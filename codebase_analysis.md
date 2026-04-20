# Mofawter Partners — Full Codebase Analysis

## 1. Project Overview

**CommissionHQ** is a role-gated, multi-tenant **Sales & Distributor Commission Management** platform. It is a pnpm monorepo composed of multiple packages that share a common database layer, API specification, and generated client. The app runs on Replit but can be self-hosted.

### Business Purpose
- Track clients, orders, and automatically calculate commissions when an order is marked **COMPLETED**
- Enforce a **5-year ownership window** per client: commissions are only earned if an order was placed within the window the client was assigned to a sales/distributor pair
- Support three roles: **ADMIN**, **DISTRIBUTOR**, **SALES**

---

## 2. Monorepo Architecture

```
Mofawter-Partners/
├── lib/
│   ├── db/                  # Drizzle ORM schema + Postgres connection
│   ├── api-spec/            # OpenAPI 3.1 spec (source of truth for types)
│   ├── api-zod/             # Zod schemas generated from the OpenAPI spec
│   └── api-client-react/    # Generated React Query hooks + customFetch layer
├── artifacts/
│   ├── api-server/          # Express 5 REST API (Node.js backend)
│   ├── commission-app/      # Vite + React 19 + TailwindCSS 4 frontend
│   └── mockup-sandbox/      # (Unused/placeholder)
└── scripts/
    └── src/
        ├── seed.ts          # Demo data seeder
        └── hello.ts         # Placeholder
```

**Dependency graph:**
```
api-spec  →  (orval generates) api-zod + api-client-react
db        →  api-server
api-zod   →  api-server
api-client-react → commission-app
```

---

## 3. Package-by-Package Breakdown

### 3.1 `lib/db` — Database Layer
- **Driver**: `drizzle-orm/node-postgres` with a `pg.Pool`
- **Connection**: reads `DATABASE_URL`; throws at startup if absent
- **Tables**:

| Table | Key Fields | Notes |
|---|---|---|
| `users` | id, name, email, passwordHash, role, distributorId | role ∈ {ADMIN, DISTRIBUTOR, SALES} |
| `clients` | id, name, assignedSalesId, assignedDistributorId, ownershipStartDate, ownershipEndDate | ownershipEnd = ownershipStart + 5 years |
| `orders` | id, clientId, orderName, amount (NUMERIC 14,2), orderDate, status | status ∈ {PENDING, COMPLETED} |
| `commissions` | id, orderId, userId, amount, roleType, status | status ∈ {UNPAID, PAID}; roleType ∈ {SALES, DISTRIBUTOR} |
| `settings` | key (PK), value (text), updatedAt | key-value store for configurable rates |

> **Note**: No foreign key constraints are defined in Drizzle schema. Referential integrity is enforced purely at application level.

---

### 3.2 `lib/api-spec` — OpenAPI Contract
- A single `openapi.yaml` (OpenAPI 3.1) defining all 13 endpoints across 8 tags
- Used as the **source of truth**; `orval` generates typed React hooks and Zod schemas from it
- All auth-required endpoints are implicit (no `securitySchemes` defined in the spec)

---

### 3.3 `lib/api-zod` — Validated Request Bodies
- Contains **Zod schemas** generated from the OpenAPI spec
- Currently only `LoginBody` is explicitly consumed in the server (`auth.ts` route)
- Other request bodies are validated informally via manual checks in route handlers

---

### 3.4 `lib/api-client-react` — React Query Client
- **`custom-fetch.ts`**: A robust ~380-line fetch wrapper that:
  - Prepends a `_baseUrl` (for React Native/Expo reuse)
  - Reads `auth_token` from `localStorage` and attaches `Authorization: Bearer` header automatically
  - On `401`, clears token and redirects to `/login`
  - Parses responses as JSON/text/blob with BOM stripping and error extraction
  - Exports typed `ApiError` and `ResponseParseError` classes
- **`generated/`**: Orval-generated hooks (`useGetMe`, `useListOrders`, `useCreateOrder`, `useUpdateOrderStatus`, `useListCommissions`, `useListUsers`, `useCreateUser`, `useGetDashboardSummary`, `useGetCommissionRates`, `useUpdateCommissionRates`)

---

### 3.5 `artifacts/api-server` — Express 5 Backend

#### Entry & Setup (`app.ts`, `index.ts`)
- `pino-http` for structured request logging (method + URL stripped of query string)
- CORS enabled globally with no origin restriction — **open CORS**
- Reads `PORT` from env; throws if missing or invalid
- JWT secret falls back to `"dev-only-change-me-in-prod"` in non-production — protected by guard

