# Commerce Customer Auth (Phase 1.5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add customer-facing authentication (register, login, sessions) to the commerce plugin so the guest checkout toggle, account pages, and customer-linked orders actually work.

**Architecture:** Token-based auth using plugin KV for sessions. Passwords hashed via PBKDF2 (Web Crypto API — works on Node.js and Workers). Customer session tokens passed in request body (plugin routes can't access cookies due to sandbox stripping). Storefront pages store tokens in localStorage. A new `customer-auth.ts` module handles all auth logic; routes are added to `sandbox-entry.ts`; storefront pages use `handlePluginApiRoute` for SSR checks.

**Tech Stack:** TypeScript, Web Crypto API (PBKDF2), EmDash plugin KV, Zod validation, Astro SSR pages.

**Spec:** `docs/superpowers/specs/2026-04-03-emdash-commerce-plugin-suite-design.md` sections 6-8.

---

## Architecture Decisions

### Why token-in-body (not cookies)?

Plugin route handlers receive a sanitized `Request` with cookies stripped (`SANDBOX_STRIPPED_HEADERS` in `request-meta.ts`). Plugins cannot read `Set-Cookie` headers from the request or set them on the response. The design is intentional — plugins run in a sandbox and shouldn't access ambient credentials.

**Solution:** Session tokens are returned in JSON responses and stored in `localStorage` by the client. Authenticated requests pass the token in the request body as `customerToken`. This follows the same pattern as `commerce_cart_id`.

### Why PBKDF2 (not bcrypt/scrypt)?

bcrypt and scrypt require native Node.js modules that don't work on Cloudflare Workers. PBKDF2 is available via `crypto.subtle.deriveBits()` on both runtimes. We use 100,000 iterations with SHA-256, matching OWASP recommendations.

### Session lifecycle

- Tokens are UUIDs stored in KV as `session:customer:{token}`
- Sessions expire after 30 days (checked at validation time)
- One customer can have multiple active sessions (multi-device)
- Logout deletes the specific session token from KV

---

## File Structure

### New files

```
packages/plugins/commerce/src/
  customer-auth.ts              # Password hashing, session management, register/login
```

### Modified files

```
packages/plugins/commerce/src/
  types.ts                      # Add passwordHash to Customer type
  validation.ts                 # Add register/login schemas
  sandbox-entry.ts              # Add auth routes, protect account routes
  checkout.ts                   # Link orders to authenticated customer
  storefront/routes/
    checkout.astro              # Check customer session (not admin session)
    login.astro                 # NEW — customer login page
    register.astro              # NEW — customer register page
    account.astro               # NEW — customer account (order history)
  storefront/integration.ts     # Inject new routes

packages/core/tests/unit/plugins/commerce/
  customer-auth.test.ts         # Auth logic tests
```

---

## Task 1: Add passwordHash to Customer Type

**Files:**

- Modify: `packages/plugins/commerce/src/types.ts`

- [ ] **Step 1: Add passwordHash field**

In `types.ts`, add `passwordHash` to the `Customer` interface:

```typescript
export interface Customer {
	id: string;
	userId: string | null;
	email: string;
	name: string;
	phone: string;
	passwordHash: string | null; // null for guest customers (created via checkout)
	defaultShippingAddress: Address | null;
	defaultBillingAddress: Address | null;
	totalOrders: number;
	totalSpent: number;
	tags: string[];
	acceptsMarketing: boolean;
	createdAt: string;
	updatedAt: string;
}
```

- [ ] **Step 2: Update createCustomer to include passwordHash**

In `customers.ts`, add `passwordHash: null` to the default customer object:

```typescript
const customer: Customer = {
	id,
	userId: null,
	email: validated.email,
	name: validated.name,
	phone: validated.phone,
	passwordHash: null, // Set during registration, null for guests
	defaultShippingAddress: validated.defaultShippingAddress,
	// ... rest unchanged
};
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/plugins/commerce/src/types.ts packages/plugins/commerce/src/customers.ts
git commit -m "feat(commerce): add passwordHash field to Customer type"
```

---

## Task 2: Customer Auth Module — Password Hashing

**Files:**

- Create: `packages/plugins/commerce/src/customer-auth.ts`
- Test: `packages/core/tests/unit/plugins/commerce/customer-auth.test.ts`

- [ ] **Step 1: Write failing tests for password hashing**

```typescript
import { describe, it, expect } from "vitest";

import { hashPassword, verifyPassword } from "../../../../../plugins/commerce/src/customer-auth.js";

describe("Password hashing", () => {
	it("hashes a password and verifies it", async () => {
		const hash = await hashPassword("my-secure-password");
		expect(hash).toContain(":"); // salt:hash format
		expect(await verifyPassword("my-secure-password", hash)).toBe(true);
	});

	it("rejects wrong password", async () => {
		const hash = await hashPassword("correct-password");
		expect(await verifyPassword("wrong-password", hash)).toBe(false);
	});

	it("produces different hashes for same password (unique salts)", async () => {
		const hash1 = await hashPassword("same-password");
		const hash2 = await hashPassword("same-password");
		expect(hash1).not.toBe(hash2);
	});

	it("rejects empty password", async () => {
		await expect(hashPassword("")).rejects.toThrow();
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm --filter emdash test -- tests/unit/plugins/commerce/customer-auth.test.ts
```

- [ ] **Step 3: Implement password hashing**

Create `customer-auth.ts`:

```typescript
import { CommerceError } from "./cart.js";

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const HASH_LENGTH = 32;

/**
 * Hash a password using PBKDF2 with a random salt.
 * Returns `{hex_salt}:{hex_hash}` string.
 */
export async function hashPassword(password: string): Promise<string> {
	if (!password) throw new CommerceError("VALIDATION_ERROR", "Password is required");

	const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
		key,
		HASH_LENGTH * 8,
	);
	const saltHex = toHex(salt);
	const hashHex = toHex(new Uint8Array(bits));
	return `${saltHex}:${hashHex}`;
}

/**
 * Verify a password against a stored hash.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [saltHex, expectedHex] = stored.split(":");
	if (!saltHex || !expectedHex) return false;

	const salt = fromHex(saltHex);
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
		key,
		HASH_LENGTH * 8,
	);
	return toHex(new Uint8Array(bits)) === expectedHex;
}

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
	}
	return bytes;
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm --filter emdash test -- tests/unit/plugins/commerce/customer-auth.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/plugins/commerce/src/customer-auth.ts packages/core/tests/unit/plugins/commerce/customer-auth.test.ts
git commit -m "feat(commerce): add PBKDF2 password hashing for customer auth"
```

---

## Task 3: Session Management

**Files:**

- Modify: `packages/plugins/commerce/src/customer-auth.ts`
- Test: `packages/core/tests/unit/plugins/commerce/customer-auth.test.ts`

- [ ] **Step 1: Write failing tests for session management**

Add to `customer-auth.test.ts`:

```typescript
import {
	hashPassword,
	verifyPassword,
	createSession,
	validateSession,
	destroySession,
} from "../../../../../plugins/commerce/src/customer-auth.js";

function createMockKV() {
	const store = new Map<string, unknown>();
	return {
		get: async <T>(key: string): Promise<T | null> => (store.get(key) as T) ?? null,
		set: async (key: string, value: unknown): Promise<void> => {
			store.set(key, value);
		},
		delete: async (key: string): Promise<boolean> => store.delete(key),
		list: async (prefix?: string): Promise<Array<{ key: string; value: unknown }>> => {
			const results: Array<{ key: string; value: unknown }> = [];
			for (const [key, value] of store) {
				if (!prefix || key.startsWith(prefix)) results.push({ key, value });
			}
			return results;
		},
	};
}

describe("Session management", () => {
	it("creates and validates a session", async () => {
		const kv = createMockKV();
		const token = await createSession(kv as never, "cust-1", "test@example.com");
		expect(token).toBeTruthy();
		expect(token.length).toBeGreaterThan(20);

		const session = await validateSession(kv as never, token);
		expect(session).not.toBeNull();
		expect(session!.customerId).toBe("cust-1");
		expect(session!.email).toBe("test@example.com");
	});

	it("returns null for invalid token", async () => {
		const kv = createMockKV();
		const session = await validateSession(kv as never, "bogus-token");
		expect(session).toBeNull();
	});

	it("returns null for expired session", async () => {
		const kv = createMockKV();
		// Manually create an expired session
		const token = "expired-token";
		await kv.set(`session:customer:${token}`, {
			customerId: "cust-1",
			email: "test@example.com",
			createdAt: "2020-01-01T00:00:00Z",
			expiresAt: "2020-01-02T00:00:00Z",
		});
		const session = await validateSession(kv as never, token);
		expect(session).toBeNull();
	});

	it("destroys a session", async () => {
		const kv = createMockKV();
		const token = await createSession(kv as never, "cust-2", "a@b.com");
		expect(await validateSession(kv as never, token)).not.toBeNull();

		await destroySession(kv as never, token);
		expect(await validateSession(kv as never, token)).toBeNull();
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement session management**

Add to `customer-auth.ts`:

```typescript
import type { KVAccess } from "emdash";

const SESSION_TTL_DAYS = 30;

export interface CustomerSession {
	customerId: string;
	email: string;
	createdAt: string;
	expiresAt: string;
}

/**
 * Create a new customer session. Returns the session token.
 */
export async function createSession(
	kv: KVAccess,
	customerId: string,
	email: string,
): Promise<string> {
	const token = crypto.randomUUID();
	const now = new Date();
	const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

	const session: CustomerSession = {
		customerId,
		email,
		createdAt: now.toISOString(),
		expiresAt: expiresAt.toISOString(),
	};

	await kv.set(`session:customer:${token}`, session);
	return token;
}

/**
 * Validate a customer session token. Returns session data or null.
 */
export async function validateSession(
	kv: KVAccess,
	token: string,
): Promise<CustomerSession | null> {
	if (!token) return null;

	const session = await kv.get<CustomerSession>(`session:customer:${token}`);
	if (!session) return null;

	// Check expiry
	if (new Date(session.expiresAt) < new Date()) {
		await kv.delete(`session:customer:${token}`);
		return null;
	}

	return session;
}

/**
 * Destroy a customer session.
 */
export async function destroySession(kv: KVAccess, token: string): Promise<void> {
	await kv.delete(`session:customer:${token}`);
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/plugins/commerce/src/customer-auth.ts packages/core/tests/unit/plugins/commerce/customer-auth.test.ts
git commit -m "feat(commerce): add customer session management via KV"
```

---

## Task 4: Register and Login Functions

**Files:**

- Modify: `packages/plugins/commerce/src/customer-auth.ts`
- Modify: `packages/plugins/commerce/src/validation.ts`
- Test: `packages/core/tests/unit/plugins/commerce/customer-auth.test.ts`

- [ ] **Step 1: Add validation schemas**

In `validation.ts`, add:

```typescript
export const customerRegisterSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8).max(128),
	name: z.string().min(1).max(200),
});

