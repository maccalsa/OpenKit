import { exec } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

interface RegenIntellijTokenOptions {
  env: string;
  out: string;
  tokenCommand: string;
  tokenVariable: string;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function interpolateCommand(command: string, environmentName: string): string {
  return command.replaceAll("{{env}}", shellQuote(environmentName));
}

function parsePrivateEnvironment(content: string, filePath: string): Record<string, Record<string, string>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Invalid JSON private environment file: ${filePath}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Private environment file must contain a JSON object: ${filePath}`);
  }

  return parsed as Record<string, Record<string, string>>;
}

function extractToken(stdout: string): string {
  const token = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);

  if (!token || token === "null") {
    throw new Error("Token command did not print a token to stdout");
  }

  return token;
}

async function readPrivateEnvironment(filePath: string): Promise<Record<string, Record<string, string>>> {
  try {
    return parsePrivateEnvironment(await readFile(filePath, "utf-8"), filePath);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export async function regenIntellijToken(options: RegenIntellijTokenOptions): Promise<string> {
  const intellijDir = path.join(path.resolve(options.out), "intellij");
  const privateEnvPath = path.join(intellijDir, "http-client.private.env.json");
  const command = interpolateCommand(options.tokenCommand, options.env);
  const { stdout } = await execAsync(command, { cwd: process.cwd(), maxBuffer: 1024 * 1024 });
  const token = extractToken(stdout);

  await mkdir(intellijDir, { recursive: true });
  const privateEnvironment = await readPrivateEnvironment(privateEnvPath);
  const environmentValues = privateEnvironment[options.env] ?? {};
  privateEnvironment[options.env] = {
    ...environmentValues,
    [options.tokenVariable]: token
  };

  await writeFile(privateEnvPath, `${JSON.stringify(privateEnvironment, null, 2)}\n`, "utf-8");
  return privateEnvPath;
}
