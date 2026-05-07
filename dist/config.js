import { readFile } from "node:fs/promises";
import path from "node:path";
function assertNonEmptyString(value, fieldName) {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`Config field "${fieldName}" must be a non-empty string`);
    }
}
function validateSource(source, index) {
    if (!source || typeof source !== "object") {
        throw new Error(`Config source at index ${index} must be an object`);
    }
    assertNonEmptyString(source.name, `sources[${index}].name`);
    assertNonEmptyString(source.specUrl, `sources[${index}].specUrl`);
    assertNonEmptyString(source.baseUrlTemplate, `sources[${index}].baseUrlTemplate`);
    return {
        name: source.name,
        specUrl: source.specUrl,
        baseUrlTemplate: source.baseUrlTemplate
    };
}
function validateConfig(parsed) {
    if (!parsed || typeof parsed !== "object") {
        throw new Error("Config must be a JSON object");
    }
    assertNonEmptyString(parsed.workspace, "workspace");
    const defaultEnv = typeof parsed.defaultEnv === "string" && parsed.defaultEnv.trim().length > 0
        ? parsed.defaultEnv
        : "dev";
    const envs = Array.isArray(parsed.envs) ? parsed.envs : ["dev"];
    if (envs.length === 0 || envs.some((env) => typeof env !== "string" || env.trim().length === 0)) {
        throw new Error('Config field "envs" must be a non-empty string array');
    }
    if (!Array.isArray(parsed.sources) || parsed.sources.length === 0) {
        throw new Error('Config field "sources" must be a non-empty array');
    }
    return {
        workspace: parsed.workspace,
        defaultEnv,
        envs,
        sources: parsed.sources.map((source, index) => validateSource(source, index))
    };
}
export async function loadConfig(configPath) {
    const absolutePath = path.resolve(configPath);
    const configText = await readFile(absolutePath, "utf-8");
    let parsed;
    try {
        parsed = JSON.parse(configText);
    }
    catch {
        throw new Error(`Invalid JSON config file: ${absolutePath}`);
    }
    return validateConfig(parsed);
}
