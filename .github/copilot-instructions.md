# Copilot Instructions for BuildWeaver

## Overview
This repository contains **BuildWeaver**, a self-hosted visual app builder.  
It combines a **visual UI builder (Puck)**, a **node-based logic builder (React Flow)**, a **language-agnostic code generator**, and **LLM-assisted generation** for logic and UI.

The codebase is a **monorepo** managed with **pnpm workspaces** and structured for modularity.  
Copilot should follow the architectural conventions and use the correct packages and patterns described below.

---

## Monorepo Structure

```markdown

buildweaver/
│
├─ apps/
│   ├─ editor/      # React (TypeScript + Vite) app with Puck + React Flow
│   ├─ api/         # NestJS backend server
│
├─ packages/
│   ├─ db/          # Drizzle ORM schemas and migrations
│   ├─ codegen/     # Language-agnostic code generator and adapters
│   ├─ llm/         # OpenRouter adapter and prompt management
│   ├─ libs/        # Shared types, IR schema, and utility functions
│   ├─ ui/          # Reusable UI components (for editor)
│   ├─ ci/          # Reusable CI workflow templates
│
├─ docker-compose.dev.yml
├─ docker-compose.prod.yml
├─ package.json
└─ pnpm-workspace.yaml

```

---

## Core Principles

- **Everything is TypeScript.** Use strict typing and existing shared types from `packages/libs`.
- **IR (Intermediate Representation)** is the single source of truth for generated projects.  
  Never hardcode schema-like data in feature code — import it from `packages/libs/ir.schema.json` or the generated `ir.ts`.
- **All features must be testable.** Use **Jest** for unit tests and **Playwright** for end-to-end tests.
- **All APIs are modular.** Each feature lives in its own NestJS module.
- **Codegen adapters are pure functions.** They take `IR` input and return a `GeneratedBundle` object.
- **LLM output must always be schema-validated** before usage.

---

## Package Responsibilities

### `apps/editor`
- Frontend built with React (Vite + Tailwind + TypeScript).
- Uses:
  - `react-flow` for node-based logic builder.
  - `@measured/puck` for UI builder.
  - Shared types and APIs from `packages/libs`.
- Responsibilities:
  - Manage projects, pages, and node graphs.
  - Integrate with LLM for node and UI generation.
  - Connect to backend via REST (OpenAPI client generated from Nest controllers).
- **Copilot behavior**:
  - Use React functional components with hooks.
  - Follow Tailwind conventions for styling.
  - Use Zustand or Context for state management (not Redux).
  - Prefer composition over inheritance.
  - When adding features, link data flow between nodes and UI bindings through IR types.

### `apps/api`
- Backend built with **NestJS**.
- Responsibilities:
  - Auth (email/password + OAuth via Passport).
  - Project management, codegen job orchestration, payment processing.
  - LLM proxy to OpenRouter.
  - Webhook handling for XPay.
- **Copilot behavior**:
  - Create new endpoints as NestJS controllers within feature modules.
  - Always validate DTOs with `class-validator`.
  - Use Drizzle ORM for data access. Never write raw SQL.
  - Use dependency injection (`@Injectable`) for services.
  - Log with `pino`.
  - Return consistent `ApiResponse` objects.
  - Maintain OpenAPI decorators (`@ApiTags`, `@ApiResponse`) for Swagger generation.

### `packages/db`
- Contains Drizzle schema and migration logic.
- **Copilot behavior**:
  - Add new tables by extending `schema.ts`.
  - Use snake_case for DB columns and camelCase for TypeScript fields.
  - Always update `drizzle.config.ts` when adding migrations.
  - Never edit generated migrations manually.

### `packages/codegen`
- Contains the language-agnostic **code generation system**.
- **Core structure**:
```

packages/codegen/
├─ core/           # Common functions for IR traversal
├─ adapters/
│   ├─ react/
│   ├─ flutter/
│   └─ express/

````
- Each adapter implements:
```ts
export interface CodegenAdapter {
  generate(ir: IR): Promise<GeneratedBundle>;
}
````

* **Copilot behavior**:

  * Keep adapters deterministic and pure.
  * Output a zip-ready file tree.
  * Never access network or databases inside adapters.
  * Use utility functions from `packages/codegen/core`.

### `packages/llm`

* Provides structured interface to OpenRouter APIs.
* **Copilot behavior**:

  * Use OpenRouter REST API calls only through `fetchWithHeaders` helper.
  * Always enforce JSON schema validation on outputs.
  * When generating prompts, wrap user input in system-defined templates from `/prompts/`.
  * Responses must be parsed and validated before sending to frontend.

