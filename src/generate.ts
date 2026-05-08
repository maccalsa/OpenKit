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
import { ApiSource } from "./config.js";

interface SourceModelPair {
  source: ApiSource;
  model: ApiModel;
}

async function loadModels(configPath: string): Promise<{ config: Awaited<ReturnType<typeof loadConfig>>; pairs: SourceModelPair[] }> {
  const config = await loadConfig(configPath);
  const pairs: SourceModelPair[] = [];
  const configDirectory = path.dirname(path.resolve(configPath));

  for (const source of config.sources) {
    const sourceSpecUrl = source.specUrl;
    let rawSpec: unknown;
    if (sourceSpecUrl.startsWith("http://") || sourceSpecUrl.startsWith("https://")) {
      const discoveredUrl = await discoverSpecUrl(sourceSpecUrl);
      rawSpec = await fetchSpecDocument(discoveredUrl);
    } else {
      const fixturePath = path.resolve(configDirectory, sourceSpecUrl);
      const fixtureText = await readFile(fixturePath, "utf-8");
      try {
        rawSpec = JSON.parse(fixtureText);
      } catch {
        throw new Error(`Local spec file must be JSON: ${fixturePath}`);
      }
    }

    const parsed = parseOpenApiDocument(rawSpec, source.name);
    pairs.push({
      source,
      model: parsed
    });
  }

  return { config, pairs };
}

export async function generateWorkspace(configPath: string, outputPath: string): Promise<void> {
  const { config, pairs } = await loadModels(configPath);
  const models = pairs.map((pair) => pair.model);
  const outputDir = path.resolve(outputPath);

  const intellijDir = path.join(outputDir, "intellij");
  const postmanDir = path.join(outputDir, "postman");
  await mkdir(intellijDir, { recursive: true });
  await mkdir(postmanDir, { recursive: true });

  await writeFile(path.join(outputDir, "README.md"), generateBundleReadme(config, models), "utf-8");
  await writeFile(path.join(intellijDir, "http-client.env.json"), generateIntellijEnvironment(config, models), "utf-8");
  await writeFile(
    path.join(postmanDir, `${config.workspace}.environment.json`),
    generatePostmanEnvironment(config, models),
    "utf-8"
  );

  for (const pair of pairs) {
    await writeFile(
      path.join(intellijDir, `${pair.model.sourceName}.http`),
      generateIntellijHttp(pair.model, pair.source),
      "utf-8"
    );
    await writeFile(
      path.join(postmanDir, `${pair.model.sourceName}.collection.json`),
      generatePostmanCollection(pair.model, pair.source),
      "utf-8"
    );
  }
}
