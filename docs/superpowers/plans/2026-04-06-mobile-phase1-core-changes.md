# Mobile Phase 1: Core Changes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the server-side foundation to EmDash core that the mobile app requires — plugin mobile metadata, app config API, mobile auth, push device registration, image transforms, and App Bridge script injection.

**Architecture:** Extend PluginDefinition/PluginManifest with a `mobile` field. Add an `app:config` hook that plugins use to contribute global config. Create a `/app/config` endpoint the mobile app fetches on launch. Add mobile auth via magic link → API token exchange. Inject an App Bridge script into storefront pages when the request comes from the mobile app.

**Tech Stack:** Astro API routes, Kysely (SQLite), Zod, existing EmDash auth token system (`packages/auth/src/tokens.ts`).

**Spec:** `docs/superpowers/specs/2026-04-06-emdash-mobile-architecture-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `packages/core/src/astro/routes/api/app/config.ts` | App config endpoint |
| `packages/core/src/api/handlers/app-config.ts` | App config business logic |
| `packages/core/src/astro/routes/api/auth/mobile/request.ts` | Send magic link for mobile |
| `packages/core/src/astro/routes/api/auth/mobile/verify.ts` | Exchange code for API token |
| `packages/core/src/astro/routes/api/auth/mobile/refresh.ts` | Refresh expired mobile token |
| `packages/core/src/astro/routes/api/auth/mobile/session.ts` | Validate mobile token |
| `packages/core/src/astro/routes/api/push/register.ts` | Register/unregister push device |
| `packages/core/src/database/migrations/033_push_devices.ts` | Push devices table |
| `packages/core/src/mobile/bridge-script.ts` | App Bridge JS that gets injected |
| `packages/core/tests/unit/app-config.test.ts` | App config handler tests |
| `packages/core/tests/unit/mobile-auth.test.ts` | Mobile auth tests |
| `packages/core/tests/unit/push-devices.test.ts` | Push device registration tests |

### Modified Files
| File | Change |
|------|--------|
| `packages/core/src/plugins/types.ts` | Add `PluginMobileConfig`, `mobile` field to `PluginDefinition` and `PluginManifest` |
| `packages/core/src/plugins/hooks.ts` | Register `app:config` hook in `registerPlugins()` |
| `packages/core/src/astro/integration/routes.ts` | Register 6 new routes |
| `packages/core/src/database/migrations/runner.ts` | Import and register migration 033 |
| `packages/core/src/astro/middleware.ts` | Detect mobile app requests, inject bridge script |
| `packages/core/src/astro/routes/api/media/file/[key].ts` | Add `?w=&h=&fit=` query params for image transforms |

---

## Task 1: Add `mobile` Field to Plugin Types

**Files:**
- Modify: `packages/core/src/plugins/types.ts:1111-1152` (PluginDefinition area)
- Modify: `packages/core/src/plugins/types.ts:1293-1304` (PluginManifest area)

- [ ] **Step 1: Add PluginMobileConfig interface**

Add the new interface above `PluginAdminConfig` (around line 1100):

```typescript
/** Mobile app configuration for plugins */
export interface PluginMobileTab {
	key: string;
	label: string;
	icon: string;
	screen: string;
	badge?: string;
}

export interface PluginMobileConfig {
	/** Whether this plugin ships native React Native screens */
	native?: boolean;
	/** Entry URL for WebView rendering (third-party plugins) */
	entryUrl?: string;
	/** Display label in the mobile app */
	label?: string;
	/** Icon name from the shared icon set */
	icon?: string;
	/** Tab contributions to the mobile app navigation */
	tabs?: PluginMobileTab[];
}
```

- [ ] **Step 2: Add `mobile` to PluginDefinition**

In the `PluginDefinition` interface (line ~1129), add after the `admin` field:

```typescript
export interface PluginDefinition<TStorage extends PluginStorageConfig = PluginStorageConfig> {
	// ... existing fields ...

	/** Admin UI configuration */
	admin?: PluginAdminConfig;

	/** Mobile app configuration */
	mobile?: PluginMobileConfig;
}
```

- [ ] **Step 3: Add `mobile` to PluginManifest**

In the `PluginManifest` interface (line ~1293), add after `admin`:

```typescript
export interface PluginManifest {
	// ... existing fields ...
	admin: PluginAdminConfig;
	/** Mobile app configuration */
	mobile?: PluginMobileConfig;
}
```

- [ ] **Step 4: Run lint and typecheck**

Run: `pnpm --silent lint:quick 2>/dev/null && pnpm typecheck`
Expected: Clean pass. If any files reference `PluginManifest` or `PluginDefinition` with strict shape checks, they may need the new field added.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/plugins/types.ts
git commit -m "feat(core): add PluginMobileConfig to PluginDefinition and PluginManifest"
```

---

## Task 2: Add `app:config` Hook

**Files:**
- Modify: `packages/core/src/plugins/hooks.ts:204-232` (registerPlugins method)
- Modify: `packages/core/src/plugins/types.ts` (PluginHooks interface)

- [ ] **Step 1: Add `app:config` to the PluginHooks interface**

Find the `PluginHooks` interface in `types.ts` and add the new hook. The handler receives no input and returns a partial app config object:

```typescript
/** Hook for contributing to the mobile app configuration */
"app:config"?: HookHandler<void, Partial<AppConfigContribution>> | HookConfig<HookHandler<void, Partial<AppConfigContribution>>>;
```

Add the `AppConfigContribution` type nearby:

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

