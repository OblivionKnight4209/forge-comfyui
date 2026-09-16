import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
// @ts-expect-error JS plugin alongside the TS vite config
import { grokPwaPlugin } from "./scripts/grok-pwa-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { appEnvPlugin } from "./scripts/app-env-plugin.mjs";
import { isMigrationFile } from "./scripts/migration-plan.mjs";

/** The files `src/lib/db.ts` globs — same directory, same non-recursive scope. */
function hasGlobbedMigrations(root: string): boolean {
  try {
    return readdirSync(join(root, "migrations")).some(isMigrationFile);
  } catch {
    return false;
  }
}

function isAbortReason(reason: unknown) {
  const msg = reason instanceof Error ? `${reason.name} ${reason.message}` : String(reason ?? "");
  const cause =
    reason && typeof reason === "object" && "cause" in reason
      ? isAbortReason((reason as { cause: unknown }).cause)
      : false;
  return cause || /AbortError|This operation was aborted|aborted/i.test(msg);
}

function quietAbortPlugin(): Plugin {
  return {
    name: "forge-quiet-abort",
    configureServer() {
      process.on("unhandledRejection", (reason) => {
        if (isAbortReason(reason)) return;
      });
    },
  };
}

/**
 * Finish PGLite bootstrap during dev-server setup (before traffic). Vite awaits
 * async `configureServer` hooks. Production: `src/lib/db` kicks `ensureDbReady`
 * on import.
 *
 * Vite awaiting the hook puts this on time-to-first-render, so an app with no
 * migrations — no schema to apply — skips it entirely rather than paying for a
 * PGLite instance it never queries.
 */
function pgliteBootstrapPlugin(): Plugin {
  return {
    name: "app-builder:pglite-bootstrap",
    apply: "serve",
    async configureServer(server) {
      if (!hasGlobbedMigrations(server.config.root)) return;
      try {
        const mod = (await server.ssrLoadModule("/src/lib/db.ts")) as {
          ensureDbReady?: () => Promise<void>;
        };
        if (typeof mod.ensureDbReady === "function") {
          await mod.ensureDbReady();
        }
      } catch (err) {
        console.error("[app-builder] DB bootstrap failed:", err);
        throw err;
      }
    },
  };
}

/**
 * Live-preview OAuth popup — handled HERE so the agent never has to create a
 * `/auth/popup` route (and cannot break it by scaffolding a React page that
 * paints the full app shell in the popup).
 *
 * `signIn` (client.ts) opens `/auth/popup?providerId=…` in a top-level window.
 * This middleware runs before TanStack Start, calls `handleAuthPopupRequest`,
 * and returns the 302 / completion HTML. Deployed apps do not use the popup
 * (full-page OAuth redirect), so `apply: "serve"` is enough.
 */
function authPopupPlugin(): Plugin {
  return {
    name: "app-builder:auth-popup",
    apply: "serve",
    configureServer(server) {
      // Register immediately (not in a returned post-hook) so we run BEFORE
      // TanStack Start / the SPA HTML fallback. A model-authored
      // `src/routes/auth/popup.tsx` React page must never win this path.
      server.middlewares.use(async (req, res, next) => {
        try {
          const rawUrl = req.url ?? "";
          const pathOnly = rawUrl.split("?", 1)[0] ?? "";
          if (pathOnly !== "/auth/popup") {
            next();
            return;
          }
          if ((req.method ?? "GET").toUpperCase() !== "GET") {
            res.statusCode = 405;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("Method Not Allowed");
            return;
          }

          const host = String(
            req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:8080",
          );
          const proto = String(
            req.headers["x-forwarded-proto"] ??
              ((req.socket as { encrypted?: boolean } | undefined)?.encrypted ? "https" : "http"),
          );
          const requestHeaders = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (value === undefined) continue;
            if (Array.isArray(value)) {
              for (const v of value) requestHeaders.append(key, v);
            } else {
              requestHeaders.set(key, value);
            }
          }
          // Ensure Host is the public preview host so Better Auth's dynamic
          // baseURL / redirect_uri match the popup origin.
          if (!requestHeaders.has("host")) requestHeaders.set("host", host);

          const request = new Request(`${proto}://${host}${rawUrl}`, {
            method: "GET",
            headers: requestHeaders,
          });

          const mod = (await server.ssrLoadModule("/src/lib/auth/popup.server.ts")) as {
            handleAuthPopupRequest: (req: Request) => Promise<Response>;
          };
          const response = await mod.handleAuthPopupRequest(request);

          res.statusCode = response.status;
          // Preserve multiple Set-Cookie headers (OAuth state + session).
          const setCookies =
            typeof response.headers.getSetCookie === "function"
              ? response.headers.getSetCookie()
              : [];
          response.headers.forEach((value, key) => {
            if (key.toLowerCase() === "set-cookie") return;
            res.setHeader(key, value);
          });
          for (const cookie of setCookies) {
            res.appendHeader("set-cookie", cookie);
          }
          const body = Buffer.from(await response.arrayBuffer());
          res.end(body);
        } catch (err) {
          console.error("[app-builder] /auth/popup handler failed:", err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("auth popup failed");
          }
        }
      });
    },
  };
}

function readReqBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function forgeMediaPlugin(): Plugin {
  const liveJobs: {
    id: string;
    createdAt: number;
    mode: string;
    prompt: string;
    seed: number;
    status: string;
    error?: string;
    resultName?: string;
    resultFolder?: string;
    resultKind: string;
    promptId?: string;
    checkpoint?: string;
    progress?: number;
    log?: string;
  }[] = [];
  return {
    name: "forge-comfy-media",
    apply: "serve",
    configureServer(server) {
      const handler = async (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse, next: () => void) => {
        const raw = req.url ?? "";
        const pathOnly = (raw.split("?", 1)[0] ?? "").replace(/\/$/, "") || "/";
        const cors = () => {
          res.setHeader("access-control-allow-origin", "*");
          res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
          res.setHeader("access-control-allow-headers", "content-type");
        };
        if (pathOnly === "/forge-api/ping") {
          cors();
          res.statusCode = 200;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ ok: true, forge: "queue" }));
          return;
        }
        if (
          pathOnly === "/forge-api/status" ||
          pathOnly === "/forge-api/queue" ||
          pathOnly === "/forge-api/generate" ||
          pathOnly === "/forge-api/history" ||
          pathOnly === "/forge-api/live" ||
          pathOnly === "/forge-api/recent" ||
          pathOnly === "/forge-api/sound"
        ) {
          cors();
          if ((req.method ?? "GET").toUpperCase() === "OPTIONS") {
            res.statusCode = 204;
            res.end();
            return;
          }
          try {
            const mod = (await server.ssrLoadModule("/src/lib/forge/comfy.server.ts")) as {
              probeComfy: (base: string) => Promise<unknown>;
              uploadToComfy: (base: string, dataUrl: string, filename: string) => Promise<string>;
              queuePrompt: (
                base: string,
                prompt: Record<string, unknown>,
                clientId: string,
              ) => Promise<{ promptId: string }>;
              saveUserWorkflow: (base: string, filename: string, json: unknown) => Promise<void>;
              readHistory: (base: string, promptId: string) => Promise<unknown>;
              viewFile: (
                base: string,
                file: { filename: string; subfolder: string; type: string },
              ) => Promise<{ mime: string; dataUrl: string }>;
              listComfyRecent: (opts?: { all?: boolean }) => { folder: "input" | "output"; name: string; mtime: number }[];
              addSoundToClip: (name: string, spoken: string) => { name: string } | { error: string };
            };
            const base = "http://127.0.0.1:8188";
            if (pathOnly === "/forge-api/live") {
              if ((req.method ?? "GET").toUpperCase() === "POST") {
                const body = JSON.parse(await readReqBody(req)) as { job?: (typeof liveJobs)[number] };
                if (body.job?.id) {
                  const i = liveJobs.findIndex((j) => j.id === body.job!.id);
                  if (i === -1) liveJobs.unshift(body.job);
                  else liveJobs[i] = { ...liveJobs[i], ...body.job };
                  liveJobs.sort((a, b) => b.createdAt - a.createdAt);
                  if (liveJobs.length > 40) liveJobs.length = 40;
                }
              }
              res.statusCode = 200;
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify({ jobs: liveJobs }));
              return;
            }
            if (pathOnly === "/forge-api/recent") {
              const files = mod.listComfyRecent({ all: true });
              res.statusCode = 200;
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify({ files }));
              return;
            }
            if (pathOnly === "/forge-api/sound") {
              if ((req.method ?? "GET").toUpperCase() !== "POST") {
                res.statusCode = 405;
                res.end("POST only");
                return;
              }
              const body = JSON.parse(await readReqBody(req)) as { name?: string; text?: string };
              const result = mod.addSoundToClip(body.name || "", body.text || "");
              res.statusCode = 200;
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify(result));
              return;
            }
            if (pathOnly === "/forge-api/status") {
              const status = await mod.probeComfy(base);
              res.statusCode = 200;
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify(status));
              return;
            }
            if (pathOnly === "/forge-api/history") {
              const u = new URL(raw, "http://127.0.0.1");
              const id = u.searchParams.get("id") ?? "";
              const hist = await mod.readHistory(base, id);
              res.statusCode = 200;
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify(hist));
              return;
            }
            if (pathOnly === "/forge-api/generate") {
              if ((req.method ?? "GET").toUpperCase() !== "POST") {
                res.statusCode = 200;
                res.setHeader("content-type", "application/json");
                res.end(JSON.stringify({ ok: true, hint: "POST a prompt" }));
                return;
              }
              const gen = (await server.ssrLoadModule("/src/lib/forge/generate.server.ts")) as {
                runGenerateIntent: (body: unknown) => Promise<{ ok: boolean; message?: string; promptId?: string }>;
              };
              const body = JSON.parse(await readReqBody(req));
              const result = await gen.runGenerateIntent(body);
              console.log("[forge-api] generate", result.ok, result.promptId || result.message);
              res.statusCode = 200;
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify(result));
              return;
            }
            if (pathOnly === "/forge-api/queue") {
              if ((req.method ?? "GET").toUpperCase() !== "POST") {
                res.statusCode = 405;
                res.end("POST only");
                return;
              }
              const body = JSON.parse(await readReqBody(req)) as {
                workflow: Record<string, unknown>;
                images?: { filename: string; dataUrl: string }[];
                clientId?: string;
                embedName?: string;
                uiWorkflow?: unknown;
              };
              for (const img of body.images ?? []) {
                const name = await mod.uploadToComfy(base, img.dataUrl, img.filename);
                for (const node of Object.values(body.workflow) as {
                  class_type?: string;
                  inputs?: Record<string, unknown>;
                }[]) {
                  if (node.class_type === "LoadImage" && node.inputs && node.inputs.image === img.filename) {
                    node.inputs.image = name;
                  }
                }
              }
              const { promptId } = await mod.queuePrompt(base, body.workflow, body.clientId || "forge-lan");
              console.log("[forge-api] queued", promptId);
              if (body.embedName && body.uiWorkflow) {
                try {
                  await mod.saveUserWorkflow(base, `${body.embedName}.json`, body.uiWorkflow);
                } catch {
                  /* optional */
                }
              }
              res.statusCode = 200;
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify({ ok: true, promptId }));
              return;
            }
          } catch (err) {
            console.error("[forge-api]", err);
            res.statusCode = 500;
            res.setHeader("content-type", "application/json");
            res.end(
              JSON.stringify({
                ok: false,
                message: err instanceof Error ? err.message : "forge-api failed",
              }),
            );
            return;
          }
        }
        if (pathOnly !== "/forge-media") {
          next();
          return;
        }
        cors();
        try {
          const u = new URL(raw, "http://127.0.0.1");
          const folder = u.searchParams.get("folder") === "input" ? "input" : "output";
          const name = u.searchParams.get("name") ?? "";
          const mod = (await server.ssrLoadModule("/src/lib/forge/comfy.server.ts")) as {
            readComfyMedia: (
              f: "input" | "output",
              n: string,
            ) => { mime: string; bytes: Buffer } | null;
          };
          const file = mod.readComfyMedia(folder, name);
          if (!file) {
            res.statusCode = 404;
            res.end("not found");
            return;
          }
          res.statusCode = 200;
          res.setHeader("content-type", file.mime);
          res.setHeader("cache-control", "no-store");
          res.end(file.bytes);
        } catch (err) {
          console.error("[forge] /forge-media", err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end("media failed");
          }
        }
      };
      return () => {
        server.middlewares.stack.unshift({ route: "", handle: handler });
      };
    },
  };
}

