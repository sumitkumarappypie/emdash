# Commerce Phase 1: Core MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a working e-commerce MVP — product catalog, cart, checkout with Stripe, orders, flat-rate shipping, manual tax, and ready-to-use storefront components.

**Architecture:** Plugin suite using EmDash's standard plugin system. Core plugin (`commerce`) declares storage collections and exposes hooks + routes. Provider plugins (`commerce-shipping-basic`, `commerce-tax-basic`, `commerce-stripe`) implement provider interfaces via hooks. Storefront plugin (`commerce-storefront`) provides Astro components consuming the core API. All plugins use the standard format (descriptor + sandbox-entry split).

**Tech Stack:** TypeScript, EmDash plugin SDK (`definePlugin`, `PluginDescriptor`, `PluginContext`), Zod for validation, Stripe SDK (in commerce-stripe), Astro components (in commerce-storefront).

**Spec:** `docs/superpowers/specs/2026-04-03-emdash-commerce-plugin-suite-design.md`

---

## File Structure

### packages/plugins/commerce/

```
commerce/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                    # Descriptor factory
    ├── sandbox-entry.ts            # definePlugin — hooks + routes
    ├── types.ts                    # All shared types (product, cart, order, etc.)
    ├── storage.ts                  # Storage config + collection types
    ├── validation.ts               # Zod schemas for all inputs
    ├── products.ts                 # Product CRUD operations
    ├── categories.ts               # Category CRUD operations
    ├── variants.ts                 # Variant CRUD operations
    ├── cart.ts                     # Cart logic (create, add, remove, recalculate)
    ├── coupons.ts                  # Coupon engine (validate, apply)
    ├── customers.ts                # Customer management
    ├── checkout.ts                 # Cart-to-order conversion, inventory
    ├── orders.ts                   # Order CRUD, status, fulfillment, refunds
    ├── transactions.ts             # Payment transaction recording
    ├── providers.ts                # Provider interface types + dispatch helpers
    ├── admin/
    │   ├── dashboard.ts            # Dashboard Block Kit page
    │   ├── products.ts             # Product list + editor Block Kit pages
    │   ├── categories.ts           # Category management Block Kit page
    │   ├── orders.ts               # Order list + detail Block Kit pages
    │   ├── customers.ts            # Customer list Block Kit page
    │   ├── coupons.ts              # Coupon list + editor Block Kit page
    │   ├── settings.ts             # Settings Block Kit page
    │   └── blocks.ts               # Shared Block Kit helpers
    └── hooks.ts                    # Hook wiring (content hooks, commerce hooks)
```

### packages/plugins/commerce-shipping-basic/

```
commerce-shipping-basic/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                    # Descriptor
    ├── sandbox-entry.ts            # definePlugin — shipping:rates hook
    └── rates.ts                    # Rate calculation logic
```

### packages/plugins/commerce-tax-basic/

```
commerce-tax-basic/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                    # Descriptor
    ├── sandbox-entry.ts            # definePlugin — tax:calculate hook
    └── calculate.ts                # Tax calculation logic
```

### packages/plugins/commerce-stripe/

```
commerce-stripe/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                    # Descriptor
    ├── sandbox-entry.ts            # definePlugin — payment hooks + webhook route
    ├── client.ts                   # Stripe API client (fetch-based, no Node SDK)
    └── webhook.ts                  # Webhook signature verification + event handling
```

### packages/plugins/commerce-storefront/

```
commerce-storefront/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                    # Descriptor (minimal — page:inject for cart JS)
    ├── sandbox-entry.ts            # definePlugin (page:fragments hook for cart script)
    ├── components/
    │   ├── ProductList.astro
    │   ├── ProductDetail.astro
    │   ├── CartDrawer.astro
    │   ├── CartPage.astro
    │   ├── Checkout.astro
    │   ├── OrderConfirmation.astro
    │   ├── CustomerAccount.astro
    │   └── CategoryNav.astro
    └── styles/
        └── commerce.css            # Default theme using CSS custom properties
```

### Tests

```
packages/core/tests/unit/plugins/commerce/
├── products.test.ts
├── categories.test.ts
├── variants.test.ts
├── cart.test.ts
├── coupons.test.ts
├── customers.test.ts
├── checkout.test.ts
├── orders.test.ts
└── providers.test.ts

packages/core/tests/integration/plugins/commerce/
├── checkout-flow.test.ts
├── admin-routes.test.ts
└── provider-contracts.test.ts
```

---

## Task 1: Scaffold Commerce Core Plugin Package

**Files:**
- Create: `packages/plugins/commerce/package.json`
- Create: `packages/plugins/commerce/tsconfig.json`
- Create: `packages/plugins/commerce/src/types.ts`
- Create: `packages/plugins/commerce/src/storage.ts`
- Create: `packages/plugins/commerce/src/index.ts`
- Create: `packages/plugins/commerce/src/sandbox-entry.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@emdash-cms/plugin-commerce",
  "version": "0.1.0",
  "description": "E-commerce plugin for EmDash CMS — products, cart, checkout, orders",
  "type": "module",
  "main": "src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./sandbox": "./src/sandbox-entry.ts"
  },
  "files": ["src"],
  "keywords": ["emdash", "cms", "plugin", "ecommerce", "shop", "cart", "checkout"],
  "author": "EmDash CMS",
  "license": "MIT",
  "dependencies": {},
  "peerDependencies": {
    "emdash": "workspace:*"
  },
  "scripts": {
    "typecheck": "tsgo --noEmit"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/emdash-cms/emdash.git",
    "directory": "packages/plugins/commerce"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create src/types.ts — all shared types**

```typescript
// Product types
export type ProductStatus = "draft" | "active" | "archived";
export type ProductType = "physical" | "digital" | "subscription";

export interface Product {
	id: string;
	slug: string;
	status: ProductStatus;
	name: string;
	description: string;
	shortDescription: string;
	productType: ProductType;
	sku: string;
	barcode: string;
	basePrice: number;
	compareAtPrice: number | null;
	currency: string;
	trackInventory: boolean;
	inventoryQuantity: number;
	lowStockThreshold: number;
	weight: number | null;
	weightUnit: string;
	dimensionsLength: number | null;
	dimensionsWidth: number | null;
	dimensionsHeight: number | null;
	dimensionUnit: string;
	taxClass: string;
	isFeatured: boolean;
	sortOrder: number;
	images: MediaReference[];
	metadata: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
}

export interface MediaReference {
	id: string;
	url: string;
	alt: string;
}

// Variant types
export interface Variant {
	id: string;
	productId: string;
	name: string;
	sku: string;
	barcode: string;
	price: number | null;
	compareAtPrice: number | null;
	inventoryQuantity: number;
	trackInventory: boolean;
	weight: number | null;
	dimensionsLength: number | null;
	dimensionsWidth: number | null;
	dimensionsHeight: number | null;
	optionValues: Record<string, string>;
	sortOrder: number;
	status: ProductStatus;
	createdAt: string;
	updatedAt: string;
}

