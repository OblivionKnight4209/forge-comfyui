import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const baseSchema = z.object({ baseUrl: z.string().min(1) });

export const probeComfyFn = createServerFn({ method: "POST" })
  .validator(baseSchema)
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
      baseUrl: z.string().min(1),
      workflow: z.record(z.string(), z.unknown()),
      images: z.array(z.object({ filename: z.string(), dataUrl: z.string() })),
      clientId: z.string(),
      embedName: z.string(),
      uiWorkflow: z.record(z.string(), z.unknown()),
    }),
  )
  .handler(async ({ data }) => {
    const comfy = await import("./comfy.server");
    const status = await comfy.probeComfy(data.baseUrl);
    if (!status.ok) {
      return { ok: false as const, message: status.message };
    }
    const uploaded: string[] = [];
    for (const img of data.images) {
      const name = await comfy.uploadToComfy(data.baseUrl, img.dataUrl, img.filename);
      uploaded.push(name);
    }
    const prompt = structuredClone(data.workflow) as Record<
      string,
      { inputs?: Record<string, unknown> }
    >;
    let i = 0;
    for (const node of Object.values(prompt)) {
      if (
        node.inputs &&
        typeof node.inputs.image === "string" &&
        node.inputs.image.startsWith("forge_")
      ) {
        node.inputs.image = uploaded[i] ?? node.inputs.image;
        i += 1;
      }
    }
    const { promptId } = await comfy.queuePrompt(data.baseUrl, prompt, data.clientId);
    await comfy.saveUserWorkflow(data.baseUrl, `${data.embedName}.json`, data.uiWorkflow);
    return { ok: true as const, promptId };
  });

export const pollComfyFn = createServerFn({ method: "POST" })
  .validator(z.object({ baseUrl: z.string(), promptId: z.string() }))
  .handler(async ({ data }) => {
    const comfy = await import("./comfy.server");
    const hist = await comfy.readHistory(data.baseUrl, data.promptId);
    if (!hist.ready) return { ready: false as const };
    const first = hist.files[0];
    if (!first) return { ready: false as const };
    const file = await comfy.viewFile(data.baseUrl, first);
    return { ready: true as const, dataUrl: file.dataUrl, mime: file.mime };
  });