export const customerLoginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1),
});
```

- [ ] **Step 2: Write failing tests for register/login**

Add to `customer-auth.test.ts`:

```typescript
import {
	hashPassword,
	verifyPassword,
	createSession,
	validateSession,
	destroySession,
	registerCustomer,
	loginCustomer,
} from "../../../../../plugins/commerce/src/customer-auth.js";

function createMockStorage<T = unknown>() {
	const store = new Map<string, T>();
	return {
		get: async (id: string): Promise<T | null> => store.get(id) ?? null,
		put: async (id: string, data: T): Promise<void> => {
			store.set(id, data);
		},
		delete: async (id: string): Promise<boolean> => store.delete(id),
		exists: async (id: string): Promise<boolean> => store.has(id),
		query: async (opts?: {
			where?: Record<string, unknown>;
			orderBy?: Record<string, string>;
			limit?: number;
		}): Promise<{ items: Array<{ id: string; data: T }>; hasMore: boolean }> => {
			let items = Array.from(store.entries(), ([id, data]) => ({ id, data }));
			if (opts?.where) {
				for (const [key, value] of Object.entries(opts.where)) {
					items = items.filter((item) => (item.data as Record<string, unknown>)[key] === value);
				}
			}
			const limit = opts?.limit ?? 50;
			return { items: items.slice(0, limit), hasMore: items.length > limit };
		},
		count: async (): Promise<number> => store.size,
	};
}

