import { ApiPackConfig, ApiSource } from "./config.js";
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

function buildRequestUrl(endpoint: ApiEndpoint, source: ApiSource): string {
  const baseKey = toEnvironmentKey(source.name);
  const pathValue = replacePathParameters(endpoint.path);
  const queryParameters = endpoint.parameters.filter((parameter) => parameter.in === "query");
  const querySuffix =
    queryParameters.length > 0
      ? `?${queryParameters.map((parameter) => `${parameter.name}={{${parameter.name}}}`).join("&")}`
      : "";
  return `{{${baseKey}}}${pathValue}${querySuffix}`;
}

function authHeadersFromProfile(source: ApiSource, config: ApiPackConfig): string[] | null {
  if (!source.authProfile) {
    return null;
  }

  const profile = config.authProfiles[source.authProfile];
  if (!profile) {
    return ["# TODO: configure auth profile in apipack.json"];
  }

  switch (profile.type) {
    case "bearer":
      return [`Authorization: Bearer {{${profile.tokenVariable ?? "token"}}}`];
    case "apiKey":
      return [`${profile.headerName ?? "X-API-Key"}: {{${profile.apiKeyVariable ?? "apiKey"}}}`];
    case "basic":
      return ["Authorization: Basic {{basicAuthToken}}"];
    case "oauth":
    case "custom":
      return ["# TODO: configure OAuth/custom auth header"];
    default:
      return ["# TODO: configure auth header"];
  }
}

function buildAuthHeaders(endpoint: ApiEndpoint, source: ApiSource, config: ApiPackConfig): string[] {
  const profileHeaders = authHeadersFromProfile(source, config);
  if (profileHeaders) {
    return profileHeaders;
  }

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

export function generateIntellijHttp(model: ApiModel, source: ApiSource, config: ApiPackConfig): string {
  const lines: string[] = [];
  for (const endpoint of model.endpoints) {
    const title = endpoint.summary ?? endpoint.operationId ?? `${endpoint.method.toUpperCase()} ${endpoint.path}`;
    lines.push(`### ${title}`);
    lines.push(`${endpoint.method.toUpperCase()} ${buildRequestUrl(endpoint, source)}`);
    lines.push("Accept: application/json");
    lines.push(...buildAuthHeaders(endpoint, source, config));

    if (endpoint.requestBodyExample !== undefined) {
      lines.push("Content-Type: application/json");
      lines.push("");
      lines.push(JSON.stringify(endpoint.requestBodyExample, null, 2));
    }

    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function interpolateTemplate(template: string, context: Record<string, string>): string {
  return template
    .replace(/\{\{(\w+)\}\}/g, (_, variableName: string) => context[variableName] ?? "")
    .replace(/\{(\w+)\}/g, (_, variableName: string) => context[variableName] ?? "");
}

function buildEnvironmentContexts(config: ApiPackConfig): Array<{ name: string; values: Record<string, string> }> {
  const envValues = config.variables.env ?? [config.defaultEnvironment];
  return envValues.map((environmentName) => {
    const values: Record<string, string> = { env: environmentName };
    for (const [variableName, options] of Object.entries(config.variables)) {
      values[variableName] = variableName === "env" ? environmentName : options[0];
    }
    return {
      name: environmentName,
      values
    };
  });
}

function collectAuthVariableNames(config: ApiPackConfig): string[] {
  const variableNames = new Set<string>();
  for (const profile of Object.values(config.authProfiles)) {
    if (profile.type === "bearer") {
      variableNames.add(profile.tokenVariable ?? "token");
    } else if (profile.type === "apiKey") {
      variableNames.add(profile.apiKeyVariable ?? "apiKey");
    } else if (profile.type === "basic") {
      variableNames.add(profile.usernameVariable ?? "username");
      variableNames.add(profile.passwordVariable ?? "password");
      variableNames.add("basicAuthToken");
    }
  }
  return [...variableNames];
}

export function generateIntellijEnvironment(config: ApiPackConfig): string {
  const envObject: Record<string, Record<string, string>> = {};
  const authVariables = collectAuthVariableNames(config);

  for (const context of buildEnvironmentContexts(config)) {
    const environmentValues: Record<string, string> = { ...context.values };
    for (const source of config.sources) {
      environmentValues[toEnvironmentKey(source.name)] = interpolateTemplate(source.baseUrlTemplate, context.values);
    }
    for (const authVariable of authVariables) {
      environmentValues[authVariable] = "";
    }
    envObject[context.name] = environmentValues;
  }
  return `${JSON.stringify(envObject, null, 2)}\n`;
}

function toPostmanItems(model: ApiModel, source: ApiSource, config: ApiPackConfig) {
  return model.endpoints.map((endpoint) => {
    const urlRaw = buildRequestUrl(endpoint, source);
    const header = [
      {
        key: "Accept",
        value: "application/json"
      },
      ...buildAuthHeaders(endpoint, source, config).map((line) => {
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

export function generatePostmanCollection(model: ApiModel, source: ApiSource, config: ApiPackConfig): string {
  const collection = {
    info: {
      name: sanitizeName(model.title) || model.sourceName,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    item: toPostmanItems(model, source, config)
  };
  return `${JSON.stringify(collection, null, 2)}\n`;
}

function deriveAuthVariables(config: ApiPackConfig, models: ApiModel[]): PostmanVariable[] {
  const variables: PostmanVariable[] = [];
  const profileAuthVariables = collectAuthVariableNames(config);
  for (const variableName of profileAuthVariables) {
    variables.push({ key: variableName, value: "", type: "string" });
  }

  if (profileAuthVariables.length > 0) {
    return variables;
  }

  const authKinds = new Set<string>();
  for (const model of models) {
    for (const scheme of model.authSchemes) {
      authKinds.add(`${scheme.type}:${scheme.scheme ?? "none"}`);
    }
  }

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
  const contexts = buildEnvironmentContexts(config);
  const defaultContext =
    contexts.find((context) => context.name === config.defaultEnvironment) ??
    contexts[0] ?? {
      name: config.defaultEnvironment,
      values: {}
    };

  for (const [key, value] of Object.entries(defaultContext.values)) {
    values.push({
      key,
      value,
      type: "string"
    });
  }

  for (const source of config.sources) {
    values.push({
      key: toEnvironmentKey(source.name),
      value: interpolateTemplate(source.baseUrlTemplate, defaultContext.values),
      type: "string"
    });
  }

  values.push(...deriveAuthVariables(config, models));

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
