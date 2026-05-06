import { ApiPackConfig } from "./config.js";
import { ApiEndpoint, ApiModel } from "./types.js";

interface PostmanVariable {
  key: string;
  value: string;
  type: string;
}

function sanitizeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, " ").trim();
}

function toEnvironmentKey(sourceName: string): string {
  return `${sourceName}Url`;
}

function replacePathParameters(pathValue: string): string {
  return pathValue.replace(/\{([^}]+)\}/g, "{{$1}}");
}

function buildRequestUrl(endpoint: ApiEndpoint, sourceName: string): string {
  const baseKey = toEnvironmentKey(sourceName);
  const pathValue = replacePathParameters(endpoint.path);
  const queryParameters = endpoint.parameters.filter((parameter) => parameter.in === "query");
  const querySuffix =
    queryParameters.length > 0
      ? `?${queryParameters.map((parameter) => `${parameter.name}={{${parameter.name}}}`).join("&")}`
      : "";
  return `{{${baseKey}}}${pathValue}${querySuffix}`;
}

function buildAuthHeaders(endpoint: ApiEndpoint): string[] {
  if (endpoint.authSchemes.length === 0) {
    return [];
  }

  const lowerAuth = endpoint.authSchemes.map((auth) => auth.toLowerCase());
  if (lowerAuth.some((auth) => auth.includes("bearer"))) {
    return ["Authorization: Bearer {{token}}"];
  }

  if (lowerAuth.some((auth) => auth.includes("apikey") || auth.includes("api-key"))) {
    return ["X-API-Key: {{apiKey}}"];
  }

  if (lowerAuth.some((auth) => auth.includes("basic"))) {
    return ["Authorization: Basic {{basicAuthToken}}"];
  }

  return ["# TODO: configure auth header"];
}

export function generateIntellijHttp(model: ApiModel): string {
  const lines: string[] = [];
  for (const endpoint of model.endpoints) {
    const title = endpoint.summary ?? endpoint.operationId ?? `${endpoint.method.toUpperCase()} ${endpoint.path}`;
    lines.push(`### ${title}`);
    lines.push(`${endpoint.method.toUpperCase()} ${buildRequestUrl(endpoint, model.sourceName)}`);
    lines.push("Accept: application/json");
    lines.push(...buildAuthHeaders(endpoint));

    if (endpoint.requestBodyExample !== undefined) {
      lines.push("Content-Type: application/json");
      lines.push("");
      lines.push(JSON.stringify(endpoint.requestBodyExample, null, 2));
    }

    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function generateIntellijEnvironment(config: ApiPackConfig): string {
  const envObject: Record<string, Record<string, string>> = {};
  for (const [environmentName, values] of Object.entries(config.environments)) {
    envObject[environmentName] = values;
  }
  return `${JSON.stringify(envObject, null, 2)}\n`;
}

function toPostmanItems(model: ApiModel) {
  return model.endpoints.map((endpoint) => {
    const urlRaw = buildRequestUrl(endpoint, model.sourceName);
    const header = [
      {
        key: "Accept",
        value: "application/json"
      },
      ...buildAuthHeaders(endpoint).map((line) => {
        const [key, ...rest] = line.split(":");
        return {
          key: key.trim(),
          value: rest.join(":").trim() || ""
        };
      })
    ];

    return {
      name: endpoint.summary ?? endpoint.operationId ?? `${endpoint.method.toUpperCase()} ${endpoint.path}`,
      request: {
        method: endpoint.method.toUpperCase(),
        header,
        url: {
          raw: urlRaw
        },
        body:
          endpoint.requestBodyExample !== undefined
            ? {
                mode: "raw",
                raw: JSON.stringify(endpoint.requestBodyExample, null, 2),
                options: {
                  raw: {
                    language: "json"
                  }
                }
              }
            : undefined
      }
    };
  });
}

export function generatePostmanCollection(model: ApiModel): string {
  const collection = {
    info: {
      name: sanitizeName(model.title) || model.sourceName,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    item: toPostmanItems(model)
  };
  return `${JSON.stringify(collection, null, 2)}\n`;
}

function deriveAuthVariables(models: ApiModel[]): PostmanVariable[] {
  const authKinds = new Set<string>();
  for (const model of models) {
    for (const scheme of model.authSchemes) {
      authKinds.add(`${scheme.type}:${scheme.scheme ?? "none"}`);
    }
  }

  const variables: PostmanVariable[] = [];
  for (const authKind of authKinds) {
    if (authKind.includes("http:bearer")) {
      variables.push({ key: "token", value: "", type: "string" });
    } else if (authKind.includes("apiKey")) {
      variables.push({ key: "apiKey", value: "", type: "string" });
    } else if (authKind.includes("http:basic")) {
      variables.push({ key: "username", value: "", type: "string" });
      variables.push({ key: "password", value: "", type: "string" });
      variables.push({ key: "basicAuthToken", value: "", type: "string" });
    }
  }
  return variables;
}

export function generatePostmanEnvironment(config: ApiPackConfig, models: ApiModel[]): string {
  const environmentName = `${config.workspace}.environment`;
  const values: PostmanVariable[] = [];

  const firstEnvironment = Object.values(config.environments)[0] ?? {};
  for (const [key, value] of Object.entries(firstEnvironment)) {
    values.push({
      key,
      value,
      type: "string"
    });
  }

  values.push(...deriveAuthVariables(models));

  const environment = {
    name: environmentName,
    values
  };

  return `${JSON.stringify(environment, null, 2)}\n`;
}

export function generateBundleReadme(config: ApiPackConfig, models: ApiModel[]): string {
  const lines = [
    `# ${config.workspace} Generated API Pack`,
    "",
    "Generated by OpenKit with OpenAPI discovery + conversion.",
    "",
    "## Included services",
    ...models.map((model) => `- ${model.sourceName} (${model.endpoints.length} endpoints)`),
    "",
    "## IntelliJ HTTP Client",
    "- Import `intellij/http-client.env.json` using the HTTP Client environment selector.",
    "- Execute requests from `intellij/*.http`.",
    "",
    "## Postman",
    "- Import collections from `postman/*.collection.json`.",
    "- Import environment from `postman/*.environment.json`.",
    "",
    "## Auth placeholders",
    "- Bearer: `{{token}}`",
    "- API key: `{{apiKey}}`",
    "- Basic auth: `{{username}}`, `{{password}}`, `{{basicAuthToken}}`",
    "- OAuth/custom: TODO placeholders are emitted in request headers where needed."
  ];

  return `${lines.join("\n")}\n`;
}
