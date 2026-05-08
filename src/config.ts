import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const sourceSchema = z.object({
  name: z.string().min(1),
  specUrl: z.string().min(1),
  baseUrlTemplate: z.string().min(1)
});

const configSchema = z.object({
  workspace: z.string().min(1),
  defaultEnv: z.string().min(1).default("dev"),
  tokenCommand: z.string().min(1).optional(),
  envs: z.array(z.string().min(1)).nonempty().default(["dev"]),
  sources: z.array(sourceSchema).min(1)
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