- [ ] **Step 2: Register the hook in HookPipeline.registerPlugins()**

In `hooks.ts`, inside `registerPlugins()` (around line 204-232), add the new hook registration alongside the existing ones:

```typescript
this.registerPluginHook(plugin, "app:config");
```

Add it after the last `this.registerPluginHook(plugin, "page:fragments");` line.

- [ ] **Step 3: Run lint and typecheck**

Run: `pnpm --silent lint:quick 2>/dev/null && pnpm typecheck`
Expected: Clean pass.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/plugins/types.ts packages/core/src/plugins/hooks.ts
git commit -m "feat(core): add app:config hook for mobile app configuration"
```

---

## Task 3: App Config API Endpoint

**Files:**
- Create: `packages/core/src/api/handlers/app-config.ts`
- Create: `packages/core/src/astro/routes/api/app/config.ts`
- Modify: `packages/core/src/astro/integration/routes.ts`
- Create: `packages/core/tests/unit/app-config.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/tests/unit/app-config.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildAppConfig } from "../../src/api/handlers/app-config.js";

describe("buildAppConfig", () => {
	it("returns default config when no plugins contribute", async () => {
		const result = await buildAppConfig({
			siteName: "Test Store",
			siteUrl: "https://test.com",
			plugins: [],
			hookContributions: [],
		});

		expect(result.site.name).toBe("Test Store");
		expect(result.site.url).toBe("https://test.com");
		expect(result.theme.primary).toBe("#3B82F6");
		expect(result.plugins).toEqual([]);
		expect(result.navigation.tabs).toEqual([]);
	});

	it("includes plugin mobile metadata", async () => {
		const result = await buildAppConfig({
			siteName: "Test Store",
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
						tabs: [
							{ key: "shop", label: "Shop", icon: "store", screen: "commerce:product-list" },
						],
					},
				},
			],
			hookContributions: [],
		});

		expect(result.plugins).toHaveLength(1);
		expect(result.plugins[0]!.id).toBe("commerce");
		expect(result.plugins[0]!.native).toBe(true);
		expect(result.navigation.tabs).toHaveLength(1);
		expect(result.navigation.tabs[0]!.key).toBe("shop");
	});

	it("merges hook contributions into theme", async () => {
		const result = await buildAppConfig({
			siteName: "Test Store",
			siteUrl: "https://test.com",
			plugins: [],
			hookContributions: [
				{ theme: { primary: "#7C3AED", secondary: "#A78BFA" } },
			],
		});

		expect(result.theme.primary).toBe("#7C3AED");
		expect(result.theme.secondary).toBe("#A78BFA");
		expect(result.theme.background).toBe("#FFFFFF"); // default preserved
	});

	it("includes third-party plugin with entryUrl", async () => {
		const result = await buildAppConfig({
			siteName: "Test Store",
			siteUrl: "https://test.com",
			plugins: [
				{
					id: "loyalty",
					name: "Loyalty Rewards",
					version: "2.0.0",
					mobile: {
						entryUrl: "/rewards",
						label: "Rewards",
						icon: "gift",
					},
				},
			],
			hookContributions: [],
		});

		expect(result.plugins[0]!.native).toBeFalsy();
		expect(result.plugins[0]!.mobile!.entryUrl).toBe("/rewards");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter emdash test -- tests/unit/app-config.test.ts`
Expected: FAIL — `buildAppConfig` does not exist.

- [ ] **Step 3: Write the handler**

Create `packages/core/src/api/handlers/app-config.ts`:

```typescript
import type { AppConfigContribution, PluginMobileConfig } from "../../plugins/types.js";

export interface AppConfigPluginInfo {
	id: string;
	name: string;
	version: string;
	mobile?: PluginMobileConfig;
}

export interface AppConfigInput {
	siteName: string;
	siteUrl: string;
	plugins: AppConfigPluginInfo[];
	hookContributions: Partial<AppConfigContribution>[];
}

export interface AppConfigTab {
	key: string;
	label: string;
	icon: string;
	screen: string;
	badge?: string;
}

export interface AppConfigResponse {
	site: {
		name: string;
		url: string;
		locale: string;
	};
	theme: {
		primary: string;
		secondary: string;
		background: string;
		surface: string;
		text: string;
		textMuted: string;
		error: string;
		success: string;
	};
	plugins: Array<{
		id: string;
		name: string;
		version: string;
		native: boolean;
		mobile?: PluginMobileConfig;
	}>;
	navigation: {
		tabs: AppConfigTab[];
	};
	features: Record<string, boolean>;
}

const DEFAULT_THEME = {
	primary: "#3B82F6",
	secondary: "#6366F1",
	background: "#FFFFFF",
	surface: "#F9FAFB",
	text: "#111827",
	textMuted: "#6B7280",
	error: "#EF4444",
	success: "#10B981",
};

export async function buildAppConfig(input: AppConfigInput): Promise<AppConfigResponse> {
	// Merge hook contributions into theme
	let theme = { ...DEFAULT_THEME };
	let features: Record<string, boolean> = {};

	for (const contribution of input.hookContributions) {
		if (contribution.theme) {
			theme = { ...theme, ...contribution.theme };
		}
		if (contribution.features) {
			features = { ...features, ...contribution.features };
		}
	}

	// Build plugin list with mobile metadata
	const plugins = input.plugins
		.filter((p) => p.mobile)
		.map((p) => ({
			id: p.id,
			name: p.name,
			version: p.version,
			native: p.mobile?.native ?? false,
			mobile: p.mobile,
		}));

	// Collect tabs from plugins that declare them
	const tabs: AppConfigTab[] = [];
	for (const plugin of input.plugins) {
		if (plugin.mobile?.tabs) {
			for (const tab of plugin.mobile.tabs) {
				tabs.push(tab);
			}
		}
	}

	return {
		site: {
			name: input.siteName,
			url: input.siteUrl,
			locale: "en",
		},
		theme,
		plugins,
		navigation: { tabs },
		features,
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter emdash test -- tests/unit/app-config.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 5: Write the route**

Create `packages/core/src/astro/routes/api/app/config.ts`:

```typescript
export const prerender = false;

import type { APIRoute } from "astro";
import { apiError, apiSuccess, handleError } from "#api/error.js";
import { buildAppConfig } from "#api/handlers/app-config.js";
import type { AppConfigContribution } from "../../../plugins/types.js";

export const GET: APIRoute = async ({ locals }) => {
	const { emdash } = locals;

	if (!emdash) {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}

	try {
		// Gather hook contributions from plugins
		const hookContributions: Partial<AppConfigContribution>[] = [];
		if (emdash.hooks) {
			const results = await emdash.hooks.run("app:config", undefined);
			if (results) {
				for (const result of results) {
					if (result) hookContributions.push(result as Partial<AppConfigContribution>);
				}
			}
		}

		// Gather plugin info with mobile metadata
		const allPlugins = emdash.plugins?.getAllPlugins() ?? [];
		const pluginInfos = allPlugins
			.filter((p) => p.state === "active")
			.map((p) => ({
				id: p.plugin.id,
				name: p.plugin.id,
				version: p.plugin.version,
				mobile: p.plugin.mobile,
			}));

		const config = await buildAppConfig({
			siteName: emdash.config?.site?.name ?? "EmDash Site",
			siteUrl: emdash.config?.site?.url ?? "",
			plugins: pluginInfos,
			hookContributions,
		});

		return apiSuccess(config);
	} catch (error) {
		return handleError(error, "Failed to build app config", "APP_CONFIG_ERROR");
	}
};
```

- [ ] **Step 6: Register the route**

In `packages/core/src/astro/integration/routes.ts`, add in the API routes section:

```typescript
injectRoute({
	pattern: "/_emdash/api/app/config",
	entrypoint: resolveRoute("api/app/config.ts"),
});
```

- [ ] **Step 7: Run lint and typecheck**

Run: `pnpm --silent lint:quick 2>/dev/null && pnpm typecheck`
Expected: Clean pass. Fix any import path issues.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/api/handlers/app-config.ts packages/core/src/astro/routes/api/app/config.ts packages/core/src/astro/integration/routes.ts packages/core/tests/unit/app-config.test.ts
git commit -m "feat(core): add GET /app/config endpoint for mobile app configuration"
```

---

## Task 4: Mobile Auth — Magic Link Flow

**Files:**
- Create: `packages/core/src/astro/routes/api/auth/mobile/request.ts`
- Create: `packages/core/src/astro/routes/api/auth/mobile/verify.ts`
- Create: `packages/core/src/astro/routes/api/auth/mobile/refresh.ts`
- Create: `packages/core/src/astro/routes/api/auth/mobile/session.ts`
- Modify: `packages/core/src/astro/integration/routes.ts`
- Create: `packages/core/tests/unit/mobile-auth.test.ts`

- [ ] **Step 1: Write failing tests for the mobile auth token flow**

Create `packages/core/tests/unit/mobile-auth.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Kysely } from "kysely";
import { setupTestDatabase } from "../utils/test-db.js";
import { generatePrefixedToken, hashPrefixedToken } from "@emdash-cms/auth/tokens";

describe("mobile auth tokens", () => {
	let db: Kysely<any>;

	beforeEach(async () => {
		db = await setupTestDatabase();
	});

	afterEach(async () => {
		await db.destroy();
	});

	it("generates a mobile token with ec_pat_ prefix", () => {
		const { raw, hash } = generatePrefixedToken("ec_pat_");
		expect(raw.startsWith("ec_pat_")).toBe(true);
		expect(hash).toBeTruthy();
		expect(hashPrefixedToken(raw)).toBe(hash);
	});

	it("can store and retrieve a mobile token in api_tokens table", async () => {
		const { raw, hash } = generatePrefixedToken("ec_pat_");

		// Insert token
		await db
			.insertInto("_emdash_api_tokens")
			.values({
				id: "tok_test_1",
				user_id: "user_1",
				name: "Mobile App",
				token_hash: hash,
				scopes: JSON.stringify(["content:read", "media:read"]),
				created_at: new Date().toISOString(),
			})
			.execute();

		// Look up by hash
		const found = await db
			.selectFrom("_emdash_api_tokens")
			.selectAll()
			.where("token_hash", "=", hashPrefixedToken(raw))
			.executeTakeFirst();

		expect(found).toBeTruthy();
		expect(found!.user_id).toBe("user_1");
		expect(found!.name).toBe("Mobile App");
	});
});
```

- [ ] **Step 2: Run test to verify it passes (these test existing token infrastructure)**

Run: `pnpm --filter emdash test -- tests/unit/mobile-auth.test.ts`
Expected: PASS — this validates the existing token system works for mobile tokens. If the `_emdash_api_tokens` table doesn't exist in test DB, check if it's created by migrations.

- [ ] **Step 3: Write the request endpoint (send magic link for mobile)**

Create `packages/core/src/astro/routes/api/auth/mobile/request.ts`:

```typescript
export const prerender = false;

import type { APIRoute } from "astro";
import { z } from "zod";
import { apiError, apiSuccess, handleError } from "#api/error.js";
import { parseBody, isParseError } from "#api/parse.js";

const mobileAuthRequestBody = z.object({
	email: z.string().email(),
});

export const POST: APIRoute = async ({ request, locals }) => {
	const { emdash } = locals;

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}

	try {
		const body = await parseBody(request, mobileAuthRequestBody);
		if (isParseError(body)) return body;

		// Check email is available
		if (!emdash.email?.isAvailable()) {
			return apiError("EMAIL_NOT_CONFIGURED", "Email delivery is not configured", 503);
		}

		// Find user by email
		const user = await emdash.db
			.selectFrom("_emdash_users")
			.selectAll()
			.where("email", "=", body.email.toLowerCase())
			.executeTakeFirst();

		// Always return success to prevent email enumeration
		if (!user) {
			return apiSuccess({ success: true, message: "If an account exists, a login link has been sent." });
		}

		// Generate a short-lived code (6 digits)
		const code = String(Math.floor(100000 + Math.random() * 900000));
		const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

		// Store code in _emdash_magic_links (reuse existing table)
		const { sql } = await import("kysely");
		await emdash.db
			.insertInto("_emdash_magic_links")
			.values({
				id: crypto.randomUUID(),
				user_id: user.id,
				token_hash: code, // For mobile, we use a short code instead of a long token
				expires_at: expiresAt,
				used: 0,
			})
			.execute();

		// Send email with code
		await emdash.email.send({
			to: body.email,
			subject: "Your mobile login code",
			text: `Your login code is: ${code}\n\nThis code expires in 10 minutes.`,
			html: `<p>Your login code is: <strong>${code}</strong></p><p>This code expires in 10 minutes.</p>`,
		});

		return apiSuccess({ success: true, message: "If an account exists, a login link has been sent." });
	} catch (error) {
		return handleError(error, "Failed to send mobile auth code", "MOBILE_AUTH_REQUEST_ERROR");
	}
};
```

- [ ] **Step 4: Write the verify endpoint (exchange code for API token)**

Create `packages/core/src/astro/routes/api/auth/mobile/verify.ts`:

```typescript
export const prerender = false;

import type { APIRoute } from "astro";
import { z } from "zod";
import { apiError, apiSuccess, handleError } from "#api/error.js";
import { parseBody, isParseError } from "#api/parse.js";
import { generatePrefixedToken, TOKEN_PREFIXES } from "@emdash-cms/auth/tokens";
import { ulidx } from "../../../../../../utils/id.js";

const mobileAuthVerifyBody = z.object({
	email: z.string().email(),
	code: z.string().length(6),
});

export const POST: APIRoute = async ({ request, locals }) => {
	const { emdash } = locals;

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}

	try {
		const body = await parseBody(request, mobileAuthVerifyBody);
		if (isParseError(body)) return body;

		// Find user
		const user = await emdash.db
			.selectFrom("_emdash_users")
			.selectAll()
			.where("email", "=", body.email.toLowerCase())
			.executeTakeFirst();

		if (!user) {
			return apiError("INVALID_CODE", "Invalid email or code", 401);
		}

		// Find valid magic link with matching code
		const link = await emdash.db
			.selectFrom("_emdash_magic_links")
			.selectAll()
			.where("user_id", "=", user.id)
			.where("token_hash", "=", body.code)
			.where("used", "=", 0)
			.where("expires_at", ">", new Date().toISOString())
			.executeTakeFirst();

		if (!link) {
			return apiError("INVALID_CODE", "Invalid or expired code", 401);
		}

		// Mark as used
		await emdash.db
			.updateTable("_emdash_magic_links")
			.set({ used: 1 })
			.where("id", "=", link.id)
			.execute();

		// Generate API token for mobile
		const { raw, hash } = generatePrefixedToken(TOKEN_PREFIXES.PAT);
		const tokenId = ulidx();

		await emdash.db
			.insertInto("_emdash_api_tokens")
			.values({
				id: tokenId,
				user_id: user.id,
				name: "Mobile App",
				token_hash: hash,
				scopes: JSON.stringify(["content:read", "content:write", "media:read", "media:write"]),
				created_at: new Date().toISOString(),
				expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
			})
			.execute();

		return apiSuccess({
			token: raw,
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				role: user.role,
			},
			expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
		});
	} catch (error) {
		return handleError(error, "Failed to verify mobile auth code", "MOBILE_AUTH_VERIFY_ERROR");
	}
};
```

- [ ] **Step 5: Write the session endpoint (validate token)**

Create `packages/core/src/astro/routes/api/auth/mobile/session.ts`:

```typescript
export const prerender = false;