describe("Customer register/login", () => {
	it("registers a new customer and returns token", async () => {
		const storage = createMockStorage();
		const kv = createMockKV();

		const result = await registerCustomer(storage as never, kv as never, {
			email: "new@example.com",
			password: "securePass123",
			name: "Jane Doe",
		});

		expect(result.customer.email).toBe("new@example.com");
		expect(result.customer.name).toBe("Jane Doe");
		expect(result.customer.passwordHash).not.toBeNull();
		expect(result.token).toBeTruthy();

		// Token should be valid
		const session = await validateSession(kv as never, result.token);
		expect(session!.customerId).toBe(result.customer.id);
	});

	it("rejects duplicate email", async () => {
		const storage = createMockStorage();
		const kv = createMockKV();

		await registerCustomer(storage as never, kv as never, {
			email: "dup@example.com",
			password: "securePass123",
			name: "First",
		});

		await expect(
			registerCustomer(storage as never, kv as never, {
				email: "dup@example.com",
				password: "otherPass456",
				name: "Second",
			}),
		).rejects.toThrow("already registered");
	});

	it("logs in with correct credentials", async () => {
		const storage = createMockStorage();
		const kv = createMockKV();

		await registerCustomer(storage as never, kv as never, {
			email: "login@example.com",
			password: "correctPass",
			name: "User",
		});

		const result = await loginCustomer(storage as never, kv as never, {
			email: "login@example.com",
			password: "correctPass",
		});

		expect(result.customer.email).toBe("login@example.com");
		expect(result.token).toBeTruthy();
	});

	it("rejects wrong password", async () => {
		const storage = createMockStorage();
		const kv = createMockKV();

		await registerCustomer(storage as never, kv as never, {
			email: "wrong@example.com",
			password: "correctPass",
			name: "User",
		});

		await expect(
			loginCustomer(storage as never, kv as never, {
				email: "wrong@example.com",
				password: "wrongPass",
			}),
		).rejects.toThrow("Invalid email or password");
	});

	it("rejects non-existent email", async () => {
		const storage = createMockStorage();
		const kv = createMockKV();

		await expect(
			loginCustomer(storage as never, kv as never, {
				email: "ghost@example.com",
				password: "anyPass",
			}),
		).rejects.toThrow("Invalid email or password");
	});
});
```

- [ ] **Step 3: Run test — expect FAIL**

- [ ] **Step 4: Implement register and login**

Add to `customer-auth.ts`:

```typescript
import type { StorageCollection } from "./storage-types.js";
import type { Customer } from "./types.js";
import { getCustomerByEmail } from "./customers.js";
import { customerRegisterSchema, customerLoginSchema } from "./validation.js";

