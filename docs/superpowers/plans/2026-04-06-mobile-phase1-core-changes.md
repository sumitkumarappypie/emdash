> **SUPERSEDED** by `2026-04-08-mobile-rewrite-phase1.md`. This plan was for incremental changes; the app was rewritten from scratch instead.

# Mobile Phase 1: Core Changes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the server-side foundation to EmDash core that the mobile app requires — core customer identity, public content API, CSRF/CORS fixes, plugin mobile metadata, app config API, customer auth, push device registration, image transforms, and App Bridge script injection.

**Architecture:** Move customer identity from plugins into core (`_emdash_customers` table). Expose a public read-only content API for published content. Exempt Bearer token requests from CSRF. Add CORS headers. Extend plugin types with `mobile` field. Create `/app/config` endpoint. Inject App Bridge script for mobile requests.

**Tech Stack:** Astro API routes, Kysely (SQLite), Zod, existing EmDash auth token system (`packages/auth/src/tokens.ts`).

**Spec:** `docs/superpowers/specs/2026-04-06-emdash-mobile-architecture-design.md`

**Decision:** Phase 1 is customer-facing only. No admin mobile auth. Admin users use the browser.

---

## File Map

### New Files

| File                                                                | Responsibility                   |
| ------------------------------------------------------------------- | -------------------------------- |
| `packages/core/src/database/migrations/033_customers.ts`            | Core customers table             |
| `packages/core/src/database/migrations/034_push_devices.ts`         | Push devices table               |
| `packages/core/src/astro/routes/api/customers/register.ts`          | Customer signup                  |
| `packages/core/src/astro/routes/api/customers/login.ts`             | Customer login → token           |
| `packages/core/src/astro/routes/api/customers/session.ts`           | Validate customer token          |
| `packages/core/src/astro/routes/api/customers/logout.ts`            | Destroy customer session         |
| `packages/core/src/astro/routes/api/customers/me.ts`                | Get/update customer profile      |
| `packages/core/src/astro/routes/api/public/content/[collection].ts` | Public read-only content         |
| `packages/core/src/astro/routes/api/app/config.ts`                  | App config endpoint              |
| `packages/core/src/api/handlers/app-config.ts`                      | App config business logic        |
| `packages/core/src/api/handlers/customer-auth.ts`                   | Customer auth business logic     |
| `packages/core/src/api/handlers/image-transform.ts`                 | Image transform param parser     |
| `packages/core/src/astro/routes/api/push/register.ts`               | Register/unregister push device  |
| `packages/core/src/mobile/bridge-script.ts`                         | App Bridge JS that gets injected |
| `packages/core/tests/unit/customers.test.ts`                        | Core customer identity tests     |
| `packages/core/tests/unit/app-config.test.ts`                       | App config handler tests         |
| `packages/core/tests/unit/public-content.test.ts`                   | Public content API tests         |
| `packages/core/tests/unit/push-devices.test.ts`                     | Push device registration tests   |
| `packages/core/tests/unit/image-transform.test.ts`                  | Image transform tests            |

### Modified Files

| File                                                     | Change                                                                 |
| -------------------------------------------------------- | ---------------------------------------------------------------------- |
| `packages/core/src/database/types.ts`                    | Add `CustomersTable`, `PushDevicesTable` to Database interface         |
| `packages/core/src/database/migrations/runner.ts`        | Import and register migrations 033, 034                                |
| `packages/core/src/plugins/types.ts`                     | Add `PluginMobileConfig`, `mobile` field, `AppConfigContribution` type |
| `packages/core/src/plugins/hooks.ts`                     | Register `app:config` and `customer:authenticated` hooks               |
| `packages/core/src/api/csrf.ts`                          | Exempt Bearer token requests from CSRF                                 |
| `packages/core/src/astro/middleware/auth.ts`             | Add customer and public routes to PUBLIC_API_PREFIXES                  |
| `packages/core/src/astro/middleware.ts`                  | Add CORS headers + bridge script injection                             |
| `packages/core/src/astro/integration/routes.ts`          | Register all new routes                                                |
| `packages/core/src/astro/routes/api/media/file/[key].ts` | Add `?w=&h=&fit=` query params                                         |
| `packages/plugins/commerce/src/sandbox-entry.ts`         | Add `mobile` config, migrate customer auth to use core customers       |

---

## Task 1: Core Customer Identity — Migration

**Files:**

- Create: `packages/core/src/database/migrations/033_customers.ts`
- Modify: `packages/core/src/database/migrations/runner.ts`
- Modify: `packages/core/src/database/types.ts`
- Create: `packages/core/tests/unit/customers.test.ts`

- [ ] **Step 1: Write failing test for customers table**