import type { APIRoute } from "astro";
import { apiError, apiSuccess, handleError } from "#api/error.js";
import { hashPrefixedToken } from "@emdash-cms/auth/tokens";

export const GET: APIRoute = async ({ request, locals }) => {
	const { emdash } = locals;

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}

	try {
		const authHeader = request.headers.get("Authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			return apiError("UNAUTHORIZED", "Missing or invalid authorization header", 401);
		}

		const token = authHeader.slice(7);
		const hash = hashPrefixedToken(token);

		const record = await emdash.db
			.selectFrom("_emdash_api_tokens")
			.innerJoin("_emdash_users", "_emdash_users.id", "_emdash_api_tokens.user_id")
			.select([
				"_emdash_api_tokens.id as token_id",
				"_emdash_api_tokens.scopes",
				"_emdash_api_tokens.expires_at",
				"_emdash_users.id as user_id",
				"_emdash_users.email",
				"_emdash_users.name",
				"_emdash_users.role",
			])
			.where("_emdash_api_tokens.token_hash", "=", hash)
			.executeTakeFirst();

		if (!record) {
			return apiError("UNAUTHORIZED", "Invalid token", 401);
		}

		// Check expiry
		if (record.expires_at && new Date(record.expires_at) < new Date()) {
			return apiError("TOKEN_EXPIRED", "Token has expired", 401);
		}

		return apiSuccess({
			user: {
				id: record.user_id,
				email: record.email,
				name: record.name,
				role: record.role,
			},
			scopes: JSON.parse(record.scopes as string),
		});
	} catch (error) {
		return handleError(error, "Failed to validate session", "MOBILE_SESSION_ERROR");
	}
};
```

- [ ] **Step 6: Write the refresh endpoint**

Create `packages/core/src/astro/routes/api/auth/mobile/refresh.ts`:

```typescript
export const prerender = false;

