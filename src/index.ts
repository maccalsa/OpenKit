#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { loadConfig } from "./config.js";

async function runGenerate(configPath: string, outputPath: string): Promise<void> {
  const config = await loadConfig(configPath);
  const outputDir = path.resolve(outputPath);
  await mkdir(outputDir, { recursive: true });

  const readmeLines = [
    `# ${config.workspace} API Pack`,
    "",
    "This generated bundle is produced by OpenKit.",
    "",
    "## Sources",
    ...config.sources.map((source) => `- ${source.name}: ${source.url}`)
  ];

  await writeFile(path.join(outputDir, "README.md"), `${readmeLines.join("\n")}\n`, "utf-8");
}

const program = new Command();

program
  .name("apipack")
  .description("Generate API workspace bundles from OpenAPI sources")
  .command("generate")
  .description("Generate an API workspace bundle")
  .requiredOption("-c, --config <path>", "Path to config file", "apipack.yml")
  .option("-o, --out <path>", "Output directory", "./generated")
  .action(async (options: { config: string; out: string }) => {
    await runGenerate(options.config, options.out);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Generation failed: ${message}`);
  process.exitCode = 1;
});