#### Auth (`lib/auth.ts`, `middlewares/auth.ts`)
- **Bcrypt** (cost factor 10) for password hashing via `bcryptjs`
- **JWT** signed with HS256 (7-day expiry) via `jsonwebtoken`
- `JwtPayload` contains `{ sub: number, role: AuthRole, distributorId: number | null }`
- `requireAuth`: validates Bearer token, attaches `req.auth`
- `requireRole(...roles)`: checks `req.auth.role` against whitelist; short-circuits before `requireAuth` if `req.auth` is absent

#### Routes

| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/healthz` | GET | No | Health check |
| `/api/auth/login` | POST | No | Returns JWT + user DTO |
| `/api/auth/me` | GET | Yes | Returns current user |
| `/api/users` | GET | Yes | List users (with role/distributorId filters) |
| `/api/users` | POST | ADMIN, DISTRIBUTOR | Create user |
| `/api/clients` | GET | Yes | List clients (scoped by role) |
| `/api/clients` | POST | Yes | Create client (deduce distributor from sales agent) |
| `/api/orders` | GET | Yes | List orders (scoped by role) |
| `/api/orders` | POST | Yes | Create order |
| `/api/orders/:id/status` | PATCH | ADMIN only | Mark PENDING↔COMPLETED, triggers commissions |
| `/api/commissions` | GET | Yes | List commissions (scoped by role) |
| `/api/dashboard/summary` | GET | Yes | Role-specific KPI summary |
| `/api/settings/commission-rates` | GET | Yes | Read commission rates |
| `/api/settings/commission-rates` | PUT | ADMIN only | Update commission rates |

---

### 3.6 `artifacts/commission-app` — React Frontend

#### Routing (Wouter)
- Role-based protected routes via `ProtectedRoute` component
- `useGetMe()` is called inside every protected route on every render → **N+1 API call issue** (see §5)
- Root `/` always redirects to `/admin` hardcoded — **bug for non-admin first login**

#### Pages

| Role | Pages |
|---|---|
| ADMIN | Dashboard · Orders · Users · Commissions · Settings |
| DISTRIBUTOR | Dashboard · Team · Commissions |
| SALES | Dashboard · Clients · Orders · Commissions |

#### Component Library
- Full **shadcn/ui** primitives (55 components) based on Radix UI + TailwindCSS 4
- Custom extras: `Empty`, `Field`, `Item`, `InputGroup`, `ButtonGroup`, `Spinner`, `Kbd`
- Recharts installed for charting (used in `chart.tsx`) but no charts rendered in pages yet

---

## 4. Core Logic Deep-Dive

### 4.1 Commission Generation Flow

```
Admin clicks "Mark Complete"
  → PATCH /api/orders/:id/status  { status: "COMPLETED" }
  → orders.ts handler:
      1. Fetch order
      2. Fetch client
      3. Check: only ADMIN can set COMPLETED
      4. getCommissionRates() → read from settings table
      5. db.transaction():
           a. UPDATE orders SET status = 'COMPLETED'
           b. DELETE existing commissions for this orderId  ← idempotency
           c. Check ownership window: order.orderDate ∈ [client.ownershipStartDate, client.ownershipEndDate]
           d. If in window: INSERT two commission rows (SALES + DISTRIBUTOR)
      6. Re-fetch & enrich order → return
