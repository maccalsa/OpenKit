import { describe, expect, it } from "vitest";
import {
  generateBundleReadme,
  generateIntellijEnvironment,
  generateIntellijHttp,
  generatePostmanCollection,
  generatePostmanEnvironment
} from "../src/generators.js";
import { ApiPackConfig } from "../src/config.js";
import { ApiModel } from "../src/types.js";

const config: ApiPackConfig = {
  workspace: "internal-apis",
  sources: [
    {
      name: "users",
      url: "https://users.example.com/v3/api-docs"
    }
  ],
  environments: {
    local: {
      usersUrl: "http://localhost:8080"
    }
  },
  auth: {
    default: {
      type: "bearer",
      tokenVariable: "token"
    }
  }
};

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
    const output = generateIntellijHttp(model);
    expect(output).toContain("GET {{usersUrl}}/users/{{id}}?expand={{expand}}");
    expect(output).toContain("Authorization: Bearer {{token}}");
  });

  it("creates IntelliJ environment JSON", () => {
    const output = generateIntellijEnvironment(config);
    expect(output).toContain("\"local\"");
    expect(output).toContain("\"usersUrl\": \"http://localhost:8080\"");
  });

  it("creates Postman collection JSON", () => {
    const output = generatePostmanCollection(model);
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