import type { APIRoute } from "astro";
import { apiError, apiSuccess, handleError } from "#api/error.js";
import { generatePrefixedToken, hashPrefixedToken, TOKEN_PREFIXES } from "@emdash-cms/auth/tokens";
import { ulidx } from "../../../../../../utils/id.js";

export const POST: APIRoute = async ({ request, locals }) => {
	const { emdash } = locals;

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}

	try {
		const authHeader = request.headers.get("Authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			return apiError("UNAUTHORIZED", "Missing authorization header", 401);
		}

		const oldToken = authHeader.slice(7);
		const oldHash = hashPrefixedToken(oldToken);

		// Find existing token
		const existing = await emdash.db
			.selectFrom("_emdash_api_tokens")
			.selectAll()
			.where("token_hash", "=", oldHash)
			.executeTakeFirst();

		if (!existing) {
			return apiError("UNAUTHORIZED", "Invalid token", 401);
		}

		// Delete old token
		await emdash.db
			.deleteFrom("_emdash_api_tokens")
			.where("id", "=", existing.id)
			.execute();

		// Generate new token
		const { raw, hash } = generatePrefixedToken(TOKEN_PREFIXES.PAT);
		const tokenId = ulidx();

		await emdash.db
			.insertInto("_emdash_api_tokens")
			.values({
				id: tokenId,
				user_id: existing.user_id,
				name: "Mobile App",
				token_hash: hash,
				scopes: existing.scopes,
				created_at: new Date().toISOString(),
				expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
			})
			.execute();

		return apiSuccess({
			token: raw,
			expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
		});
	} catch (error) {
		return handleError(error, "Failed to refresh token", "MOBILE_REFRESH_ERROR");
	}
};
```

- [ ] **Step 7: Register all 4 mobile auth routes**

In `packages/core/src/astro/integration/routes.ts`, add:

```typescript
injectRoute({
	pattern: "/_emdash/api/auth/mobile/request",
	entrypoint: resolveRoute("api/auth/mobile/request.ts"),
});
injectRoute({
	pattern: "/_emdash/api/auth/mobile/verify",
	entrypoint: resolveRoute("api/auth/mobile/verify.ts"),
});
injectRoute({
	pattern: "/_emdash/api/auth/mobile/refresh",
	entrypoint: resolveRoute("api/auth/mobile/refresh.ts"),
});
injectRoute({
	pattern: "/_emdash/api/auth/mobile/session",
	entrypoint: resolveRoute("api/auth/mobile/session.ts"),
});
```

- [ ] **Step 8: Run lint, typecheck, and tests**

Run: `pnpm --silent lint:quick 2>/dev/null && pnpm typecheck && pnpm --filter emdash test -- tests/unit/mobile-auth.test.ts`
Expected: All pass.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/astro/routes/api/auth/mobile/ packages/core/src/astro/integration/routes.ts packages/core/tests/unit/mobile-auth.test.ts
git commit -m "feat(core): add mobile auth endpoints (magic link code → API token)"
```

