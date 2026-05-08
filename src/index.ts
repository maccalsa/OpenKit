#!/usr/bin/env node

import { Command } from "commander";
import { loadConfig } from "./config.js";
import { generateWorkspace } from "./generate.js";
import { addIntellijLink } from "./links.js";
import { regenIntellijToken } from "./token.js";

const DEFAULT_TOKEN_COMMAND = "./script.sh {{env}}";

const program = new Command();

program
  .name("apipack")
  .description("Generate API workspace bundles from OpenAPI sources")
  .command("generate")
  .description("Generate an API workspace bundle")
  .requiredOption("-c, --config <path>", "Path to config file", "apipack.json")
  .option("-o, --out <path>", "Output directory", "./generated")
  .action(async (options: { config: string; out: string }) => {
    await generateWorkspace(options.config, options.out);
  });

program
  .command("addlink")
  .description("Create a symlink to the generated IntelliJ HTTP Client files")
  .argument("[linkPath]", "Symlink path to create", "./openkit-intellij")
  .option("-o, --out <path>", "Generated output directory", "./generated")
  .option("--force", "Replace an existing symlink that points elsewhere", false)
  .action(async (linkPath: string, options: { out: string; force: boolean }) => {
    const createdLink = await addIntellijLink({
      out: options.out,
      linkPath,
      force: options.force
    });
    console.log(`Linked ${createdLink}`);
  });

program
  .command("regenToken")
  .description("Refresh IntelliJ private env token from a token-producing command")
  .option("-c, --config <path>", "Path to config file", "apipack.json")
  .option("-e, --env <name>", "Environment name to update")
  .option("-o, --out <path>", "Generated output directory", "./generated")
  .option("--token-command <command>", "Command that prints a token to stdout")
  .option("--token-variable <name>", "HTTP Client variable name to update", "token")
  .action(
    async (options: {
      config: string;
      env?: string;
      out: string;
      tokenCommand?: string;
      tokenVariable: string;
    }) => {
      const config = await loadConfig(options.config);
      const privateEnvPath = await regenIntellijToken({
        env: options.env ?? config.defaultEnv,
        out: options.out,
        tokenCommand: options.tokenCommand ?? config.tokenCommand ?? DEFAULT_TOKEN_COMMAND,
        tokenVariable: options.tokenVariable
      });
      console.log(`Updated ${privateEnvPath}`);
    }
  );

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Command failed: ${message}`);
  process.exitCode = 1;
});