Create `packages/core/tests/unit/customers.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Kysely } from "kysely";
import { setupTestDatabase } from "../utils/test-db.js";

describe("core customer identity", () => {
	let db: Kysely<any>;

	beforeEach(async () => {
		db = await setupTestDatabase();
	});

	afterEach(async () => {
		await db.destroy();
	});

	it("can insert and query a customer", async () => {
		await db
			.insertInto("_emdash_customers")
			.values({
				id: "cust_1",
				email: "alice@example.com",
				name: "Alice",
				password_hash: "hashed_pw",
				status: "active",
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			})
			.execute();

		const customer = await db
			.selectFrom("_emdash_customers")
			.selectAll()
			.where("email", "=", "alice@example.com")
			.executeTakeFirst();

		expect(customer).toBeTruthy();
		expect(customer!.name).toBe("Alice");
		expect(customer!.status).toBe("active");
	});

	it("enforces unique email", async () => {
		const base = {
			email: "bob@example.com",
			name: "Bob",
			password_hash: "hash",
			status: "active",
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		await db
			.insertInto("_emdash_customers")
			.values({ id: "cust_1", ...base })
			.execute();

		await expect(
			db
				.insertInto("_emdash_customers")
				.values({ id: "cust_2", ...base })
				.execute(),
		).rejects.toThrow();
	});

	it("can store and retrieve a customer session token", async () => {
		await db
			.insertInto("_emdash_customers")
			.values({
				id: "cust_1",
				email: "alice@example.com",
				name: "Alice",
				password_hash: "hash",
				status: "active",
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			})
			.execute();

		await db
			.insertInto("_emdash_customer_sessions")
			.values({
				id: "sess_1",
				customer_id: "cust_1",
				token_hash: "hashed_token_abc",
				expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
				created_at: new Date().toISOString(),
			})
			.execute();

		const session = await db
			.selectFrom("_emdash_customer_sessions")
			.innerJoin(
				"_emdash_customers",
				"_emdash_customers.id",
				"_emdash_customer_sessions.customer_id",
			)
			.select([
				"_emdash_customers.id as customer_id",
				"_emdash_customers.email",
				"_emdash_customers.name",
				"_emdash_customer_sessions.expires_at",
			])
			.where("_emdash_customer_sessions.token_hash", "=", "hashed_token_abc")
			.executeTakeFirst();

		expect(session).toBeTruthy();
		expect(session!.email).toBe("alice@example.com");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter emdash test -- tests/unit/customers.test.ts`
Expected: FAIL — table `_emdash_customers` does not exist.

- [ ] **Step 3: Write the migration**

Create `packages/core/src/database/migrations/033_customers.ts`:

```typescript
import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("_emdash_customers")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("email", "text", (col) => col.notNull().unique())
		.addColumn("name", "text", (col) => col.notNull())
		.addColumn("password_hash", "text", (col) => col.notNull())
		.addColumn("status", "text", (col) => col.notNull().defaultTo("active"))
		.addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
		.addColumn("updated_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
		.addColumn("last_login_at", "text")
		.execute();

	await db.schema
		.createIndex("idx_customers_email")
		.on("_emdash_customers")
		.column("email")
		.execute();

	await db.schema
		.createIndex("idx_customers_status")
		.on("_emdash_customers")
		.column("status")
		.execute();

	await db.schema
		.createTable("_emdash_customer_sessions")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("customer_id", "text", (col) =>
			col.notNull().references("_emdash_customers.id").onDelete("cascade"),
		)
		.addColumn("token_hash", "text", (col) => col.notNull().unique())
		.addColumn("expires_at", "text", (col) => col.notNull())
		.addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
		.execute();

	await db.schema
		.createIndex("idx_customer_sessions_token")
		.on("_emdash_customer_sessions")
		.column("token_hash")
		.execute();

	await db.schema
		.createIndex("idx_customer_sessions_customer")
		.on("_emdash_customer_sessions")
		.column("customer_id")
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("_emdash_customer_sessions").execute();
	await db.schema.dropTable("_emdash_customers").execute();
}
```

- [ ] **Step 4: Add types to Database interface**

In `packages/core/src/database/types.ts`, add the table interfaces (near the other table types):

```typescript
export interface CustomersTable {
	id: string;
	email: string;
	name: string;
	password_hash: string;
	status: string;
	created_at: string;
	updated_at: string;
	last_login_at: string | null;
}

export interface CustomerSessionsTable {
	id: string;
	customer_id: string;
	token_hash: string;
	expires_at: string;
	created_at: string;
}
```

In the `Database` interface, add:

```typescript
_emdash_customers: CustomersTable;
_emdash_customer_sessions: CustomerSessionsTable;
```

- [ ] **Step 5: Register migration in runner.ts**

In `packages/core/src/database/migrations/runner.ts`, add:

At the top:

```typescript
import * as m033 from "./033_customers.js";
```

In `getMigrations()`:

```typescript
"033_customers": m033,
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter emdash test -- tests/unit/customers.test.ts`
Expected: All 3 tests PASS.

- [ ] **Step 7: Run lint and typecheck**

