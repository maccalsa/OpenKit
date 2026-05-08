# OpenKit

OpenKit is a CLI that converts internal OpenAPI sources into ready-to-use API testing bundles for IntelliJ HTTP Client and Postman.

## What it generates

Running OpenKit creates:

- `generated/README.md`
- `generated/intellij/*.http`
- `generated/intellij/http-client.env.json`
- `generated/postman/*.collection.json`
- `generated/postman/*.environment.json`

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Build and test:

```bash
npm run build
npm test
```

3. Generate output from the sample config:

```bash
npm run dev -- generate --config apipack.json --out ./generated
```

## Config format

Use a JSON file:

```json
{
  "workspace": "internal-apis",
  "defaultEnv": "dev",
  "tokenCommand": "./script.sh {{env}}",
  "envs": ["dev", "preprod", "prod"],
  "sources": [
    {
      "name": "users",
      "specUrl": "https://users.example.com/swagger-ui/index.html",
      "baseUrlTemplate": "https://{{env}}-users.example.com"
    }
  ]
}
```

`sources.specUrl` accepts:

- direct OpenAPI JSON URL
- common Swagger UI URL (OpenKit attempts discovery)
- local JSON file path (helpful for fixtures and offline usage)

## Auth handling (MVP)

OpenKit reads security schemes and emits practical placeholders:

- Bearer -> `{{token}}`
- API key -> `{{apiKey}}`
- Basic -> `{{username}}`, `{{password}}`, `{{basicAuthToken}}`
- OAuth/custom -> TODO placeholder notes in request templates

## Refresh IntelliJ bearer tokens

Use `regenToken` to refresh `generated/intellij/http-client.private.env.json` from any local command that prints a token to stdout:

```bash
npm run dev -- regenToken --env dev
```

OpenKit reads `tokenCommand` from `apipack.json`. You can override it for one run with `--token-command "./other-token-command {{env}}"`. IntelliJ merges `http-client.private.env.json` with the public `http-client.env.json`, so generated requests can keep using `Authorization: Bearer {{token}}` without committing secrets.

## Link IntelliJ HTTP files

Use `addlink` to create a symlink from a convenient project path to `generated/intellij`:

```bash
npm run dev -- addlink ./http
```

Open `./http/*.http` in IntelliJ. The linked directory keeps requests, `http-client.env.json`, and `http-client.private.env.json` together, so environment selection still works.