---

## Task 5: Push Device Registration

**Files:**
- Create: `packages/core/src/database/migrations/033_push_devices.ts`
- Modify: `packages/core/src/database/migrations/runner.ts`
- Create: `packages/core/src/astro/routes/api/push/register.ts`
- Modify: `packages/core/src/astro/integration/routes.ts`
- Create: `packages/core/tests/unit/push-devices.test.ts`

- [ ] **Step 1: Write failing test for the migration**

Create `packages/core/tests/unit/push-devices.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Kysely } from "kysely";
import { setupTestDatabase } from "../utils/test-db.js";

describe("push device registration", () => {
	let db: Kysely<any>;

	beforeEach(async () => {
		db = await setupTestDatabase();
	});

	afterEach(async () => {
		await db.destroy();
	});

	it("can insert and query push devices", async () => {
		await db
			.insertInto("_emdash_push_devices")
			.values({
				id: "dev_1",
				user_id: "user_1",
				push_token: "fcm_token_abc123",
				platform: "ios",
				created_at: new Date().toISOString(),
				last_seen_at: new Date().toISOString(),
			})
			.execute();

		const devices = await db
			.selectFrom("_emdash_push_devices")
			.selectAll()
			.where("user_id", "=", "user_1")
			.execute();

		expect(devices).toHaveLength(1);
		expect(devices[0]!.platform).toBe("ios");
		expect(devices[0]!.push_token).toBe("fcm_token_abc123");
	});

	it("enforces unique push_token", async () => {
		await db
			.insertInto("_emdash_push_devices")
			.values({
				id: "dev_1",
				user_id: "user_1",
				push_token: "same_token",
				platform: "ios",
				created_at: new Date().toISOString(),
				last_seen_at: new Date().toISOString(),
			})
			.execute();

		await expect(
			db
				.insertInto("_emdash_push_devices")
				.values({
					id: "dev_2",
					user_id: "user_2",
					push_token: "same_token",
					platform: "android",
					created_at: new Date().toISOString(),
					last_seen_at: new Date().toISOString(),
				})
				.execute(),
		).rejects.toThrow();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter emdash test -- tests/unit/push-devices.test.ts`
