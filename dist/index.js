#!/usr/bin/env node
import { generateWorkspace } from "./generate.js";

function parseArgs(args) {
    const options = {
        config: "apipack.json",
        out: "./generated"
    };
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === "generate") {
            continue;
        }
        if ((arg === "-c" || arg === "--config") && args[index + 1]) {
            options.config = args[index + 1];
            index += 1;
            continue;
        }
        if ((arg === "-o" || arg === "--out") && args[index + 1]) {
            options.out = args[index + 1];
            index += 1;
            continue;
        }
        if (arg === "-h" || arg === "--help") {
            console.log("Usage: apipack generate --config <path> --out <path>");
            process.exit(0);
        }
        throw new Error(`Unknown argument: ${arg}`);
    }
    return options;
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    await generateWorkspace(options.config, options.out);
}

main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Generation failed: ${message}`);
    process.exitCode = 1;
});
