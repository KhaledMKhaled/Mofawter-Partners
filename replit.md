# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Project: Commission Manager (MVP)

Full-stack Sales & Distributor Commission Management System with three role-based portals.

### Roles
- **ADMIN** — sees everything; can mark orders complete; manages commission rates and users.
- **DISTRIBUTOR** — manages own team of Sales agents; sees team commissions.
- **SALES** — owns clients; submits orders; sees own commissions.

### Core business rule: 5-Year Ownership Rule
When a client is created, ownership is assigned to a Sales agent (and their Distributor) for 5 calendar years (`start.setFullYear(start.getFullYear() + 5)`). When an order is marked COMPLETED by an Admin, commissions are generated **only if** `now` is still within the client's ownership window. Reverting to PENDING removes the commissions. The status update + commission writes are wrapped in a single DB transaction for atomicity.

### Default commission rates
Sales 10%, Distributor 5%. Stored in `settings` table; configurable via `PUT /api/settings/commission-rates` (admin only).

### Auth
JWT (HS256) signed with `JWT_SECRET`. Tokens are set in `Authorization: Bearer <token>` and persisted in localStorage (`auth_token`) by the frontend. In production `JWT_SECRET` must be set or the server fails fast.

### Seed credentials
- `admin@demo.test` / `admin123`
- `distributor@demo.test` / `distributor123`
- `sales@demo.test` / `sales123`

Run `pnpm --filter @workspace/scripts run seed` to (re)seed the dev database.

### Artifacts
- `artifacts/api-server` — Express + Drizzle + Postgres backend (port via `PORT`).
- `artifacts/commission-app` — React + Vite frontend (uses generated react-query hooks from `@workspace/api-client-react`).
