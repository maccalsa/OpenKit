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
npm run dev -- generate --config apipack.yml --out ./generated
```

## Config format

Use a YAML file:

```yaml
workspace: internal-apis

sources:
  - name: users
    url: https://users.example.com/swagger-ui/index.html

environments:
  local:
    usersUrl: http://localhost:8080
```

`sources.url` accepts:

- direct OpenAPI JSON/YAML URL
- common Swagger UI URL (OpenKit attempts discovery)
- local JSON/YAML file path (helpful for fixtures and offline usage)

## Auth handling (MVP)

OpenKit reads security schemes and emits practical placeholders:

- Bearer -> `{{token}}`
- API key -> `{{apiKey}}`
- Basic -> `{{username}}`, `{{password}}`, `{{basicAuthToken}}`
- OAuth/custom -> TODO placeholder notes in request templates
