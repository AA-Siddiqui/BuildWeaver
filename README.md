# BuildWeaver

Self-hosted visual app builder monorepo managed with pnpm workspaces.

## Structure

- `apps/editor`: React + Vite front-end workspace.
- `apps/api`: NestJS backend with Pino logging.
- `packages/*`: Shared libs, UI kit, codegen core, database schema, LLM adapters, CI templates.

## Requirements

- Node 18 (Corepack enabled for pnpm 8.10).
- Postgres 15, Redis 7 for local dev (see `docker-compose.dev.yml`).

## Getting Started

```bash
corepack enable pnpm
pnpm install
pnpm --filter @buildweaver/editor dev   # frontend dev server
pnpm --filter @buildweaver/api start:dev # backend watcher
```

## Quality Gates

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` run across the workspace.
- Husky pre-commit enforces `lint` + `typecheck`.
- GitHub Actions workflow `.github/workflows/ci.yml` runs lint/test/build matrices on PRs.

See `plan.md` for the full 16-week roadmap.
