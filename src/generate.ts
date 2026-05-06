import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "./config.js";
import {
  generateBundleReadme,
  generateIntellijEnvironment,
  generateIntellijHttp,
  generatePostmanCollection,
  generatePostmanEnvironment
} from "./generators.js";
import { discoverSpecUrl, fetchSpecDocument, parseOpenApiDocument } from "./openapi.js";
import { ApiModel } from "./types.js";

async function loadModels(configPath: string): Promise<{ config: Awaited<ReturnType<typeof loadConfig>>; models: ApiModel[] }> {
  const config = await loadConfig(configPath);
  const models: ApiModel[] = [];
  const configDirectory = path.dirname(path.resolve(configPath));

  for (const source of config.sources) {
    let rawSpec: unknown;
    if (source.url.startsWith("http://") || source.url.startsWith("https://")) {
      const discoveredUrl = await discoverSpecUrl(source.url);
      rawSpec = await fetchSpecDocument(discoveredUrl);
    } else {
      const fixturePath = path.resolve(configDirectory, source.url);
      const fixtureText = await readFile(fixturePath, "utf-8");
      rawSpec = JSON.parse(fixtureText);
    }

    const parsed = parseOpenApiDocument(rawSpec, source.name);
    models.push(parsed);
  }

  return { config, models };
}

export async function generateWorkspace(configPath: string, outputPath: string): Promise<void> {
  const { config, models } = await loadModels(configPath);
  const outputDir = path.resolve(outputPath);

  const intellijDir = path.join(outputDir, "intellij");
  const postmanDir = path.join(outputDir, "postman");
  await mkdir(intellijDir, { recursive: true });
  await mkdir(postmanDir, { recursive: true });

  await writeFile(path.join(outputDir, "README.md"), generateBundleReadme(config, models), "utf-8");
  await writeFile(path.join(intellijDir, "http-client.env.json"), generateIntellijEnvironment(config), "utf-8");
  await writeFile(
    path.join(postmanDir, `${config.workspace}.environment.json`),
    generatePostmanEnvironment(config, models),
    "utf-8"
  );

  for (const model of models) {
    await writeFile(path.join(intellijDir, `${model.sourceName}.http`), generateIntellijHttp(model), "utf-8");
    await writeFile(
      path.join(postmanDir, `${model.sourceName}.collection.json`),
      generatePostmanCollection(model),
      "utf-8"
    );
  }
}
