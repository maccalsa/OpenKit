import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("loads and validates JSON config", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "openkit-"));
    const configPath = path.join(tempDir, "apipack.json");
    await writeFile(
      configPath,
      JSON.stringify(
        {
          workspace: "internal-apis",
          defaultEnv: "dev",
          envs: ["dev", "prod"],
          sources: [
            {
              name: "users",
              specUrl: "https://users.example.com/v3/api-docs",
              baseUrlTemplate: "https://{{env}}-users.example.com"
            }
          ]
        },
        null,
        2
      ),
      "utf-8"
    );

    const config = await loadConfig(configPath);
    expect(config.workspace).toBe("internal-apis");
    expect(config.sources).toHaveLength(1);
    expect(config.defaultEnv).toBe("dev");
    expect(config.envs).toEqual(["dev", "prod"]);
    expect(config.sources[0]?.baseUrlTemplate).toBe("https://{{env}}-users.example.com");
  });
});
