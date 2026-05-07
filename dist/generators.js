function sanitizeName(value) {
    return value.replace(/[^a-zA-Z0-9]+/g, " ").trim();
}
function toEnvironmentKey(sourceName) {
    return `${sourceName}Url`;
}
function replacePathParameters(pathValue) {
    return pathValue.replace(/\{([^}]+)\}/g, "{{$1}}");
}
function buildRequestUrl(endpoint, source) {
    const baseKey = toEnvironmentKey(source.name);
    const pathValue = replacePathParameters(endpoint.path);
    const queryParameters = endpoint.parameters.filter((parameter) => parameter.in === "query");
    const querySuffix = queryParameters.length > 0
        ? `?${queryParameters.map((parameter) => `${parameter.name}={{${parameter.name}}}`).join("&")}`
        : "";
    return `{{${baseKey}}}${pathValue}${querySuffix}`;
}
function buildAuthHeaders(endpoint) {
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
export function generateIntellijHttp(model, source) {
    const lines = [];
    for (const endpoint of model.endpoints) {
        const title = endpoint.summary ?? endpoint.operationId ?? `${endpoint.method.toUpperCase()} ${endpoint.path}`;
        lines.push(`### ${title}`);
        lines.push(`${endpoint.method.toUpperCase()} ${buildRequestUrl(endpoint, source)}`);
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
function interpolateTemplate(template, context) {
    return template
        .replace(/\{\{(\w+)\}\}/g, (_, variableName) => context[variableName] ?? "")
        .replace(/\{(\w+)\}/g, (_, variableName) => context[variableName] ?? "");
}
function toPostmanTemplateUrl(template) {
    const protectedTemplate = template.replace(/\{\{(\w+)\}\}/g, "__OPENKIT_VAR__$1__");
    const normalizedTemplate = protectedTemplate.replace(/\{(\w+)\}/g, "{{$1}}");
    return normalizedTemplate.replace(/__OPENKIT_VAR__(\w+)__/g, "{{$1}}");
}
function resolveSourceBaseUrl(source, context) {
    return interpolateTemplate(source.baseUrlTemplate, context);
}
function buildEnvironmentContexts(config) {
    return config.envs.map((environmentName) => {
        const values = { env: environmentName };
        return {
            name: environmentName,
            values
        };
    });
}
function deriveAuthVariables(models) {
    const authKinds = new Set();
    for (const model of models) {
        for (const scheme of model.authSchemes) {
            authKinds.add(`${scheme.type}:${scheme.scheme ?? "none"}`);
        }
    }
    const variables = [];
    for (const authKind of authKinds) {
        if (authKind.includes("http:bearer")) {
            variables.push({ key: "token", value: "", type: "string" });
        }
        else if (authKind.includes("apiKey")) {
            variables.push({ key: "apiKey", value: "", type: "string" });
        }
        else if (authKind.includes("http:basic")) {
            variables.push({ key: "username", value: "", type: "string" });
            variables.push({ key: "password", value: "", type: "string" });
            variables.push({ key: "basicAuthToken", value: "", type: "string" });
        }
    }
    return variables;
}
export function generateIntellijEnvironment(config, models) {
    const envObject = {};
    const authVariables = deriveAuthVariables(models).map((variable) => variable.key);
    for (const context of buildEnvironmentContexts(config)) {
        const environmentValues = { ...context.values };
        for (const source of config.sources) {
            environmentValues[toEnvironmentKey(source.name)] = resolveSourceBaseUrl(source, context.values);
        }
        for (const authVariable of authVariables) {
            environmentValues[authVariable] = "";
        }
        envObject[context.name] = environmentValues;
    }
    return `${JSON.stringify(envObject, null, 2)}\n`;
}
function toPostmanItems(model, source) {
    return model.endpoints.map((endpoint) => {
        const urlRaw = buildRequestUrl(endpoint, source);
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
                body: endpoint.requestBodyExample !== undefined
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
export function generatePostmanCollection(model, source) {
    const collection = {
        info: {
            name: sanitizeName(model.title) || model.sourceName,
            schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        item: toPostmanItems(model, source)
    };
    return `${JSON.stringify(collection, null, 2)}\n`;
}
export function generatePostmanEnvironment(config, models) {
    const environmentName = `${config.workspace}.environment`;
    const values = [];
    const contexts = buildEnvironmentContexts(config);
    const defaultContext = contexts.find((context) => context.name === config.defaultEnv) ??
        contexts[0] ?? {
        name: config.defaultEnv,
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
            value: toPostmanTemplateUrl(source.baseUrlTemplate),
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
export function generateBundleReadme(config, models) {
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
