#!/usr/bin/env node

import { Command } from "commander";
import { generateWorkspace } from "./generate.js";

const program = new Command();

program
  .name("apipack")
  .description("Generate API workspace bundles from OpenAPI sources")
  .command("generate")
  .description("Generate an API workspace bundle")
  .requiredOption("-c, --config <path>", "Path to config file", "apipack.yml")
  .option("-o, --out <path>", "Output directory", "./generated")
  .action(async (options: { config: string; out: string }) => {
    await generateWorkspace(options.config, options.out);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Generation failed: ${message}`);
  process.exitCode = 1;
});