// `0.0.0.0:8080` is the live-preview contract — don't change host/port.
// The dev server starts once `src/router.tsx` and `src/routes/` exist — see
// AGENTS.md § "First scaffold".
export default defineConfig(({ command, isPreview }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
    allowedHosts: true,
    cors: true,
    hmr: {
      clientPort: 8080,
    },
    proxy: {
      "/comfy-proxy": {
        target: "http://127.0.0.1:8188",
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/comfy-proxy/, "") || "/",
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("host", "127.0.0.1:8188");
            proxyReq.setHeader("origin", "http://127.0.0.1:8188");
            proxyReq.setHeader("referer", "http://127.0.0.1:8188/");
          });
          proxy.on("proxyRes", (proxyRes, req) => {
            const u = req.url || "";
            if (/\.mp4(\b|$)/i.test(u) || /filename=.*\.mp4/i.test(decodeURIComponent(u))) {
              proxyRes.headers["content-type"] = "video/mp4";
            } else if (/\.webm(\b|$)/i.test(u)) {
              proxyRes.headers["content-type"] = "video/webm";
            }
          });
        },
      },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: true,
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    quietAbortPlugin(),
    pgliteBootstrapPlugin(),
    // Before tanstackStart so /auth/popup never falls through to the SPA.
    authPopupPlugin(),
    forgeMediaPlugin(),
    // Dev-only /__app-env, read by scripts/check-auth-invariant.mjs.
    appEnvPlugin(),
    // PWA head + ?install=1 tutorial page; runs before Start/Nitro.
    grokPwaPlugin(),
    tailwindcss(),
    tanstackStart(),
    ...(command === "build" || isPreview
      ? [
          nitro({
            preset: "vercel",
            // Auto-registers server/middleware/* (the PWA install page +
            // manifest + head-tag middleware). Nitro v3 defaults serverDir to
            // false, so removing this silently unwires /?install=1 on deploys.
            serverDir: "./server",
          }),
        ]
      : []),
    viteReact(),
  ],
}));