Run: `pnpm --silent lint:quick 2>/dev/null && pnpm typecheck`

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/database/migrations/033_customers.ts packages/core/src/database/migrations/runner.ts packages/core/src/database/types.ts packages/core/tests/unit/customers.test.ts
git commit -m "feat(core): add _emdash_customers and _emdash_customer_sessions tables"
```

---

## Task 2: Core Customer Auth Endpoints

**Files:**

- Create: `packages/core/src/api/handlers/customer-auth.ts`
- Create: `packages/core/src/astro/routes/api/customers/register.ts`
- Create: `packages/core/src/astro/routes/api/customers/login.ts`
- Create: `packages/core/src/astro/routes/api/customers/session.ts`
- Create: `packages/core/src/astro/routes/api/customers/logout.ts`
- Create: `packages/core/src/astro/routes/api/customers/me.ts`
- Modify: `packages/core/src/astro/middleware/auth.ts`
- Modify: `packages/core/src/astro/integration/routes.ts`

- [ ] **Step 1: Write the customer auth handler**

Create `packages/core/src/api/handlers/customer-auth.ts`:

```typescript
import type { Kysely } from "kysely";
import type { Database } from "../../database/types.js";
import type { ApiResult } from "../types.js";

const PBKDF2_ITERATIONS = 100_000;

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		encoder.encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const hash = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
		keyMaterial,
		256,
	);
	const saltHex = Array.from(salt)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	const hashHex = Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [saltHex, _hashHex] = stored.split(":");
	if (!saltHex || !_hashHex) return false;
	const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		encoder.encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const hash = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
		keyMaterial,
		256,
	);
	const hashHex = Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return hashHex === _hashHex;
}

export function generateSessionToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export function hashSessionToken(token: string): string {
	// Simple SHA-256 hash for session tokens
	const encoder = new TextEncoder();
	const data = encoder.encode(token);
	// Use sync approach for simplicity — can be made async if needed
	return token; // placeholder — see step 2 for async version
}

export async function hashSessionTokenAsync(token: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(token);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

interface CustomerPublic {
	id: string;
	email: string;
	name: string;
	status: string;
	created_at: string;
}

export async function registerCustomer(
	db: Kysely<Database>,
	input: { email: string; name: string; password: string },
): Promise<ApiResult<{ customer: CustomerPublic; token: string }>> {
	const email = input.email.toLowerCase().trim();

	const existing = await db
		.selectFrom("_emdash_customers")
		.select("id")
		.where("email", "=", email)
		.executeTakeFirst();

	if (existing) {
		return {
			success: false,
			error: { code: "EMAIL_EXISTS", message: "An account with this email already exists" },
		};
	}

	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	const passwordHash = await hashPassword(input.password);

	await db
		.insertInto("_emdash_customers")
		.values({
			id,
			email,
			name: input.name.trim(),
			password_hash: passwordHash,
			status: "active",
			created_at: now,
			updated_at: now,
		})
		.execute();

	// Create session
	const rawToken = generateSessionToken();
	const tokenHash = await hashSessionTokenAsync(rawToken);
	const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

	await db
		.insertInto("_emdash_customer_sessions")
		.values({
			id: crypto.randomUUID(),
			customer_id: id,
			token_hash: tokenHash,
			expires_at: expiresAt,
			created_at: now,
		})
		.execute();

	return {
		success: true,
		data: {
			customer: { id, email, name: input.name.trim(), status: "active", created_at: now },
			token: rawToken,
		},
	};
}

export async function loginCustomer(
	db: Kysely<Database>,
	input: { email: string; password: string },
): Promise<ApiResult<{ customer: CustomerPublic; token: string }>> {
	const email = input.email.toLowerCase().trim();

	const customer = await db
		.selectFrom("_emdash_customers")
		.selectAll()
		.where("email", "=", email)
		.where("status", "=", "active")
		.executeTakeFirst();

	if (!customer) {
		return {
			success: false,
			error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
		};
	}

	const valid = await verifyPassword(input.password, customer.password_hash);
	if (!valid) {
		return {
			success: false,
			error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
		};
	}

	// Update last_login_at
	const now = new Date().toISOString();
	await db
		.updateTable("_emdash_customers")
		.set({ last_login_at: now, updated_at: now })
		.where("id", "=", customer.id)
		.execute();

	// Create session
	const rawToken = generateSessionToken();
	const tokenHash = await hashSessionTokenAsync(rawToken);
	const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

	await db
		.insertInto("_emdash_customer_sessions")
		.values({
			id: crypto.randomUUID(),
			customer_id: customer.id,
			token_hash: tokenHash,
			expires_at: expiresAt,
			created_at: now,
		})
		.execute();

	return {
		success: true,
		data: {
			customer: {
				id: customer.id,
				email: customer.email,
				name: customer.name,
				status: customer.status,
				created_at: customer.created_at,
			},
			token: rawToken,
		},
	};
}

export async function validateCustomerSession(
	db: Kysely<Database>,
	token: string,
): Promise<ApiResult<{ customer: CustomerPublic }>> {
	const tokenHash = await hashSessionTokenAsync(token);

	const result = await db
		.selectFrom("_emdash_customer_sessions")
		.innerJoin("_emdash_customers", "_emdash_customers.id", "_emdash_customer_sessions.customer_id")
		.select([
			"_emdash_customers.id",
			"_emdash_customers.email",
			"_emdash_customers.name",
			"_emdash_customers.status",
			"_emdash_customers.created_at",
			"_emdash_customer_sessions.expires_at",
		])
		.where("_emdash_customer_sessions.token_hash", "=", tokenHash)
		.executeTakeFirst();

	if (!result) {
		return {
			success: false,
			error: { code: "INVALID_TOKEN", message: "Invalid or expired session" },
		};
	}

	if (new Date(result.expires_at) < new Date()) {
		// Clean up expired session
		await db.deleteFrom("_emdash_customer_sessions").where("token_hash", "=", tokenHash).execute();
		return { success: false, error: { code: "TOKEN_EXPIRED", message: "Session has expired" } };
	}

	return {
		success: true,
		data: {
			customer: {
				id: result.id,
				email: result.email,
				name: result.name,
				status: result.status,
				created_at: result.created_at,
			},
		},
	};
}

export async function logoutCustomer(db: Kysely<Database>, token: string): Promise<void> {
	const tokenHash = await hashSessionTokenAsync(token);
	await db.deleteFrom("_emdash_customer_sessions").where("token_hash", "=", tokenHash).execute();
}
```

- [ ] **Step 2: Write the register route**

Create `packages/core/src/astro/routes/api/customers/register.ts`:

```typescript
export const prerender = false;

import type { APIRoute } from "astro";
import { z } from "zod";
import { apiError, apiSuccess, handleError } from "#api/error.js";
import { parseBody, isParseError } from "#api/parse.js";
import { registerCustomer } from "#api/handlers/customer-auth.js";

const registerBody = z.object({
	email: z.string().email(),
	name: z.string().min(1).max(200),
	password: z.string().min(8).max(128),
});

export const POST: APIRoute = async ({ request, locals }) => {
	const { emdash } = locals;
	if (!emdash?.db) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);

	try {
		const body = await parseBody(request, registerBody);
		if (isParseError(body)) return body;

		const result = await registerCustomer(emdash.db, body);
		if (!result.success) {
			return apiError(result.error.code, result.error.message, 409);
		}

		// Fire hook for plugins to react
		if (emdash.hooks) {
			await emdash.hooks.run("customer:authenticated", {
				customerId: result.data.customer.id,
				email: result.data.customer.email,
			});
		}

		return apiSuccess(result.data, 201);
	} catch (error) {
		return handleError(error, "Registration failed", "CUSTOMER_REGISTER_ERROR");
	}
};
```

- [ ] **Step 3: Write the login route**

Create `packages/core/src/astro/routes/api/customers/login.ts`:

```typescript
export const prerender = false;

