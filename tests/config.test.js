import { mkdtemp, writeFile } from "node:fs/promises";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../dist/config.js";

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
    assert.equal(config.workspace, "internal-apis");
    assert.equal(config.sources.length, 1);
    assert.equal(config.defaultEnv, "dev");
    assert.deepEqual(config.envs, ["dev", "prod"]);
    assert.equal(config.sources[0]?.baseUrlTemplate, "https://{{env}}-users.example.com");
  });
});
