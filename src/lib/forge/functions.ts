import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const probeComfyFn = createServerFn({ method: "POST" })
  .validator(z.object({ baseUrl: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { probeComfy } = await import("./comfy.server");
    return probeComfy(data.baseUrl);
  });

export const lanInfoFn = createServerFn({ method: "GET" }).handler(async () => {
  const { listLanIpv4 } = await import("./comfy.server");
  return { port: 8080, addresses: listLanIpv4() };
});

export const queueComfyFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      baseUrl: z.string(),
      workflow: z.record(z.string(), z.unknown()),
      images: z.array(z.object({ filename: z.string(), dataUrl: z.string() })),
      clientId: z.string(),
      embedName: z.string(),
      uiWorkflow: z.unknown(),
    }),
  )
  .handler(async ({ data }) => {
    const { uploadToComfy, queuePrompt, saveUserWorkflow } = await import("./comfy.server");
    try {
      const { rewireLoadImages, stripBrokenLoraNodes } = await import("./workflows");
      for (const img of data.images) {
        const name = await uploadToComfy(data.baseUrl, img.dataUrl, img.filename);
        rewireLoadImages(
          data.workflow as Record<string, { class_type?: string; inputs?: Record<string, unknown> }>,
          { [img.filename]: name },
        );
      }
      stripBrokenLoraNodes(data.workflow as import("./workflows").ApiPrompt);
      const { promptId } = await queuePrompt(
        data.baseUrl,
        data.workflow as Record<string, unknown>,
        data.clientId,
      );
      try {
        await saveUserWorkflow(data.baseUrl, `${data.embedName}.json`, data.uiWorkflow);
      } catch {
        /* optional */
      }
      return { ok: true as const, promptId };
    } catch (err) {
      return { ok: false as const, message: err instanceof Error ? err.message : "Queue failed" };
    }
  });

export const pollComfyFn = createServerFn({ method: "POST" })
  .validator(z.object({ baseUrl: z.string(), promptId: z.string() }))
  .handler(async ({ data }) => {
    const { readHistory } = await import("./comfy.server");
    const hist = await readHistory(data.baseUrl, data.promptId);
    if ("error" in hist && hist.error) {
      return { ready: false as const, error: hist.error, log: hist.log ?? "", progress: 0 };
    }
    if (!hist.ready) {
      return { ready: false as const, progress: hist.progress ?? 10, log: "log" in hist ? String(hist.log ?? "") : "" };
    }
    const views: { dataUrl: string; kind: "image" | "video"; filename: string }[] = [];
    for (const file of hist.files.slice(0, 8)) {
      const folder = file.type === "input" ? "input" : "output";
      const media = `/forge-media?folder=${folder}&name=${encodeURIComponent(file.filename)}`;
      const video = /\.(mp4|webm|gif|mov|m4v)$/i.test(file.filename);
      views.push({
        dataUrl: media,
        kind: video ? "video" : "image",
        filename: file.filename,
      });
    }
    const first = views[0];
    if (!first) {
      return { ready: true as const, progress: 100, tags: hist.tags, dataUrl: "", kind: "image" as const, extras: [] };
    }
    return {
      ready: true as const,
      progress: 100,
      dataUrl: first.dataUrl,
      filename: first.filename,
      folder: (hist.files[0]?.type === "input" ? "input" : "output") as "input" | "output",
      kind: first.kind,
      tags: hist.tags,
      extras: views.slice(1),
    };
  });

export const expandDiskWildcardsFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      prompt: z.string(),
      seed: z.number(),
      extra: z.array(z.object({ name: z.string(), lines: z.array(z.string()) })),
    }),
  )
  .handler(async ({ data }) => {
    const { expandWithDiskWildcards } = await import("./comfy.server");
    const { expandPrompt } = await import("./wildcards");
    const files = expandWithDiskWildcards(data.prompt, data.seed, data.extra);
    return expandPrompt(data.prompt, files, data.seed);
  });

