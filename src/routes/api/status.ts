import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/status")({
  server: {
    handlers: {
      GET: async () => {
        const { probeComfy } = await import("@/lib/forge/comfy.server");
        const status = await probeComfy("http://127.0.0.1:8188");
        return Response.json(status);
      },
      POST: async () => {
        const { probeComfy } = await import("@/lib/forge/comfy.server");
        const status = await probeComfy("http://127.0.0.1:8188");
        return Response.json(status);
      },
    },
  },
});