// Category types
export interface Category {
	id: string;
	slug: string;
	name: string;
	description: string;
	image: MediaReference | null;
	parentId: string | null;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

// Cart types
export interface Cart {
	id: string;
	sessionId: string | null;
	customerId: string | null;
	currency: string;
	subtotal: number;
	discountTotal: number;
	shippingTotal: number;
	taxTotal: number;
	total: number;
	shippingAddress: Address | null;
	billingAddress: Address | null;
	shippingMethodId: string | null;
	couponCodes: string[];
	expiresAt: string;
	createdAt: string;
	updatedAt: string;
}

export interface CartItem {
	id: string;
	cartId: string;
	productId: string;
	variantId: string | null;
	quantity: number;
	unitPrice: number;
	totalPrice: number;
	metadata: Record<string, unknown>;
}

export interface Address {
	name: string;
	line1: string;
	line2: string;
	city: string;
	state: string;
	postalCode: string;
	country: string;
	phone: string;
}

// Order types
export type OrderStatus =
	| "pending"
	| "paid"
	| "processing"
	| "shipped"
	| "delivered"
	| "completed"
	| "cancelled"
	| "refunded";
export type PaymentStatus = "unpaid" | "paid" | "partially_refunded" | "refunded";
export type FulfillmentStatus = "unfulfilled" | "partially_fulfilled" | "fulfilled";

export interface Order {
	id: string;
	orderNumber: string;
	customerId: string | null;
	customerEmail: string;
	customerName: string;
	status: OrderStatus;
	paymentStatus: PaymentStatus;
	fulfillmentStatus: FulfillmentStatus;
	subtotal: number;
	discountTotal: number;
	shippingTotal: number;
	taxTotal: number;
	total: number;
	currency: string;
	shippingAddress: Address | null;
	billingAddress: Address | null;
	shippingMethod: string | null;
	trackingNumber: string | null;
	trackingUrl: string | null;
	paymentProvider: string | null;
	paymentIntentId: string | null;
	notes: string;
	customerNotes: string;
	metadata: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
}

export interface OrderItem {
	id: string;
	orderId: string;
	productId: string;
	variantId: string | null;
	productName: string;
	variantName: string;
	sku: string;
	quantity: number;
	unitPrice: number;
	totalPrice: number;
	fulfillmentStatus: FulfillmentStatus;
	metadata: Record<string, unknown>;
}

// Transaction types
export type TransactionType = "charge" | "refund" | "partial_refund";
export type TransactionStatus = "pending" | "succeeded" | "failed";

export interface Transaction {
	id: string;
	orderId: string;
	type: TransactionType;
	amount: number;
	currency: string;
	provider: string;
	providerTransactionId: string;
	status: TransactionStatus;
	metadata: Record<string, unknown>;
	createdAt: string;
}

// Customer types
export interface Customer {
	id: string;
	userId: string | null;
	email: string;
	name: string;
	phone: string;
	defaultShippingAddress: Address | null;
	defaultBillingAddress: Address | null;
	totalOrders: number;
	totalSpent: number;
	tags: string[];
	acceptsMarketing: boolean;
	createdAt: string;
	updatedAt: string;
}

// Coupon types
export type CouponType = "percentage" | "fixed_amount" | "free_shipping";
export type CouponAppliesTo = "all" | "specific_products" | "specific_categories";

export interface Coupon {
	id: string;
	code: string;
	description: string;
	type: CouponType;
	value: number;
	currency: string;
	minimumOrderAmount: number | null;
	maximumDiscountAmount: number | null;
	usageLimit: number | null;
	usageCount: number;
	perCustomerLimit: number | null;
	appliesTo: CouponAppliesTo;
	productIds: string[];
	categoryIds: string[];
	startsAt: string | null;
	expiresAt: string | null;
	status: ProductStatus;
	createdAt: string;
	updatedAt: string;
}

// Provider interfaces
export interface ShippingRate {
	id: string;
	name: string;
	description: string;
	price: number;
	currency: string;
	estimatedDays: number | null;
}

export interface ShippingRatesResult {
	rates: ShippingRate[];
}

export interface TaxLineItem {
	itemId: string;
	taxAmount: number;
	taxRate: number;
	taxName: string;
}

export interface TaxResult {
	lineItems: TaxLineItem[];
	totalTax: number;
}

export interface PaymentCreateResult {
	redirectUrl?: string;
	clientSecret?: string;
	providerOrderId: string;
}

export interface PaymentCaptureResult {
	transactionId: string;
	status: TransactionStatus;
}

export interface PaymentRefundResult {
	refundId: string;
	status: TransactionStatus;
}

export interface PaymentWebhookResult {
	event: string;
	orderId: string;
	status: TransactionStatus;
}
```

- [ ] **Step 4: Create src/storage.ts — storage configuration**

```typescript
import type { PluginStorageConfig } from "emdash";

export type CommerceStorage = PluginStorageConfig & {
	products: {
		indexes: ["slug", "status", "productType", "isFeatured", "createdAt"];
		uniqueIndexes: ["slug"];
	};
	variants: {
		indexes: ["productId", "sku", "status", ["productId", "sortOrder"]];
	};
	categories: {
		indexes: ["slug", "parentId", "sortOrder"];
		uniqueIndexes: ["slug"];
	};
	productCategories: {
		indexes: ["productId", "categoryId", ["productId", "categoryId"]];
	};
	carts: {
		indexes: ["sessionId", "customerId", "expiresAt", "createdAt"];
	};
	cartItems: {
		indexes: ["cartId", ["cartId", "productId"]];
	};
	orders: {
		indexes: [
			"orderNumber",
			"customerId",
			"status",
			"paymentStatus",
			"fulfillmentStatus",
			"createdAt",
			["customerId", "createdAt"],
		];
		uniqueIndexes: ["orderNumber"];
	};
	orderItems: {
		indexes: ["orderId", ["orderId", "fulfillmentStatus"]];
	};
	transactions: {
		indexes: ["orderId", "provider", "providerTransactionId", "createdAt"];
		uniqueIndexes: ["providerTransactionId"];
	};
	customers: {
		indexes: ["email", "userId", "createdAt"];
		uniqueIndexes: ["email"];
	};
	coupons: {
		indexes: ["code", "status", "startsAt", "expiresAt"];
		uniqueIndexes: ["code"];
	};
	orderCounter: {
		indexes: [];
	};
};

export const COMMERCE_STORAGE_CONFIG = {
	products: {
		indexes: ["slug", "status", "productType", "isFeatured", "createdAt"] as const,
		uniqueIndexes: ["slug"] as const,
	},
	variants: {
		indexes: ["productId", "sku", "status", ["productId", "sortOrder"]] as const,
	},
	categories: {
		indexes: ["slug", "parentId", "sortOrder"] as const,
		uniqueIndexes: ["slug"] as const,
	},
	productCategories: {
		indexes: ["productId", "categoryId", ["productId", "categoryId"]] as const,
	},
	carts: {
		indexes: ["sessionId", "customerId", "expiresAt", "createdAt"] as const,
	},
	cartItems: {
		indexes: ["cartId", ["cartId", "productId"]] as const,
	},
	orders: {
		indexes: [
			"orderNumber",
			"customerId",
			"status",
			"paymentStatus",
			"fulfillmentStatus",
			"createdAt",
			["customerId", "createdAt"],
		] as const,
		uniqueIndexes: ["orderNumber"] as const,
	},
	orderItems: {
		indexes: ["orderId", ["orderId", "fulfillmentStatus"]] as const,
	},
	transactions: {
		indexes: ["orderId", "provider", "providerTransactionId", "createdAt"] as const,
		uniqueIndexes: ["providerTransactionId"] as const,
	},
	customers: {
		indexes: ["email", "userId", "createdAt"] as const,
		uniqueIndexes: ["email"] as const,
	},
	coupons: {
		indexes: ["code", "status", "startsAt", "expiresAt"] as const,
		uniqueIndexes: ["code"] as const,
	},
	orderCounter: {
		indexes: [] as const,
	},
} satisfies PluginStorageConfig;
```

- [ ] **Step 5: Create src/index.ts — plugin descriptor**

```typescript
import type { PluginDescriptor } from "emdash";
import { COMMERCE_STORAGE_CONFIG } from "./storage.js";

export type { Product, Variant, Category, Cart, CartItem, Order, OrderItem, Transaction, Customer, Coupon, Address, ShippingRate, TaxResult, PaymentCreateResult } from "./types.js";

export function commercePlugin(): PluginDescriptor {
	return {
		id: "commerce",
		version: "0.1.0",
		format: "standard",
		entrypoint: "@emdash-cms/plugin-commerce/sandbox",
		capabilities: ["read:content", "write:content", "email:send"],
		storage: COMMERCE_STORAGE_CONFIG,
		adminPages: [
			{ path: "/", label: "Dashboard", icon: "dashboard" },
			{ path: "/products", label: "Products", icon: "box" },
			{ path: "/categories", label: "Categories", icon: "folder" },
			{ path: "/orders", label: "Orders", icon: "receipt" },
			{ path: "/customers", label: "Customers", icon: "users" },
			{ path: "/coupons", label: "Coupons", icon: "tag" },
			{ path: "/settings", label: "Settings", icon: "settings" },
		],
		adminWidgets: [
			{ id: "revenue", title: "Revenue", size: "half" },
			{ id: "recent-orders", title: "Recent Orders", size: "half" },
		],
	};
}
```

- [ ] **Step 6: Create src/sandbox-entry.ts — minimal skeleton**

```typescript
import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";

export default definePlugin({
	hooks: {
		"plugin:install": async (_event: unknown, ctx: PluginContext) => {
			ctx.log.info("Commerce plugin installed");
			// Initialize order counter
			await ctx.storage.orderCounter!.put("current", { value: 1000 });
		},

		"plugin:activate": async (_event: unknown, ctx: PluginContext) => {
			ctx.log.info("Commerce plugin activated");
		},
	},

	routes: {},
});
```

- [ ] **Step 7: Install dependencies and verify typecheck**

Run: `cd /Users/sumitkumartiwari/Documents/emdash_R_D/emdash && pnpm install`
Run: `cd packages/plugins/commerce && pnpm typecheck`
Expected: clean compilation

- [ ] **Step 8: Commit**

```bash
git add packages/plugins/commerce/
git commit -m "feat(commerce): scaffold core plugin package with types and storage config"
```

---

## Task 2: Validation Schemas

**Files:**
- Create: `packages/plugins/commerce/src/validation.ts`

- [ ] **Step 1: Create Zod validation schemas for all inputs**

```typescript
import { z } from "zod";

// Shared schemas
const addressSchema = z.object({
	name: z.string().min(1).max(200),
	line1: z.string().min(1).max(500),
	line2: z.string().max(500).default(""),
	city: z.string().min(1).max(200),
	state: z.string().max(200).default(""),
	postalCode: z.string().max(20).default(""),
	country: z.string().min(2).max(2),
	phone: z.string().max(30).default(""),
});

const slugSchema = z
	.string()
	.min(1)
	.max(200)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const priceSchema = z.number().nonnegative().multipleOf(0.01);
const quantitySchema = z.number().int().positive().max(9999);

// Product schemas
export const createProductSchema = z.object({
	name: z.string().min(1).max(500),
	slug: slugSchema,
	status: z.enum(["draft", "active", "archived"]).default("draft"),
	description: z.string().default(""),
	shortDescription: z.string().max(500).default(""),
	productType: z.enum(["physical", "digital", "subscription"]).default("physical"),
	sku: z.string().max(100).default(""),
	barcode: z.string().max(100).default(""),
	basePrice: priceSchema,
	compareAtPrice: priceSchema.nullable().default(null),
	currency: z.string().min(3).max(3).default("USD"),
	trackInventory: z.boolean().default(false),
	inventoryQuantity: z.number().int().nonnegative().default(0),
	lowStockThreshold: z.number().int().nonnegative().default(5),
	weight: z.number().nonnegative().nullable().default(null),
	weightUnit: z.string().max(10).default("kg"),
	dimensionsLength: z.number().nonnegative().nullable().default(null),
	dimensionsWidth: z.number().nonnegative().nullable().default(null),
	dimensionsHeight: z.number().nonnegative().nullable().default(null),
	dimensionUnit: z.string().max(10).default("cm"),
	taxClass: z.string().max(100).default("standard"),
	isFeatured: z.boolean().default(false),
	sortOrder: z.number().int().default(0),
	images: z
		.array(
			z.object({
				id: z.string(),
				url: z.string().url(),
				alt: z.string().default(""),
			}),
		)
		.default([]),
	metadata: z.record(z.unknown()).default({}),
});

export const updateProductSchema = createProductSchema.partial();

// Variant schemas
export const createVariantSchema = z.object({
	name: z.string().min(1).max(500),
	sku: z.string().max(100).default(""),
	barcode: z.string().max(100).default(""),
	price: priceSchema.nullable().default(null),
	compareAtPrice: priceSchema.nullable().default(null),
	inventoryQuantity: z.number().int().nonnegative().default(0),
	trackInventory: z.boolean().default(false),
	weight: z.number().nonnegative().nullable().default(null),
	dimensionsLength: z.number().nonnegative().nullable().default(null),
	dimensionsWidth: z.number().nonnegative().nullable().default(null),
	dimensionsHeight: z.number().nonnegative().nullable().default(null),
	optionValues: z.record(z.string()).default({}),
	sortOrder: z.number().int().default(0),
	status: z.enum(["draft", "active", "archived"]).default("active"),
});

export const updateVariantSchema = createVariantSchema.partial();

// Category schemas
export const createCategorySchema = z.object({
	name: z.string().min(1).max(500),
	slug: slugSchema,
	description: z.string().default(""),
	image: z
		.object({
			id: z.string(),
			url: z.string().url(),
			alt: z.string().default(""),
		})
		.nullable()
		.default(null),
	parentId: z.string().nullable().default(null),
	sortOrder: z.number().int().default(0),
});

export const updateCategorySchema = createCategorySchema.partial();

// Cart schemas
export const addCartItemSchema = z.object({
	productId: z.string().min(1),
	variantId: z.string().nullable().default(null),
	quantity: quantitySchema,
	metadata: z.record(z.unknown()).default({}),
});

export const updateCartItemSchema = z.object({
	quantity: quantitySchema,
});

export const applyCouponSchema = z.object({
	code: z
		.string()
		.min(4)
		.max(32)
		.regex(/^[A-Z0-9-]+$/),
});

export const setShippingAddressSchema = z.object({
	address: addressSchema,
});

export const setShippingMethodSchema = z.object({
	shippingMethodId: z.string().min(1),
});

// Checkout schemas
export const checkoutSchema = z.object({
	email: z.string().email(),
	name: z.string().min(1).max(200),
	shippingAddress: addressSchema.optional(),
	billingAddress: addressSchema.optional(),
	paymentProvider: z.string().min(1),
	customerNotes: z.string().max(2000).default(""),
});

// Customer schemas
export const createCustomerSchema = z.object({
	email: z.string().email(),
	name: z.string().min(1).max(200),
	phone: z.string().max(30).default(""),
	defaultShippingAddress: addressSchema.nullable().default(null),
	defaultBillingAddress: addressSchema.nullable().default(null),
	tags: z.array(z.string()).default([]),
	acceptsMarketing: z.boolean().default(false),
});

export const updateCustomerSchema = createCustomerSchema.partial();

// Coupon schemas
export const createCouponSchema = z.object({
	code: z
		.string()
		.min(4)
		.max(32)
		.regex(/^[A-Z0-9-]+$/),
	description: z.string().max(500).default(""),
	type: z.enum(["percentage", "fixed_amount", "free_shipping"]),
	value: z.number().positive(),
	currency: z.string().min(3).max(3).default("USD"),
	minimumOrderAmount: priceSchema.nullable().default(null),
	maximumDiscountAmount: priceSchema.nullable().default(null),
	usageLimit: z.number().int().positive().nullable().default(null),
	perCustomerLimit: z.number().int().positive().nullable().default(null),
	appliesTo: z.enum(["all", "specific_products", "specific_categories"]).default("all"),
	productIds: z.array(z.string()).default([]),
	categoryIds: z.array(z.string()).default([]),
	startsAt: z.string().datetime().nullable().default(null),
	expiresAt: z.string().datetime().nullable().default(null),
});

export const updateCouponSchema = createCouponSchema.partial();

// Order admin schemas
export const updateOrderStatusSchema = z.object({
	status: z.enum([
		"pending",
		"paid",
		"processing",
		"shipped",
		"delivered",
		"completed",
		"cancelled",
		"refunded",
	]),
});

export const fulfillOrderSchema = z.object({
	trackingNumber: z.string().max(200).optional(),
	trackingUrl: z.string().url().optional(),
	itemIds: z.array(z.string()).optional(),
});

export const refundOrderSchema = z.object({
	amount: priceSchema.optional(),
	reason: z.string().max(500).default(""),
});

export const addOrderNoteSchema = z.object({
	note: z.string().min(1).max(2000),
});

// Query schemas
export const paginationSchema = z.object({
	cursor: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const productQuerySchema = paginationSchema.extend({
	status: z.enum(["draft", "active", "archived"]).optional(),
	productType: z.enum(["physical", "digital", "subscription"]).optional(),
	category: z.string().optional(),
	featured: z.coerce.boolean().optional(),
	search: z.string().optional(),
});

export const orderQuerySchema = paginationSchema.extend({
	status: z.enum(["pending", "paid", "processing", "shipped", "delivered", "completed", "cancelled", "refunded"]).optional(),
	paymentStatus: z.enum(["unpaid", "paid", "partially_refunded", "refunded"]).optional(),
	fulfillmentStatus: z.enum(["unfulfilled", "partially_fulfilled", "fulfilled"]).optional(),
	customerId: z.string().optional(),
	search: z.string().optional(),
});

export const customerQuerySchema = paginationSchema.extend({
	search: z.string().optional(),
});

export const couponQuerySchema = paginationSchema.extend({
	status: z.enum(["draft", "active", "archived"]).optional(),
});
```

- [ ] **Step 2: Verify typecheck**

Run: `cd packages/plugins/commerce && pnpm typecheck`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add packages/plugins/commerce/src/validation.ts
git commit -m "feat(commerce): add Zod validation schemas for all inputs"
```

---

## Task 3: Product CRUD Operations

**Files:**
- Create: `packages/plugins/commerce/src/products.ts`
- Test: `packages/core/tests/unit/plugins/commerce/products.test.ts`

- [ ] **Step 1: Write failing tests for product CRUD**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
	createProduct,
	getProduct,
	getProductBySlug,
	listProducts,
	updateProduct,
	deleteProduct,
} from "../../../../packages/plugins/commerce/src/products.js";

// Mock storage collection
function createMockStorage() {
	const store = new Map<string, unknown>();
	return {
		get: async (id: string) => store.get(id) ?? null,
		put: async (id: string, data: unknown) => { store.set(id, data); },
		delete: async (id: string) => store.delete(id),
		exists: async (id: string) => store.has(id),
		query: async (opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; limit?: number; cursor?: string }) => {
			let items = Array.from(store.entries()).map(([id, data]) => ({ id, data }));
			if (opts?.where) {
				for (const [key, value] of Object.entries(opts.where)) {
					items = items.filter((item) => (item.data as Record<string, unknown>)[key] === value);
				}
			}
			if (opts?.orderBy) {
				const [field, dir] = Object.entries(opts.orderBy)[0]!;
				items.sort((a, b) => {
					const av = (a.data as Record<string, unknown>)[field] as string;
					const bv = (b.data as Record<string, unknown>)[field] as string;
					return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
				});
			}
			const limit = opts?.limit ?? 50;
			return { items: items.slice(0, limit), hasMore: items.length > limit };
		},
		count: async (where?: Record<string, unknown>) => {
			if (!where) return store.size;
			let count = 0;
			for (const data of store.values()) {
				let match = true;
				for (const [key, value] of Object.entries(where)) {
					if ((data as Record<string, unknown>)[key] !== value) { match = false; break; }
				}
				if (match) count++;
			}
			return count;
		},
	};
}

describe("Product CRUD", () => {
	let storage: ReturnType<typeof createMockStorage>;

	beforeEach(() => {
		storage = createMockStorage();
	});

	it("creates a product and returns it with generated id", async () => {
		const product = await createProduct(storage, {
			name: "Test Product",
			slug: "test-product",
			basePrice: 29.99,
		});

		expect(product.id).toBeDefined();
		expect(product.name).toBe("Test Product");
		expect(product.slug).toBe("test-product");
		expect(product.basePrice).toBe(29.99);
		expect(product.status).toBe("draft");
		expect(product.productType).toBe("physical");
	});

	it("retrieves a product by id", async () => {
		const created = await createProduct(storage, {
			name: "Test Product",
			slug: "test-product",
			basePrice: 29.99,
		});

		const retrieved = await getProduct(storage, created.id);
		expect(retrieved).toEqual(created);
	});

	it("retrieves a product by slug", async () => {
		const created = await createProduct(storage, {
			name: "Test Product",
			slug: "test-product",
			basePrice: 29.99,
		});

		const retrieved = await getProductBySlug(storage, "test-product");
		expect(retrieved).toEqual(created);
	});

	it("returns null for nonexistent product", async () => {
		const result = await getProduct(storage, "nonexistent");
		expect(result).toBeNull();
	});

	it("lists products with pagination", async () => {
		await createProduct(storage, { name: "Product A", slug: "product-a", basePrice: 10 });
		await createProduct(storage, { name: "Product B", slug: "product-b", basePrice: 20 });

		const result = await listProducts(storage, { limit: 50 });
		expect(result.items).toHaveLength(2);
	});

	it("lists products filtered by status", async () => {
		await createProduct(storage, { name: "Active", slug: "active", basePrice: 10, status: "active" });
		await createProduct(storage, { name: "Draft", slug: "draft", basePrice: 20, status: "draft" });

		const result = await listProducts(storage, { status: "active", limit: 50 });
		expect(result.items).toHaveLength(1);
		expect(result.items[0]!.name).toBe("Active");
	});

	it("updates a product", async () => {
		const created = await createProduct(storage, {
			name: "Original",
			slug: "original",
			basePrice: 10,
		});

		const updated = await updateProduct(storage, created.id, { name: "Updated", basePrice: 15 });
		expect(updated!.name).toBe("Updated");
		expect(updated!.basePrice).toBe(15);
		expect(updated!.slug).toBe("original");
	});

	it("returns null when updating nonexistent product", async () => {
		const result = await updateProduct(storage, "nonexistent", { name: "Nope" });
		expect(result).toBeNull();
	});

	it("deletes a product (archives it)", async () => {
		const created = await createProduct(storage, {
			name: "To Delete",
			slug: "to-delete",
			basePrice: 10,
		});

		const deleted = await deleteProduct(storage, created.id);
		expect(deleted).toBe(true);

		const retrieved = await getProduct(storage, created.id);
		expect(retrieved!.status).toBe("archived");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter emdash test -- tests/unit/plugins/commerce/products.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement products.ts**

```typescript
import type { Product } from "./types.js";
import { createProductSchema, updateProductSchema } from "./validation.js";

type StorageCollection = {
	get(id: string): Promise<Product | null>;
	put(id: string, data: Product): Promise<void>;
	delete(id: string): Promise<boolean>;
	exists(id: string): Promise<boolean>;
	query(opts?: {
		where?: Record<string, unknown>;
		orderBy?: Record<string, string>;
		limit?: number;
		cursor?: string;
	}): Promise<{ items: Array<{ id: string; data: Product }>; hasMore: boolean; cursor?: string }>;
	count(where?: Record<string, unknown>): Promise<number>;
};

function generateId(): string {
	return crypto.randomUUID();
}

export async function createProduct(
	storage: StorageCollection,
	input: Record<string, unknown>,
): Promise<Product> {
	const validated = createProductSchema.parse(input);
	const now = new Date().toISOString();
	const id = generateId();

	const product: Product = {
		id,
		slug: validated.slug,
		status: validated.status,
		name: validated.name,
		description: validated.description,
		shortDescription: validated.shortDescription,
		productType: validated.productType,
		sku: validated.sku,
		barcode: validated.barcode,
		basePrice: validated.basePrice,
		compareAtPrice: validated.compareAtPrice,
		currency: validated.currency,
		trackInventory: validated.trackInventory,
		inventoryQuantity: validated.inventoryQuantity,
		lowStockThreshold: validated.lowStockThreshold,
		weight: validated.weight,
		weightUnit: validated.weightUnit,
		dimensionsLength: validated.dimensionsLength,
		dimensionsWidth: validated.dimensionsWidth,
		dimensionsHeight: validated.dimensionsHeight,
		dimensionUnit: validated.dimensionUnit,
		taxClass: validated.taxClass,
		isFeatured: validated.isFeatured,
		sortOrder: validated.sortOrder,
		images: validated.images,
		metadata: validated.metadata,
		createdAt: now,
		updatedAt: now,
	};

	await storage.put(id, product);
	return product;
}

export async function getProduct(
	storage: StorageCollection,
	id: string,
): Promise<Product | null> {
	return storage.get(id);
}

export async function getProductBySlug(
	storage: StorageCollection,
	slug: string,
): Promise<Product | null> {
	const result = await storage.query({ where: { slug }, limit: 1 });
	return result.items[0]?.data ?? null;
}

export async function listProducts(
	storage: StorageCollection,
	opts: {
		status?: string;
		productType?: string;
		featured?: boolean;
		limit?: number;
		cursor?: string;
	},
): Promise<{ items: Product[]; hasMore: boolean; cursor?: string }> {
	const where: Record<string, unknown> = {};
	if (opts.status) where.status = opts.status;
	if (opts.productType) where.productType = opts.productType;
	if (opts.featured !== undefined) where.isFeatured = opts.featured;

	const result = await storage.query({
		where: Object.keys(where).length > 0 ? where : undefined,
		orderBy: { createdAt: "desc" },
		limit: Math.min(opts.limit ?? 50, 100),
		cursor: opts.cursor,
	});

	return {
		items: result.items.map((item) => item.data),
		hasMore: result.hasMore,
		cursor: result.cursor,
	};
}

export async function updateProduct(
	storage: StorageCollection,
	id: string,
	input: Record<string, unknown>,
): Promise<Product | null> {
	const existing = await storage.get(id);
	if (!existing) return null;

	const validated = updateProductSchema.parse(input);
	const updated: Product = {
		...existing,
		...validated,
		id,
		updatedAt: new Date().toISOString(),
	};

	await storage.put(id, updated);
	return updated;
}

export async function deleteProduct(
	storage: StorageCollection,
	id: string,
): Promise<boolean> {
	const existing = await storage.get(id);
	if (!existing) return false;

	const archived: Product = {
		...existing,
		status: "archived",
		updatedAt: new Date().toISOString(),
	};

	await storage.put(id, archived);
	return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter emdash test -- tests/unit/plugins/commerce/products.test.ts`
Expected: all 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/plugins/commerce/src/products.ts packages/core/tests/unit/plugins/commerce/products.test.ts
git commit -m "feat(commerce): add product CRUD with tests"
```

---

## Task 4: Category and Variant CRUD

**Files:**
- Create: `packages/plugins/commerce/src/categories.ts`
- Create: `packages/plugins/commerce/src/variants.ts`
- Test: `packages/core/tests/unit/plugins/commerce/categories.test.ts`
- Test: `packages/core/tests/unit/plugins/commerce/variants.test.ts`

These follow the exact same pattern as products.ts. Key differences:

**categories.ts:**
- `createCategory`, `getCategory`, `getCategoryBySlug`, `listCategories`, `updateCategory`, `deleteCategory`
- `getCategoryTree` — returns nested structure by querying all categories and building parent-child tree in memory
- Delete checks for child categories and reassigns them to parent (or root) before deleting

**variants.ts:**
- `createVariant`, `getVariant`, `listVariantsByProduct`, `updateVariant`, `deleteVariant`
- `generateVariantCombinations(productId, optionTypes)` — takes `{Size: ["S","M","L"], Color: ["Red","Blue"]}` and creates all 6 combinations
- All queries scoped to `productId` (via `where: { productId }`)

- [ ] **Step 1: Write failing tests for categories**

Test `createCategory`, `getCategoryBySlug`, `listCategories`, `getCategoryTree` (flat list → nested tree), `updateCategory`, `deleteCategory`.

The `getCategoryTree` test should create: Electronics (parent), Phones (child of Electronics), Laptops (child of Electronics), and verify the tree structure: `[{...Electronics, children: [{...Phones}, {...Laptops}]}]`.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `pnpm --filter emdash test -- tests/unit/plugins/commerce/categories.test.ts`

- [ ] **Step 3: Implement categories.ts**

Same CRUD pattern as products.ts. Additional function:

```typescript
export async function getCategoryTree(
	storage: StorageCollection,
): Promise<CategoryNode[]> {
	const result = await storage.query({ orderBy: { sortOrder: "asc" }, limit: 1000 });
	const categories = result.items.map((item) => item.data);

	const byId = new Map<string, CategoryNode>();
	for (const cat of categories) {
		byId.set(cat.id, { ...cat, children: [] });
	}

	const roots: CategoryNode[] = [];
	for (const node of byId.values()) {
		if (node.parentId && byId.has(node.parentId)) {
			byId.get(node.parentId)!.children.push(node);
		} else {
			roots.push(node);
		}
	}
	return roots;
}

export interface CategoryNode extends Category {
	children: CategoryNode[];
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Write failing tests for variants**

Test `createVariant`, `listVariantsByProduct`, `generateVariantCombinations`, `updateVariant`, `deleteVariant`.

The `generateVariantCombinations` test:
```typescript
it("generates all variant combinations from option types", async () => {
	const variants = await generateVariantCombinations(storage, "prod-1", {
		Size: ["S", "M"],
		Color: ["Red", "Blue"],
	});
	expect(variants).toHaveLength(4);
	expect(variants.map((v) => v.optionValues)).toContainEqual({ Size: "S", Color: "Red" });
	expect(variants.map((v) => v.optionValues)).toContainEqual({ Size: "M", Color: "Blue" });
});
```

- [ ] **Step 6: Run tests — expect FAIL**

- [ ] **Step 7: Implement variants.ts**

Same CRUD pattern. Additional function:

```typescript
export async function generateVariantCombinations(
	storage: StorageCollection,
	productId: string,
	optionTypes: Record<string, string[]>,
): Promise<Variant[]> {
	const keys = Object.keys(optionTypes);
	const valueSets = Object.values(optionTypes);

	function cartesian(arrays: string[][]): string[][] {
		return arrays.reduce<string[][]>(
			(acc, curr) => acc.flatMap((combo) => curr.map((val) => [...combo, val])),
			[[]],
		);
	}

	const combos = cartesian(valueSets);
	const variants: Variant[] = [];

	for (let i = 0; i < combos.length; i++) {
		const optionValues: Record<string, string> = {};
		for (let j = 0; j < keys.length; j++) {
			optionValues[keys[j]!] = combos[i]![j]!;
		}

		const name = Object.values(optionValues).join(" / ");
		const variant = await createVariant(storage, {
			name,
			productId,
			optionValues,
			sortOrder: i,
		});
		variants.push(variant);
	}

	return variants;
}
```

- [ ] **Step 8: Run tests — expect PASS**

- [ ] **Step 9: Commit**

```bash
git add packages/plugins/commerce/src/categories.ts packages/plugins/commerce/src/variants.ts \
  packages/core/tests/unit/plugins/commerce/categories.test.ts \
  packages/core/tests/unit/plugins/commerce/variants.test.ts
git commit -m "feat(commerce): add category and variant CRUD with tests"
```

---

## Task 5: Cart Logic

**Files:**
- Create: `packages/plugins/commerce/src/cart.ts`
- Test: `packages/core/tests/unit/plugins/commerce/cart.test.ts`

- [ ] **Step 1: Write failing tests for cart operations**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
	createCart,
	getCart,
	addCartItem,
	updateCartItemQuantity,
	removeCartItem,
	recalculateCart,
} from "../../../../packages/plugins/commerce/src/cart.js";

describe("Cart", () => {
	let cartStorage: ReturnType<typeof createMockStorage>;
	let cartItemStorage: ReturnType<typeof createMockStorage>;
	let productStorage: ReturnType<typeof createMockStorage>;
	let variantStorage: ReturnType<typeof createMockStorage>;

	beforeEach(() => {
		cartStorage = createMockStorage();
		cartItemStorage = createMockStorage();
		productStorage = createMockStorage();
		variantStorage = createMockStorage();
	});

	it("creates a cart with session id and 30-day expiry", async () => {
		const cart = await createCart(cartStorage, { sessionId: "sess-123" });

		expect(cart.id).toBeDefined();
		expect(cart.sessionId).toBe("sess-123");
		expect(cart.subtotal).toBe(0);
		expect(cart.total).toBe(0);
		const expiry = new Date(cart.expiresAt);
		const now = new Date();
		const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
		expect(diffDays).toBeGreaterThan(29);
		expect(diffDays).toBeLessThan(31);
	});

	it("adds an item to the cart", async () => {
		const cart = await createCart(cartStorage, { sessionId: "sess-123" });

		await productStorage.put("prod-1", {
			id: "prod-1",
			basePrice: 25.00,
			status: "active",
			trackInventory: true,
			inventoryQuantity: 10,
		});

		const item = await addCartItem(
			cartStorage,
			cartItemStorage,
			productStorage,
			variantStorage,
			cart.id,
			{ productId: "prod-1", quantity: 2 },
		);

		expect(item.productId).toBe("prod-1");
		expect(item.quantity).toBe(2);
		expect(item.unitPrice).toBe(25.00);
		expect(item.totalPrice).toBe(50.00);
	});

	it("rejects adding out-of-stock product", async () => {
		const cart = await createCart(cartStorage, { sessionId: "sess-123" });

		await productStorage.put("prod-1", {
			id: "prod-1",
			basePrice: 25.00,
			status: "active",
			trackInventory: true,
			inventoryQuantity: 0,
		});

		await expect(
			addCartItem(cartStorage, cartItemStorage, productStorage, variantStorage, cart.id, {
				productId: "prod-1",
				quantity: 1,
			}),
		).rejects.toThrow("INSUFFICIENT_STOCK");
	});

	it("increments quantity when adding existing product", async () => {
		const cart = await createCart(cartStorage, { sessionId: "sess-123" });

		await productStorage.put("prod-1", {
			id: "prod-1",
			basePrice: 10.00,
			status: "active",
			trackInventory: false,
		});

		await addCartItem(cartStorage, cartItemStorage, productStorage, variantStorage, cart.id, {
			productId: "prod-1",
			quantity: 1,
		});
		const item = await addCartItem(
			cartStorage,
			cartItemStorage,
			productStorage,
			variantStorage,
			cart.id,
			{ productId: "prod-1", quantity: 2 },
		);

		expect(item.quantity).toBe(3);
		expect(item.totalPrice).toBe(30.00);
	});

	it("recalculates cart totals", async () => {
		const cart = await createCart(cartStorage, { sessionId: "sess-123" });

		await productStorage.put("prod-1", { id: "prod-1", basePrice: 10.00, status: "active", trackInventory: false });
		await productStorage.put("prod-2", { id: "prod-2", basePrice: 20.00, status: "active", trackInventory: false });

		await addCartItem(cartStorage, cartItemStorage, productStorage, variantStorage, cart.id, {
			productId: "prod-1",
			quantity: 2,
		});
		await addCartItem(cartStorage, cartItemStorage, productStorage, variantStorage, cart.id, {
			productId: "prod-2",
			quantity: 1,
		});

		const updated = await recalculateCart(cartStorage, cartItemStorage, cart.id);
		expect(updated!.subtotal).toBe(40.00);
		expect(updated!.total).toBe(40.00);
	});

	it("removes an item from the cart", async () => {
		const cart = await createCart(cartStorage, { sessionId: "sess-123" });

		await productStorage.put("prod-1", { id: "prod-1", basePrice: 10.00, status: "active", trackInventory: false });

		const item = await addCartItem(
			cartStorage,
			cartItemStorage,
			productStorage,
			variantStorage,
			cart.id,
			{ productId: "prod-1", quantity: 1 },
		);

		const removed = await removeCartItem(cartItemStorage, item.id);
		expect(removed).toBe(true);
	});

	it("updates item quantity", async () => {
		const cart = await createCart(cartStorage, { sessionId: "sess-123" });

		await productStorage.put("prod-1", { id: "prod-1", basePrice: 10.00, status: "active", trackInventory: false });

		const item = await addCartItem(
			cartStorage,
			cartItemStorage,
			productStorage,
			variantStorage,
			cart.id,
			{ productId: "prod-1", quantity: 1 },
		);

		const updated = await updateCartItemQuantity(cartItemStorage, item.id, 5);
		expect(updated!.quantity).toBe(5);
		expect(updated!.totalPrice).toBe(50.00);
	});
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `pnpm --filter emdash test -- tests/unit/plugins/commerce/cart.test.ts`

- [ ] **Step 3: Implement cart.ts**

```typescript
import type { Cart, CartItem } from "./types.js";

type StorageCollection<T = unknown> = {
	get(id: string): Promise<T | null>;
	put(id: string, data: T): Promise<void>;
	delete(id: string): Promise<boolean>;
	query(opts?: {
		where?: Record<string, unknown>;
		orderBy?: Record<string, string>;
		limit?: number;
	}): Promise<{ items: Array<{ id: string; data: T }>; hasMore: boolean }>;
};

function generateId(): string {
	return crypto.randomUUID();
}

export class CommerceError extends Error {
	constructor(
		public code: string,
		message: string,
	) {
		super(message);
		this.name = "CommerceError";
	}
}

export async function createCart(
	cartStorage: StorageCollection<Cart>,
	opts: { sessionId?: string; customerId?: string },
): Promise<Cart> {
	const now = new Date();
	const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
	const id = generateId();

	const cart: Cart = {
		id,
		sessionId: opts.sessionId ?? null,
		customerId: opts.customerId ?? null,
		currency: "USD",
		subtotal: 0,
		discountTotal: 0,
		shippingTotal: 0,
		taxTotal: 0,
		total: 0,
		shippingAddress: null,
		billingAddress: null,
		shippingMethodId: null,
		couponCodes: [],
		expiresAt: expiresAt.toISOString(),
		createdAt: now.toISOString(),
		updatedAt: now.toISOString(),
	};

	await cartStorage.put(id, cart);
	return cart;
}

export async function getCart(
	cartStorage: StorageCollection<Cart>,
	id: string,
): Promise<Cart | null> {
	const cart = await cartStorage.get(id);
	if (!cart) return null;

	if (new Date(cart.expiresAt) < new Date()) {
		return null;
	}
	return cart;
}

export async function addCartItem(
	cartStorage: StorageCollection<Cart>,
	cartItemStorage: StorageCollection<CartItem>,
	productStorage: StorageCollection<Record<string, unknown>>,
	variantStorage: StorageCollection<Record<string, unknown>>,
	cartId: string,
	input: { productId: string; variantId?: string | null; quantity: number; metadata?: Record<string, unknown> },
): Promise<CartItem> {
	const cart = await cartStorage.get(cartId);
	if (!cart) throw new CommerceError("CART_NOT_FOUND", "Cart not found");

	const product = await productStorage.get(input.productId);
	if (!product) throw new CommerceError("PRODUCT_NOT_FOUND", "Product not found");
	if (product.status !== "active") throw new CommerceError("PRODUCT_UNAVAILABLE", "Product is not available");

	let unitPrice = product.basePrice as number;

	if (input.variantId) {
		const variant = await variantStorage.get(input.variantId);
		if (!variant) throw new CommerceError("VARIANT_NOT_FOUND", "Variant not found");
		if (variant.price !== null && variant.price !== undefined) {
			unitPrice = variant.price as number;
		}
	}

	// Check inventory
	if (product.trackInventory) {
		const available = (product.inventoryQuantity as number) ?? 0;
		if (available < input.quantity) {
			throw new CommerceError("INSUFFICIENT_STOCK", `Only ${available} available`);
		}
	}

	// Check if item already exists in cart (same product + variant)
	const existingItems = await cartItemStorage.query({
		where: { cartId },
		limit: 1000,
	});

	const existing = existingItems.items.find(
		(item) =>
			item.data.productId === input.productId &&
			item.data.variantId === (input.variantId ?? null),
	);

	if (existing) {
		const newQuantity = existing.data.quantity + input.quantity;
		const updated: CartItem = {
			...existing.data,
			quantity: newQuantity,
			totalPrice: Math.round(unitPrice * newQuantity * 100) / 100,
			unitPrice,
		};
		await cartItemStorage.put(existing.id, updated);
		return updated;
	}

	const id = generateId();
	const item: CartItem = {
		id,
		cartId,
		productId: input.productId,
		variantId: input.variantId ?? null,
		quantity: input.quantity,
		unitPrice,
		totalPrice: Math.round(unitPrice * input.quantity * 100) / 100,
		metadata: input.metadata ?? {},
	};

	await cartItemStorage.put(id, item);
	return item;
}

export async function updateCartItemQuantity(
	cartItemStorage: StorageCollection<CartItem>,
	itemId: string,
	quantity: number,
): Promise<CartItem | null> {
	const item = await cartItemStorage.get(itemId);
	if (!item) return null;

	const updated: CartItem = {
		...item,
		quantity,
		totalPrice: Math.round(item.unitPrice * quantity * 100) / 100,
	};

	await cartItemStorage.put(itemId, updated);
	return updated;
}

export async function removeCartItem(
	cartItemStorage: StorageCollection<CartItem>,
	itemId: string,
): Promise<boolean> {
	return cartItemStorage.delete(itemId);
}

export async function getCartItems(
	cartItemStorage: StorageCollection<CartItem>,
	cartId: string,
): Promise<CartItem[]> {
	const result = await cartItemStorage.query({ where: { cartId }, limit: 1000 });
	return result.items.map((item) => item.data);
}

export async function recalculateCart(
	cartStorage: StorageCollection<Cart>,
	cartItemStorage: StorageCollection<CartItem>,
	cartId: string,
): Promise<Cart | null> {
	const cart = await cartStorage.get(cartId);
	if (!cart) return null;

	const items = await getCartItems(cartItemStorage, cartId);

	const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
	const total = Math.round(
		(subtotal - cart.discountTotal + cart.shippingTotal + cart.taxTotal) * 100,
	) / 100;

	const updated: Cart = {
		...cart,
		subtotal: Math.round(subtotal * 100) / 100,
		total: Math.max(0, total),
		updatedAt: new Date().toISOString(),
	};

	await cartStorage.put(cartId, updated);
	return updated;
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `pnpm --filter emdash test -- tests/unit/plugins/commerce/cart.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/plugins/commerce/src/cart.ts packages/core/tests/unit/plugins/commerce/cart.test.ts
git commit -m "feat(commerce): add cart logic with inventory checks and recalculation"
```

---

## Task 6: Coupon Engine

**Files:**
- Create: `packages/plugins/commerce/src/coupons.ts`
- Test: `packages/core/tests/unit/plugins/commerce/coupons.test.ts`

- [ ] **Step 1: Write failing tests for coupon validation and application**

Key test cases:
- Valid percentage coupon applies correctly
- Valid fixed_amount coupon applies correctly
- free_shipping coupon sets discount to shipping amount
- Expired coupon rejected
- Not-yet-started coupon rejected
- Usage limit exceeded rejected
- Minimum order amount not met rejected
- Coupon scoped to specific products only applies to matching items
- Maximum discount amount caps the discount

```typescript
describe("Coupon Engine", () => {
	it("applies percentage discount", async () => {
		const coupon = makeCoupon({ type: "percentage", value: 10 });
		const cart = makeCart({ subtotal: 100 });
		const items = [makeCartItem({ totalPrice: 100 })];

		const discount = calculateDiscount(coupon, cart, items, []);
		expect(discount).toBe(10.00);
	});

	it("caps discount at maximumDiscountAmount", async () => {
		const coupon = makeCoupon({ type: "percentage", value: 50, maximumDiscountAmount: 20 });
		const cart = makeCart({ subtotal: 100 });
		const items = [makeCartItem({ totalPrice: 100 })];

		const discount = calculateDiscount(coupon, cart, items, []);
		expect(discount).toBe(20.00);
	});

	it("rejects expired coupon", () => {
		const coupon = makeCoupon({ expiresAt: "2020-01-01T00:00:00Z" });
		const result = validateCoupon(coupon, makeCart({ subtotal: 100 }), []);
		expect(result).toBe("COUPON_EXPIRED");
	});

	it("rejects coupon below minimum order amount", () => {
		const coupon = makeCoupon({ minimumOrderAmount: 50 });
		const result = validateCoupon(coupon, makeCart({ subtotal: 30 }), []);
		expect(result).toBe("MINIMUM_NOT_MET");
	});

	it("rejects coupon over usage limit", () => {
		const coupon = makeCoupon({ usageLimit: 10, usageCount: 10 });
		const result = validateCoupon(coupon, makeCart({ subtotal: 100 }), []);
		expect(result).toBe("COUPON_LIMIT_REACHED");
	});
});
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement coupons.ts**

Two core functions:

```typescript
export function validateCoupon(
	coupon: Coupon,
	cart: Cart,
	cartItems: CartItem[],
): string | null {
	if (coupon.status !== "active") return "INVALID_COUPON";

	const now = new Date();
	if (coupon.expiresAt && new Date(coupon.expiresAt) < now) return "COUPON_EXPIRED";
	if (coupon.startsAt && new Date(coupon.startsAt) > now) return "INVALID_COUPON";
	if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) return "COUPON_LIMIT_REACHED";
	if (coupon.minimumOrderAmount !== null && cart.subtotal < coupon.minimumOrderAmount) return "MINIMUM_NOT_MET";

	if (coupon.appliesTo === "specific_products") {
		const hasMatch = cartItems.some((item) => coupon.productIds.includes(item.productId));
		if (!hasMatch) return "INVALID_COUPON";
	}

	return null;
}

export function calculateDiscount(
	coupon: Coupon,
	cart: Cart,
	cartItems: CartItem[],
	productCategoryMap: Array<{ productId: string; categoryIds: string[] }>,
): number {
	let applicableTotal = cart.subtotal;

	if (coupon.appliesTo === "specific_products") {
		applicableTotal = cartItems
			.filter((item) => coupon.productIds.includes(item.productId))
			.reduce((sum, item) => sum + item.totalPrice, 0);
	} else if (coupon.appliesTo === "specific_categories") {
		applicableTotal = cartItems
			.filter((item) => {
				const cats = productCategoryMap.find((m) => m.productId === item.productId);
				return cats?.categoryIds.some((cid) => coupon.categoryIds.includes(cid));
			})
			.reduce((sum, item) => sum + item.totalPrice, 0);
	}

	let discount = 0;
	switch (coupon.type) {
		case "percentage":
			discount = Math.round(applicableTotal * (coupon.value / 100) * 100) / 100;
			break;
		case "fixed_amount":
			discount = Math.min(coupon.value, applicableTotal);
			break;
		case "free_shipping":
			discount = cart.shippingTotal;
			break;
	}

	if (coupon.maximumDiscountAmount !== null) {
		discount = Math.min(discount, coupon.maximumDiscountAmount);
	}

	return Math.round(discount * 100) / 100;
}
```

Plus standard CRUD functions (`createCoupon`, `getCoupon`, `getCouponByCode`, `listCoupons`, `updateCoupon`, `incrementUsage`).

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/plugins/commerce/src/coupons.ts packages/core/tests/unit/plugins/commerce/coupons.test.ts
git commit -m "feat(commerce): add coupon validation and discount calculation"
```

---

## Task 7: Customer Management & Order Counter

**Files:**
- Create: `packages/plugins/commerce/src/customers.ts`
- Create: `packages/plugins/commerce/src/transactions.ts`

- [ ] **Step 1: Implement customers.ts**

Standard CRUD following products.ts pattern: `createCustomer`, `getCustomer`, `getCustomerByEmail`, `listCustomers`, `updateCustomer`, `incrementOrderStats(customerId, orderTotal)`.

`incrementOrderStats` loads the customer, increments `totalOrders` by 1 and `totalSpent` by `orderTotal`, saves back.

- [ ] **Step 2: Implement transactions.ts**

Simple module: `recordTransaction(storage, { orderId, type, amount, currency, provider, providerTransactionId, status })` and `getTransactionsByOrder(storage, orderId)`.

- [ ] **Step 3: Verify typecheck**

Run: `cd packages/plugins/commerce && pnpm typecheck`

- [ ] **Step 4: Commit**

```bash
git add packages/plugins/commerce/src/customers.ts packages/plugins/commerce/src/transactions.ts
git commit -m "feat(commerce): add customer management and transaction recording"
```

---

## Task 8: Checkout — Cart to Order Conversion

**Files:**
- Create: `packages/plugins/commerce/src/checkout.ts`
- Create: `packages/plugins/commerce/src/orders.ts`
- Test: `packages/core/tests/unit/plugins/commerce/checkout.test.ts`

- [ ] **Step 1: Write failing tests for checkout flow**

```typescript
describe("Checkout", () => {
	it("converts cart to order with correct totals", async () => {
		// Setup: create cart with 2 items, total = $60
		const order = await createOrderFromCart(storages, cartId, {
			email: "test@example.com",
			name: "Test User",
			paymentProvider: "stripe",
		});

		expect(order.orderNumber).toMatch(/^ORD-\d+$/);
		expect(order.status).toBe("pending");
		expect(order.paymentStatus).toBe("unpaid");
		expect(order.total).toBe(60);
		expect(order.customerEmail).toBe("test@example.com");
	});

	it("snapshots product data in order items", async () => {
		// Product name/price should be copied, not referenced
		const order = await createOrderFromCart(storages, cartId, { ... });
		const items = await getOrderItems(storages.orderItems, order.id);

		expect(items[0]!.productName).toBe("Test Product");
		expect(items[0]!.unitPrice).toBe(25.00);
	});

	it("generates sequential order numbers", async () => {
		const order1 = await createOrderFromCart(storages, cart1Id, { ... });
		const order2 = await createOrderFromCart(storages, cart2Id, { ... });

		const num1 = parseInt(order1.orderNumber.replace("ORD-", ""));
		const num2 = parseInt(order2.orderNumber.replace("ORD-", ""));
		expect(num2).toBe(num1 + 1);
	});

	it("rejects checkout on empty cart", async () => {
		await expect(createOrderFromCart(storages, emptyCartId, { ... }))
			.rejects.toThrow("CART_EMPTY");
	});

	it("rejects checkout on expired cart", async () => {
		await expect(createOrderFromCart(storages, expiredCartId, { ... }))
			.rejects.toThrow("CART_EXPIRED");
	});

	it("deletes cart after successful order creation", async () => {
		await createOrderFromCart(storages, cartId, { ... });
		const cart = await cartStorage.get(cartId);
		expect(cart).toBeNull();
	});
});
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement checkout.ts**

```typescript
import type { Order, OrderItem, Cart, CartItem } from "./types.js";
import { CommerceError, getCartItems } from "./cart.js";

interface CheckoutStorages {
	carts: StorageCollection<Cart>;
	cartItems: StorageCollection<CartItem>;
	orders: StorageCollection<Order>;
	orderItems: StorageCollection<OrderItem>;
	products: StorageCollection<Record<string, unknown>>;
	customers: StorageCollection<Record<string, unknown>>;
	orderCounter: StorageCollection<{ value: number }>;
}

async function getNextOrderNumber(
	counterStorage: StorageCollection<{ value: number }>,
): Promise<string> {
	const counter = await counterStorage.get("current");
	const value = counter?.value ?? 1000;
	await counterStorage.put("current", { value: value + 1 });
	return `ORD-${value + 1}`;
}

export async function createOrderFromCart(
	storages: CheckoutStorages,
	cartId: string,
	input: {
		email: string;
		name: string;
		paymentProvider: string;
		customerNotes?: string;
		shippingAddress?: Record<string, unknown>;
		billingAddress?: Record<string, unknown>;
	},
): Promise<Order> {
	const cart = await storages.carts.get(cartId);
	if (!cart) throw new CommerceError("CART_NOT_FOUND", "Cart not found");
	if (new Date(cart.expiresAt) < new Date()) throw new CommerceError("CART_EXPIRED", "Cart has expired");

	const items = await getCartItems(storages.cartItems, cartId);
	if (items.length === 0) throw new CommerceError("CART_EMPTY", "Cart is empty");

	// Re-validate prices against current product data
	const orderItems: OrderItem[] = [];
	let subtotal = 0;

	for (const item of items) {
		const product = await storages.products.get(item.productId);
		if (!product) continue;

		const currentPrice = (product.basePrice as number) ?? item.unitPrice;
		const totalPrice = Math.round(currentPrice * item.quantity * 100) / 100;
		subtotal += totalPrice;

		orderItems.push({
			id: crypto.randomUUID(),
			orderId: "", // Set after order creation
			productId: item.productId,
			variantId: item.variantId,
			productName: (product.name as string) ?? "",
			variantName: "",
			sku: (product.sku as string) ?? "",
			quantity: item.quantity,
			unitPrice: currentPrice,
			totalPrice,
			fulfillmentStatus: "unfulfilled",
			metadata: item.metadata,
		});
	}

	const orderNumber = await getNextOrderNumber(storages.orderCounter);
	const now = new Date().toISOString();
	const orderId = crypto.randomUUID();

	const total = Math.round(
		(subtotal - cart.discountTotal + cart.shippingTotal + cart.taxTotal) * 100,
	) / 100;

	const order: Order = {
		id: orderId,
		orderNumber,
		customerId: cart.customerId,
		customerEmail: input.email,
		customerName: input.name,
		status: "pending",
		paymentStatus: "unpaid",
		fulfillmentStatus: "unfulfilled",
		subtotal: Math.round(subtotal * 100) / 100,
		discountTotal: cart.discountTotal,
		shippingTotal: cart.shippingTotal,
		taxTotal: cart.taxTotal,
		total: Math.max(0, total),
		currency: cart.currency,
		shippingAddress: cart.shippingAddress,
		billingAddress: cart.billingAddress,
		shippingMethod: cart.shippingMethodId,
		trackingNumber: null,
		trackingUrl: null,
		paymentProvider: input.paymentProvider,
		paymentIntentId: null,
		notes: "",
		customerNotes: input.customerNotes ?? "",
		metadata: {},
		createdAt: now,
		updatedAt: now,
	};

	await storages.orders.put(orderId, order);

	// Save order items with orderId set
	for (const item of orderItems) {
		item.orderId = orderId;
		await storages.orderItems.put(item.id, item);
	}

	// Delete cart and cart items
	for (const item of items) {
		await storages.cartItems.delete(item.id);
	}
	await storages.carts.delete(cartId);

	return order;
}
```

- [ ] **Step 4: Implement orders.ts**

```typescript
import type { Order, OrderItem } from "./types.js";
import { CommerceError } from "./cart.js";

// Order queries
export async function getOrder(storage: StorageCollection<Order>, id: string): Promise<Order | null> {
	return storage.get(id);
}

export async function getOrderByNumber(storage: StorageCollection<Order>, orderNumber: string): Promise<Order | null> {
	const result = await storage.query({ where: { orderNumber }, limit: 1 });
	return result.items[0]?.data ?? null;
}

export async function listOrders(storage: StorageCollection<Order>, opts: {
	status?: string;
	paymentStatus?: string;
	fulfillmentStatus?: string;
	customerId?: string;
	limit?: number;
	cursor?: string;
}): Promise<{ items: Order[]; hasMore: boolean; cursor?: string }> {
	const where: Record<string, unknown> = {};
	if (opts.status) where.status = opts.status;
	if (opts.paymentStatus) where.paymentStatus = opts.paymentStatus;
	if (opts.fulfillmentStatus) where.fulfillmentStatus = opts.fulfillmentStatus;
	if (opts.customerId) where.customerId = opts.customerId;

	const result = await storage.query({
		where: Object.keys(where).length > 0 ? where : undefined,
		orderBy: { createdAt: "desc" },
		limit: Math.min(opts.limit ?? 50, 100),
		cursor: opts.cursor,
	});

	return {
		items: result.items.map((item) => item.data),
		hasMore: result.hasMore,
		cursor: result.cursor,
	};
}

export async function getOrderItems(storage: StorageCollection<OrderItem>, orderId: string): Promise<OrderItem[]> {
	const result = await storage.query({ where: { orderId }, limit: 1000 });
	return result.items.map((item) => item.data);
}

// Order mutations
export async function updateOrderStatus(
	storage: StorageCollection<Order>,
	orderId: string,
	status: Order["status"],
): Promise<Order> {
	const order = await storage.get(orderId);
	if (!order) throw new CommerceError("ORDER_NOT_FOUND", "Order not found");

	const updated: Order = { ...order, status, updatedAt: new Date().toISOString() };
	await storage.put(orderId, updated);
	return updated;
}

export async function fulfillOrder(
	orderStorage: StorageCollection<Order>,
	orderItemStorage: StorageCollection<OrderItem>,
	orderId: string,
	input: { trackingNumber?: string; trackingUrl?: string; itemIds?: string[] },
): Promise<Order> {
	const order = await orderStorage.get(orderId);
	if (!order) throw new CommerceError("ORDER_NOT_FOUND", "Order not found");

	const items = await getOrderItems(orderItemStorage, orderId);
	const targetIds = input.itemIds ?? items.map((i) => i.id);

	for (const item of items) {
		if (targetIds.includes(item.id)) {
			await orderItemStorage.put(item.id, { ...item, fulfillmentStatus: "fulfilled" });
		}
	}

	const allFulfilled = items.every(
		(item) => targetIds.includes(item.id) || item.fulfillmentStatus === "fulfilled",
	);

	const updated: Order = {
		...order,
		fulfillmentStatus: allFulfilled ? "fulfilled" : "partially_fulfilled",
		trackingNumber: input.trackingNumber ?? order.trackingNumber,
		trackingUrl: input.trackingUrl ?? order.trackingUrl,
		status: allFulfilled ? "shipped" : order.status,
		updatedAt: new Date().toISOString(),
	};

	await orderStorage.put(orderId, updated);
	return updated;
}

export async function markOrderPaid(
	storage: StorageCollection<Order>,
	orderId: string,
	paymentIntentId: string,
): Promise<Order> {
	const order = await storage.get(orderId);
	if (!order) throw new CommerceError("ORDER_NOT_FOUND", "Order not found");

	const updated: Order = {
		...order,
		status: "paid",
		paymentStatus: "paid",
		paymentIntentId,
		updatedAt: new Date().toISOString(),
	};

	await storage.put(orderId, updated);
	return updated;
}
```

- [ ] **Step 5: Run tests — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add packages/plugins/commerce/src/checkout.ts packages/plugins/commerce/src/orders.ts \
  packages/core/tests/unit/plugins/commerce/checkout.test.ts
git commit -m "feat(commerce): add checkout flow and order management"
```

---

## Task 9: Provider Interfaces

**Files:**
- Create: `packages/plugins/commerce/src/providers.ts`
- Test: `packages/core/tests/unit/plugins/commerce/providers.test.ts`

- [ ] **Step 1: Write provider dispatch helpers and tests**

The core plugin doesn't implement providers — it dispatches to them via hooks. Since EmDash's existing hook system only supports the predefined hook names (see `HOOK_NAMES` in manifest-schema.ts), commerce provider dispatch uses the plugin's **routes** rather than custom hooks. Each provider plugin registers routes that the core invokes.

```typescript
import type {
	ShippingRatesResult,
	TaxResult,
	PaymentCreateResult,
	PaymentCaptureResult,
	PaymentRefundResult,
} from "./types.js";

interface ProviderRegistry {
	paymentProviders: string[];
	shippingProviders: string[];
	taxProvider: string | null;
}

// Provider registry stored in KV
export async function getProviderRegistry(
	kv: { get<T>(key: string): Promise<T | null> },
): Promise<ProviderRegistry> {
	const registry = await kv.get<ProviderRegistry>("state:providers");
	return registry ?? { paymentProviders: [], shippingProviders: [], taxProvider: null };
}

export async function registerProvider(
	kv: { get<T>(key: string): Promise<T | null>; set(key: string, value: unknown): Promise<void> },
	type: "payment" | "shipping" | "tax",
	providerId: string,
): Promise<void> {
	const registry = await getProviderRegistry(kv);

	switch (type) {
		case "payment":
			if (!registry.paymentProviders.includes(providerId)) {
				registry.paymentProviders.push(providerId);
			}
			break;
		case "shipping":
			if (!registry.shippingProviders.includes(providerId)) {
				registry.shippingProviders.push(providerId);
			}
			break;
		case "tax":
			registry.taxProvider = providerId;
			break;
	}

	await kv.set("state:providers", registry);
}

export async function unregisterProvider(
	kv: { get<T>(key: string): Promise<T | null>; set(key: string, value: unknown): Promise<void> },
	type: "payment" | "shipping" | "tax",
	providerId: string,
): Promise<void> {
	const registry = await getProviderRegistry(kv);

	switch (type) {
		case "payment":
			registry.paymentProviders = registry.paymentProviders.filter((id) => id !== providerId);
			break;
		case "shipping":
			registry.shippingProviders = registry.shippingProviders.filter((id) => id !== providerId);
			break;
		case "tax":
			if (registry.taxProvider === providerId) registry.taxProvider = null;
			break;
	}

	await kv.set("state:providers", registry);
}
```

Tests: verify register/unregister for each provider type, verify registry state after operations.

- [ ] **Step 2: Run tests — expect FAIL then PASS after implementation**

- [ ] **Step 3: Commit**

```bash
git add packages/plugins/commerce/src/providers.ts packages/core/tests/unit/plugins/commerce/providers.test.ts
git commit -m "feat(commerce): add provider registry for payment, shipping, and tax"
```

---

## Task 10: Wire Routes into sandbox-entry.ts

**Files:**
- Modify: `packages/plugins/commerce/src/sandbox-entry.ts`

This is the big wiring task. All the business logic modules are done — now wire them as plugin routes.

- [ ] **Step 1: Wire storefront routes (public)**

Update `sandbox-entry.ts` to add all public routes. Each route is thin — parse input, call business logic, return result:

```typescript
import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";
import { createProduct, getProduct, getProductBySlug, listProducts, updateProduct, deleteProduct } from "./products.js";
import { createCategory, getCategory, getCategoryBySlug, listCategories, getCategoryTree, updateCategory, deleteCategory } from "./categories.js";
import { createVariant, listVariantsByProduct, updateVariant, deleteVariant, generateVariantCombinations } from "./variants.js";
import { createCart, getCart, addCartItem, updateCartItemQuantity, removeCartItem, getCartItems, recalculateCart, CommerceError } from "./cart.js";
import { createCoupon, getCouponByCode, listCoupons, updateCoupon, validateCoupon, calculateDiscount } from "./coupons.js";
import { createCustomer, getCustomer, getCustomerByEmail, listCustomers, updateCustomer, incrementOrderStats } from "./customers.js";
import { createOrderFromCart } from "./checkout.js";
import { getOrder, getOrderByNumber, listOrders, getOrderItems, updateOrderStatus, fulfillOrder, markOrderPaid } from "./orders.js";
import { recordTransaction, getTransactionsByOrder } from "./transactions.js";
import { getProviderRegistry, registerProvider, unregisterProvider } from "./providers.js";

export default definePlugin({
	hooks: {
		"plugin:install": async (_event: unknown, ctx: PluginContext) => {
			ctx.log.info("Commerce plugin installed");
			await ctx.storage.orderCounter!.put("current", { value: 1000 });
		},
		"plugin:activate": async (_event: unknown, ctx: PluginContext) => {
			ctx.log.info("Commerce plugin activated");
		},
	},

	routes: {
		// === Storefront (public) ===

		"products/list": {
			public: true,
			handler: async (routeCtx: { input: { status?: string; productType?: string; featured?: boolean; limit?: number; cursor?: string } }, ctx: PluginContext) => {
				return listProducts(ctx.storage.products!, {
					...routeCtx.input,
					status: "active", // Public always sees only active
				});
			},
		},

		"products/get": {
			public: true,
			handler: async (routeCtx: { input: { slug: string } }, ctx: PluginContext) => {
				const product = await getProductBySlug(ctx.storage.products!, routeCtx.input.slug);
				if (!product || product.status !== "active") {
					throw new CommerceError("PRODUCT_NOT_FOUND", "Product not found");
				}
				const variants = await listVariantsByProduct(ctx.storage.variants!, product.id);
				return { ...product, variants };
			},
		},

		"categories/tree": {
			public: true,
			handler: async (_routeCtx: unknown, ctx: PluginContext) => {
				return getCategoryTree(ctx.storage.categories!);
			},
		},

		"cart/create": {
			public: true,
			handler: async (routeCtx: { input: { sessionId?: string } }, ctx: PluginContext) => {
				return createCart(ctx.storage.carts!, { sessionId: routeCtx.input.sessionId });
			},
		},

		"cart/get": {
			public: true,
			handler: async (routeCtx: { input: { cartId: string } }, ctx: PluginContext) => {
				const cart = await getCart(ctx.storage.carts!, routeCtx.input.cartId);
				if (!cart) throw new CommerceError("CART_NOT_FOUND", "Cart not found");
				const items = await getCartItems(ctx.storage.cartItems!, cart.id);
				return { ...cart, items };
			},
		},

		"cart/add-item": {
			public: true,
			handler: async (routeCtx: { input: { cartId: string; productId: string; variantId?: string; quantity: number } }, ctx: PluginContext) => {
				const item = await addCartItem(
					ctx.storage.carts!,
					ctx.storage.cartItems!,
					ctx.storage.products!,
					ctx.storage.variants!,
					routeCtx.input.cartId,
					routeCtx.input,
				);
				await recalculateCart(ctx.storage.carts!, ctx.storage.cartItems!, routeCtx.input.cartId);
				return item;
			},
		},

		"cart/update-item": {
			public: true,
			handler: async (routeCtx: { input: { itemId: string; cartId: string; quantity: number } }, ctx: PluginContext) => {
				const item = await updateCartItemQuantity(ctx.storage.cartItems!, routeCtx.input.itemId, routeCtx.input.quantity);
				if (!item) throw new CommerceError("CART_NOT_FOUND", "Cart item not found");
				await recalculateCart(ctx.storage.carts!, ctx.storage.cartItems!, routeCtx.input.cartId);
				return item;
			},
		},

		"cart/remove-item": {
			public: true,
			handler: async (routeCtx: { input: { itemId: string; cartId: string } }, ctx: PluginContext) => {
				await removeCartItem(ctx.storage.cartItems!, routeCtx.input.itemId);
				await recalculateCart(ctx.storage.carts!, ctx.storage.cartItems!, routeCtx.input.cartId);
				return { success: true };
			},
		},

		"checkout/create": {
			public: true,
			handler: async (routeCtx: { input: { cartId: string; email: string; name: string; paymentProvider: string; customerNotes?: string } }, ctx: PluginContext) => {
				const order = await createOrderFromCart(
					{
						carts: ctx.storage.carts!,
						cartItems: ctx.storage.cartItems!,
						orders: ctx.storage.orders!,
						orderItems: ctx.storage.orderItems!,
						products: ctx.storage.products!,
						customers: ctx.storage.customers!,
						orderCounter: ctx.storage.orderCounter!,
					},
					routeCtx.input.cartId,
					routeCtx.input,
				);
				return order;
			},
		},

		// === Admin routes ===

		"admin/products/list": {
			handler: async (routeCtx: { input: { status?: string; productType?: string; limit?: number; cursor?: string } }, ctx: PluginContext) => {
				return listProducts(ctx.storage.products!, routeCtx.input);
			},
		},

		"admin/products/create": {
			handler: async (routeCtx: { input: Record<string, unknown> }, ctx: PluginContext) => {
				return createProduct(ctx.storage.products!, routeCtx.input);
			},
		},

		"admin/products/update": {
			handler: async (routeCtx: { input: { id: string } & Record<string, unknown> }, ctx: PluginContext) => {
				const { id, ...data } = routeCtx.input;
				const product = await updateProduct(ctx.storage.products!, id, data);
				if (!product) throw new CommerceError("PRODUCT_NOT_FOUND", "Product not found");
				return product;
			},
		},

		"admin/products/delete": {
			handler: async (routeCtx: { input: { id: string } }, ctx: PluginContext) => {
				const deleted = await deleteProduct(ctx.storage.products!, routeCtx.input.id);
				if (!deleted) throw new CommerceError("PRODUCT_NOT_FOUND", "Product not found");
				return { success: true };
			},
		},

		"admin/orders/list": {
			handler: async (routeCtx: { input: { status?: string; paymentStatus?: string; limit?: number; cursor?: string } }, ctx: PluginContext) => {
				return listOrders(ctx.storage.orders!, routeCtx.input);
			},
		},

		"admin/orders/get": {
			handler: async (routeCtx: { input: { id: string } }, ctx: PluginContext) => {
				const order = await getOrder(ctx.storage.orders!, routeCtx.input.id);
				if (!order) throw new CommerceError("ORDER_NOT_FOUND", "Order not found");
				const items = await getOrderItems(ctx.storage.orderItems!, order.id);
				const transactions = await getTransactionsByOrder(ctx.storage.transactions!, order.id);
				return { ...order, items, transactions };
			},
		},

		"admin/orders/fulfill": {
			handler: async (routeCtx: { input: { id: string; trackingNumber?: string; trackingUrl?: string } }, ctx: PluginContext) => {
				return fulfillOrder(ctx.storage.orders!, ctx.storage.orderItems!, routeCtx.input.id, routeCtx.input);
			},
		},

		"admin/orders/status": {
			handler: async (routeCtx: { input: { id: string; status: string } }, ctx: PluginContext) => {
				return updateOrderStatus(ctx.storage.orders!, routeCtx.input.id, routeCtx.input.status as Order["status"]);
			},
		},

		// Provider registration (called by provider plugins on install)
		"providers/register": {
			handler: async (routeCtx: { input: { type: "payment" | "shipping" | "tax"; providerId: string } }, ctx: PluginContext) => {
				await registerProvider(ctx.kv, routeCtx.input.type, routeCtx.input.providerId);
				return { success: true };
			},
		},

		"providers/unregister": {
			handler: async (routeCtx: { input: { type: "payment" | "shipping" | "tax"; providerId: string } }, ctx: PluginContext) => {
				await unregisterProvider(ctx.kv, routeCtx.input.type, routeCtx.input.providerId);
				return { success: true };
			},
		},

		"providers/list": {
			handler: async (_routeCtx: unknown, ctx: PluginContext) => {
				return getProviderRegistry(ctx.kv);
			},
		},

		// Block Kit admin UI handler
		admin: {
			handler: async (routeCtx: { input: { type: string; page?: string; action_id?: string; value?: string } }, ctx: PluginContext) => {
				// Delegate to admin page handlers (Task 11)
				return { blocks: [{ type: "header", text: "Commerce Dashboard" }] };
			},
		},
	},
});
```

The route names above are illustrative — trim, add, or rename as needed to match the exact API surface from the spec.

- [ ] **Step 2: Verify typecheck**

Run: `cd packages/plugins/commerce && pnpm typecheck`

- [ ] **Step 3: Commit**

```bash
git add packages/plugins/commerce/src/sandbox-entry.ts
git commit -m "feat(commerce): wire all business logic into plugin routes"
```

---

## Task 11: Admin Block Kit Pages

**Files:**
- Create: `packages/plugins/commerce/src/admin/blocks.ts`
- Create: `packages/plugins/commerce/src/admin/dashboard.ts`
- Create: `packages/plugins/commerce/src/admin/products.ts`
- Create: `packages/plugins/commerce/src/admin/orders.ts`
- Create: `packages/plugins/commerce/src/admin/categories.ts`
- Create: `packages/plugins/commerce/src/admin/customers.ts`
- Create: `packages/plugins/commerce/src/admin/coupons.ts`
- Create: `packages/plugins/commerce/src/admin/settings.ts`

- [ ] **Step 1: Create shared Block Kit helpers**

```typescript
// admin/blocks.ts
export function header(text: string) {
	return { type: "header", text };
}

export function section(text: string, accessory?: unknown) {
	return { type: "section", text, ...(accessory ? { accessory } : {}) };
}

export function table(headers: string[], rows: string[][]) {
	return { type: "table", headers, rows };
}

export function button(text: string, actionId: string, value?: string, style?: "primary" | "danger") {
	return { type: "button", text, action_id: actionId, value, ...(style ? { style } : {}) };
}

export function statsRow(stats: Array<{ label: string; value: string }>) {
	return {
		type: "section",
		fields: stats.map((s) => ({ type: "mrkdwn", text: `*${s.label}*\n${s.value}` })),
	};
}

export function form(fields: Array<{ label: string; name: string; type: string; value?: string; options?: Array<{ text: string; value: string }> }>) {
	return { type: "form", fields };
}

export function formatCurrency(amount: number, currency: string): string {
	return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}
```

- [ ] **Step 2: Create dashboard page**

```typescript
// admin/dashboard.ts
import type { PluginContext } from "emdash";
import { header, statsRow, table, formatCurrency, formatDate } from "./blocks.js";

export async function buildDashboard(ctx: PluginContext) {
	const orders = await ctx.storage.orders!.query({
		orderBy: { createdAt: "desc" },
		limit: 10,
	});

	const allOrders = orders.items.map((i) => i.data as Record<string, unknown>);
	const todayStr = new Date().toISOString().split("T")[0]!;
	const todayOrders = allOrders.filter((o) => (o.createdAt as string).startsWith(todayStr));

	const todayRevenue = todayOrders
		.filter((o) => o.paymentStatus === "paid")
		.reduce((sum, o) => sum + (o.total as number), 0);

	const pendingCount = allOrders.filter((o) => o.fulfillmentStatus === "unfulfilled" && o.paymentStatus === "paid").length;

	return {
		blocks: [
			header("Commerce Dashboard"),
			statsRow([
				{ label: "Today's Revenue", value: formatCurrency(todayRevenue, "USD") },
				{ label: "Orders Today", value: String(todayOrders.length) },
				{ label: "Pending Fulfillment", value: String(pendingCount) },
			]),
			header("Recent Orders"),
			table(
				["Order", "Customer", "Total", "Status", "Date"],
				allOrders.slice(0, 10).map((o) => [
					o.orderNumber as string,
					o.customerEmail as string,
					formatCurrency(o.total as number, (o.currency as string) ?? "USD"),
					o.status as string,
					formatDate(o.createdAt as string),
				]),
			),
		],
	};
}
```

- [ ] **Step 3: Create remaining admin pages**

Each admin page follows the same pattern as the audit-log plugin: return Block Kit JSON for `page_load` interactions, handle `block_action` for buttons/forms.

**products.ts** — product list table with status filter, "New Product" button, product edit form
**orders.ts** — order list with status filters, order detail with timeline and fulfill/refund buttons
**categories.ts** — category tree display, add/edit/delete
**customers.ts** — customer list with search, customer detail with order history
**coupons.ts** — coupon list, coupon create/edit form
**settings.ts** — tabbed settings (General, Payments, Shipping, Tax, Notifications) using KV for persistence

- [ ] **Step 4: Wire admin pages into sandbox-entry.ts admin route**

Update the `admin` route handler to delegate to the appropriate page builder based on `interaction.page`:

```typescript
admin: {
	handler: async (routeCtx: { input: { type: string; page?: string; action_id?: string; value?: string } }, ctx: PluginContext) => {
		const { type, page, action_id, value } = routeCtx.input as Record<string, string>;

		if (type === "page_load") {
			switch (page) {
				case "/": return buildDashboard(ctx);
				case "/products": return buildProductList(ctx);
				case "/orders": return buildOrderList(ctx);
				case "/categories": return buildCategoryPage(ctx);
				case "/customers": return buildCustomerList(ctx);
				case "/coupons": return buildCouponList(ctx);
				case "/settings": return buildSettingsPage(ctx);
				case "widget:revenue": return buildRevenueWidget(ctx);
				case "widget:recent-orders": return buildRecentOrdersWidget(ctx);
			}
		}

		if (type === "block_action") {
			// Route actions to appropriate handlers
			if (action_id?.startsWith("product:")) return handleProductAction(action_id, value, ctx);
			if (action_id?.startsWith("order:")) return handleOrderAction(action_id, value, ctx);
			if (action_id?.startsWith("category:")) return handleCategoryAction(action_id, value, ctx);
			if (action_id?.startsWith("coupon:")) return handleCouponAction(action_id, value, ctx);
			if (action_id?.startsWith("settings:")) return handleSettingsAction(action_id, value, ctx);
		}

		return { blocks: [] };
	},
},
```

- [ ] **Step 5: Commit**

```bash
git add packages/plugins/commerce/src/admin/
git commit -m "feat(commerce): add Block Kit admin UI pages"
```

---

## Task 12: Scaffold Shipping Basic Plugin

**Files:**
- Create: `packages/plugins/commerce-shipping-basic/package.json`
- Create: `packages/plugins/commerce-shipping-basic/tsconfig.json`
- Create: `packages/plugins/commerce-shipping-basic/src/index.ts`
- Create: `packages/plugins/commerce-shipping-basic/src/sandbox-entry.ts`
- Create: `packages/plugins/commerce-shipping-basic/src/rates.ts`
- Test: `packages/core/tests/unit/plugins/commerce/shipping-basic.test.ts`

- [ ] **Step 1: Write failing test for shipping rate calculation**

```typescript
import { describe, it, expect } from "vitest";
import { calculateShippingRates } from "../../../../packages/plugins/commerce-shipping-basic/src/rates.js";

describe("Basic Shipping Rates", () => {
	it("returns flat rate when configured", () => {
		const config = {
			methods: [
				{ id: "flat", name: "Standard Shipping", type: "flat_rate" as const, price: 5.99, currency: "USD" },
			],
		};
		const cart = { subtotal: 30, currency: "USD", items: [] };

		const result = calculateShippingRates(config, cart);
		expect(result.rates).toHaveLength(1);
		expect(result.rates[0]!.price).toBe(5.99);
		expect(result.rates[0]!.name).toBe("Standard Shipping");
	});

	it("returns free shipping when cart exceeds threshold", () => {
		const config = {
			methods: [
				{ id: "flat", name: "Standard Shipping", type: "flat_rate" as const, price: 5.99, currency: "USD" },
				{ id: "free", name: "Free Shipping", type: "free_over" as const, threshold: 50, currency: "USD" },
			],
		};
		const cart = { subtotal: 60, currency: "USD", items: [] };

		const result = calculateShippingRates(config, cart);
		expect(result.rates).toHaveLength(2);
		const freeRate = result.rates.find((r) => r.id === "free");
		expect(freeRate!.price).toBe(0);
	});

	it("excludes free shipping when cart is below threshold", () => {
		const config = {
			methods: [
				{ id: "free", name: "Free Shipping", type: "free_over" as const, threshold: 50, currency: "USD" },
			],
		};
		const cart = { subtotal: 30, currency: "USD", items: [] };

		const result = calculateShippingRates(config, cart);
		expect(result.rates).toHaveLength(0);
	});
});
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Create package.json**

```json
{
  "name": "@emdash-cms/plugin-commerce-shipping-basic",
  "version": "0.1.0",
  "description": "Basic shipping rates for EmDash Commerce — flat rate and free-over-threshold",
  "type": "module",
  "main": "src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./sandbox": "./src/sandbox-entry.ts"
  },
  "files": ["src"],
  "keywords": ["emdash", "cms", "plugin", "commerce", "shipping"],
  "license": "MIT",
  "peerDependencies": {
    "emdash": "workspace:*"
  },
  "scripts": {
    "typecheck": "tsgo --noEmit"
  }
}
```

- [ ] **Step 4: Create src/index.ts descriptor**

```typescript
import type { PluginDescriptor } from "emdash";

export function commerceShippingBasicPlugin(): PluginDescriptor {
	return {
		id: "commerce-shipping-basic",
		version: "0.1.0",
		format: "standard",
		entrypoint: "@emdash-cms/plugin-commerce-shipping-basic/sandbox",
		capabilities: [],
		storage: {},
		adminPages: [],
	};
}
```

- [ ] **Step 5: Create src/rates.ts**

```typescript
import type { ShippingRatesResult, ShippingRate } from "@emdash-cms/plugin-commerce";

export interface ShippingMethod {
	id: string;
	name: string;
	type: "flat_rate" | "free_over";
	price?: number;
	threshold?: number;
	currency: string;
	estimatedDays?: number;
}

export interface ShippingConfig {
	methods: ShippingMethod[];
}

export function calculateShippingRates(
	config: ShippingConfig,
	cart: { subtotal: number; currency: string },
): ShippingRatesResult {
	const rates: ShippingRate[] = [];

	for (const method of config.methods) {
		switch (method.type) {
			case "flat_rate":
				rates.push({
					id: method.id,
					name: method.name,
					description: `Flat rate shipping`,
					price: method.price ?? 0,
					currency: method.currency,
					estimatedDays: method.estimatedDays ?? null,
				});
				break;
			case "free_over":
				if (cart.subtotal >= (method.threshold ?? 0)) {
					rates.push({
						id: method.id,
						name: method.name,
						description: `Free shipping on orders over ${method.threshold}`,
						price: 0,
						currency: method.currency,
						estimatedDays: method.estimatedDays ?? null,
					});
				}
				break;
		}
	}

	return { rates };
}
```

- [ ] **Step 6: Create src/sandbox-entry.ts**

```typescript
import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";
import { calculateShippingRates } from "./rates.js";
import type { ShippingConfig } from "./rates.js";

const DEFAULT_CONFIG: ShippingConfig = {
	methods: [
		{ id: "standard", name: "Standard Shipping", type: "flat_rate", price: 5.99, currency: "USD", estimatedDays: 5 },
		{ id: "free", name: "Free Shipping", type: "free_over", threshold: 50, currency: "USD", estimatedDays: 7 },
	],
};

export default definePlugin({
	hooks: {
		"plugin:install": async (_event: unknown, ctx: PluginContext) => {
			await ctx.kv.set("settings:config", DEFAULT_CONFIG);
			ctx.log.info("Commerce Shipping Basic installed with default config");
		},
	},

	routes: {
		rates: {
			public: true,
			handler: async (routeCtx: { input: { subtotal: number; currency: string } }, ctx: PluginContext) => {
				const config = await ctx.kv.get<ShippingConfig>("settings:config") ?? DEFAULT_CONFIG;
				return calculateShippingRates(config, routeCtx.input);
			},
		},

		"admin/config": {
			handler: async (routeCtx: { input: { type: string; config?: ShippingConfig } }, ctx: PluginContext) => {
				if (routeCtx.input.type === "get") {
					return await ctx.kv.get<ShippingConfig>("settings:config") ?? DEFAULT_CONFIG;
				}
				if (routeCtx.input.type === "set" && routeCtx.input.config) {
					await ctx.kv.set("settings:config", routeCtx.input.config);
					return { success: true };
				}
				return { success: false };
			},
		},
	},
});
```

- [ ] **Step 7: Run tests — expect PASS**

- [ ] **Step 8: Create tsconfig.json (same pattern as commerce core)**

- [ ] **Step 9: Commit**

```bash
git add packages/plugins/commerce-shipping-basic/
git commit -m "feat(commerce): add basic shipping rates plugin"
```

---

## Task 13: Scaffold Tax Basic Plugin

**Files:**
- Create: `packages/plugins/commerce-tax-basic/package.json`
- Create: `packages/plugins/commerce-tax-basic/tsconfig.json`
- Create: `packages/plugins/commerce-tax-basic/src/index.ts`
- Create: `packages/plugins/commerce-tax-basic/src/sandbox-entry.ts`
- Create: `packages/plugins/commerce-tax-basic/src/calculate.ts`
- Test: `packages/core/tests/unit/plugins/commerce/tax-basic.test.ts`

Follows the same pattern as shipping-basic. Key differences:

- [ ] **Step 1: Write failing test for tax calculation**

```typescript
import { describe, it, expect } from "vitest";
import { calculateTax } from "../../../../packages/plugins/commerce-tax-basic/src/calculate.js";

describe("Basic Tax Calculation", () => {
	it("applies tax rate for matching region", () => {
		const config = {
			rates: [
				{ country: "US", state: "CA", rate: 8.25, name: "CA Sales Tax" },
				{ country: "US", state: "NY", rate: 8.0, name: "NY Sales Tax" },
			],
		};
		const items = [
			{ itemId: "item-1", amount: 100 },
			{ itemId: "item-2", amount: 50 },
		];
		const address = { country: "US", state: "CA" };

		const result = calculateTax(config, items, address);
		expect(result.totalTax).toBe(12.38); // (100+50) * 0.0825 = 12.375, rounded
		expect(result.lineItems).toHaveLength(2);
		expect(result.lineItems[0]!.taxRate).toBe(8.25);
	});

	it("returns zero tax for region with no rate", () => {
		const config = { rates: [{ country: "US", state: "CA", rate: 8.25, name: "CA Sales Tax" }] };
		const items = [{ itemId: "item-1", amount: 100 }];
		const address = { country: "US", state: "TX" };

		const result = calculateTax(config, items, address);
		expect(result.totalTax).toBe(0);
	});

	it("matches country-only rate when no state-specific rate", () => {
		const config = { rates: [{ country: "GB", rate: 20, name: "UK VAT" }] };
		const items = [{ itemId: "item-1", amount: 100 }];
		const address = { country: "GB" };

		const result = calculateTax(config, items, address);
		expect(result.totalTax).toBe(20);
	});
});
```

- [ ] **Step 2: Implement calculate.ts**

```typescript
import type { TaxResult, TaxLineItem } from "@emdash-cms/plugin-commerce";

export interface TaxRate {
	country: string;
	state?: string;
	rate: number;
	name: string;
}

export interface TaxConfig {
	rates: TaxRate[];
}

export function calculateTax(
	config: TaxConfig,
	items: Array<{ itemId: string; amount: number }>,
	address: { country: string; state?: string },
): TaxResult {
	// Find best matching rate: state-specific first, then country-only
	const rate =
		config.rates.find((r) => r.country === address.country && r.state === address.state) ??
		config.rates.find((r) => r.country === address.country && !r.state);

	if (!rate) {
		return {
			lineItems: items.map((item) => ({
				itemId: item.itemId,
				taxAmount: 0,
				taxRate: 0,
				taxName: "No Tax",
			})),
			totalTax: 0,
		};
	}

	const lineItems: TaxLineItem[] = items.map((item) => ({
		itemId: item.itemId,
		taxAmount: Math.round(item.amount * (rate.rate / 100) * 100) / 100,
		taxRate: rate.rate,
		taxName: rate.name,
	}));

	const totalTax = Math.round(lineItems.reduce((sum, li) => sum + li.taxAmount, 0) * 100) / 100;

	return { lineItems, totalTax };
}
```

- [ ] **Step 3: Create package.json, tsconfig.json, index.ts, sandbox-entry.ts**

Same pattern as shipping-basic. Descriptor declares no capabilities, no storage. Sandbox-entry stores tax config in KV, exposes `calculate` and `admin/config` routes.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/plugins/commerce-tax-basic/
git commit -m "feat(commerce): add basic tax calculation plugin"
```

---

## Task 14: Scaffold Commerce Stripe Plugin

**Files:**
- Create: `packages/plugins/commerce-stripe/package.json`
- Create: `packages/plugins/commerce-stripe/tsconfig.json`
- Create: `packages/plugins/commerce-stripe/src/index.ts`
- Create: `packages/plugins/commerce-stripe/src/sandbox-entry.ts`
- Create: `packages/plugins/commerce-stripe/src/client.ts`
- Create: `packages/plugins/commerce-stripe/src/webhook.ts`
- Test: `packages/core/tests/unit/plugins/commerce/stripe.test.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@emdash-cms/plugin-commerce-stripe",
  "version": "0.1.0",
  "description": "Stripe payment provider for EmDash Commerce",
  "type": "module",
  "main": "src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./sandbox": "./src/sandbox-entry.ts"
  },
  "files": ["src"],
  "keywords": ["emdash", "cms", "plugin", "commerce", "stripe", "payment"],
  "license": "MIT",
  "peerDependencies": {
    "emdash": "workspace:*"
  },
  "scripts": {
    "typecheck": "tsgo --noEmit"
  }
}
```

- [ ] **Step 2: Create src/client.ts — fetch-based Stripe API client**

No Node SDK — pure fetch for sandbox compatibility:

```typescript
const STRIPE_API = "https://api.stripe.com/v1";

interface StripeRequestOpts {
	method: "GET" | "POST";
	path: string;
	body?: Record<string, string>;
	secretKey: string;
}

async function stripeRequest<T>(fetchFn: typeof fetch, opts: StripeRequestOpts): Promise<T> {
	const headers: Record<string, string> = {
		Authorization: `Bearer ${opts.secretKey}`,
		"Content-Type": "application/x-www-form-urlencoded",
	};

	const response = await fetchFn(`${STRIPE_API}${opts.path}`, {
		method: opts.method,
		headers,
		body: opts.body ? new URLSearchParams(opts.body).toString() : undefined,
	});

	if (!response.ok) {
		const error = await response.json() as { error: { message: string } };
		throw new Error(`Stripe API error: ${error.error.message}`);
	}

	return response.json() as Promise<T>;
}

export async function createPaymentIntent(
	fetchFn: typeof fetch,
	secretKey: string,
	opts: { amount: number; currency: string; metadata?: Record<string, string> },
): Promise<{ id: string; client_secret: string; status: string }> {
	const body: Record<string, string> = {
		amount: String(Math.round(opts.amount * 100)), // Stripe uses cents
		currency: opts.currency.toLowerCase(),
		automatic_payment_methods: "true",
	};

	if (opts.metadata) {
		for (const [key, value] of Object.entries(opts.metadata)) {
			body[`metadata[${key}]`] = value;
		}
	}

	return stripeRequest(fetchFn, {
		method: "POST",
		path: "/payment_intents",
		body,
		secretKey,
	});
}

export async function createRefund(
	fetchFn: typeof fetch,
	secretKey: string,
	opts: { paymentIntentId: string; amount?: number },
): Promise<{ id: string; status: string }> {
	const body: Record<string, string> = {
		payment_intent: opts.paymentIntentId,
	};

	if (opts.amount !== undefined) {
		body.amount = String(Math.round(opts.amount * 100));
	}

	return stripeRequest(fetchFn, {
		method: "POST",
		path: "/refunds",
		body,
		secretKey,
	});
}
```

- [ ] **Step 3: Create src/webhook.ts — signature verification**

```typescript
export async function verifyWebhookSignature(
	payload: string,
	signature: string,
	secret: string,
): Promise<boolean> {
	const parts = signature.split(",").reduce<Record<string, string>>((acc, part) => {
		const [key, value] = part.split("=");
		if (key && value) acc[key] = value;
		return acc;
	}, {});

	const timestamp = parts.t;
	const expectedSig = parts.v1;
	if (!timestamp || !expectedSig) return false;

	// Verify timestamp is within 5 minutes
	const age = Math.abs(Date.now() / 1000 - parseInt(timestamp));
	if (age > 300) return false;

	const signedPayload = `${timestamp}.${payload}`;
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
	const computed = Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	return computed === expectedSig;
}

export interface StripeEvent {
	id: string;
	type: string;
	data: {
		object: Record<string, unknown>;
	};
}

export function parseStripeEvent(payload: string): StripeEvent {
	return JSON.parse(payload) as StripeEvent;
}
```

- [ ] **Step 4: Create src/index.ts descriptor and src/sandbox-entry.ts**

```typescript
// index.ts
import type { PluginDescriptor } from "emdash";

export function commerceStripePlugin(): PluginDescriptor {
	return {
		id: "commerce-stripe",
		version: "0.1.0",
		format: "standard",
		entrypoint: "@emdash-cms/plugin-commerce-stripe/sandbox",
		capabilities: ["network:fetch"],
		allowedHosts: ["api.stripe.com"],
		storage: {},
		adminPages: [],
	};
}
```

```typescript
// sandbox-entry.ts
import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";
import { createPaymentIntent, createRefund } from "./client.js";
import { verifyWebhookSignature, parseStripeEvent } from "./webhook.js";

export default definePlugin({
	hooks: {
		"plugin:install": async (_event: unknown, ctx: PluginContext) => {
			ctx.log.info("Commerce Stripe plugin installed");
		},
	},

	routes: {
		"payment/create": {
			handler: async (
				routeCtx: { input: { amount: number; currency: string; orderId: string; returnUrl: string } },
				ctx: PluginContext,
			) => {
				const secretKey = await ctx.kv.get<string>("settings:secret:stripe_secret_key");
				if (!secretKey) throw new Error("Stripe secret key not configured");

				const fetchFn = ctx.http!.fetch.bind(ctx.http);
				const intent = await createPaymentIntent(fetchFn, secretKey, {
					amount: routeCtx.input.amount,
					currency: routeCtx.input.currency,
					metadata: { orderId: routeCtx.input.orderId },
				});

				return {
					clientSecret: intent.client_secret,
					providerOrderId: intent.id,
				};
			},
		},

		"payment/refund": {
			handler: async (
				routeCtx: { input: { paymentIntentId: string; amount?: number } },
				ctx: PluginContext,
			) => {
				const secretKey = await ctx.kv.get<string>("settings:secret:stripe_secret_key");
				if (!secretKey) throw new Error("Stripe secret key not configured");

				const fetchFn = ctx.http!.fetch.bind(ctx.http);
				const refund = await createRefund(fetchFn, secretKey, routeCtx.input);

				return {
					refundId: refund.id,
					status: refund.status === "succeeded" ? "succeeded" : "pending",
				};
			},
		},

		webhook: {
			public: true,
			handler: async (
				routeCtx: { input: unknown; request: Request },
				ctx: PluginContext,
			) => {
				const webhookSecret = await ctx.kv.get<string>("settings:secret:stripe_webhook_secret");
				if (!webhookSecret) throw new Error("Webhook secret not configured");

				const payload = await routeCtx.request.text();
				const signature = routeCtx.request.headers.get("stripe-signature") ?? "";

				const valid = await verifyWebhookSignature(payload, signature, webhookSecret);
				if (!valid) return { error: "Invalid signature", status: 400 };

				const event = parseStripeEvent(payload);

				switch (event.type) {
					case "payment_intent.succeeded": {
						const pi = event.data.object;
						return {
							event: "payment_succeeded",
							orderId: (pi.metadata as Record<string, string>)?.orderId ?? "",
							providerTransactionId: pi.id as string,
							status: "succeeded",
						};
					}
					case "charge.refunded": {
						const charge = event.data.object;
						return {
							event: "refund_succeeded",
							orderId: ((charge.metadata as Record<string, string>)?.orderId) ?? "",
							providerTransactionId: charge.id as string,
							status: "succeeded",
						};
					}
					default:
						return { event: event.type, handled: false };
				}
			},
		},

		"admin/config": {
			handler: async (
				routeCtx: { input: { type: string; publishableKey?: string; secretKey?: string; webhookSecret?: string } },
				ctx: PluginContext,
			) => {
				if (routeCtx.input.type === "get") {
					const pk = await ctx.kv.get<string>("settings:stripe_publishable_key");
					return { publishableKey: pk ?? "", configured: !!pk };
				}
				if (routeCtx.input.type === "set") {
					if (routeCtx.input.publishableKey) {
						await ctx.kv.set("settings:stripe_publishable_key", routeCtx.input.publishableKey);
					}
					if (routeCtx.input.secretKey) {
						await ctx.kv.set("settings:secret:stripe_secret_key", routeCtx.input.secretKey);
					}
					if (routeCtx.input.webhookSecret) {
						await ctx.kv.set("settings:secret:stripe_webhook_secret", routeCtx.input.webhookSecret);
					}
					return { success: true };
				}
			},
		},
	},
});
```

- [ ] **Step 5: Write tests for webhook signature verification**

```typescript
describe("Stripe Webhook", () => {
	it("rejects invalid signature", async () => {
		const result = await verifyWebhookSignature("payload", "t=123,v1=invalid", "secret");
		expect(result).toBe(false);
	});

	it("rejects expired timestamp", async () => {
		const oldTimestamp = String(Math.floor(Date.now() / 1000) - 600);
		const result = await verifyWebhookSignature("payload", `t=${oldTimestamp},v1=abc`, "secret");
		expect(result).toBe(false);
	});
});
```

- [ ] **Step 6: Run tests — expect PASS**

- [ ] **Step 7: Create tsconfig.json**

- [ ] **Step 8: Commit**

```bash
git add packages/plugins/commerce-stripe/
git commit -m "feat(commerce): add Stripe payment provider plugin"
```

---

## Task 15: Scaffold Storefront Components Plugin

**Files:**
- Create: `packages/plugins/commerce-storefront/package.json`
- Create: `packages/plugins/commerce-storefront/tsconfig.json`
- Create: `packages/plugins/commerce-storefront/src/index.ts`
- Create: `packages/plugins/commerce-storefront/src/sandbox-entry.ts`
- Create: `packages/plugins/commerce-storefront/src/components/ProductList.astro`
- Create: `packages/plugins/commerce-storefront/src/components/ProductDetail.astro`
- Create: `packages/plugins/commerce-storefront/src/components/CartDrawer.astro`
- Create: `packages/plugins/commerce-storefront/src/components/Checkout.astro`
- Create: `packages/plugins/commerce-storefront/src/components/OrderConfirmation.astro`
- Create: `packages/plugins/commerce-storefront/src/components/CategoryNav.astro`
- Create: `packages/plugins/commerce-storefront/src/styles/commerce.css`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@emdash-cms/plugin-commerce-storefront",
  "version": "0.1.0",
  "description": "Ready-to-use storefront components for EmDash Commerce",
  "type": "module",
  "main": "src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./sandbox": "./src/sandbox-entry.ts",
    "./components/ProductList": "./src/components/ProductList.astro",
    "./components/ProductDetail": "./src/components/ProductDetail.astro",
    "./components/CartDrawer": "./src/components/CartDrawer.astro",
    "./components/Checkout": "./src/components/Checkout.astro",
    "./components/OrderConfirmation": "./src/components/OrderConfirmation.astro",
    "./components/CategoryNav": "./src/components/CategoryNav.astro",
    "./styles": "./src/styles/commerce.css"
  },
  "files": ["src"],
  "keywords": ["emdash", "cms", "plugin", "commerce", "storefront", "astro"],
  "license": "MIT",
  "peerDependencies": {
    "emdash": "workspace:*",
    "astro": "^5.0.0"
  },
  "scripts": {
    "typecheck": "tsgo --noEmit"
  }
}
```

- [ ] **Step 2: Create src/index.ts descriptor**

```typescript
import type { PluginDescriptor } from "emdash";

export function commerceStorefrontPlugin(): PluginDescriptor {
	return {
		id: "commerce-storefront",
		version: "0.1.0",
		format: "standard",
		entrypoint: "@emdash-cms/plugin-commerce-storefront/sandbox",
		capabilities: ["page:inject"],
		storage: {},
		adminPages: [],
	};
}
```

- [ ] **Step 3: Create src/sandbox-entry.ts — injects cart script**

```typescript
import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";

export default definePlugin({
	hooks: {
		"page:fragments": {
			handler: async (_event: unknown, _ctx: PluginContext) => {
				return {
					head: `<link rel="stylesheet" href="/_emdash/plugins/commerce-storefront/styles/commerce.css" />`,
					bodyEnd: `<script src="/_emdash/plugins/commerce-storefront/cart.js" defer></script>`,
				};
			},
		},
	},
	routes: {},
});
```

- [ ] **Step 4: Create ProductList.astro**

```astro
---
interface Props {
	apiBase?: string;
	columns?: 2 | 3 | 4;
	showFilters?: boolean;
}

const { apiBase = "/_emdash/api/plugins/commerce", columns = 3, showFilters = true } = Astro.props;
---

<div data-commerce-product-list data-api-base={apiBase} data-columns={columns}>
	{showFilters && (
		<div data-commerce-filters>
			<select data-commerce-category-filter aria-label="Filter by category">
				<option value="">All Categories</option>
			</select>
			<select data-commerce-sort aria-label="Sort by">
				<option value="newest">Newest</option>
				<option value="price-asc">Price: Low to High</option>
				<option value="price-desc">Price: High to Low</option>
			</select>
		</div>
	)}

	<div data-commerce-grid class={`commerce-grid commerce-grid--${columns}`}>
		<p data-commerce-loading>Loading products...</p>
	</div>

	<nav data-commerce-pagination aria-label="Product pagination">
		<button data-commerce-load-more type="button" hidden>Load More</button>
	</nav>
</div>

<style>
	.commerce-grid {
		display: grid;
		gap: var(--commerce-grid-gap, 1.5rem);
	}
	.commerce-grid--2 { grid-template-columns: repeat(2, 1fr); }
	.commerce-grid--3 { grid-template-columns: repeat(3, 1fr); }
	.commerce-grid--4 { grid-template-columns: repeat(4, 1fr); }

	@media (max-width: 768px) {
		.commerce-grid--3,
		.commerce-grid--4 { grid-template-columns: repeat(2, 1fr); }
	}
	@media (max-width: 480px) {
		.commerce-grid { grid-template-columns: 1fr; }
	}
</style>
```

- [ ] **Step 5: Create remaining Astro components**

Each component follows the same pattern: semantic HTML, data attributes for JS hooks, CSS custom properties for theming, responsive by default.

**ProductDetail.astro** — image gallery, title, price, variant selector (dropdown per option type), quantity input, add-to-cart button
**CartDrawer.astro** — off-canvas panel, item list, quantity +/- buttons, coupon input, subtotal, checkout button
**Checkout.astro** — multi-step form (address, shipping method radio buttons, payment container div for Stripe Elements, submit)
**OrderConfirmation.astro** — order number, items table, totals, shipping address
**CategoryNav.astro** — recursive list rendering for category tree

- [ ] **Step 6: Create commerce.css default theme**

```css
/* commerce.css — default theme using CSS custom properties */
:root {
	--commerce-font-family: inherit;
	--commerce-primary: #2563eb;
	--commerce-primary-hover: #1d4ed8;
	--commerce-text: #1f2937;
	--commerce-text-muted: #6b7280;
	--commerce-border: #e5e7eb;
	--commerce-bg: #ffffff;
	--commerce-bg-muted: #f9fafb;
	--commerce-radius: 0.5rem;
	--commerce-grid-gap: 1.5rem;
	--commerce-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

[data-commerce-product-card] {
	border: 1px solid var(--commerce-border);
	border-radius: var(--commerce-radius);
	overflow: hidden;
	background: var(--commerce-bg);
	box-shadow: var(--commerce-shadow);
	transition: box-shadow 0.2s;
}

[data-commerce-product-card]:hover {
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

[data-commerce-price] {
	font-weight: 700;
	color: var(--commerce-text);
}

[data-commerce-price-compare] {
	text-decoration: line-through;
	color: var(--commerce-text-muted);
}

[data-commerce-btn] {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 0.625rem 1.25rem;
	font-weight: 600;
	border-radius: var(--commerce-radius);
	border: none;
	cursor: pointer;
	transition: background 0.2s;
}

[data-commerce-btn="primary"] {
	background: var(--commerce-primary);
	color: white;
}

[data-commerce-btn="primary"]:hover {
	background: var(--commerce-primary-hover);
}
```

- [ ] **Step 7: Create tsconfig.json**

- [ ] **Step 8: Commit**

```bash
git add packages/plugins/commerce-storefront/
git commit -m "feat(commerce): add storefront Astro components with default theme"
```

---

## Task 16: Integration Test — Full Checkout Flow

**Files:**
- Test: `packages/core/tests/integration/plugins/commerce/checkout-flow.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
import { describe, it, expect, beforeEach } from "vitest";

describe("Commerce Checkout Flow (Integration)", () => {
	// Uses mock storage collections (same helpers as unit tests)

	it("full flow: create product -> add to cart -> checkout -> order", async () => {
		// 1. Create a product
		const product = await createProduct(storages.products, {
			name: "Widget",
			slug: "widget",
			basePrice: 25.00,
			status: "active",
		});

		// 2. Create a cart
		const cart = await createCart(storages.carts, { sessionId: "test-session" });

		// 3. Add product to cart
		await addCartItem(
			storages.carts,
			storages.cartItems,
			storages.products,
			storages.variants,
			cart.id,
			{ productId: product.id, quantity: 2 },
		);

		// 4. Recalculate
		const recalculated = await recalculateCart(storages.carts, storages.cartItems, cart.id);
		expect(recalculated!.subtotal).toBe(50.00);
		expect(recalculated!.total).toBe(50.00);

		// 5. Checkout
		const order = await createOrderFromCart(storages, cart.id, {
			email: "buyer@example.com",
			name: "Test Buyer",
			paymentProvider: "stripe",
		});

		expect(order.status).toBe("pending");
		expect(order.total).toBe(50.00);
		expect(order.orderNumber).toMatch(/^ORD-/);

		// 6. Verify order items snapshot
		const items = await getOrderItems(storages.orderItems, order.id);
		expect(items).toHaveLength(1);
		expect(items[0]!.productName).toBe("Widget");
		expect(items[0]!.quantity).toBe(2);

		// 7. Verify cart deleted
		const deletedCart = await storages.carts.get(cart.id);
		expect(deletedCart).toBeNull();

		// 8. Mark order paid
		const paid = await markOrderPaid(storages.orders, order.id, "pi_test_123");
		expect(paid.paymentStatus).toBe("paid");

		// 9. Fulfill order
		const fulfilled = await fulfillOrder(storages.orders, storages.orderItems, order.id, {
			trackingNumber: "TRACK123",
		});
		expect(fulfilled.fulfillmentStatus).toBe("fulfilled");
		expect(fulfilled.status).toBe("shipped");
	});

	it("full flow with coupon applied", async () => {
		const product = await createProduct(storages.products, {
			name: "Widget",
			slug: "widget",
			basePrice: 100.00,
			status: "active",
		});

		const coupon = await createCoupon(storages.coupons, {
			code: "SAVE10",
			type: "percentage",
			value: 10,
			status: "active",
		});

		const cart = await createCart(storages.carts, { sessionId: "test" });
		await addCartItem(storages.carts, storages.cartItems, storages.products, storages.variants, cart.id, {
			productId: product.id,
			quantity: 1,
		});

		// Validate and apply coupon
		const items = await getCartItems(storages.cartItems, cart.id);
		const recalculated = await recalculateCart(storages.carts, storages.cartItems, cart.id);
		const error = validateCoupon(coupon, recalculated!, items);
		expect(error).toBeNull();

		const discount = calculateDiscount(coupon, recalculated!, items, []);
		expect(discount).toBe(10.00);
	});
});
```

- [ ] **Step 2: Run integration test**

Run: `pnpm --filter emdash test -- tests/integration/plugins/commerce/checkout-flow.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/tests/integration/plugins/commerce/checkout-flow.test.ts
git commit -m "test(commerce): add full checkout flow integration test"
```

---

## Task 17: Register Plugins and pnpm Install

**Files:**
- Modify: `pnpm-workspace.yaml` (if plugins aren't already included)
- Verify all 5 plugins are installable

- [ ] **Step 1: Verify workspace includes plugins directory**

Check `pnpm-workspace.yaml` includes `packages/plugins/*`. If not, add it.

- [ ] **Step 2: Run pnpm install**

Run: `pnpm install`
Expected: all 5 new packages resolved

- [ ] **Step 3: Verify typecheck across all plugins**

Run: `pnpm typecheck`
Expected: clean

- [ ] **Step 4: Run all commerce tests**

Run: `pnpm --filter emdash test -- tests/unit/plugins/commerce/ tests/integration/plugins/commerce/`
Expected: all tests PASS

- [ ] **Step 5: Run lint**

Run: `pnpm --silent lint:quick`
Expected: clean

- [ ] **Step 6: Format**

Run: `pnpm format`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(commerce): complete Phase 1 MVP — 5 plugins, tests passing"
```

---

## Task 18: Demo Integration

**Files:**
- Modify: `demos/simple/astro.config.mjs` (add plugin registration)
- Create: `demos/simple/src/pages/shop/index.astro` (product listing page)
- Create: `demos/simple/src/pages/shop/[slug].astro` (product detail page)

- [ ] **Step 1: Register commerce plugins in demo**

Add to `demos/simple/astro.config.mjs`:

```typescript
import { commercePlugin } from "@emdash-cms/plugin-commerce";
import { commerceStorefrontPlugin } from "@emdash-cms/plugin-commerce-storefront";
import { commerceShippingBasicPlugin } from "@emdash-cms/plugin-commerce-shipping-basic";
import { commerceTaxBasicPlugin } from "@emdash-cms/plugin-commerce-tax-basic";
import { commerceStripePlugin } from "@emdash-cms/plugin-commerce-stripe";

// In the emdash() config:
plugins: [
  commercePlugin(),
  commerceStorefrontPlugin(),
  commerceShippingBasicPlugin(),
  commerceTaxBasicPlugin(),
  commerceStripePlugin(),
],
```

- [ ] **Step 2: Create shop pages using storefront components**

```astro
---
// src/pages/shop/index.astro
import Layout from "../../layouts/Layout.astro";
import ProductList from "@emdash-cms/plugin-commerce-storefront/components/ProductList";
import CategoryNav from "@emdash-cms/plugin-commerce-storefront/components/CategoryNav";
---
<Layout title="Shop">
  <div class="shop-layout">
    <aside><CategoryNav /></aside>
    <main><ProductList columns={3} /></main>
  </div>
</Layout>
```

- [ ] **Step 3: Start dev server and verify**

Run: `pnpm --filter emdash-demo dev`
Navigate to `http://localhost:4321/shop/`
Expected: page renders without errors (empty product list since no products seeded yet)

- [ ] **Step 4: Commit**

```bash
git add demos/simple/
git commit -m "feat(commerce): integrate commerce plugins into demo site"
```
