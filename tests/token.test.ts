import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { regenIntellijToken } from "../src/token.js";

function nodeCommand(script: string): string {
  return `${JSON.stringify(process.execPath)} -e ${JSON.stringify(script)}`;
}

describe("regenIntellijToken", () => {
  it("writes a token from stdout to the IntelliJ private environment", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "openkit-token-"));

    const privateEnvPath = await regenIntellijToken({
      env: "dev",
      out: tempDir,
      tokenCommand: nodeCommand("console.log('fresh-token')"),
      tokenVariable: "token"
    });

    const privateEnv = JSON.parse(await readFile(privateEnvPath, "utf-8")) as Record<
      string,
      Record<string, string>
    >;
    expect(privateEnv.dev?.token).toBe("fresh-token");
  });

  it("preserves existing private environment values", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "openkit-token-"));
    const intellijDir = path.join(tempDir, "intellij");
    const privateEnvPath = path.join(intellijDir, "http-client.private.env.json");
    await mkdir(intellijDir, { recursive: true });
    await writeFile(
      privateEnvPath,
      JSON.stringify(
        {
          dev: {
            usersUrl: "https://dev-users.example.com",
            token: "old-token"
          },
          prod: {
            token: "prod-token"
          }
        },
        null,
        2
      ),
      "utf-8"
    );

    await regenIntellijToken({
      env: "dev",
      out: tempDir,
      tokenCommand: nodeCommand("console.log('new-token')"),
      tokenVariable: "token"
    });

    const privateEnv = JSON.parse(await readFile(privateEnvPath, "utf-8")) as Record<
      string,
      Record<string, string>
    >;
    expect(privateEnv.dev).toEqual({
      usersUrl: "https://dev-users.example.com",
      token: "new-token"
    });
    expect(privateEnv.prod?.token).toBe("prod-token");
  });

  it("passes the selected environment through command interpolation", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "openkit-token-"));

    const privateEnvPath = await regenIntellijToken({
      env: "preprod",
      out: tempDir,
      tokenCommand: `${nodeCommand("console.log(process.argv[1])")} {{env}}`,
      tokenVariable: "token"
    });

    const privateEnv = JSON.parse(await readFile(privateEnvPath, "utf-8")) as Record<
      string,
      Record<string, string>
    >;
    expect(privateEnv.preprod?.token).toBe("preprod");
  });
});
