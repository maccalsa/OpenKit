import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverSpecUrl, fetchSpecDocument, parseOpenApiDocument } from "../src/openapi.js";

function createJsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json"
    }
  });
}

function createYamlResponse(payload: string): Response {
  return new Response(payload, {
    status: 200,
    headers: {
      "content-type": "application/yaml"
    }
  });
}

describe("discoverSpecUrl", () => {
  it("returns direct spec URLs without discovery", async () => {
    const specUrl = await discoverSpecUrl("https://users.example.com/v3/api-docs");
    expect(specUrl).toBe("https://users.example.com/v3/api-docs");
  });

  it("extracts spec URL from Swagger UI HTML", async () => {
    const calls: string[] = [];
    const fetchMock = async (url: string): Promise<Response> => {
      calls.push(url);
      return new Response('<script>window.ui = SwaggerUIBundle({ url: "/v3/api-docs" })</script>', {
        status: 200,
        headers: {
          "content-type": "text/html"
        }
      });
    };

    const discovered = await discoverSpecUrl("https://users.example.com/swagger-ui/index.html", fetchMock);
    expect(discovered).toBe("https://users.example.com/v3/api-docs");
    expect(calls).toHaveLength(1);
  });
});

describe("parseOpenApiDocument", () => {
  it("creates internal endpoint model and auth metadata", async () => {
    const fixturePath = path.resolve("fixtures/users.openapi.json");
    const fixtureText = await readFile(fixturePath, "utf-8");
    const fixture = JSON.parse(fixtureText) as unknown;

    const model = parseOpenApiDocument(fixture, "users");
    expect(model.title).toBe("Users API");
    expect(model.endpoints).toHaveLength(2);
    expect(model.authSchemes.map((scheme) => scheme.key)).toContain("bearerAuth");

    const createUser = model.endpoints.find((endpoint) => endpoint.operationId === "createUser");
    expect(createUser?.requestBodyExample).toEqual({ email: "person@example.com", name: "Person" });
    expect(createUser?.authSchemes).toEqual(["bearerAuth"]);
  });

  it("rejects non OpenAPI 3 specs", () => {
    expect(() =>
      parseOpenApiDocument(
        {
          openapi: "2.0",
          info: {
            title: "Legacy"
          },
          paths: {}
        },
        "legacy"
      )
    ).toThrow("Only OpenAPI 3.x is supported");
  });

  it("includes path item parameters in endpoint model", () => {
    const doc = {
      openapi: "3.0.0",
      info: {
        title: "Items API"
      },
      paths: {
        "/items/{id}": {
          get: {
            operationId: "getItem",
            parameters: [
              {
                name: "id",
                in: "path",
                required: true
              }
            ]
          }
        }
      }
    };

    const model = parseOpenApiDocument(doc, "items");
    expect(model.endpoints[0]?.parameters).toEqual([
      {
        name: "id",
        in: "path",
        required: true
      }
    ]);
  });
});

describe("fetchSpecDocument", () => {
  it("parses YAML OpenAPI responses", async () => {
    const fetchMock = async () =>
      createYamlResponse(
        [
          "openapi: 3.0.3",
          "info:",
          "  title: YAML API",
          "paths:",
          "  /ping:",
          "    get:",
          "      operationId: ping"
        ].join("\n")
      );

    const document = await fetchSpecDocument("https://yaml.example.com/openapi.yaml", fetchMock);
    expect((document as Record<string, unknown>).openapi).toBe("3.0.3");
  });

  it("parses JSON OpenAPI responses", async () => {
    const fetchMock = async () =>
      createJsonResponse({
        openapi: "3.0.3",
        info: {
          title: "JSON API"
        },
        paths: {}
      });

    const document = await fetchSpecDocument("https://json.example.com/openapi.json", fetchMock);
    expect((document as Record<string, unknown>).openapi).toBe("3.0.3");
  });
});
