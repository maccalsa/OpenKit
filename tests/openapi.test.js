import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { discoverSpecUrl, fetchSpecDocument, parseOpenApiDocument } from "../dist/openapi.js";

function createJsonResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json"
    }
  });
}

describe("discoverSpecUrl", () => {
  it("returns direct spec URLs without discovery", async () => {
    const specUrl = await discoverSpecUrl("https://users.example.com/v3/api-docs");
    assert.equal(specUrl, "https://users.example.com/v3/api-docs");
  });

  it("extracts spec URL from Swagger UI HTML", async () => {
    const calls = [];
    const fetchMock = async (url) => {
      calls.push(url);
      return new Response('<script>window.ui = SwaggerUIBundle({ url: "/v3/api-docs" })</script>', {
        status: 200,
        headers: {
          "content-type": "text/html"
        }
      });
    };

    const discovered = await discoverSpecUrl("https://users.example.com/swagger-ui/index.html", fetchMock);
    assert.equal(discovered, "https://users.example.com/v3/api-docs");
    assert.equal(calls.length, 1);
  });
});

describe("parseOpenApiDocument", () => {
  it("creates internal endpoint model and auth metadata", async () => {
    const fixturePath = path.resolve("fixtures/users.openapi.json");
    const fixtureText = await readFile(fixturePath, "utf-8");
    const fixture = JSON.parse(fixtureText);

    const model = parseOpenApiDocument(fixture, "users");
    assert.equal(model.title, "Users API");
    assert.equal(model.endpoints.length, 2);
    assert.ok(model.authSchemes.map((scheme) => scheme.key).includes("bearerAuth"));

    const createUser = model.endpoints.find((endpoint) => endpoint.operationId === "createUser");
    assert.deepEqual(createUser?.requestBodyExample, { email: "person@example.com", name: "Person" });
    assert.deepEqual(createUser?.authSchemes, ["bearerAuth"]);
  });

  it("rejects non OpenAPI 3 specs", () => {
    assert.throws(() =>
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
    , /Only OpenAPI 3\.x is supported/);
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
    assert.deepEqual(model.endpoints[0]?.parameters, [
      {
        name: "id",
        in: "path",
        required: true
      }
    ]);
  });
});

describe("fetchSpecDocument", () => {
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
    assert.equal(document.openapi, "3.0.3");
  });

  it("rejects non-JSON spec responses", async () => {
    const fetchMock = async () =>
      new Response("openapi: 3.0.3", {
        status: 200,
        headers: {
          "content-type": "application/yaml"
        }
      });

    await assert.rejects(
      () => fetchSpecDocument("https://yaml.example.com/openapi.yaml", fetchMock),
      /Expected JSON/
    );
  });
});