export async function registerCustomer(
	customerStorage: StorageCollection,
	kv: KVAccess,
	input: { email: string; password: string; name: string },
): Promise<{ customer: Customer; token: string }> {
	const validated = customerRegisterSchema.parse(input);

	// Check if email already exists
	const existing = await getCustomerByEmail(customerStorage, validated.email);
	if (existing) {
		throw new CommerceError("CUSTOMER_EXISTS", "A customer with this email is already registered");
	}

	const passwordHash = await hashPassword(validated.password);
	const now = new Date().toISOString();
	const id = crypto.randomUUID();

	const customer: Customer = {
		id,
		userId: null,
		email: validated.email,
		name: validated.name,
		phone: "",
		passwordHash,
		defaultShippingAddress: null,
		defaultBillingAddress: null,
		totalOrders: 0,
		totalSpent: 0,
		tags: [],
		acceptsMarketing: false,
		createdAt: now,
		updatedAt: now,
	};

	await customerStorage.put(id, customer);
	const token = await createSession(kv, id, customer.email);
	return { customer, token };
}

export async function loginCustomer(
	customerStorage: StorageCollection,
	kv: KVAccess,
	input: { email: string; password: string },
): Promise<{ customer: Customer; token: string }> {
	const validated = customerLoginSchema.parse(input);

	const customer = await getCustomerByEmail(customerStorage, validated.email);
	if (!customer || !customer.passwordHash) {
		throw new CommerceError("AUTH_FAILED", "Invalid email or password");
	}

	const valid = await verifyPassword(validated.password, customer.passwordHash);
	if (!valid) {
		throw new CommerceError("AUTH_FAILED", "Invalid email or password");
	}

	const token = await createSession(kv, customer.id, customer.email);
	return { customer, token };
}
```

- [ ] **Step 5: Run test — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add packages/plugins/commerce/src/customer-auth.ts packages/plugins/commerce/src/validation.ts packages/core/tests/unit/plugins/commerce/customer-auth.test.ts
git commit -m "feat(commerce): add customer register/login with PBKDF2 + KV sessions"
```

