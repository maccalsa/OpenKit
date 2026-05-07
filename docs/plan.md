# API Workspace Generator MVP Prompt

You are a senior pragmatic developer working on an internal developer productivity tool.

---

# Product Idea

Build a small internal tool that accepts one or more Swagger/OpenAPI URLs and generates ready-to-use API testing bundles for:

1. IntelliJ HTTP Client `.http` files
2. Postman collection/environment JSON files

The tool is for internal organisational use only.

It does not need to be a polished SaaS product.

It must be useful, maintainable, and shippable.

---

# Core Problem

Developers in the organisation have too many APIs, Swagger pages, auth mechanisms, environments, and stale Postman collections to remember.

The tool should let a developer provide API spec URLs and generate a practical workspace they can immediately use.

---

# Important Constraints

- All work must be safe to commit directly to `main`
- Do not over-engineer
- Do not build a plugin architecture unless clearly needed
- Do not build a hosted service
- Do not add a database
- Do not add authentication to this tool
- Do not create unnecessary abstractions
- Prefer boring, readable code
- Prefer CLI-first
- Prefer files over services
- This only has to work in my organisation
- Make pragmatic assumptions and document them
- If something is uncertain, create a sensible default and continue
- Keep dependencies minimal
- The first version should work end-to-end

---

# MVP Requirements

The tool should:

1. Accept a list of URLs
2. Support direct OpenAPI JSON/YAML URLs
3. Support common Swagger UI URLs and attempt to discover the underlying OpenAPI spec
4. Parse OpenAPI 3.x specs
5. Extract:
   - API title/name
   - servers/base URLs
   - paths
   - HTTP methods
   - operation IDs
   - tags
   - path/query/header parameters
   - request body examples where possible
   - security schemes where possible
6. Generate IntelliJ `.http` files
7. Generate Postman collection JSON
8. Generate Postman environment JSON
9. Generate a short `README.md` explaining how to use the output
10. Handle auth pragmatically:
    - bearer token → use `{{token}}`
    - API key → use `{{apiKey}}`
    - basic auth → use `{{username}}` / `{{password}}`
    - OAuth/custom auth → generate placeholders and TODO notes
11. Allow config via a simple YAML file
12. Provide a simple CLI command such as:

```bash
apipack generate --config apipack.yml --out ./generated
```

---

# Expected Config Shape

```yaml
workspace: internal-apis

sources:
  - name: users
    url: https://users.example.com/swagger-ui/index.html

  - name: billing
    url: https://billing.example.com/v3/api-docs

environments:
  local:
    usersUrl: http://localhost:8080
    billingUrl: http://localhost:8081

  dev:
    usersUrl: https://dev-users.example.com
    billingUrl: https://dev-billing.example.com

auth:
  default:
    type: bearer
    tokenVariable: token
```

---

# Expected Output Shape

```txt
generated/
  README.md

  intellij/
    users.http
    billing.http
    http-client.env.json

  postman/
    users.collection.json
    billing.collection.json
    internal-apis.environment.json
```

---

# Your Task

First analyse this specification and break it down into a GitHub-style checklist/burndown list.

Create a file called:

```txt
IMPLEMENTATION_PLAN.md
```

The plan must contain:

1. Scope summary
2. Non-goals
3. Assumptions
4. GitHub checklist
5. Suggested commit sequence
6. Risk list
7. Done definition

Then start implementing the MVP.

---

# Implementation Rules

- Work in small commits
- Each commit must leave the project in a working state
- After each meaningful chunk, update the checklist in `IMPLEMENTATION_PLAN.md`
- Use clear commit messages
- Run tests/build before committing
- Do not leave broken generated code
- Do not introduce placeholder files unless they are useful
- Prefer a working narrow slice over a broad unfinished system
- Add tests for core parsing/generation logic
- Add a sample config and sample OpenAPI fixture
- Make the README useful enough that another internal developer can run the tool

---

# Suggested Burndown

Use this as the starting checklist:

```md
## Burndown

- [ ] Create project scaffold
- [ ] Add CLI entrypoint
- [ ] Add YAML config loading
- [ ] Add URL/spec fetcher
- [ ] Add Swagger UI discovery for common cases
- [ ] Add OpenAPI parser
- [ ] Add internal model for APIs/endpoints
- [ ] Add auth scheme extraction
- [ ] Add IntelliJ `.http` generator
- [ ] Add IntelliJ environment generator
- [ ] Add Postman collection generator
- [ ] Add Postman environment generator
- [ ] Add generated README output
- [ ] Add sample `apipack.yml`
- [ ] Add sample OpenAPI fixture
- [ ] Add unit tests for parser
- [ ] Add unit tests for generators
- [ ] Add smoke test for full generation
- [ ] Add project README
- [ ] Run full test/build
- [ ] Commit complete MVP
```

---

# Preferred Implementation Shape

Use the simplest sensible stack for the repository already present.

- Node/TypeScript CLI using:
  - `commander`
  - `zod`
  - `yaml`

---

# Final Instruction

Do not ask for permission to begin.

Analyse the spec, create the plan, then start implementing the smallest working end-to-end slice. Commit each slice. add testing but do not be excessive in tests