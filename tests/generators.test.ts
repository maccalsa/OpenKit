import { describe, expect, it } from "vitest";
import {
  generateBundleReadme,
  generateIntellijEnvironment,
  generateIntellijHttp,
  generatePostmanCollection,
  generatePostmanEnvironment
} from "../src/generators.js";
import { ApiPackConfig, ApiSource } from "../src/config.js";
import { ApiModel } from "../src/types.js";

const config: ApiPackConfig = {
  workspace: "internal-apis",
  defaultEnvironment: "dev",
  variables: {
    env: ["dev", "preprod", "prod"]
  },
  sources: [
    {
      name: "users",
      specUrl: "https://users.example.com/v3/api-docs",
      baseUrlTemplate: "https://{{env}}-users.example.com",
      authProfile: "bearer"
    }
  ],
  authProfiles: {
    bearer: {
      type: "bearer",
      tokenVariable: "token"
    }
  }
};
const source: ApiSource = config.sources[0] as ApiSource;

const model: ApiModel = {
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
    const output = generateIntellijHttp(model, source, config);
    expect(output).toContain("GET {{usersUrl}}/users/{{id}}?expand={{expand}}");
    expect(output).toContain("Authorization: Bearer {{token}}");
  });

  it("creates IntelliJ environment JSON", () => {
    const output = generateIntellijEnvironment(config);
    expect(output).toContain("\"dev\"");
    expect(output).toContain("\"usersUrl\": \"https://dev-users.example.com\"");
    expect(output).toContain("\"preprod\"");
  });

  it("creates Postman collection JSON", () => {
    const output = generatePostmanCollection(model, source, config);
    expect(output).toContain("\"schema\": \"https://schema.getpostman.com/json/collection/v2.1.0/collection.json\"");
    expect(output).toContain("\"raw\": \"{{usersUrl}}/users/{{id}}?expand={{expand}}\"");
  });

  it("creates Postman environment with auth variables", () => {
    const output = generatePostmanEnvironment(config, [model]);
    expect(output).toContain("\"name\": \"internal-apis.environment\"");
    expect(output).toContain("\"key\": \"token\"");
  });

  it("creates generated README content", () => {
    const output = generateBundleReadme(config, [model]);
    expect(output).toContain("# internal-apis Generated API Pack");
    expect(output).toContain("- users (1 endpoints)");
  });
});
