import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/generate")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET,POST,OPTIONS",
            "access-control-allow-headers": "content-type",
          },
        }),
      GET: async () => Response.json({ ok: true, hint: "POST a prompt" }),
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { runGenerateIntent } = await import("@/lib/forge/generate.server");
          const result = await runGenerateIntent(body);
          return Response.json(result);
        } catch (err) {
          return Response.json({
            ok: false,
            message: err instanceof Error ? err.message : "Generate failed",
          });
        }
      },
    },
  },
});