```

**Key design decisions:**
- Commission calculation uses the **order placement date**, not the completion date — correctly noted in code comment
- Reverting to PENDING deletes commissions for the order (soft rollback)
- Commission status remains `UNPAID` permanently — no payout flow exists

### 4.2 Ownership Window
- Created at client creation: `start = now`, `end = start + 5 years`
- Enforced only at order completion time
- No mechanism to extend or override the window after creation
- `addFiveYears` function is duplicated between `clients.ts` route and `scripts/seed.ts`

### 4.3 Data Enrichment Pattern
Every route that returns `orders` or `commissions` must JOIN manually:
```
enrichOrders():  orders → clientIds → clientMap → userIds → userMap → merge
enrich():        commissions → orderIds → orderMap → clientIds → clientMap → userIds → userMap → merge
```
These do **N individual queries** (one per ID) using `Promise.all`. No SQL JOINs are used anywhere.

### 4.4 Dashboard Aggregation
- The `/api/dashboard/summary` endpoint fetches **all** orders, commissions, and users from the DB, then filters/aggregates in JS
- This is fine for small datasets but will not scale past ~50,000 rows
- For DISTRIBUTOR role, it fetches team members twice (once for commissions filter, once for teamSize count)

---

## 5. Identified Issues & Bugs

### 🔴 Critical

| # | Location | Issue |
|---|---|---|
| C1 | `app.ts` L28 | **CORS is open to all origins** — `cors()` with no options allows any domain to call the API. Should be restricted to known origins in production. |
| C2 | `orders.ts` L102–106 | **Inefficient order filtering**: fetches ALL orders then filters in JS. On large datasets this degrades severely. Should use an SQL `IN` query. |
| C3 | `App.tsx` L89 | **Root redirect always goes to /admin** — a DISTRIBUTOR or SALES user landing on `/` gets a redirect to `/admin`, then ProtectedRoute bounces them to `/distributor` or `/sales`. Two round-trips with flicker. Should resolve role first. |

### 🟠 High

| # | Location | Issue |
|---|---|---|
| H1 | `App.tsx` L38 | **`useGetMe` called inside every `ProtectedRoute`** — React calls this hook on every navigation. Each route renders a fresh `useGetMe` call. Should lift auth state to a context. |
| H2 | Database schemas | **No foreign key constraints** — `clients.assignedSalesId`, `orders.clientId`, `commissions.orderId/userId` have no FK constraints. Orphaned records are possible. |
| H3 | `settings.ts` lib | **No caching on commission rates** — `getCommissionRates()` does a full DB fetch every time it's called. Called multiple times per order completion. Should cache in memory with a short TTL. |
| H4 | `commissions.ts` L87–98 | **Distributor commission filter loads ALL commissions** — fetches all commissions into Node, then filters by allowed user IDs. Use SQL `IN` clause. |
| H5 | `users.ts` route POST | **No email uniqueness validation response** — if duplicate email inserted, throws a DB error; the catch block returns `err.message` which may expose internal DB error text to the client. |

### 🟡 Medium

| # | Location | Issue |
|---|---|---|
| M1 | `lib/auth.ts` L40 | **JWT expiry is hard-coded to 7 days** — not configurable via env. Should be `JWT_EXPIRES_IN` env var. |
| M2 | `orders.ts` POST | **No Zod validation on request body** — uses manual `if (!clientId || !orderName ...)` checks. Inconsistent with auth route which uses `LoginBody.safeParse`. |
| M3 | `clients.ts` toDto | **ownershipStartDate/End exposed as ISO strings** — timezone-free comparison in commission calculation might have edge cases near midnight UTC. |
| M4 | `dashboard.ts` L89–96 | **Team fetched twice for DISTRIBUTOR** — once at L58–62 to filter commissions, then again at L88–93 for teamSize count. Can be deduplicated. |
| M5 | `admin/users.tsx` | **Admin can only create DISTRIBUTORS** — the form hardcodes `role: Role.DISTRIBUTOR`. There's no UI to create ADMIN or SALES users from the Admin panel. |
| M6 | Seed script | **Hardcoded plain-text passwords in seed output** — printed to console. Acceptable for dev but should be gated behind `NODE_ENV !== 'production'`. |
| M7 | `custom-fetch.ts` L370–373 | **Hard redirect on 401** — `window.location.href = "/login"` skips React Router and causes a full page reload. Should use Wouter's navigate. |

### 🔵 Low / Cosmetic

| # | Location | Issue |
|---|---|---|
| L1 | `addFiveYears` | Duplicated in `clients.ts` and `seed.ts`. Should live in `lib/db` or a shared util. |
| L2 | `dashboard.ts` | Enrichment logic duplicated from `commissions.ts` `enrich()`. Should be shared. |
| L3 | `commission-app` | `framer-motion` and `recharts` are installed but unused in current pages. |
| L4 | `pnpm-workspace.yaml` | References `lib/integrations/*` which doesn't exist. |
| L5 | `openapi.yaml` | No `securitySchemes` or `security` annotations — tools that consume the spec won't know auth is required. |

---

## 6. Future Enhancement Roadmap

### Phase 1 — Stability & Scale (Recommended First)

| Priority | Enhancement | Details |
|---|---|---|
| P1 | **SQL JOINs instead of N+1 queries** | Replace `Promise.all(ids.map(id => db.select().where(eq(..., id))))` with Drizzle `.leftJoin()` across orders, clients, users tables. |
| P1 | **Auth Context in React** | Move `useGetMe` into a top-level `AuthProvider` with React Context. ProtectedRoute reads from context, not a fresh API call each render. |
| P1 | **CORS restriction** | Set `cors({ origin: process.env.ALLOWED_ORIGINS })` in production. |
| P1 | **FK constraints** | Add `references(() => usersTable.id)` etc. in Drizzle schema and migrate. |
| P2 | **Request validation with Zod on all routes** | Extend `api-zod` schemas and use `safeParse` on every POST/PATCH handler. Return structured 400 errors. |
| P2 | **Commission rate caching** | Add a simple in-memory cache (or Redis) with 30s TTL to avoid DB round-trips on every order completion. |
| P2 | **Paginated list endpoints** | Add `?page=&limit=` params with DB-level `LIMIT/OFFSET`. Dashboard summary should use SQL aggregates (`COUNT`, `SUM`) not JavaScript reduction. |

### Phase 2 — Feature Completeness

| Feature | Description |
|---|---|
| **Commission Payout Workflow** | Add a `PATCH /api/commissions/:id/status` endpoint allowing ADMIN to mark commissions PAID. Add filters and summary on the frontend. |
| **Filter & Search** | Table filtering by date range, status, user; search by client/order name. |
| **Full User Management** | Admin UI to create SALES and ADMIN users (not just DISTRIBUTOR). Edit user details, deactivate accounts. |
| **Distributor Orders View** | Distributors can see all orders from their sales team, not just their commissions. |
| **Client Management (Admin)** | Admin view of all clients across all distributors with re-assignment capability. |
| **Ownership Window Override** | Allow ADMIN to extend or reset a client's ownership window (with audit log). |
| **Export / Reports** | CSV/Excel export for commissions, orders, and user performance reports. |
| **Charts & Analytics** | Use the already-installed `recharts` to render revenue trends, commission breakdown pie charts, and sales funnel on dashboards. |
| **Notifications** | In-app or email notifications when: an order is completed, a commission is paid, ownership window is expiring. |

### Phase 3 — Production Hardening

| Feature | Description |
|---|---|
| **Refresh Tokens** | Replace the 7-day JWT with short-lived access tokens + refresh token rotation stored in httpOnly cookies. |
| **Rate Limiting** | Add `express-rate-limit` on `/api/auth/login` (brute-force protection) and general API throttle. |
| **Audit Log Table** | Record who changed what and when for orders, commissions, settings, and users. |
| **Multi-tenant / Company Isolation** | Add a `companyId` discriminator to all tables for true SaaS multi-tenancy. |
| **Automated Tests** | Unit tests for commission calculation logic; integration tests for each API route with Vitest + supertest. |
| **OpenAPI Security Annotations** | Add `securitySchemes: bearerAuth` and `security: [bearerAuth]` to the spec for self-documenting API and accurate client generation. |
| **Environment Validation** | Use `zod` to validate all required env vars at startup (DATABASE_URL, JWT_SECRET, PORT, ALLOWED_ORIGINS). |

---

## 7. Technology Version Notes

| Package | Current | Latest Stable | Notes |
|---|---|---|---|
| Express | `^5` | 5.x | Express 5 is production-ready ✓ |
| React | `19.1.0` | 19.x | Pinned for Expo compat ✓ |
| Drizzle ORM | `^0.45.2` | Latest | Keep up-to-date; migrations strategy not defined |
| TailwindCSS | `^4.1.14` | 4.x | New JIT engine, Vite plugin ✓ |
| Vite | `^7.3.2` | 7.x | Very new; monitor for breaking changes |
| jsonwebtoken | `^9.0.3` | 9.x | ✓ |
| bcryptjs | `^3.0.3` | 3.x | ✓ |

---

## 8. Overall Code Quality Assessment

| Dimension | Score | Notes |
|---|---|---|
| **Architecture** | ⭐⭐⭐⭐ | Clean monorepo with clear package boundaries; spec-first approach is excellent |
| **Type Safety** | ⭐⭐⭐⭐ | End-to-end types from DB schema → API → React hooks; no `any` leakage |
| **Security** | ⭐⭐⭐ | JWT + bcrypt correct; CORS open; no rate limiting; no FK constraints |
| **Performance** | ⭐⭐ | N+1 query pattern throughout; JS-side filtering of entire tables |
| **Test Coverage** | ⭐ | Zero tests; critical commission logic untested |
| **Feature Completeness** | ⭐⭐⭐ | Core MVP works; payout flow, reporting, user management incomplete |
| **Code Reuse** | ⭐⭐⭐ | Some duplication (enrichment, addFiveYears); otherwise DRY |
| **Documentation** | ⭐⭐⭐ | OpenAPI spec is good; limited inline comments outside of the commission window logic |
