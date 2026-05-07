import { ApiModel, ApiParameter, AuthScheme, HttpMethod } from "./types.js";

const HTTP_METHODS: HttpMethod[] = ["get", "post", "put", "patch", "delete", "head", "options"];

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

function isDirectSpecUrl(url: URL): boolean {
  return (
    url.pathname.endsWith(".json") ||
    url.pathname.includes("/v3/api-docs") ||
    url.pathname.includes("/openapi")
  );
}

function toAbsoluteUrl(rawUrl: string, baseUrl: URL): string {
  try {
    return new URL(rawUrl, baseUrl).toString();
  } catch {
    return rawUrl;
  }
}

function extractSpecUrlFromHtml(html: string, pageUrl: URL): string | null {
  const directUrlMatch = html.match(/url:\s*["']([^"']+)["']/);
  if (directUrlMatch?.[1]) {
    return toAbsoluteUrl(directUrlMatch[1], pageUrl);
  }

  const urlsMatch = html.match(/urls:\s*\[\s*\{\s*url:\s*["']([^"']+)["']/);
  if (urlsMatch?.[1]) {
    return toAbsoluteUrl(urlsMatch[1], pageUrl);
  }

  return null;
}

export async function discoverSpecUrl(sourceUrl: string, fetchFn: FetchFn = fetch): Promise<string> {
  const normalizedUrl = new URL(sourceUrl);
  if (isDirectSpecUrl(normalizedUrl)) {
    return normalizedUrl.toString();
  }

  const pageResponse = await fetchFn(normalizedUrl.toString());
  if (!pageResponse.ok) {
    throw new Error(`Cannot access source URL: ${normalizedUrl.toString()}`);
  }

  const html = await pageResponse.text();
  const fromHtml = extractSpecUrlFromHtml(html, normalizedUrl);
  if (fromHtml) {
    return fromHtml;
  }

  const candidates = ["/v3/api-docs", "/swagger/v1/swagger.json", "/swagger.json", "/openapi.json"];
  for (const candidate of candidates) {
    const candidateUrl = new URL(candidate, normalizedUrl.origin).toString();
    const candidateResponse = await fetchFn(candidateUrl);
    if (candidateResponse.ok) {
      return candidateUrl;
    }
  }

  throw new Error(`Could not discover OpenAPI spec URL for ${normalizedUrl.toString()}`);
}

export async function fetchSpecDocument(specUrl: string, fetchFn: FetchFn = fetch): Promise<unknown> {
  const response = await fetchFn(specUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch spec: ${specUrl}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json") || contentType.includes("+json")) {
    return response.json();
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Unsupported spec format at ${specUrl}. Expected JSON.`);
  }
}

function extractAuthSchemes(rawDoc: Record<string, unknown>): AuthScheme[] {
  const components = rawDoc.components;
  if (!components || typeof components !== "object") {
    return [];
  }

  const securitySchemes = (components as Record<string, unknown>).securitySchemes;
  if (!securitySchemes || typeof securitySchemes !== "object") {
    return [];
  }

  const entries = Object.entries(securitySchemes as Record<string, unknown>);
  return entries.flatMap(([key, scheme]) => {
    if (!scheme || typeof scheme !== "object") {
      return [];
    }
    const objectScheme = scheme as Record<string, unknown>;
    return [
      {
        key,
        type: String(objectScheme.type ?? "unknown"),
        in: objectScheme.in ? String(objectScheme.in) : undefined,
        scheme: objectScheme.scheme ? String(objectScheme.scheme) : undefined
      }
    ];
  });
}

function extractOperationAuth(operation: Record<string, unknown>, documentSecurity: string[]): string[] {
  const operationSecurity = operation.security;
  if (!operationSecurity) {
    return documentSecurity;
  }

  if (!Array.isArray(operationSecurity)) {
    return documentSecurity;
  }

  const authNames = operationSecurity.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    return Object.keys(item as Record<string, unknown>);
  });

  return authNames.length > 0 ? authNames : documentSecurity;
}

function extractParameters(operation: Record<string, unknown>): ApiParameter[] {
  const rawParameters = operation.parameters;
  if (!Array.isArray(rawParameters)) {
    return [];
  }

  return rawParameters.flatMap((parameter) => {
    if (!parameter || typeof parameter !== "object") {
      return [];
    }
    const objectParameter = parameter as Record<string, unknown>;
    const parameterIn = objectParameter.in;
    if (
      parameterIn !== "path" &&
      parameterIn !== "query" &&
      parameterIn !== "header" &&
      parameterIn !== "cookie"
    ) {
      return [];
    }

    return [
      {
        name: String(objectParameter.name ?? "unknown"),
        in: parameterIn,
        required: Boolean(objectParameter.required)
      }
    ];
  });
}

function extractRequestBodyExample(operation: Record<string, unknown>): unknown {
  const requestBody = operation.requestBody;
  if (!requestBody || typeof requestBody !== "object") {
    return undefined;
  }

  const content = (requestBody as Record<string, unknown>).content;
  if (!content || typeof content !== "object") {
    return undefined;
  }

  const jsonContent = (content as Record<string, unknown>)["application/json"];
  if (!jsonContent || typeof jsonContent !== "object") {
    return undefined;
  }

  const directExample = (jsonContent as Record<string, unknown>).example;
  if (directExample !== undefined) {
    return directExample;
  }

  const examples = (jsonContent as Record<string, unknown>).examples;
  if (!examples || typeof examples !== "object") {
    return undefined;
  }

  const firstExample = Object.values(examples as Record<string, unknown>)[0];
  if (!firstExample || typeof firstExample !== "object") {
    return undefined;
  }

  return (firstExample as Record<string, unknown>).value;
}

export function parseOpenApiDocument(document: unknown, sourceName: string): ApiModel {
  if (!document || typeof document !== "object") {
    throw new Error("OpenAPI document must be an object");
  }

  const rawDoc = document as Record<string, unknown>;
  const openApiVersion = rawDoc.openapi;
  if (typeof openApiVersion !== "string" || !openApiVersion.startsWith("3.")) {
    throw new Error(`Only OpenAPI 3.x is supported. Received: ${String(openApiVersion)}`);
  }

  const info = rawDoc.info;
  const title =
    info && typeof info === "object" && typeof (info as Record<string, unknown>).title === "string"
      ? String((info as Record<string, unknown>).title)
      : sourceName;

  const servers = Array.isArray(rawDoc.servers)
    ? rawDoc.servers.flatMap((server) => {
        if (!server || typeof server !== "object") {
          return [];
        }
        const serverUrl = (server as Record<string, unknown>).url;
        return typeof serverUrl === "string" ? [serverUrl] : [];
      })
    : [];

  const defaultSecurity = Array.isArray(rawDoc.security)
    ? rawDoc.security.flatMap((item) => {
        if (!item || typeof item !== "object") {
          return [];
        }
        return Object.keys(item as Record<string, unknown>);
      })
    : [];

  const paths = rawDoc.paths;
  if (!paths || typeof paths !== "object") {
    throw new Error("OpenAPI document does not contain paths");
  }

  const endpoints = Object.entries(paths as Record<string, unknown>).flatMap(([pathKey, pathItem]) => {
    if (!pathItem || typeof pathItem !== "object") {
      return [];
    }

    const pathObject = pathItem as Record<string, unknown>;
    return HTTP_METHODS.flatMap((method) => {
      const operation = pathObject[method];
      if (!operation || typeof operation !== "object") {
        return [];
      }

      const operationObject = operation as Record<string, unknown>;
      const tags = Array.isArray(operationObject.tags)
        ? operationObject.tags.filter((tag): tag is string => typeof tag === "string")
        : [];

      return [
        {
          path: pathKey,
          method,
          operationId:
            typeof operationObject.operationId === "string" ? operationObject.operationId : undefined,
          summary: typeof operationObject.summary === "string" ? operationObject.summary : undefined,
          tag: tags[0],
          parameters: extractParameters(operationObject),
          requestBodyExample: extractRequestBodyExample(operationObject),
          authSchemes: extractOperationAuth(operationObject, defaultSecurity)
        }
      ];
    });
  });

  return {
    sourceName,
    title,
    servers,
    endpoints,
    authSchemes: extractAuthSchemes(rawDoc)
  };
}