export const peekWildcardFn = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { readWildcardLines } = await import("./comfy.server");
    const lines = readWildcardLines(data.name);
    return { name: data.name, total: lines.length, preview: lines.slice(0, 16) };
  });

export const tagWithWd14Fn = createServerFn({ method: "POST" })
  .validator(z.object({ baseUrl: z.string().min(1), dataUrl: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { tagImageWd14 } = await import("./comfy.server");
    return tagImageWd14(data.baseUrl, data.dataUrl);
  });

export const shredComfyFn = createServerFn({ method: "POST" })
  .validator(z.object({ folder: z.enum(["input", "output"]), name: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { shredComfyFile } = await import("./comfy.server");
    return shredComfyFile(data.folder, data.name);
  });

export const comfyMediaFn = createServerFn({ method: "POST" })
  .validator(z.object({ folder: z.enum(["input", "output"]), name: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { readComfyMedia } = await import("./comfy.server");
    const file = readComfyMedia(data.folder, data.name);
    if (!file) return { ok: false as const, message: "not found" };
    return {
      ok: true as const,
      mime: file.mime,
      dataUrl: `data:${file.mime};base64,${file.bytes.toString("base64")}`,
    };
  });

export const listComfyRecentFn = createServerFn({ method: "POST" })
  .validator(z.object({ all: z.boolean().optional() }).optional())
  .handler(async ({ data }) => {
    const { listComfyRecent } = await import("./comfy.server");
    return listComfyRecent({ all: data?.all === true });
  });

export const listWorkflowsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { listUserWorkflows } = await import("./comfy.server");
  return listUserWorkflows().map((w) => w.name);
});

export const queueSavedWorkflowFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      baseUrl: z.string(),
      name: z.string(),
      prompt: z.string(),
      negative: z.string(),
      seed: z.number(),
      image: z.object({ filename: z.string(), dataUrl: z.string() }).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { queueSavedWorkflow } = await import("./comfy.server");
    return queueSavedWorkflow(data.baseUrl, data.name, {
      prompt: data.prompt,
      negative: data.negative,
      seed: data.seed,
      image: data.image,
    });
  });

export const probeOllamaFn = createServerFn({ method: "POST" })
  .validator(z.object({ baseUrl: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { probeOllama } = await import("./ollama.server");
    return probeOllama(data.baseUrl);
  });

export const writeLlmIdeasFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      baseUrl: z.string(),
      model: z.string(),
      existing: z.string(),
      flavor: z.string(),
      family: z.string(),
      checkpoint: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const { writeLlmIdeas } = await import("./ollama.server");
    return writeLlmIdeas(data);
  });

export const writeStoryFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      baseUrl: z.string(),
      model: z.string(),
      scene: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const { writeStory } = await import("./ollama.server");
    return writeStory(data);
  });

export const appendPromptFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      mode: z.string(),
      prompt: z.string(),
      negative: z.string(),
      seed: z.number(),
      checkpoint: z.string(),
      loras: z.array(z.string()),
    }),
  )
  .handler(async ({ data }) => {
    const { appendPrompt } = await import("./history.server");
    appendPrompt({ at: new Date().toISOString(), ...data });
    return { ok: true };
  });

export const listPromptsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { listPrompts, historyLocation } = await import("./history.server");
  return { path: historyLocation(), items: listPrompts(80) };
});

export const loadTasteFn = createServerFn({ method: "GET" }).handler(async () => {
  const { readTaste } = await import("./taste.server");
  return readTaste();
});

export const voteTasteFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
      jobId: z.string().optional(),
      vote: z.enum(["up", "down"]),
      checkpoint: z.string(),
      loras: z.array(z.string()),
      prompt: z.string(),
      seed: z.number(),
      reason: z.enum(["deformed", "wrong", "ugly", "other"]).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { recordTasteVote } = await import("./taste.server");
    return recordTasteVote({ ...data, at: Date.now() });
  });

export const resetTasteFn = createServerFn({ method: "POST" }).handler(async () => {
  const { resetTaste } = await import("./taste.server");
  return resetTaste();
});