import type { APIRoute } from "astro";
import { z } from "zod";
import { apiError, apiSuccess, handleError } from "#api/error.js";
import { parseBody, isParseError } from "#api/parse.js";
import { loginCustomer } from "#api/handlers/customer-auth.js";

const loginBody = z.object({
	email: z.string().email(),
	password: z.string().min(1),
});

export const POST: APIRoute = async ({ request, locals }) => {
	const { emdash } = locals;
	if (!emdash?.db) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);

	try {
		const body = await parseBody(request, loginBody);
		if (isParseError(body)) return body;

		const result = await loginCustomer(emdash.db, body);
		if (!result.success) {
			return apiError(result.error.code, result.error.message, 401);
		}

		if (emdash.hooks) {
			await emdash.hooks.run("customer:authenticated", {
				customerId: result.data.customer.id,
				email: result.data.customer.email,
			});
		}

		return apiSuccess(result.data);
	} catch (error) {
		return handleError(error, "Login failed", "CUSTOMER_LOGIN_ERROR");
	}
};
```

- [ ] **Step 4: Write the session validation route**

Create `packages/core/src/astro/routes/api/customers/session.ts`:

```typescript
export const prerender = false;

import type { APIRoute } from "astro";
import { apiError, apiSuccess, handleError } from "#api/error.js";
import { validateCustomerSession } from "#api/handlers/customer-auth.js";

export const GET: APIRoute = async ({ request, locals }) => {
	const { emdash } = locals;
	if (!emdash?.db) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);

	try {
		const authHeader = request.headers.get("Authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			return apiError("UNAUTHORIZED", "Missing authorization header", 401);
		}

		const token = authHeader.slice(7);
		const result = await validateCustomerSession(emdash.db, token);
		if (!result.success) {
			return apiError(result.error.code, result.error.message, 401);
		}

		return apiSuccess(result.data);
	} catch (error) {
		return handleError(error, "Session validation failed", "CUSTOMER_SESSION_ERROR");
	}
};
```

- [ ] **Step 5: Write the logout route**

Create `packages/core/src/astro/routes/api/customers/logout.ts`:

```typescript
export const prerender = false;

import type { APIRoute } from "astro";
import { apiError, apiSuccess, handleError } from "#api/error.js";
import { logoutCustomer } from "#api/handlers/customer-auth.js";

export const POST: APIRoute = async ({ request, locals }) => {
	const { emdash } = locals;
	if (!emdash?.db) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);

	try {
		const authHeader = request.headers.get("Authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			return apiError("UNAUTHORIZED", "Missing authorization header", 401);
		}

		await logoutCustomer(emdash.db, authHeader.slice(7));
		return apiSuccess({ success: true });
	} catch (error) {
		return handleError(error, "Logout failed", "CUSTOMER_LOGOUT_ERROR");
	}
};
```

- [ ] **Step 6: Write the me route (get/update profile)**

Create `packages/core/src/astro/routes/api/customers/me.ts`:

```typescript
export const prerender = false;

