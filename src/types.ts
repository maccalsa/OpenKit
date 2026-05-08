export type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "head" | "options";

export interface ApiParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required: boolean;
}

export interface ApiEndpoint {
  path: string;
  method: HttpMethod;
  operationId?: string;
  summary?: string;
  tag?: string;
  parameters: ApiParameter[];
  requestBodyExample?: unknown;
  authSchemes: string[];
}

export interface AuthScheme {
  key: string;
  type: string;
  in?: string;
  scheme?: string;
}

export interface ApiModel {
  sourceName: string;
  title: string;
  servers: string[];
  endpoints: ApiEndpoint[];
  authSchemes: AuthScheme[];
}
