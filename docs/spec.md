Yes — this is a **good small-app idea**.

Existing tools already import OpenAPI, but the pain is that they do not solve the **organisation workflow**: “Where is the spec? Which environment? How do I auth? What variables do I need? Give me something usable now.” Postman can import OpenAPI 3.0/3.1 specs, and IntelliJ can generate HTTP Client requests from OpenAPI specs, but your app can package the messy bits into ready-to-use bundles. ([Postman Docs][1])

## App idea

**Name idea:** ApiPack / SpecPort / OpenKit

**One-liner:**

> Paste Swagger/OpenAPI URLs. Get ready-made Postman collections, IntelliJ `.http` files, environment files, and auth helpers.

## The real pain

In companies, APIs are scattered across:

* Swagger UI pages
* `/v3/api-docs`
* `/swagger.json`
* Confluence links
* internal gateways
* different auth methods
* different environments
* stale Postman collections
* manually copied bearer tokens

The app should not be “another API client”. It should be an **API workspace generator**.

## MVP

### Input

User gives:

```txt
https://service-a.company.com/swagger-ui/index.html
https://service-b.company.com/v3/api-docs
https://service-c.company.com/swagger.json
```

App does:

1. Detect the actual OpenAPI JSON/YAML.
2. Parse the spec.
3. Extract:

   * service name
   * base URLs
   * endpoints
   * methods
   * tags/groups
   * request bodies
   * path/query params
   * security schemes
4. Generate outputs.

### Output 1: IntelliJ bundle

Generate:

```txt
api-pack/
  service-a.http
  service-b.http
  http-client.env.json
  README.md
```

Example `.http`:

```http
### Login
POST {{authUrl}}/login
Content-Type: application/json

{
  "username": "{{username}}",
  "password": "{{password}}"
}

> {% client.global.set("token", response.body.access_token); %}

### Get users
GET {{serviceAUrl}}/users
Authorization: Bearer {{token}}
```

JetBrains HTTP Client supports `.http` files and OpenAPI-aware request generation, so generating these files is very viable. ([JetBrains][2])

### Output 2: Postman bundle

Generate:

```txt
postman/
  service-a.collection.json
  service-b.collection.json
  company-local.environment.json
  company-dev.environment.json
```

Postman already supports importing OpenAPI specs, but your value is generating cleaner collections plus usable environments and auth variables. ([Postman Docs][1])

## Authentication strategy

Do **not** try to fully automate every company’s login in v1. That becomes a rabbit hole.

OpenAPI can describe auth using security schemes like API keys, bearer auth, basic auth, OAuth2, and OpenID Connect. ([Swagger][3])

For MVP, support these levels:

| Auth type             | MVP handling                                  |
| --------------------- | --------------------------------------------- |
| No auth               | Generate requests directly                    |
| Bearer token          | Add `{{token}}` variable                      |
| API key header        | Add `{{apiKey}}` variable                     |
| Basic auth            | Add `{{username}}` / `{{password}}` variables |
| OAuth2 / OIDC         | Generate placeholders + instructions          |
| Custom login endpoint | Let user define it once                       |

The key feature: **auth profiles**.

Example:

```yaml
authProfiles:
  local-dev:
    type: bearer-login
    loginUrl: https://auth.company.com/login
    method: POST
    body:
      username: "{{username}}"
      password: "{{password}}"
    tokenPath: "$.access_token"
```

Then the app injects token reuse into IntelliJ and Postman.

## MVP product shape

I would build this as a **small CLI first**, not SaaS.

```bash
apipack init
apipack add https://service-a/swagger-ui/index.html
apipack generate --target intellij
apipack generate --target postman
apipack generate --target all
```

Config:

```yaml
workspace: my-company-apis

sources:
  - name: users
    url: https://users.company.com/swagger-ui/index.html
  - name: billing
    url: https://billing.company.com/v3/api-docs

environments:
  local:
    usersUrl: http://localhost:8080
    billingUrl: http://localhost:8081
  dev:
    usersUrl: https://dev-users.company.com
    billingUrl: https://dev-billing.company.com

auth:
  type: bearer
  tokenVariable: token
```

## Why this is worth building

The defensible value is not “convert OpenAPI to Postman”. That exists.

The value is:

> “Give me a clean, organisation-ready API testing pack from messy internal Swagger URLs.”

That includes:

* discovery
* normalization
* auth hints
* shared environments
* generated examples
* refreshable outputs
* team conventions

## Suggested MVP scope

Build only this:

1. CLI app.
2. Accept list of URLs.
3. Discover OpenAPI JSON from Swagger UI URLs.
4. Generate IntelliJ `.http`.
5. Generate Postman collection/environment.
6. Support bearer token/API key placeholders.
7. Produce a README explaining how to use the generated pack.

Avoid for now:

* hosted SaaS
* team accounts
* secret storage
* live API testing
* OAuth device flows
* Confluence crawling
* automatic login magic
* full Postman sync

## My verdict

Yes, it is a good idea, but only if positioned correctly:

**Bad version:**
“OpenAPI to Postman converter.”

**Good version:**
“Internal API workspace generator for developers drowning in Swagger URLs, auth tokens, environments, and stale collections.”

That is much more useful.

[1]: https://learning.postman.com/docs/integrations/available-integrations/working-with-openAPI?utm_source=chatgpt.com "Integrate Postman with OpenAPI"
[2]: https://www.jetbrains.com/help/idea/http-client-in-product-code-editor.html?utm_source=chatgpt.com "HTTP Client | IntelliJ IDEA Documentation - JetBrains"
[3]: https://swagger.io/docs/specification/v3_0/authentication/?utm_source=chatgpt.com "Authentication | Swagger Docs"