import type { APIRoute } from "astro";
import { z } from "zod";
import { apiError, apiSuccess, handleError } from "#api/error.js";
import { parseBody, isParseError } from "#api/parse.js";
import { validateCustomerSession } from "#api/handlers/customer-auth.js";

const updateBody = z.object({
	name: z.string().min(1).max(200).optional(),
	email: z.string().email().optional(),
});

export const GET: APIRoute = async ({ request, locals }) => {
	const { emdash } = locals;
	if (!emdash?.db) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);

	try {
		const authHeader = request.headers.get("Authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			return apiError("UNAUTHORIZED", "Missing authorization header", 401);
		}

		const result = await validateCustomerSession(emdash.db, authHeader.slice(7));
		if (!result.success) return apiError(result.error.code, result.error.message, 401);

		return apiSuccess(result.data);
	} catch (error) {
		return handleError(error, "Failed to get profile", "CUSTOMER_PROFILE_ERROR");
	}
};

export const PATCH: APIRoute = async ({ request, locals }) => {
	const { emdash } = locals;
	if (!emdash?.db) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);

	try {
		const authHeader = request.headers.get("Authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			return apiError("UNAUTHORIZED", "Missing authorization header", 401);
		}

		const session = await validateCustomerSession(emdash.db, authHeader.slice(7));
		if (!session.success) return apiError(session.error.code, session.error.message, 401);

		const body = await parseBody(request, updateBody);
		if (isParseError(body)) return body;

		const updates: Record<string, string> = { updated_at: new Date().toISOString() };
		if (body.name) updates.name = body.name.trim();
		if (body.email) updates.email = body.email.toLowerCase().trim();

		await emdash.db
			.updateTable("_emdash_customers")
			.set(updates)
			.where("id", "=", session.data.customer.id)
			.execute();

		return apiSuccess({ success: true });
	} catch (error) {
		return handleError(error, "Failed to update profile", "CUSTOMER_UPDATE_ERROR");
	}
};
```

- [ ] **Step 7: Add customer routes to PUBLIC_API_PREFIXES**

In `packages/core/src/astro/middleware/auth.ts`, add to the `PUBLIC_API_PREFIXES` array (around line 88):

```typescript
"/_emdash/api/customers/",
```

This makes all customer endpoints public (they handle their own auth via Bearer token).

- [ ] **Step 8: Register all 5 customer routes**

In `packages/core/src/astro/integration/routes.ts`, add:

```typescript
injectRoute({
	pattern: "/_emdash/api/customers/register",
	entrypoint: resolveRoute("api/customers/register.ts"),
});
injectRoute({
	pattern: "/_emdash/api/customers/login",
	entrypoint: resolveRoute("api/customers/login.ts"),
});
injectRoute({
	pattern: "/_emdash/api/customers/session",
	entrypoint: resolveRoute("api/customers/session.ts"),
});
injectRoute({
	pattern: "/_emdash/api/customers/logout",
	entrypoint: resolveRoute("api/customers/logout.ts"),
});
injectRoute({
	pattern: "/_emdash/api/customers/me",
	entrypoint: resolveRoute("api/customers/me.ts"),
});
```

- [ ] **Step 9: Add `customer:authenticated` hook**

In `packages/core/src/plugins/types.ts`, add to `PluginHooks`:

```typescript
"customer:authenticated"?: HookHandler<{ customerId: string; email: string }, void> | HookConfig<HookHandler<{ customerId: string; email: string }, void>>;
```

In `packages/core/src/plugins/hooks.ts`, register in `registerPlugins()`:

```typescript
this.registerPluginHook(plugin, "customer:authenticated");
```

- [ ] **Step 10: Run lint, typecheck, and tests**

Run: `pnpm --silent lint:quick 2>/dev/null && pnpm typecheck && pnpm --filter emdash test -- tests/unit/customers.test.ts`

- [ ] **Step 11: Commit**

```bash
git add packages/core/src/api/handlers/customer-auth.ts packages/core/src/astro/routes/api/customers/ packages/core/src/astro/middleware/auth.ts packages/core/src/astro/integration/routes.ts packages/core/src/plugins/types.ts packages/core/src/plugins/hooks.ts
git commit -m "feat(core): add core customer auth endpoints (register, login, session, logout, profile)"
```

---

## Task 3: CSRF Exemption for Bearer Token + CORS Headers

**Files:**

- Modify: `packages/core/src/api/csrf.ts`
- Modify: `packages/core/src/astro/middleware.ts`

- [ ] **Step 1: Exempt Bearer token requests from CSRF**

In `packages/core/src/api/csrf.ts`, modify `checkPublicCsrf()` to skip CSRF when a Bearer token is present:

```typescript
export function checkPublicCsrf(request: Request): Response | null {
	// Bearer token auth already proves intent — no CSRF risk
	const authHeader = request.headers.get("Authorization");
	if (authHeader?.startsWith("Bearer ")) {
		return null;
	}

	// ... existing CSRF checks remain for cookie-based sessions ...
}
```

- [ ] **Step 2: Add CORS headers in middleware**

In `packages/core/src/astro/middleware.ts`, add a CORS handler for API routes. After the `const response = await next();` call, before `setBaselineSecurityHeaders(response)`:

```typescript
// CORS for API routes
if (url.pathname.startsWith("/_emdash/api/")) {
	const origin = request.headers.get("Origin");
	if (origin) {
		response.headers.set("Access-Control-Allow-Origin", origin);
		response.headers.set("Access-Control-Allow-Credentials", "true");
		response.headers.set(
			"Access-Control-Allow-Headers",
			"Content-Type, Authorization, X-EmDash-Request, X-EmDash-App",
		);
		response.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
		response.headers.set("Access-Control-Max-Age", "86400");
	}
}
```

Also add an OPTIONS handler at the top of the middleware (before any other logic):

```typescript
// Handle CORS preflight
if (request.method === "OPTIONS" && url.pathname.startsWith("/_emdash/api/")) {
	const origin = request.headers.get("Origin");
	return new Response(null, {
		status: 204,
		headers: {
			"Access-Control-Allow-Origin": origin || "*",
			"Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization, X-EmDash-Request, X-EmDash-App",
			"Access-Control-Max-Age": "86400",
		},
	});
}
```

- [ ] **Step 3: Run lint and typecheck**

Run: `pnpm --silent lint:quick 2>/dev/null && pnpm typecheck`

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/api/csrf.ts packages/core/src/astro/middleware.ts
git commit -m "feat(core): exempt Bearer token from CSRF, add CORS headers for API routes"
```