### `packages/libs`

* Shared IR schema and types.
* **Copilot behavior**:

  * Always import shared types (e.g., `Project`, `Page`, `IRNode`, `GeneratedBundle`) from this package.
  * Never redefine these types locally.
  * When extending IR, update `ir.schema.json` and regenerate types.

---

## Testing Rules

* **Unit tests**: Jest for all logic and backend code.
* **E2E tests**: Playwright for frontend.
* **Coverage target**: 80% on core modules.
* **Copilot behavior**:

  * Generate tests along with implementation.
  * Prefer `describe/it` structure.
  * Use `supertest` for NestJS APIs.
  * For frontend, write component tests using `@testing-library/react`.

---

## CI/CD Behavior

* GitHub Actions run:

  * `lint`, `test`, and `build` on PR.
  * `docker-build` and `push` on merge to `main`.
* **Copilot behavior**:

  * When adding new packages, update `.github/workflows/ci.yml` matrix.
  * Ensure build scripts are non-interactive.
  * Avoid hardcoding secrets — reference `${{ secrets.* }}` variables.

---

## LLM Usage Policy

* Always use `packages/llm` to call OpenRouter.
* Prompts must declare expected JSON structure and validate before accepting.
* Never directly send raw user input to LLM endpoints.
* Sensitive data must not be included in prompts.

---

## Security and Validation

* Sanitize all user inputs.
* Never trust LLM output; validate it.
* Use JWT for user sessions.
* Use Helmet and rate limiting on NestJS.
* CORS allowed only for editor origin.

---

## Code Style

* Follow Prettier and ESLint rules defined in root config.
* Variable naming: `camelCase` for vars/functions, `PascalCase` for components/types.
* Avoid `any`. Prefer explicit types from shared packages.
* Use async/await over Promises.
* Tailwind class order: structure → color → spacing.

---

## Commit & Branching Rules

* Feature branches: `feature/<short-description>`.
* PRs must include:

  * Passing CI.
  * At least one code review.
  * Updated tests and docs if needed.
* Copilot should generate concise, descriptive commit messages that match the task scope.

---

## Codegen Output Policy

* Generated apps must include:

  * Proper routing structure.
  * Auth templates (if auth_required).
  * Payment template (if payment_required).
* Always produce zippable folder trees using utilities in `packages/codegen/core/zip.ts`.

---

## How Copilot Should Behave

When completing code:

* Respect architectural boundaries (frontend vs backend vs shared types).
* Suggest imports from local `packages/` rather than third-party libraries if available.
* Use existing helpers before writing new utilities.
* Always include types and schema validation.
* Default to functional programming and modular design.
* Generate accompanying Jest or Playwright tests automatically.
* Follow the established naming patterns:

  * Services: `XService`
  * Controllers: `XController`
  * DTOs: `CreateXDto`, `UpdateXDto`
  * React Components: `XPanel`, `XDialog`, `XCard`
  * Codegen Adapters: `<Language>Adapter`

After completing code:

* Generate a logs/{timestamp}.log entry summarizing changes. Mention which of the provided requirements were fulfilled and which were not.
* Ensure no ESLint or Prettier errors.
* Ensure the whole project, even if it seems unrelated to current work, passes typecheck, lint, tests and build successfully locally before ending work cycle.

---

## Example Good Patterns for Copilot

**Backend (NestJS):**

```ts
@Controller('projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ProjectDto> {
    return this.service.getProjectById(id);
  }
}
```

**Frontend (React + Vite):**

```tsx
export const NodeInspector: FC<{ nodeId: string }> = ({ nodeId }) => {
  const node = useNodeStore((s) => s.nodes[nodeId]);
  if (!node) return null;
  return (
    <div className="p-3 border rounded-xl bg-white shadow-sm">
      <h2 className="font-semibold">{node.name}</h2>
      <BindingsPanel bindings={node.bindings} />
    </div>
  );
};
```

**Codegen Adapter:**

```ts
export const ReactAdapter: CodegenAdapter = {
  async generate(ir) {
    const files = createReactAppFiles(ir);
    return zipBundle(files, 'react-app.zip');
  },
};
```

---

## Summary for Copilot

* Know the project: BuildWeaver = full-stack visual builder + LLM-assisted codegen.
* Always prefer **type-safe**, **modular**, **tested** code.
* Follow the structure and style of existing packages.
* Respect **IR schema** as the single truth.
* Never produce code that bypasses schema validation, uses untyped data, or breaks modular boundaries.
* Every file added must be **testable, typed, and lint-clean**.

---