---

## Task 5: Wire Auth Routes into sandbox-entry.ts

**Files:**

- Modify: `packages/plugins/commerce/src/sandbox-entry.ts`

- [ ] **Step 1: Add imports**

At top of `sandbox-entry.ts`, add:

```typescript
import {
	registerCustomer,
	loginCustomer,
	validateSession,
	destroySession,
} from "./customer-auth.js";
```

- [ ] **Step 2: Add public auth routes**

Add these routes after the `orders/confirmation` route block (before the account routes):

```typescript
// ── Customer auth routes ────────────────────────────────
"customer/register": {
	public: true,
	handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
		const result = await registerCustomer(
			ctx.storage.customers!,
			ctx.kv,
			routeCtx.input as { email: string; password: string; name: string },
		);
		return {
			customer: { id: result.customer.id, email: result.customer.email, name: result.customer.name },
			token: result.token,
		};
	},
},

"customer/login": {
	public: true,
	handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
		const result = await loginCustomer(
			ctx.storage.customers!,
			ctx.kv,
			routeCtx.input as { email: string; password: string },
		);
		return {
			customer: { id: result.customer.id, email: result.customer.email, name: result.customer.name },
			token: result.token,
		};
	},
},

"customer/session": {
	public: true,
	handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
		const token = routeCtx.input.customerToken as string | undefined;
		if (!token) return { authenticated: false };
		const session = await validateSession(ctx.kv, token);
		if (!session) return { authenticated: false };
		const customer = await getCustomer(ctx.storage.customers!, session.customerId);
		if (!customer) return { authenticated: false };
		return {
			authenticated: true,
			customer: { id: customer.id, email: customer.email, name: customer.name },
		};
	},
},

"customer/logout": {
	public: true,
	handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
		const token = routeCtx.input.customerToken as string | undefined;
		if (token) await destroySession(ctx.kv, token);
		return { success: true };
	},
},
```

- [ ] **Step 3: Protect account routes with session validation**

Update the existing `account/addresses/list` route to validate the customer token:

```typescript
"account/addresses/list": {
	public: true,
	handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
		const session = await validateSession(ctx.kv, routeCtx.input.customerToken as string);
		if (!session) throw new CommerceError("UNAUTHORIZED", "Not authenticated");
		const customerId = session.customerId;
		const customer = await getCustomer(ctx.storage.customers!, customerId);
		if (!customer) throw new CommerceError("CUSTOMER_NOT_FOUND", "Customer not found");
		const entries = await ctx.kv.list(`state:addresses:${customerId}:`);
		return { addresses: entries.map((e) => e.value) };
	},
},
```

Apply the same pattern to `account/addresses/save` and `account/addresses/delete` — extract `customerId` from validated session instead of trusting input.

- [ ] **Step 4: Run lint and typecheck**

```bash
pnpm --silent lint:quick
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/plugins/commerce/src/sandbox-entry.ts
git commit -m "feat(commerce): wire customer auth and session-protected account routes"
```

---

## Task 6: Link Orders to Authenticated Customers

**Files:**

- Modify: `packages/plugins/commerce/src/sandbox-entry.ts`