---

## Task 4: Public Content API

**Files:**

- Create: `packages/core/src/astro/routes/api/public/content/[collection].ts`
- Modify: `packages/core/src/astro/middleware/auth.ts`
- Modify: `packages/core/src/astro/integration/routes.ts`
- Create: `packages/core/tests/unit/public-content.test.ts`

- [ ] **Step 1: Write the public content route**

Create `packages/core/src/astro/routes/api/public/content/[collection].ts`:

```typescript
export const prerender = false;

import type { APIRoute } from "astro";
import { apiError, apiSuccess, handleError } from "#api/error.js";

export const GET: APIRoute = async ({ params, url, locals }) => {
	const { emdash } = locals;
	if (!emdash) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);

	const { collection } = params;
	if (!collection) return apiError("VALIDATION_ERROR", "Collection is required", 400);

	try {
		// Slug lookup: GET /api/public/content/posts?slug=my-post
		const slug = url.searchParams.get("slug");
		if (slug) {
			const result = await emdash.handleContentGet(collection, slug);
			if (!result.success) {
				return apiError(result.error.code, result.error.message, 404);
			}
			// Only return published content
			if (result.data.item.status !== "published") {
				return apiError("NOT_FOUND", "Content not found", 404);
			}
			return apiSuccess(result.data);
		}

		// List: GET /api/public/content/posts?limit=20&cursor=xxx
		const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 100);
		const cursor = url.searchParams.get("cursor") || undefined;

		const result = await emdash.handleContentList(collection, {
			status: "published",
			limit,
			cursor,
		});

		if (!result.success) {
			return apiError(result.error.code, result.error.message, 400);
		}

		return apiSuccess(result.data, 200);
	} catch (error) {
		return handleError(error, "Failed to fetch content", "PUBLIC_CONTENT_ERROR");
	}
};
```

- [ ] **Step 2: Add to PUBLIC_API_PREFIXES**

In `packages/core/src/astro/middleware/auth.ts`, add:

```typescript
"/_emdash/api/public/",
```

- [ ] **Step 3: Add to PUBLIC_API_PREFIXES and also add app config**

Also add to `PUBLIC_API_PREFIXES`:

```typescript
"/_emdash/api/app/",
```

- [ ] **Step 4: Register the route**

In `packages/core/src/astro/integration/routes.ts`:

```typescript
injectRoute({
	pattern: "/_emdash/api/public/content/[collection]",
	entrypoint: resolveRoute("api/public/content/[collection].ts"),
});
```

- [ ] **Step 5: Run lint and typecheck**

Run: `pnpm --silent lint:quick 2>/dev/null && pnpm typecheck`

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/astro/routes/api/public/ packages/core/src/astro/middleware/auth.ts packages/core/src/astro/integration/routes.ts
git commit -m "feat(core): add public read-only content API for published content"
```

---

## Task 5: Add `mobile` Field to Plugin Types

**Files:**

- Modify: `packages/core/src/plugins/types.ts`

- [ ] **Step 1: Add PluginMobileConfig interface and mobile field**

In `packages/core/src/plugins/types.ts`, add before `PluginAdminConfig`:

```typescript
export interface PluginMobileTab {
	key: string;
	label: string;
	icon: string;
	screen: string;
	badge?: string;
}

