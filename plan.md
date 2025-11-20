BuildWeaver: 16-week concrete weekly implementation plan below. Each week lists owners, tasks, deliverables, test/CI requirements, and acceptance criteria. Roles are assumed evenly available and interchangeable: Frontend (FE), Backend (BE), Full-stack (FS), ML/LLM (ML), DevOps (DO), QA, Designer (UX). Use the tech stack and constraints you provided.

# Overview decisions (concrete)

* Monorepo: pnpm workspaces. Root packages: `apps/editor` (integrated React Vite app with puck + react-flow), `apps/api` (NestJS), `packages/ui`, `packages/codegen`, `packages/libs` (shared types), `packages/db` (drizzle schemas), `packages/llm` (OpenRouter adapter), `packages/ci` (workflow templates).
* Node: 18.x. TypeScript: 5.x. ESLint + Prettier + Husky precommit. Vitest for unit on frontend optional, but use Jest for all unit tests. Playwright for e2e.
* Database: Postgres (drizzle ORM). Migrations with drizzle-orm/migrator. Local Docker compose for dev.
* Auth: email/password + OAuth (Google, GitHub). Use NestJS Passport strategies and JWT sessions. Secrets supplied by user in `.env`. Dev uses test keys you will provide.
* Payments: XPay initial integration (server SDK + webhook endpoint). Design pluggable payment provider interface.
* Codegen: `packages/codegen` implements IR → language adapters. IR chosen JSON AST schema (concrete spec week 2). Initial adapters: React (TSX + Vite project), Flutter (Dart app scaffold), Express (Node routes). Output zip file written by backend and returned to user. GitHub integration optional later.
* LLM: OpenRouter adapter in `packages/llm`. Use structured output enforcement (JSON schema) in prompts.
* Editor: single React app (`apps/editor`) combining Puck UI builder and React Flow for nodes. Clicking a UI Node opens puck canvas for that component. Data Node outputs link into UI Node inputs.
* Hosting: Docker on VPS. Github Actions (hosted runners). Container images pushed to VPS.
* Testing: Jest unit tests for all code. Playwright for key flows (editor, codegen download, auth, payments). Coverage target: 80% on critical modules.
* Branch strategy: feature/* → main via PR. PR template enforces tests and CI.
* Story tracking: use labels `frontend/backend/llm/devops/qa` and `priority:high/med/low`.

---

# Week 1 — Repo, infra, skeletons, developer workflow

Owners: DO, FS, BE, FE, QA
Tasks

* Create GitHub repo `buildweaver` monorepo skeleton with pnpm workspaces and basic README.
* Add folder structure described above. Initialize `package.json` workspaces.
* Add ESLint, Prettier, tsconfig base, Husky precommit hooks (lint, typecheck).
* CI: Add GitHub Actions templates for `lint`, `test` and `build` for monorepo. Actions run on PRs to `main`. Use matrix jobs for `apps/editor`, `apps/api`, and `packages/*`.
* Docker: add root `docker-compose.dev.yml` with Postgres, pgadmin, Redis (for queue), and `apps/api` service.
* Drizzle: init `packages/db` with empty schema and migrations folder.
* Create empty Vite React TS app in `apps/editor` and NestJS starter in `apps/api`.
* Create `packages/libs` with shared types `IR` placeholder file.
  Deliverables
* Repo created with CI pipelines that run lint and basic tests (placeholder).
* Docker dev compose up works.
  Acceptance criteria
* `pnpm install` then `pnpm -w test` runs and passes placeholder tests.
* `docker-compose up` starts Postgres and NestJS app.
  Tests/CI
* Jest smoke tests in both apps. Playwright not yet configured.

# Week 2 — IR spec, core shared types, codegen scaffolding

Owners: FS, BE, ML, FE
Tasks

* Finalize concrete language-agnostic IR schema. Deliver JSON Schema file `packages/libs/ir.schema.json`. IR must describe:

  * UI tree (components, props, styles, bindings)
  * Logic graph (nodes, node types, input/output ports, edges)
  * Data shapes (types)
  * Block nodes (larger wrapper node that house logic inside them associated with them, such as auth-protection, paywall, etc.)
    * Auth requirements (page-level)
    * Payment hooks (page-level)
  * Metadata (project name, assets)
* Implement TypeScript types from schema in `packages/libs`. Export types for all packages.
* Implement `packages/codegen` scaffold:

  * `codegen-core` to accept IR and produce normalized AST.
  * Adapter interface `CodegenAdapter { generate(ir): Promise<GeneratedBundle> }`.
  * Create empty adapters `react-adapter`, `flutter-adapter`, `express-adapter`.
  * Implement `zip` writer util.
* Update CI to run typecheck across packages.
  Deliverables
* `ir.schema.json` and TypeScript types.
* Working codegen scaffold with unit tests for adapter interface.
  Acceptance criteria
* Types compile across monorepo.
* Unit tests for `packages/codegen` pass.

# Week 3 — DB schema, auth primitives, API skeletons

Owners: BE, DO, QA
Tasks

* Design drizzle schema for:

  * users, oauth_accounts, sessions, projects, pages, nodes, edges, assets, codegen_jobs, payments, webhooks.
* Implement initial migrations in `packages/db`. Add db client wrapper to `apps/api`.
* Implement NestJS modules: `auth`, `projects`, `editor` (CRUD), `codegen` (job queue), `payments`.
* Implement email/password registration and login endpoints. JWT token issuance plus refresh tokens stored in DB sessions.
* Add OAuth skeleton endpoints for Google & GitHub. Use passport strategies with config that reads env.
  Deliverables
* DB migrations applied locally.
* Auth endpoints for register/login working with Postman.
  Acceptance criteria
* Able to register/login and create project via API. Tests for auth module added to CI.

# Week 4 — Editor: integrate puck + react-flow, basic node graph

Owners: FE, UX, FS, QA
Tasks

* Build `apps/editor` as single Vite app containing:

  * React Flow canvas for logic nodes.
  * Puck UI builder integrated as a panel. (Concrete: embed puck as an iframe module or library depending on puck packaging; implement route `/puck/:componentId`).
  * Implement `UI Node`, `Data Node`, `Action Node` node types in React Flow.
  * Clicking a `UI Node` opens puck canvas for that component in a side panel. Save/Load component JSON to project via API.
* Implement node selection sync: when node clicked, show node metadata and connections.
* Implement saving nodes/pages to backend `projects/:id/pages`.
  Deliverables
* Editor that can create nodes and persist graph to backend.
  Acceptance criteria
* Create a small graph with a UI Node and Data Node, save, reload. Playwright test for graph save/load passes.

# Week 5 — UI builder deep integration, binding inputs

Owners: FE, FS, UX
Tasks

* In puck canvas show "Inputs" panel listing all Data Node outputs available in the project (pulled from backend).
* Implement binding UI in puck allowing props to bind to IR paths from Data Node outputs. Save bindings into component metadata in IR.
* Ensure UI Node exposes its inputs in React Flow inspector when selected.
* Implement visual indicator in React Flow showing linked UI Nodes and Data Nodes.
  Deliverables
* End-to-end flow: create Data Node → create UI Node → bind a UI component prop to Data Node output.
  Acceptance criteria
* Playwright test: create data node with sample output, bind to UI component prop in puck, save, and confirm binding persists.

# Week 6 — Codegen IR export + local preview

Owners: FE, BE, FS, QA
Tasks

* Implement IR export endpoint `GET /projects/:id/export` returning full IR JSON.
* Implement local preview server in `apps/editor` to render generated React code in an iframe for quick preview using `packages/codegen/react-adapter` skeleton (stubbed render).
* Implement generation job enqueue API `POST /projects/:id/codegen` to queue job.
* Add background worker in NestJS (`bull` or simple queue + Redis) to run codegen adapters and produce zip to `storage/` and return signed URL.
  Deliverables
* IR export and job enqueue endpoints. Local preview works with stubbed code.
  Acceptance criteria
* IR can be exported and previewed. CI test: `export` endpoint returns valid JSON schema.

# Week 7 — Implement React codegen adapter (first pass)

Owners: FS, FE, BE, QA
Tasks

* Implement `react-adapter`:

  * Consume IR. Produce a Vite + React TSX app scaffold that:

    * Renders pages.
    * Registers routes for pages.
    * Includes minimal Tailwind setup and assets folder.
    * Implements bindings between data sources and UI props using a generated data layer (simple fetch wrappers or local mocks).
  * Package into zip.
* Add unit tests for adapter output shape and generated file presence.
  Deliverables
* Working adapter that produces a downloadable zip of a runnable React app for simple pages.
  Acceptance criteria
* Generated zip unzips and `pnpm install && pnpm dev` boots the app and shows the page (CI can run a smoke run in an isolated job).

# Week 8 — Implement Express backend codegen adapter + codegen API polish

Owners: BE, FS, QA
Tasks

* Implement `express-adapter` that produces:

  * Express app with routes for APIs used by generated frontend.
  * Example controllers for auth stubs, data endpoints wired to generated data models.
* Add codegen job lifecycle tracking: status `queued/running/success/failed`, logs persisted.
* Implement endpoint `GET /codegen/jobs/:id` and download endpoint for zip.
  Deliverables
* Express adapter and completed codegen job flow.
  Acceptance criteria
* Codegen job that produces both frontend and backend zips. Download works. Unit tests pass.

# Week 9 — LLM integration: OpenRouter adapter + prompt tooling

Owners: ML, FS, BE
Tasks

* Implement `packages/llm` OpenRouter adapter with:

  * Template prompts manager supporting JSON Schema validation of LLM outputs.
  * Prompt templates for:

    * UI component generation assistance (from text spec → puck component skeleton).
    * Logic node generation (generate node configurations given intent).
    * IR refinement assistant (optimize IR for codegen).
* Implement endpoint `POST /llm/generate` that calls OpenRouter, validates JSON schema, and returns structured payload.
* Create a "suggest" button in editor nodes to request LLM assisted node code generation.
  Deliverables
* LLM adapter with structured output enforcement and test mocks.
  Acceptance criteria
* Unit tests simulate OpenRouter response and validate schema. Editor can call `suggest` and receive structured suggestions.

# Week 10 — Node automation: LLM-assisted logic generation and UI generation

Owners: FE, ML, FS, QA
Tasks

* Implement UI for LLM suggestions:

  * In React Flow, `Create from prompt` modal for nodes.
  * For UI builder, `Generate component` modal that uses LLM to produce puck component JSON that can be inserted.
* Implement server side validation and safety: schema validation and review UI before acceptance.
* Add audit log entries for LLM outputs (user can accept/reject).
  Deliverables
* LLM assist fully wired into editor flows.
  Acceptance criteria
* Playwright test: generate a UI component via LLM, accept, and have it appear in project IR.

# Week 11 — Flutter adapter implementation

Owners: FS, Mobile dev, QA
Tasks

* Implement `flutter-adapter`:

  * Translate IR UI into Flutter widget tree sample code.
  * Scaffold basic Flutter project with `main.dart`, routing, and placeholder data layer.
  * Ensure code compiles in local environment (CI should run `dart analyze` if feasible).
* Add config option in codegen job to select adapters (React + Express + Flutter).
  Deliverables
* Flutter adapter outputs zip that compiles locally with `flutter analyze`.
  Acceptance criteria
* Generated Flutter project passes static analysis in CI job (if runtime not possible CI should test file presence and necessary `pubspec.yaml`).

# Week 12 — Auth templates and protected pages codegen

Owners: BE, FS, QA
Tasks

* Implement codegen templates for:

  * Auth system (email/password + OAuth) in generated React app and Express backend, with protected routes and sample `AuthGuard`.
  * Ensure generated code includes login/register flows, JWT handling, and sample protected page.
* Add IR flags for pages marked `auth_required:true` and codegen uses that flag.
* Add example Playwright tests in generated React to validate protected page redirect behavior.
  Deliverables
* Auth template integrated in codegen outputs.
  Acceptance criteria
* Generated app shows login flow and protects `auth_required` pages. Tests validate.

# Week 13 — Payments templates and webhook handling

Owners: BE, FS, QA, DO
Tasks

* Implement XPay adapter in `apps/api` for user deployments:

  * Server-side webhook endpoint to process payments and mark project payment status.
  * Codegen templates for generated apps that integrate XPay client SDK and protect `payment_required` pages (client checks payment status and redirects).
* Implement admin UI in editor to set payment-required pages and XPay config per project.
* Add test sandbox credentials flow in UI (user will input their keys in `.env` for deploy).
  Deliverables
* Payment template flows and webhook handling.
  Acceptance criteria
* Playwright test: simulate a webhook and confirm project page becomes accessible as payment processed.

# Week 14 — Tests, QA sweep, coverage, and templates library

Owners: QA, FS, FE, BE
Tasks

* Write comprehensive Jest tests and Playwright suites:

  * Editor flows, node binding, LLM acceptance, codegen end-to-end, auth, payment webhook flows, codegen zip download.
* Set coverage gates in CI for critical packages (`apps/editor`, `apps/api`, `packages/codegen`, `packages/llm`) at 80% on core modules. Non-critical modules 60%.
* Build templates catalog UI in editor for:

  * Auth template
  * Payments template
  * Example CRUD app
  * Landing page
    Deliverables
* Test suites in CI and templates UI.
  Acceptance criteria
* CI passes with coverage gates. Playwright e2e pass on PR main.

# Week 15 — Dockerization, deployment, and VPS setup

Owners: DO, BE, FS
Tasks

* Create Dockerfiles for `apps/editor` and `apps/api`. Use multi-stage builds. Push images to GitHub Packages.
* GitHub Actions workflow to build, test, and push images on `main` merges.
* VPS deploy scripts: `deploy.sh` to pull images, run `docker-compose.prod.yml`, env var loading instructions for users.
* Add runtime healthchecks, Prometheus metrics basic endpoints, and log rotation.
  Deliverables
* Production Docker images and deployment scripts.
  Acceptance criteria
* On VPS, `deploy.sh` runs and services start. Health endpoints return 200.

# Week 16 — Final hardening, docs, demo, and buffer

Owners: All
Tasks

* Final QA pass and bugfixes. Fix remaining issues from prior weeks.
* Write developer and user docs:

  * Setup dev environment.
  * How to add payment keys and OAuth keys.
  * IR spec docs and codegen adapter integration guide.
  * How to add a new language adapter.
* Prepare 20-minute demo checklist and sample projects.
* Release: tag `v0.1.0`, merge release PR, create release artifacts (zip of generated sample, screenshots).
  Deliverables
* Release candidate, full docs, demo.
  Acceptance criteria
* All critical tests pass. Demo shows editor → LLM assist → codegen → zip download → generated app run.

---

# Cross-cutting concrete tasks and specs (all weeks)

* Logging: Use `pino` on backend. Correlate request IDs.
* Secrets: store in GitHub Actions secrets. `.env.example` in repo. Users set their own `.env` for production.
* API spec: OpenAPI (Swagger) auto generated from Nest controllers. Publish at `/api/docs`.
* Observability: basic metrics endpoint `/metrics`. Health check `/health`.
* Security: rate limit LLM and codegen endpoints. Validate and sanitize all LLM outputs against JSON Schema. Use helmet, CORS strict policies.
* PR policy: require 1 code review, CI green, and tests passing. Use PR templates.
* Tickets: one task per feature with acceptance criteria. Use labels and milestones per week.
* Tests: Jest unit for all modules; Playwright e2e for these flows:

  1. User register/login.
  2. Create project + editor node flow.
  3. LLM generate component.
  4. Bind data to UI.
  5. Codegen job produces zip and download works.
  6. Generated React app login and protected page test.
  7. Payment webhook test.
* Coverage: track with `coverage` job in CI and fail PR if below threshold for critical packages.
* Timeboxing: each week ends with demo and retro. Fixes prioritized into next week backlog.

# Deliverable checklist by week (concise)

Week1: repo + CI + Docker dev.
Week2: IR spec + codegen scaffold.
Week3: DB + auth endpoints.
Week4: Editor base + React Flow + puck Hookup.
Week5: Bindings and UI inputs.
Week6: IR export + preview + codegen queue.
Week7: React adapter working.
Week8: Express adapter + job flow.
Week9: OpenRouter adapter + prompt schemas.
Week10: LLM assisted node/UI generation.
Week11: Flutter adapter.
Week12: Auth templates in codegen.
Week13: XPay templates + webhooks.
Week14: Tests, templates library, coverage.
Week15: Docker images and VPS deploy scripts.
Week16: Docs, final QA, demo, release.

# Risk log and mitigations (concrete)

* LLM structured output fails. Mitigation: enforce JSON Schema validation, add human review step before applying. Keep fallback manual generator UI.
* Puck integration mismatch. Mitigation: embed via iframe and create lightweight adapter layer to translate puck JSON ↔ IR. Reserve 1 sprint buffer for heavy integration.
* Codegen correctness for Flutter. Mitigation: start with minimal widget coverage and expand. Provide sample projects and document limitations.
* Payment provider differences. Mitigation: design pluggable provider interface from day one. XPay is first concrete implementation.

# Final notes

* No features left vague. All choices are concrete and implemented in the weekly plan.
* If you want specific task breakdowns into story tickets or estimated story points, I will produce them next. Otherwise this plan is ready to assign and execute.
