import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const sourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().min(1)
});

const environmentSchema = z.record(z.string(), z.string());

const authSchema = z
  .object({
    type: z.string(),
    tokenVariable: z.string().optional()
  })
  .passthrough();

const configSchema = z.object({
  workspace: z.string().min(1),
  sources: z.array(sourceSchema).min(1),
  environments: z.record(z.string(), environmentSchema).default({}),
  auth: z.record(z.string(), authSchema).default({})
});

export type ApiPackConfig = z.infer<typeof configSchema>;
export type ApiSource = z.infer<typeof sourceSchema>;

export async function loadConfig(configPath: string): Promise<ApiPackConfig> {
  const absolutePath = path.resolve(configPath);
  const configText = await readFile(absolutePath, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(configText);
  } catch {
    throw new Error(`Invalid JSON config file: ${absolutePath}`);
  }
  return configSchema.parse(parsed);
}