Expected: FAIL — table `_emdash_push_devices` does not exist.

- [ ] **Step 3: Write the migration**

Create `packages/core/src/database/migrations/033_push_devices.ts`:

```typescript
import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("_emdash_push_devices")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("user_id", "text")
		.addColumn("customer_id", "text")
		.addColumn("push_token", "text", (col) => col.notNull().unique())
		.addColumn("platform", "text", (col) => col.notNull())
		.addColumn("created_at", "text", (col) => col.notNull())
		.addColumn("last_seen_at", "text", (col) => col.notNull())
		.execute();

	await db.schema
		.createIndex("idx_push_devices_user_id")
		.on("_emdash_push_devices")
		.column("user_id")
		.execute();

	await db.schema
		.createIndex("idx_push_devices_customer_id")
		.on("_emdash_push_devices")
		.column("customer_id")
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("_emdash_push_devices").execute();
}
```

- [ ] **Step 4: Register the migration in runner.ts**

In `packages/core/src/database/migrations/runner.ts`, add:

At the top with the other imports:
```typescript
import * as m033 from "./033_push_devices.js";
```

In the `getMigrations()` return object, add:
```typescript
"033_push_devices": m033,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter emdash test -- tests/unit/push-devices.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the push registration route**

Create `packages/core/src/astro/routes/api/push/register.ts`:

```typescript
export const prerender = false;

import type { APIRoute } from "astro";
import { z } from "zod";
import { apiError, apiSuccess, handleError } from "#api/error.js";
import { parseBody, isParseError } from "#api/parse.js";
import { hashPrefixedToken } from "@emdash-cms/auth/tokens";

const registerBody = z.object({
	pushToken: z.string().min(1),
	platform: z.enum(["ios", "android"]),
	customerToken: z.string().optional(),
});

const unregisterBody = z.object({
	pushToken: z.string().min(1),
});

export const POST: APIRoute = async ({ request, locals }) => {
	const { emdash } = locals;

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}

	try {
		const body = await parseBody(request, registerBody);
		if (isParseError(body)) return body;

		// Resolve user from auth header if present
		let userId: string | null = null;
		const authHeader = request.headers.get("Authorization");
		if (authHeader?.startsWith("Bearer ")) {
			const hash = hashPrefixedToken(authHeader.slice(7));
			const token = await emdash.db
				.selectFrom("_emdash_api_tokens")
				.select("user_id")
				.where("token_hash", "=", hash)
				.executeTakeFirst();
			userId = token?.user_id ?? null;
		}

		const now = new Date().toISOString();

		// Upsert: update last_seen if token exists, insert if new
		const existing = await emdash.db
			.selectFrom("_emdash_push_devices")
			.select("id")
			.where("push_token", "=", body.pushToken)
			.executeTakeFirst();

		if (existing) {
			await emdash.db
				.updateTable("_emdash_push_devices")
				.set({
					user_id: userId,
					customer_id: body.customerToken ?? null,
					platform: body.platform,
					last_seen_at: now,
				})
				.where("id", "=", existing.id)
				.execute();
		} else {
			await emdash.db
				.insertInto("_emdash_push_devices")
				.values({
					id: crypto.randomUUID(),
					user_id: userId,
					customer_id: body.customerToken ?? null,
					push_token: body.pushToken,
					platform: body.platform,
					created_at: now,
					last_seen_at: now,
				})
				.execute();
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return handleError(error, "Failed to register push device", "PUSH_REGISTER_ERROR");
	}
};

export const DELETE: APIRoute = async ({ request, locals }) => {
	const { emdash } = locals;

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}

	try {
		const body = await parseBody(request, unregisterBody);
		if (isParseError(body)) return body;

		await emdash.db
			.deleteFrom("_emdash_push_devices")
			.where("push_token", "=", body.pushToken)
			.execute();

		return apiSuccess({ success: true });
	} catch (error) {
		return handleError(error, "Failed to unregister push device", "PUSH_UNREGISTER_ERROR");
	}
};
```

- [ ] **Step 7: Register the push route**

In `packages/core/src/astro/integration/routes.ts`, add:

```typescript
injectRoute({
	pattern: "/_emdash/api/push/register",
	entrypoint: resolveRoute("api/push/register.ts"),
});
```

- [ ] **Step 8: Run lint, typecheck, and tests**

Run: `pnpm --silent lint:quick 2>/dev/null && pnpm typecheck && pnpm --filter emdash test -- tests/unit/push-devices.test.ts`
Expected: All pass.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/database/migrations/033_push_devices.ts packages/core/src/database/migrations/runner.ts packages/core/src/astro/routes/api/push/register.ts packages/core/src/astro/integration/routes.ts packages/core/tests/unit/push-devices.test.ts
git commit -m "feat(core): add push device registration table and endpoints"
```

