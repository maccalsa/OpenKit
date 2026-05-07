import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const sourceSchema = z.object({
  name: z.string().min(1),
  specUrl: z.string().min(1),
  baseUrlTemplate: z.string().min(1),
  authProfile: z.string().optional()
});

const authProfileSchema = z
  .object({
    type: z.enum(["bearer", "apiKey", "basic", "oauth", "custom"]),
    tokenVariable: z.string().optional(),
    apiKeyVariable: z.string().optional(),
    usernameVariable: z.string().optional(),
    passwordVariable: z.string().optional(),
    headerName: z.string().optional()
  })
  .passthrough();

const configSchema = z.object({
  workspace: z.string().min(1),
  defaultEnvironment: z.string().default("default"),
  variables: z.record(z.string(), z.array(z.string()).nonempty()).default({}),
  sources: z.array(sourceSchema).min(1),
  authProfiles: z.record(z.string(), authProfileSchema).default({})
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