export interface PluginMobileConfig {
	native?: boolean;
	entryUrl?: string;
	label?: string;
	icon?: string;
	tabs?: PluginMobileTab[];
}
```

Add `mobile?: PluginMobileConfig;` to both `PluginDefinition` and `PluginManifest`.

Add `AppConfigContribution` type:

```typescript
export interface AppConfigContribution {
	theme?: {
		primary?: string;
		secondary?: string;
		background?: string;
		surface?: string;
		text?: string;
		textMuted?: string;
		error?: string;
		success?: string;
	};
	features?: Record<string, boolean>;
}
```

- [ ] **Step 2: Add `app:config` hook**

In `plugins/types.ts`, add to `PluginHooks`:

```typescript
"app:config"?: HookHandler<void, Partial<AppConfigContribution>> | HookConfig<HookHandler<void, Partial<AppConfigContribution>>>;
```

In `plugins/hooks.ts`, register in `registerPlugins()`:

```typescript
this.registerPluginHook(plugin, "app:config");
```

- [ ] **Step 3: Run lint and typecheck**

Run: `pnpm --silent lint:quick 2>/dev/null && pnpm typecheck`

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/plugins/types.ts packages/core/src/plugins/hooks.ts
git commit -m "feat(core): add PluginMobileConfig, app:config hook, and AppConfigContribution type"
```

---

## Task 6: App Config API Endpoint

**Files:**

- Create: `packages/core/src/api/handlers/app-config.ts`
- Create: `packages/core/src/astro/routes/api/app/config.ts`
- Modify: `packages/core/src/astro/integration/routes.ts`
- Create: `packages/core/tests/unit/app-config.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/core/tests/unit/app-config.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildAppConfig } from "../../src/api/handlers/app-config.js";

describe("buildAppConfig", () => {
	it("returns default config with no plugins", async () => {
		const result = await buildAppConfig({
			siteName: "Test",
			siteUrl: "https://test.com",
			plugins: [],
			hookContributions: [],
		});
		expect(result.site.name).toBe("Test");
		expect(result.theme.primary).toBe("#3B82F6");
		expect(result.plugins).toEqual([]);
	});

	it("includes plugin mobile metadata", async () => {
		const result = await buildAppConfig({
			siteName: "Test",
			siteUrl: "https://test.com",
			plugins: [
				{
					id: "commerce",
					name: "Commerce",
					version: "1.0.0",
					mobile: {
						native: true,
						label: "Shop",
						icon: "store",
						tabs: [{ key: "shop", label: "Shop", icon: "store", screen: "commerce:product-list" }],
					},
				},
			],
			hookContributions: [],
		});
		expect(result.plugins).toHaveLength(1);
		expect(result.navigation.tabs).toHaveLength(1);
	});

	it("merges theme from hook contributions", async () => {
		const result = await buildAppConfig({
			siteName: "Test",
			siteUrl: "https://test.com",
			plugins: [],
			hookContributions: [{ theme: { primary: "#7C3AED" } }],
		});
		expect(result.theme.primary).toBe("#7C3AED");
		expect(result.theme.background).toBe("#FFFFFF");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter emdash test -- tests/unit/app-config.test.ts`

- [ ] **Step 3: Write handler and route**

Create `packages/core/src/api/handlers/app-config.ts` with `buildAppConfig()` function (same as previous plan version — default theme, merge hook contributions, collect plugin mobile metadata and tabs).

Create `packages/core/src/astro/routes/api/app/config.ts` as GET route that runs `app:config` hooks and calls `buildAppConfig()`.

Register in routes.ts:

```typescript
injectRoute({ pattern: "/_emdash/api/app/config", entrypoint: resolveRoute("api/app/config.ts") });
```

- [ ] **Step 4: Run tests, lint, typecheck**