---

## Task 6: Image Transform on Media Endpoint

**Files:**
- Modify: `packages/core/src/astro/routes/api/media/file/[key].ts`
- Create: `packages/core/tests/unit/image-transform.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/core/tests/unit/image-transform.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseTransformParams } from "../../src/api/handlers/image-transform.js";

describe("parseTransformParams", () => {
	it("returns null when no transform params present", () => {
		const url = new URL("https://example.com/media/file/abc.jpg");
		expect(parseTransformParams(url)).toBeNull();
	});

	it("parses width and height", () => {
		const url = new URL("https://example.com/media/file/abc.jpg?w=300&h=200");
		const params = parseTransformParams(url);
		expect(params).toEqual({ w: 300, h: 200, fit: "cover", format: null });
	});

	it("parses fit parameter", () => {
		const url = new URL("https://example.com/media/file/abc.jpg?w=300&fit=contain");
		const params = parseTransformParams(url);
		expect(params!.fit).toBe("contain");
	});

	it("clamps width to max 2000", () => {
		const url = new URL("https://example.com/media/file/abc.jpg?w=5000");
		const params = parseTransformParams(url);
		expect(params!.w).toBe(2000);
	});

	it("ignores invalid values", () => {
		const url = new URL("https://example.com/media/file/abc.jpg?w=abc");
		expect(parseTransformParams(url)).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter emdash test -- tests/unit/image-transform.test.ts`
Expected: FAIL — `parseTransformParams` does not exist.

- [ ] **Step 3: Write the transform param parser**

Create `packages/core/src/api/handlers/image-transform.ts`:

```typescript
export interface TransformParams {
	w: number | null;
	h: number | null;
	fit: "cover" | "contain" | "fill";
	format: "webp" | "jpeg" | "png" | null;
}

const MAX_DIMENSION = 2000;
const VALID_FITS = new Set(["cover", "contain", "fill"]);
const VALID_FORMATS = new Set(["webp", "jpeg", "png"]);

export function parseTransformParams(url: URL): TransformParams | null {
	const wStr = url.searchParams.get("w");
	const hStr = url.searchParams.get("h");
	const fitStr = url.searchParams.get("fit");
	const formatStr = url.searchParams.get("format");

	// If no transform params, skip transforms
	if (!wStr && !hStr) return null;

	const w = wStr ? parseInt(wStr, 10) : null;
	const h = hStr ? parseInt(hStr, 10) : null;

	// Reject non-numeric values
	if ((wStr && (isNaN(w!) || w! <= 0)) || (hStr && (isNaN(h!) || h! <= 0))) {
		return null;
	}

	return {
		w: w ? Math.min(w, MAX_DIMENSION) : null,
		h: h ? Math.min(h, MAX_DIMENSION) : null,
		fit: (fitStr && VALID_FITS.has(fitStr) ? fitStr : "cover") as TransformParams["fit"],
		format: (formatStr && VALID_FORMATS.has(formatStr) ? formatStr : null) as TransformParams["format"],
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter emdash test -- tests/unit/image-transform.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 5: Integrate transform params into the media file route**

In `packages/core/src/astro/routes/api/media/file/[key].ts`, modify the GET handler to parse transform params and add a `Vary` header. The actual image processing (sharp/Cloudflare) is deferred to Phase 2 — for now, this just passes through the original image but sets up the URL contract:

Add at the top of the file:
```typescript
import { parseTransformParams } from "#api/handlers/image-transform.js";
```

Inside the GET handler, after getting the `url` from context (add `url` to destructuring), before `emdash.storage.download(key)`:

```typescript
const transform = parseTransformParams(url);

// TODO(phase2): Apply transforms via sharp (Node) or Cloudflare Image Resizing
// For now, serve original and set Vary header so CDN caches per-params
```

In the response headers section, add:
```typescript
if (transform) {
	headers["Vary"] = "Accept";
	// Remove immutable cache for transformed images (params may change)
	headers["Cache-Control"] = "public, max-age=86400";
}
```

- [ ] **Step 6: Run lint and typecheck**

Run: `pnpm --silent lint:quick 2>/dev/null && pnpm typecheck`
Expected: Clean pass.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/api/handlers/image-transform.ts packages/core/src/astro/routes/api/media/file/\\[key\\].ts packages/core/tests/unit/image-transform.test.ts
git commit -m "feat(core): add image transform URL params on media endpoint (contract only)"
```

---

## Task 7: App Bridge Script Injection

**Files:**
- Create: `packages/core/src/mobile/bridge-script.ts`
- Modify: `packages/core/src/astro/middleware.ts`

- [ ] **Step 1: Write the App Bridge JS script**

Create `packages/core/src/mobile/bridge-script.ts`:

```typescript
/**
 * Returns the App Bridge JavaScript that gets injected into storefront pages
 * when the request comes from the EmDash mobile app.
 *
 * This script:
 * 1. Reads bridge context from window.__EMDASH_BRIDGE__
 * 2. Exposes the emdash.* SDK for WebView → Native communication
 * 3. Sets up postMessage listener for Native → WebView responses
 */
export function getAppBridgeScript(): string {
	return `
