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

    const configPath = path.join(tempDir, "apipack.json");
    await writeFile(
      configPath,
      JSON.stringify(
        {
          workspace: "smoke-workspace",
          defaultEnv: "dev",
          envs: ["dev", "prod"],
          sources: [
            {
              name: "users",
              specUrl: "./users.openapi.json",
              baseUrlTemplate: "https://{{env}}-users.example.com"
            },
            {
              name: "orders",
              specUrl: "./users.openapi.json",
              baseUrlTemplate: "https://{{env}}-orders.example.com"
            }
          ]
        },
        null,
        2
      ),
      "utf-8"
    );

    const outDir = path.join(tempDir, "generated");
    await generateWorkspace(configPath, outDir);

    const generatedReadme = await readFile(path.join(outDir, "README.md"), "utf-8");
    const generatedHttp = await readFile(path.join(outDir, "intellij/users.http"), "utf-8");
    const generatedHttpEnv = await readFile(path.join(outDir, "intellij/http-client.env.json"), "utf-8");
    const generatedPostman = await readFile(path.join(outDir, "postman/users.collection.json"), "utf-8");
    const generatedPostmanEnvironment = await readFile(
      path.join(outDir, "postman/smoke-workspace.environment.json"),
      "utf-8"
    );

    expect(generatedReadme).toContain("# smoke-workspace Generated API Pack");
    expect(generatedHttp).toContain("GET {{usersUrl}}/users");
    expect(generatedHttpEnv).toContain("\"usersUrl\": \"https://dev-users.example.com\"");
    expect(generatedHttpEnv).toContain("\"ordersUrl\": \"https://dev-orders.example.com\"");
    expect(generatedPostman).toContain("\"schema\": \"https://schema.getpostman.com/json/collection/v2.1.0/collection.json\"");
    expect(generatedPostmanEnvironment).toContain("\"key\": \"ordersUrl\"");
    expect(generatedPostmanEnvironment).toContain("\"value\": \"https://{{env}}-orders.example.com\"");
  });
});