- [ ] **Step 1: Update checkout/create to link customer**

In the `checkout/create` route handler, after creating the order, check if a customer token is provided and link the order:

```typescript
"checkout/create": {
	public: true,
	handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
		// If customer is authenticated, set customerId on the cart before checkout
		const customerToken = routeCtx.input.customerToken as string | undefined;
		if (customerToken) {
			const session = await validateSession(ctx.kv, customerToken);
			if (session) {
				const cart = await getCart(ctx.storage.carts!, routeCtx.input.cartId as string);
				if (cart && !cart.customerId) {
					await ctx.storage.carts!.put(cart.id, { ...cart, customerId: session.customerId });
				}
			}
		}

		const order = await createOrderFromCart(
			// ... existing code unchanged
		);
		// ... rest of handler unchanged
	},
},
```

- [ ] **Step 2: Add customer order history route**

```typescript
"account/orders": {
	public: true,
	handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
		const session = await validateSession(ctx.kv, routeCtx.input.customerToken as string);
		if (!session) throw new CommerceError("UNAUTHORIZED", "Not authenticated");

		const orders = await listOrders(ctx.storage.orders!, {
			customerId: session.customerId,
			limit: routeCtx.input.limit as number | undefined,
			cursor: routeCtx.input.cursor as string | undefined,
		});
		return orders;
	},
},
```

- [ ] **Step 3: Commit**

```bash
git add packages/plugins/commerce/src/sandbox-entry.ts
git commit -m "feat(commerce): link orders to authenticated customers + order history route"
```

---

## Task 7: Storefront Auth Pages

**Files:**

- Create: `packages/plugins/commerce/src/storefront/routes/login.astro`
- Create: `packages/plugins/commerce/src/storefront/routes/register.astro`
- Create: `packages/plugins/commerce/src/storefront/routes/account.astro`
- Modify: `packages/plugins/commerce/src/storefront/integration.ts`

- [ ] **Step 1: Create login page**

Create `login.astro` — a client-side form that calls `customer/login` API, stores the token in `localStorage`, and redirects:

```astro
---
// @ts-ignore virtual module
import { Layout } from "virtual:commerce-storefront/config";

export const prerender = false;
---

<Layout title="Log In">
	<main class="auth-page">
		<div class="auth-card">
			<h1>Log In</h1>
			<form id="login-form">
				<div class="form-field">
					<label for="email">Email</label>
					<input type="email" id="email" name="email" required />
				</div>
				<div class="form-field">
					<label for="password">Password</label>
					<input type="password" id="password" name="password" required />
				</div>
				<p id="login-error" class="auth-error" style="display:none"></p>
				<button type="submit" class="auth-btn" id="login-btn">Log In</button>
			</form>
			<p class="auth-link">Don't have an account? <a href="/shop/register">Create one</a></p>
		</div>
	</main>
</Layout>
```

Include a `<script>` block that handles form submission, calls the API, stores token, and redirects to `/shop` or the return URL.

Include `<style is:global>` with auth page styles (card layout, form fields, error display).

- [ ] **Step 2: Create register page**

Create `register.astro` — similar form with name, email, password fields. Calls `customer/register` API.

- [ ] **Step 3: Create account page**

Create `account.astro` — checks customer token from localStorage, fetches customer info and order history, displays them. If not authenticated, redirects to login.

- [ ] **Step 4: Register routes in integration**

In `integration.ts`, add the new routes:

```typescript
injectRoute({ pattern: `${basePath}/login`, entrypoint: resolveRoute("login.astro") });
injectRoute({ pattern: `${basePath}/register`, entrypoint: resolveRoute("register.astro") });
injectRoute({ pattern: `${basePath}/account`, entrypoint: resolveRoute("account.astro") });
```

- [ ] **Step 5: Run lint**

```bash
pnpm --silent lint:quick
```

- [ ] **Step 6: Commit**

```bash
git add packages/plugins/commerce/src/storefront/
git commit -m "feat(commerce): add customer login, register, and account storefront pages"
```

---

## Task 8: Fix Checkout Guest Toggle

**Files:**