Run: `pnpm --filter emdash test -- tests/unit/app-config.test.ts && pnpm --silent lint:quick 2>/dev/null && pnpm typecheck`

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/api/handlers/app-config.ts packages/core/src/astro/routes/api/app/config.ts packages/core/src/astro/integration/routes.ts packages/core/tests/unit/app-config.test.ts
git commit -m "feat(core): add GET /app/config endpoint for mobile app configuration"
```

---

## Task 7: Push Device Registration

**Files:**

- Create: `packages/core/src/database/migrations/034_push_devices.ts`
- Modify: `packages/core/src/database/migrations/runner.ts`
- Modify: `packages/core/src/database/types.ts`
- Create: `packages/core/src/astro/routes/api/push/register.ts`
- Modify: `packages/core/src/astro/integration/routes.ts`
- Create: `packages/core/tests/unit/push-devices.test.ts`

- [ ] **Step 1: Write migration**

Create `packages/core/src/database/migrations/034_push_devices.ts`:

```typescript
import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("_emdash_push_devices")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("customer_id", "text", (col) =>
			col.references("_emdash_customers.id").onDelete("cascade"),
		)
		.addColumn("push_token", "text", (col) => col.notNull().unique())
		.addColumn("platform", "text", (col) => col.notNull())
		.addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
		.addColumn("last_seen_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
		.execute();

	await db.schema
		.createIndex("idx_push_devices_customer")
		.on("_emdash_push_devices")
		.column("customer_id")
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("_emdash_push_devices").execute();
}
```

Add types to `database/types.ts`, import in `runner.ts` as `m034`, register as `"034_push_devices": m034`.

- [ ] **Step 2: Write route and test**

Create register/unregister route (POST/DELETE on `/_emdash/api/push/register`). Validates customer Bearer token, upserts push device.

Register in routes.ts. Add `"/_emdash/api/push/"` to PUBLIC_API_PREFIXES.

- [ ] **Step 3: Run tests, lint, typecheck, commit**

```bash
git commit -m "feat(core): add push device registration table and endpoints"
```

---

## Task 8: Image Transform URL Contract

**Files:**

- Create: `packages/core/src/api/handlers/image-transform.ts`
- Modify: `packages/core/src/astro/routes/api/media/file/[key].ts`
- Create: `packages/core/tests/unit/image-transform.test.ts`

- [ ] **Step 1: Write `parseTransformParams()` with tests**

Same as previous plan — parses `?w=300&h=200&fit=cover&format=webp`, clamps to max 2000, returns null when no params.

- [ ] **Step 2: Integrate into media file route**

Add `Vary: Accept` header and reduced `Cache-Control` when transform params present. Actual image processing deferred to Phase 2.

- [ ] **Step 3: Test, lint, commit**

```bash
git commit -m "feat(core): add image transform URL params on media endpoint (contract only)"
```

---

## Task 9: App Bridge Script Injection

**Files:**

- Create: `packages/core/src/mobile/bridge-script.ts`
- Modify: `packages/core/src/astro/middleware.ts`

- [ ] **Step 1: Write bridge script and `isMobileAppRequest()` detector**

Same as previous plan — `getAppBridgeScript()` returns the JS that sets up `window.emdash.*` SDK, `isMobileAppRequest()` checks for `EmDashApp/` user agent or `X-EmDash-App: 1` header.

- [ ] **Step 2: Add injection to middleware**

After `const response = await next()`, if mobile app request + HTML response, inject `<script>` before `</head>`.

- [ ] **Step 3: Lint, commit**

```bash
git commit -m "feat(core): inject App Bridge script into storefront pages for mobile app requests"
```

---

## Task 10: Update Commerce Plugin

**Files:**

- Modify: `packages/plugins/commerce/src/sandbox-entry.ts`

- [ ] **Step 1: Add mobile config**

```typescript
mobile: {
	native: true,
	label: "Shop",
	icon: "store",
	tabs: [
		{ key: "shop", label: "Shop", icon: "store", screen: "commerce:product-list" },
		{ key: "cart", label: "Cart", icon: "cart", screen: "commerce:cart", badge: "cartCount" },
	],
},
```

- [ ] **Step 2: Migrate customer routes to use core customers**

Update commerce customer routes (`customer/register`, `customer/login`, `customer/session`, `customer/logout`) to delegate to core endpoints or reference `_emdash_customers` table instead of plugin storage.

This is the largest change — the commerce plugin's `customer-auth.ts` currently stores customers in `_plugin_storage`. It needs to:

1. Call core customer auth endpoints instead of managing its own customers
2. Keep its account routes (addresses, orders) but look up `customerId` from core customer sessions
3. Keep cart linking via `customerId` from `_emdash_customers.id`

- [ ] **Step 3: Lint, typecheck, test, commit**

```bash
git commit -m "feat(commerce): add mobile config, migrate customer auth to core customer identity"
```

---

## Verification

After all 10 tasks:

- [ ] `pnpm --silent lint:json 2>/dev/null | jq '.diagnostics | length'` → 0
- [ ] `pnpm typecheck` → pass
- [ ] `pnpm test` → pass
- [ ] `pnpm format`

### New API Surface

| Method    | Route                                      | Auth   | Purpose                     |
| --------- | ------------------------------------------ | ------ | --------------------------- |
| POST      | `/_emdash/api/customers/register`          | Public | Customer signup             |
| POST      | `/_emdash/api/customers/login`             | Public | Customer login → token      |
| GET       | `/_emdash/api/customers/session`           | Bearer | Validate customer token     |
| POST      | `/_emdash/api/customers/logout`            | Bearer | Destroy session             |
| GET/PATCH | `/_emdash/api/customers/me`                | Bearer | Get/update profile          |
| GET       | `/_emdash/api/public/content/[collection]` | Public | Published content read-only |
| GET       | `/_emdash/api/app/config`                  | Public | Mobile app configuration    |
| POST      | `/_emdash/api/push/register`               | Bearer | Register push device        |
| DELETE    | `/_emdash/api/push/register`               | Bearer | Unregister push device      |

### New Database Tables

| Table                       | Purpose                               |
| --------------------------- | ------------------------------------- |
| `_emdash_customers`         | Core customer identity                |
| `_emdash_customer_sessions` | Customer session tokens               |
| `_emdash_push_devices`      | Push notification device registration |

### New Hooks

| Hook                     | Purpose                                            |
| ------------------------ | -------------------------------------------------- |
| `customer:authenticated` | Plugins react to customer login/register           |
| `app:config`             | Plugins contribute theme/features to mobile config |

### Core Modifications

| Change                     | Why                                                   |
| -------------------------- | ----------------------------------------------------- |
| CSRF exempts Bearer token  | Mobile app uses tokens not cookies                    |
| CORS headers on API routes | WebViews and mobile clients need cross-origin access  |
| OPTIONS preflight handler  | Required for CORS                                     |
| Bridge script injection    | WebView plugins get `window.emdash.*` SDK             |
| Image transform URL params | Mobile requests optimized images                      |
| Public content route       | Mobile app reads published content without admin auth |