(function() {
	if (window.__emdashBridgeInitialized) return;
	window.__emdashBridgeInitialized = true;

	var _callbacks = {};
	var _nextId = 1;

	function send(method, params) {
		return new Promise(function(resolve, reject) {
			var id = String(_nextId++);
			_callbacks[id] = { resolve: resolve, reject: reject };
			window.ReactNativeWebView.postMessage(JSON.stringify({
				type: "emdash-bridge",
				id: id,
				method: method,
				params: params || {}
			}));
		});
	}

	function fire(method, params) {
		window.ReactNativeWebView.postMessage(JSON.stringify({
			type: "emdash-bridge",
			id: "0",
			method: method,
			params: params || {}
		}));
	}

	// Listen for responses from native
	window.addEventListener("message", function(event) {
		try {
			var data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
			if (data.type !== "emdash-bridge-response") return;
			var cb = _callbacks[data.id];
			if (!cb) return;
			delete _callbacks[data.id];
			if (data.error) {
				cb.reject(new Error(data.error));
			} else {
				cb.resolve(data.result);
			}
		} catch (e) {}
	});

	window.emdash = {
		navigate: function(screen, params) { fire("navigate", { screen: screen, params: params }); },
		dismiss: function() { fire("dismiss"); },
		setTitle: function(title) { fire("setTitle", { title: title }); },
		toast: function(message, type) { fire("toast", { message: message, type: type || "info" }); },
		confirm: function(title, message) { return send("confirm", { title: title, message: message }); },
		updateCartBadge: function(count) { fire("updateCartBadge", { count: count }); },
		getAuth: function() { return send("getAuth"); },
		share: function(url, text) { fire("share", { url: url, text: text }); },
		haptic: function(type) { fire("haptic", { type: type || "light" }); },
		ready: function() { fire("ready"); },
		context: window.__EMDASH_BRIDGE__ || {}
	};

	// Auto-apply theme colors as CSS custom properties
	var theme = (window.__EMDASH_BRIDGE__ || {}).theme;
	if (theme) {
		var root = document.documentElement;
		Object.keys(theme).forEach(function(key) {
			root.style.setProperty("--emdash-" + key, theme[key]);
		});
	}

	// Signal ready
	window.emdash.ready();
})();
`;
}

/**
 * Checks if a request comes from the EmDash mobile app.
 */
export function isMobileAppRequest(request: Request): boolean {
	const ua = request.headers.get("User-Agent") ?? "";
	const header = request.headers.get("X-EmDash-App");
	return ua.includes("EmDashApp/") || header === "1";
}
```

- [ ] **Step 2: Add bridge injection to middleware**

In `packages/core/src/astro/middleware.ts`, import the bridge utilities at the top:

```typescript
import { getAppBridgeScript, isMobileAppRequest } from "../mobile/bridge-script.js";
```

Inside the middleware function, after the `const response = await next();` call and before `setBaselineSecurityHeaders(response)`, add the bridge injection logic:

```typescript
// Inject App Bridge script for mobile app requests
if (isMobileAppRequest(request) && response.headers.get("Content-Type")?.includes("text/html")) {
	const html = await response.text();
	const bridgeScript = `<script>${getAppBridgeScript()}</script>`;
	const injectedHtml = html.replace("</head>", `${bridgeScript}</head>`);
	return new Response(injectedHtml, {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers,
	});
}
```

- [ ] **Step 3: Run lint and typecheck**

Run: `pnpm --silent lint:quick 2>/dev/null && pnpm typecheck`
Expected: Clean pass.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/mobile/bridge-script.ts packages/core/src/astro/middleware.ts
git commit -m "feat(core): inject App Bridge script into storefront pages for mobile app requests"
```

---

## Task 8: Update Commerce Plugin with Mobile Config

**Files:**
- Modify: `packages/plugins/commerce/src/sandbox-entry.ts`

- [ ] **Step 1: Add mobile config to the commerce plugin definition**

In `packages/plugins/commerce/src/sandbox-entry.ts`, find the `definePlugin()` call and add the `mobile` field:

```typescript
export default definePlugin({
	id: "commerce",
	version: "1.0.0",
	// ... existing fields ...

	mobile: {
		native: true,
		label: "Shop",
		icon: "store",
		tabs: [
			{ key: "shop", label: "Shop", icon: "store", screen: "commerce:product-list" },
			{ key: "cart", label: "Cart", icon: "cart", screen: "commerce:cart", badge: "cartCount" },
		],
	},

	// ... rest of plugin definition ...
});
```

- [ ] **Step 2: Run lint and typecheck**

Run: `pnpm --silent lint:quick 2>/dev/null && pnpm typecheck`
Expected: Clean pass. The `mobile` field should be accepted by the updated `PluginDefinition` type from Task 1.

- [ ] **Step 3: Commit**

```bash
git add packages/plugins/commerce/src/sandbox-entry.ts
git commit -m "feat(commerce): add mobile config to commerce plugin definition"
```

---

## Verification

After all 8 tasks are complete, run the full check:

- [ ] **Full lint:** `pnpm --silent lint:json 2>/dev/null | jq '.diagnostics | length'` → should be 0
- [ ] **Full typecheck:** `pnpm typecheck` → should pass
- [ ] **All tests:** `pnpm test` → should pass
- [ ] **Format:** `pnpm format`

### New API surface summary

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/_emdash/api/app/config` | Mobile app configuration |
| POST | `/_emdash/api/auth/mobile/request` | Send magic link code |
| POST | `/_emdash/api/auth/mobile/verify` | Exchange code for API token |
| POST | `/_emdash/api/auth/mobile/refresh` | Refresh expired token |
| GET | `/_emdash/api/auth/mobile/session` | Validate token |
| POST | `/_emdash/api/push/register` | Register push device |
| DELETE | `/_emdash/api/push/register` | Unregister push device |