- Modify: `packages/plugins/commerce/src/storefront/routes/checkout.astro`

- [ ] **Step 1: Update checkout to check customer session**

Replace the current admin session check with a customer session check:

```typescript
// Old (checks admin session):
if (!GUEST_CHECKOUT) {
	const authRes = await fetch("/_emdash/api/manifest", { credentials: "same-origin" });
	if (!authRes.ok) {
		/* show login required */
	}
}

// New (checks customer session):
if (!GUEST_CHECKOUT) {
	const customerToken = localStorage.getItem("commerce_customer_token");
	if (!customerToken) {
		loadingEl.style.display = "none";
		loginRequiredEl.style.display = "block";
		return;
	}
	const sessionRes = await fetch(`${API_BASE}/customer/session`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ customerToken }),
	});
	const sessionBody = await sessionRes.json();
	if (!sessionBody?.data?.authenticated) {
		localStorage.removeItem("commerce_customer_token");
		loadingEl.style.display = "none";
		loginRequiredEl.style.display = "block";
		return;
	}
}
```

- [ ] **Step 2: Update login link**

Change the "Log In" button to link to `/shop/login` instead of `/_emdash/admin/login`:

```html
<a href="/shop/login" class="login-btn">Log In</a>
```

- [ ] **Step 3: Pass customer token on checkout submit**

In the checkout form submit handler, include the customer token:

```typescript
const customerToken = localStorage.getItem("commerce_customer_token");
const res = await fetch(`${API_BASE}/checkout/create`, {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		cartId,
		name,
		email,
		customerNotes: notes || undefined,
		paymentProvider: "manual",
		customerToken: customerToken || undefined,
	}),
});
```

- [ ] **Step 4: Commit**

```bash
git add packages/plugins/commerce/src/storefront/routes/checkout.astro
git commit -m "feat(commerce): checkout checks customer session, not admin session"
```

---

## Task 9: Run Full Test Suite and Deploy

**Files:**

- None (verification only)

- [ ] **Step 1: Run all tests**

```bash
pnpm --filter emdash test
```

Expected: All existing tests pass + new `customer-auth.test.ts` passes.

- [ ] **Step 2: Run lint**

```bash
pnpm --silent lint:quick
```

- [ ] **Step 3: Format**

```bash
pnpm format
```

- [ ] **Step 4: Build core**

```bash
pnpm --filter emdash build
```

- [ ] **Step 5: Build and deploy live**

```bash
pnpm --filter emdash-live build && npx wrangler deploy
```

- [ ] **Step 6: Verify on live**

Test the flow:

1. Visit `/shop/register` — create an account
2. Visit `/shop/login` — log in
3. Visit `/shop/account` — see empty order history
4. Add product to cart, checkout — order should link to customer
5. Disable guest checkout in admin, try checkout in incognito — should see "Log In" pointing to `/shop/login`

- [ ] **Step 7: Commit any final fixes**

```bash
git add -A
git commit -m "feat(commerce): complete customer auth — Phase 1.5"
```

---

## Spec Coverage Check

| Spec Requirement        | Task                                                     |
| ----------------------- | -------------------------------------------------------- |
| Customer registration   | Task 4 (register function) + Task 7 (register page)      |
| Customer login          | Task 4 (login function) + Task 7 (login page)            |
| Customer session        | Task 3 (KV sessions) + Task 5 (session validation route) |
| Account pages           | Task 7 (login, register, account pages)                  |
| Checkout integration    | Task 6 (customer linking) + Task 8 (guest toggle fix)    |
| Customer-order linking  | Task 6 (checkout sets customerId from session)           |
| Order history           | Task 6 (account/orders route) + Task 7 (account page)    |
| Address book (existing) | Task 5 (session-protected)                               |
| Password security       | Task 2 (PBKDF2 100K iterations)                          |
| Guest checkout toggle   | Task 8 (checks customer session, not admin)              |
| Multi-device sessions   | Task 3 (one customer, many tokens)                       |
| Session expiry          | Task 3 (30-day TTL, checked at validation)               |
| Logout                  | Task 5 (customer/logout route)                           |
