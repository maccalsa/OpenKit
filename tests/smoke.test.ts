import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateWorkspace } from "../src/generate.js";

describe("generateWorkspace", () => {
  it("generates the expected output bundle from local fixture source", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "openkit-smoke-"));
    const fixtureSource = path.resolve("fixtures/users.openapi.json");
    const fixtureTarget = path.join(tempDir, "users.openapi.json");
    const fixtureText = await readFile(fixtureSource, "utf-8");
    await writeFile(fixtureTarget, fixtureText, "utf-8");

    const configPath = path.join(tempDir, "apipack.yml");
    await writeFile(
      configPath,
      [
        "workspace: smoke-workspace",
        "sources:",
        "  - name: users",
        "    url: ./users.openapi.json",
        "environments:",
        "  local:",
        "    usersUrl: http://localhost:8080"
      ].join("\n"),
      "utf-8"
    );

    const outDir = path.join(tempDir, "generated");
    await generateWorkspace(configPath, outDir);

    const generatedReadme = await readFile(path.join(outDir, "README.md"), "utf-8");
    const generatedHttp = await readFile(path.join(outDir, "intellij/users.http"), "utf-8");
    const generatedPostman = await readFile(path.join(outDir, "postman/users.collection.json"), "utf-8");

    expect(generatedReadme).toContain("# smoke-workspace Generated API Pack");
    expect(generatedHttp).toContain("GET {{usersUrl}}/users");
    expect(generatedPostman).toContain("\"schema\": \"https://schema.getpostman.com/json/collection/v2.1.0/collection.json\"");
  });
});
