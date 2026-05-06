import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("loads and validates YAML config", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "openkit-"));
    const configPath = path.join(tempDir, "apipack.yml");
    await writeFile(
      configPath,
      [
        "workspace: internal-apis",
        "sources:",
        "  - name: users",
        "    url: https://users.example.com/v3/api-docs",
        "environments:",
        "  dev:",
        "    usersUrl: https://dev-users.example.com"
      ].join("\n"),
      "utf-8"
    );

    const config = await loadConfig(configPath);
    expect(config.workspace).toBe("internal-apis");
    expect(config.sources).toHaveLength(1);
    expect(config.environments.dev.usersUrl).toBe("https://dev-users.example.com");
  });
});
