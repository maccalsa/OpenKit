import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateBundleReadme,
  generateIntellijEnvironment,
  generateIntellijHttp,
  generatePostmanCollection,
  generatePostmanEnvironment
} from "../dist/generators.js";

const config = {
  workspace: "internal-apis",
  defaultEnv: "dev",
  envs: ["dev", "preprod", "prod"],
  sources: [
    {
      name: "users",
      specUrl: "https://users.example.com/v3/api-docs",
      baseUrlTemplate: "https://{{env}}-users.example.com"
    }
  ]
};

const source = config.sources[0];

const model = {
  sourceName: "users",
  title: "Users API",
  servers: ["https://users.example.com"],
  authSchemes: [
    {
      key: "bearerAuth",
      type: "http",
      scheme: "bearer"
    }
  ],
  endpoints: [
    {
      path: "/users/{id}",
      method: "get",
      operationId: "getUser",
      summary: "Get user",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true
        },
        {
          name: "expand",
          in: "query",
          required: false
        }
      ],
      authSchemes: ["bearerAuth"]
    }
  ]
};

describe("generators", () => {
  it("creates IntelliJ HTTP requests with placeholders", () => {
    const output = generateIntellijHttp(model, source);
    assert.match(output, /GET \{\{usersUrl\}\}\/users\/\{\{id\}\}\?expand=\{\{expand\}\}/);
    assert.match(output, /Authorization: Bearer \{\{token\}\}/);
  });

  it("creates IntelliJ environment JSON", () => {
    const output = generateIntellijEnvironment(config, [model]);
    assert.match(output, /"dev"/);
    assert.match(output, /"usersUrl": "https:\/\/dev-users\.example\.com"/);
    assert.match(output, /"preprod"/);
    assert.match(output, /"usersUrl": "https:\/\/preprod-users\.example\.com"/);
  });

  it("creates Postman collection JSON", () => {
    const output = generatePostmanCollection(model, source);
    assert.match(output, /"schema": "https:\/\/schema\.getpostman\.com\/json\/collection\/v2\.1\.0\/collection\.json"/);
    assert.match(output, /"raw": "\{\{usersUrl\}\}\/users\/\{\{id\}\}\?expand=\{\{expand\}\}"/);
  });

  it("creates Postman environment with auth variables", () => {
    const output = generatePostmanEnvironment(config, [model]);
    assert.match(output, /"name": "internal-apis\.environment"/);
    assert.match(output, /"key": "token"/);
    assert.match(output, /"key": "usersUrl"/);
    assert.match(output, /"value": "https:\/\/\{\{env\}\}-users\.example\.com"/);
  });

  it("creates generated README content", () => {
    const output = generateBundleReadme(config, [model]);
    assert.match(output, /# internal-apis Generated API Pack/);
    assert.match(output, /- users \(1 endpoints\)/);
  });
});
