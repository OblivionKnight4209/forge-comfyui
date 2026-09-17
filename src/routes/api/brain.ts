import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/brain")({
  server: {
    handlers: {
      GET: async () => {
        const { listOllamaModels } = await import("@/lib/forge/ollama.server");
        const { pickBrainModel } = await import("@/lib/forge/brain");
        const models = await listOllamaModels();
        const model = pickBrainModel(models);
        return Response.json({ ok: Boolean(model), model, models });
      },
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          prompt?: string;
          flavor?: string;
          wrap?: string;
          checkpoint?: string;
          fresh?: boolean;
          seed?: number;
          nsfwMode?: boolean;
          cast?: string;
        };
        const { runBrain } = await import("@/lib/forge/ollama.server");
        const result = await runBrain({
          prompt: body.prompt || "",
          flavor: body.flavor,
          wrap: body.wrap,
          checkpoint: body.checkpoint,
          fresh: body.fresh,
          seed: body.seed,
          nsfwMode: body.nsfwMode,
          cast: body.cast,
        });
        return Response.json(result);
      },
    },
  },
});
