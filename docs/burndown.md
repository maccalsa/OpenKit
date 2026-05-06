# OpenKit MVP Burndown

Scope anchor: `docs/spec.md` and `docs/plan.md`

## Burndown

- [x] Create project scaffold
- [x] Add CLI entrypoint
- [x] Add YAML config loading
- [x] Add URL/spec fetcher
- [x] Add Swagger UI discovery for common cases
- [x] Add OpenAPI parser
- [x] Add internal model for APIs/endpoints
- [x] Add auth scheme extraction
- [ ] Add IntelliJ `.http` generator
- [ ] Add IntelliJ environment generator
- [ ] Add Postman collection generator
- [ ] Add Postman environment generator
- [ ] Add generated README output
- [ ] Add sample `apipack.yml`
- [x] Add sample OpenAPI fixture
- [x] Add unit tests for parser
- [ ] Add unit tests for generators
- [ ] Add smoke test for full generation
- [ ] Add project README
- [ ] Run full test/build
- [ ] Commit complete MVP

## Slice Log

### Slice 1 - Scaffold + CLI skeleton

- Status: Done
- Goal: Run `apipack generate --config ... --out ...` and generate a baseline README from YAML config.

### Slice 2 - Spec discovery and parse model

- Status: In progress
- Goal: Discover OpenAPI URLs from Swagger UI links, parse OpenAPI 3.x docs into internal endpoint/auth model, and cover with parser/discovery tests.
