import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/queue")({
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
      GET: async () => Response.json({ ok: true, hint: "POST workflow" }),
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            workflow?: Record<string, unknown>;
            images?: { filename: string; dataUrl: string }[];
            clientId?: string;
            embedName?: string;
            uiWorkflow?: unknown;
          };
          if (!body.workflow || typeof body.workflow !== "object") {
            return Response.json({ ok: false, message: "No workflow" });
          }
          const { uploadToComfy, queuePrompt, saveUserWorkflow } = await import("@/lib/forge/comfy.server");
          const { rewireLoadImages } = await import("@/lib/forge/workflows");
          const base = "http://127.0.0.1:8188";
          for (const img of body.images ?? []) {
            const name = await uploadToComfy(base, img.dataUrl, img.filename);
            rewireLoadImages(
              body.workflow as Record<string, { class_type?: string; inputs?: Record<string, unknown> }>,
              { [img.filename]: name },
            );
          }
          const { promptId } = await queuePrompt(base, body.workflow, body.clientId || "forge-lan");
          if (body.embedName && body.uiWorkflow) {
            try {
              await saveUserWorkflow(base, `${body.embedName}.json`, body.uiWorkflow);
            } catch {
              /* optional */
            }
          }
          return Response.json({ ok: true, promptId });
        } catch (err) {
          return Response.json({
            ok: false,
            message: err instanceof Error ? err.message : "Queue failed",
          });
        }
      },
    },
  },
});
