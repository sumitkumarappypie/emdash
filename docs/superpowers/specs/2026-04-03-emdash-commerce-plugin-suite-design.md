# EmDash Commerce Plugin Suite — Design Spec

**Date:** 2026-04-03
**Status:** Approved
**Scope:** Full-spectrum e-commerce for EmDash CMS

---

## 1. Overview

A modular suite of EmDash plugins that provides full e-commerce capabilities: physical goods, digital products, and subscriptions. Designed for non-technical store owners who manage everything from the admin UI. Medium scale (~10K products, moderate traffic).

### Design Decisions

- **Plugin Suite (Approach 2):** Composable family of plugins rather than a monolith. Install only what you need. Matches EmDash's existing provider pattern.
- **Multi-provider architecture:** Payment, shipping, and tax providers are separate plugins implementing hook-based interfaces. Multiple payment providers active simultaneously; shipping rates aggregated; tax is exclusive (one engine).
- **Full storefront included:** Astro components ship ready-to-use. Minimal unstyled markup with CSS custom properties for easy theming.
- **Server-side cart:** All cart state lives on the server. No client-side cart drift. Enables accurate inventory checks and future abandoned cart features.

---

## 2. Package Structure

```
packages/plugins/
├── commerce/                  # Core: catalog, cart, checkout, orders
├── commerce-digital/          # Digital downloads, license keys
├── commerce-subscriptions/    # Recurring billing, memberships
├── commerce-stripe/           # Stripe payment provider
├── commerce-paypal/           # PayPal payment provider
├── commerce-shipping-basic/   # Flat rate, free-over-threshold, weight-based
├── commerce-tax-basic/        # Manual tax rates by region
└── commerce-storefront/       # Astro components (product pages, cart, checkout UI)
```

### Dependency Graph

- `commerce` is the core — all others depend on it
- `commerce-digital` and `commerce-subscriptions` extend the core's product and order models
- Payment providers (`commerce-stripe`, etc.) implement the payment provider interface
- Shipping/tax providers implement their respective provider interfaces
- `commerce-storefront` consumes the core's API

### Installation

```bash
emdash commerce init          # Installs core + storefront + basic shipping/tax
emdash commerce add stripe    # Adds Stripe payment provider
emdash commerce add digital   # Adds digital products support
```

---

## 3. Data Model

### Products & Catalog

**`ec_commerce_products`**

- `id`, `slug`, `status` (draft/active/archived)
- `name`, `description` (Portable Text), `short_description`
- `product_type` — `physical`, `digital`, `subscription` (extensible by sub-plugins)
- `sku`, `barcode`
- `base_price`, `compare_at_price`, `currency`
- `track_inventory` (boolean), `inventory_quantity`, `low_stock_threshold`
- `weight`, `weight_unit`, `dimensions_length/width/height`, `dimension_unit`
- `tax_class`
- `is_featured`, `sort_order`
- `images` (JSON array of media references)
- `metadata` (JSON — extensible key-value for sub-plugins)

**`ec_commerce_variants`**

- `id`, `product_id` (FK)
- `name`, `sku`, `barcode`
- `price` (null = inherit from product), `compare_at_price`
- `inventory_quantity`, `track_inventory`
- `weight`, `dimensions_*`
- `option_values` (JSON — e.g., `{"size": "XL", "color": "Blue"}`)
- `sort_order`, `status`

**`ec_commerce_categories`** (hierarchical)

- `id`, `slug`, `name`, `description`, `image`
- `parent_id` (FK, self-referencing), `sort_order`

**`ec_commerce_product_categories`** (junction)

- `product_id`, `category_id`

### Cart & Checkout

**`ec_commerce_carts`**

- `id`, `session_id` (anonymous) or `customer_id` (logged in)
- `currency`, `subtotal`, `discount_total`, `shipping_total`, `tax_total`, `total`
- `shipping_address`, `billing_address` (JSON)
- `shipping_method_id`, `coupon_codes` (JSON array)
- `expires_at`, `created_at`, `updated_at`

**`ec_commerce_cart_items`**

- `id`, `cart_id` (FK), `product_id`, `variant_id` (nullable)
- `quantity`, `unit_price`, `total_price`
- `metadata` (JSON)

### Orders

**`ec_commerce_orders`**

- `id`, `order_number` (human-readable, sequential)
- `customer_id`, `customer_email`, `customer_name`
- `status` — `pending`, `paid`, `processing`, `shipped`, `delivered`, `completed`, `cancelled`, `refunded`
- `payment_status` — `unpaid`, `paid`, `partially_refunded`, `refunded`
- `fulfillment_status` — `unfulfilled`, `partially_fulfilled`, `fulfilled`
- `subtotal`, `discount_total`, `shipping_total`, `tax_total`, `total`, `currency`
- `shipping_address`, `billing_address` (JSON)
- `shipping_method`, `tracking_number`, `tracking_url`
- `payment_provider`, `payment_intent_id`
- `notes`, `customer_notes`
- `metadata` (JSON)

**`ec_commerce_order_items`**

- `id`, `order_id` (FK), `product_id`, `variant_id`
- `product_name`, `variant_name`, `sku` (snapshot at time of order)
- `quantity`, `unit_price`, `total_price`
- `fulfillment_status`, `metadata`

**`ec_commerce_transactions`**

- `id`, `order_id` (FK)
- `type` — `charge`, `refund`, `partial_refund`
- `amount`, `currency`, `provider`, `provider_transaction_id`
- `status` — `pending`, `succeeded`, `failed`
- `metadata`

### Customers

**`ec_commerce_customers`**

- `id`, `user_id` (nullable FK), `email`, `name`
- `phone`, `default_shipping_address`, `default_billing_address` (JSON)
- `total_orders`, `total_spent`, `tags` (JSON array)
- `accepts_marketing` (boolean)

### Coupons & Discounts

**`ec_commerce_coupons`**

- `id`, `code` (unique), `description`
- `type` — `percentage`, `fixed_amount`, `free_shipping`
- `value`, `currency`
- `minimum_order_amount`, `maximum_discount_amount`
- `usage_limit`, `usage_count`, `per_customer_limit`
- `applies_to` — `all`, `specific_products`, `specific_categories`
- `product_ids`, `category_ids` (JSON arrays)
- `starts_at`, `expires_at`, `status`

### Sub-Plugin Tables

**commerce-digital:**

- `ec_commerce_downloads` — `id`, `order_item_id`, `product_id`, `file_url`, `file_name`, `file_size`, `license_key`, `download_limit`, `download_count`, `expires_at`

**commerce-subscriptions:**

- `ec_commerce_subscription_plans` — `id`, `product_id`, `name`, `interval` (daily/weekly/monthly/yearly), `interval_count`, `trial_days`, `billing_cycles` (null = infinite), `price`, `currency`
- `ec_commerce_subscriptions` — `id`, `customer_id`, `plan_id`, `order_id`, `status` (active/paused/cancelled/expired/past_due), `current_period_start`, `current_period_end`, `trial_end`, `cancelled_at`, `cancel_reason`, `payment_provider`, `provider_subscription_id`

### Extension Seam

The `metadata` JSON column on products, cart items, order items, and orders is the extension point. Sub-plugins store their data there. Sub-plugins also get their own tables when metadata is insufficient.

---

## 4. Provider Interfaces & Hook System

### Payment Provider

Hooks: `commerce:payment:create`, `commerce:payment:capture`, `commerce:payment:refund`, `commerce:payment:webhook`

Multiple providers can be active simultaneously (customer chooses at checkout).

**Contract:**

- `create(order, returnUrl)` -> `{ redirectUrl?, clientSecret?, providerOrderId }`
- `capture(providerOrderId)` -> `{ transactionId, status }`
- `refund(transactionId, amount?)` -> `{ refundId, status }`
- `webhook(request)` -> `{ event, orderId, status }`

Webhook routing: each provider registers a public route at `/_emdash/api/plugins/@emdash/commerce-{provider}/webhook`.

### Shipping Provider

Hook: `commerce:shipping:rates` (non-exclusive, aggregated)

All active shipping plugins return rates; customer picks one.

**Contract:**

- `rates(cart, shippingAddress)` -> `{ rates: [{ id, name, description, price, currency, estimatedDays }] }`
- `fulfill(order, items)` -> `{ trackingNumber?, trackingUrl?, status }` (optional)

### Tax Provider

Hook: `commerce:tax:calculate` (exclusive — one tax engine at a time)

**Contract:**

- `calculate(cart, shippingAddress, billingAddress)` -> `{ lineItems: [{ itemId, taxAmount, taxRate, taxName }], totalTax }`
- `commit(order)` -> `void` (for providers like Avalara)

### Core Commerce Hooks

| Hook                               | Type      | Purpose                                         |
| ---------------------------------- | --------- | ----------------------------------------------- |
| `commerce:product:afterSave`       | broadcast | Sync inventory, update search index             |
| `commerce:cart:beforeAdd`          | pipeline  | Validate stock, apply restrictions              |
| `commerce:cart:afterUpdate`        | broadcast | Recalculate totals, apply coupons               |
| `commerce:checkout:beforeComplete` | pipeline  | Final validation, reserve inventory             |
| `commerce:order:created`           | broadcast | Send confirmation email, notify fulfillment     |
| `commerce:order:statusChanged`     | broadcast | Send status emails, update analytics            |
| `commerce:order:paid`              | broadcast | Trigger digital delivery, activate subscription |
| `commerce:order:refunded`          | broadcast | Revoke access, restore inventory                |
| `commerce:inventory:low`           | broadcast | Alert admin, trigger reorder                    |

Pipeline hooks can modify or abort. Broadcast hooks are fire-and-forget.

---

## 5. Admin UI & Dashboard

### Dashboard (`/_emdash/admin/commerce`)

**Top bar:** Today's revenue, orders today, pending orders, low-stock alerts

**Sections:**

- Revenue chart (7/30/90 days)
- Recent orders (last 10, status badges)
- Top products (by revenue/quantity)
- Action items (pending fulfillment, low stock, pending refunds)

### Admin Screens

| Screen         | Path                     | Features                                                                                                     |
| -------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Products       | `/commerce/products`     | List, filters (status, category, type, stock), bulk actions, search                                          |
| Product editor | `/commerce/products/:id` | Name, description (PT), pricing, variants builder, images, inventory, SEO, categories, product type settings |
| Categories     | `/commerce/categories`   | Tree view, drag reorder, CRUD                                                                                |
| Orders         | `/commerce/orders`       | List, filters (status, payment, fulfillment, date), search                                                   |
| Order detail   | `/commerce/orders/:id`   | Timeline, line items, addresses, payment, refund, fulfillment, notes                                         |
| Customers      | `/commerce/customers`    | List, search, order history, tags                                                                            |
| Coupons        | `/commerce/coupons`      | List, CRUD, usage stats                                                                                      |
| Settings       | `/commerce/settings`     | Tabs: General, Payments, Shipping, Tax, Notifications                                                        |

### Product Editor Details

**Variants builder:** Define option types (Size, Color) -> enter values -> auto-generate combinations -> per-variant SKU/price/inventory/image. Bulk edit supported.

**Product type switching:** Selecting "Digital" shows file upload, license key settings, download limit (injected by commerce-digital). Selecting "Subscription" shows plan config (injected by commerce-subscriptions). Injected via `commerce:admin:product:sections` hook.

### Storefront Components (commerce-storefront)

| Component               | Purpose                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `<ProductList />`       | Grid/list with filters, pagination, sorting                |
| `<ProductDetail />`     | Images, description, variant selector, add-to-cart         |
| `<CartDrawer />`        | Slide-out cart, quantity controls, coupon input            |
| `<CartPage />`          | Full-page cart for mobile                                  |
| `<Checkout />`          | Multi-step: address -> shipping -> payment -> confirmation |
| `<OrderConfirmation />` | Thank you page with order summary                          |
| `<CustomerAccount />`   | Order history, addresses, subscriptions                    |
| `<CategoryNav />`       | Hierarchical category navigation                           |

Styling: minimal unstyled markup with data attributes and CSS custom properties. Default theme included, easily overridden. No Tailwind dependency.

### Email Notifications

Order confirmation, payment received, order shipped, order delivered, refund processed, low stock alert (admin), new order alert (admin), subscription renewal reminder, subscription cancelled. Each has a default template, customizable from settings.

---

## 6. Checkout Flow & Cart Logic

### Cart Lifecycle

```
Anonymous visitor -> Session-based cart (cookie)
       | (signs in)
Merge into customer cart (larger quantity wins per item)
       | (checkout)
Cart frozen -> Order created -> Cart deleted
       | (abandoned)
Cron cleans up carts older than 30 days
```

### Cart Recalculation

On every cart mutation:

1. Line item totals (price x quantity, variant overrides)
2. Coupon discounts (validate eligibility, apply rules)
3. Shipping rates (call `commerce:shipping:rates` with cart + address)
4. Tax (call `commerce:tax:calculate` with cart + addresses)
5. Grand total

### Checkout Steps

```
Cart -> Shipping Info -> Shipping Method -> Payment -> Confirmation
```

- **Shipping Info:** Email, name, address. Guest checkout supported. Digital-only carts skip.
- **Shipping Method:** Aggregated rates from providers. Digital-only carts skip.
- **Payment:** Active providers shown as options. Provider SDKs handle PCI. Card data never touches our server.
- **Confirmation:** Order created, inventory decremented, emails sent, hooks fired.

### Inventory Management

- Reserve on checkout start (15-minute soft hold)
- Deduct on payment success (atomic SQL transaction)
- Restore on failure/abandonment
- Low stock threshold per product, triggers `commerce:inventory:low`
- Out of stock: admin configures hide/label/allow-backorders

### Coupon Validation

Single coupon per cart (v1). Checks: code exists, active, within date range, under usage limit, minimum met, applies to cart items.

---

## 7. REST API Surface

### Storefront APIs (public)

| Method | Route                        | Purpose                         |
| ------ | ---------------------------- | ------------------------------- |
| GET    | `/products`                  | List (paginated, filterable)    |
| GET    | `/products/:slug`            | Single product with variants    |
| GET    | `/categories`                | Category tree                   |
| GET    | `/categories/:slug/products` | Products in category            |
| POST   | `/cart`                      | Create cart                     |
| GET    | `/cart/:id`                  | Get cart with totals            |
| POST   | `/cart/:id/items`            | Add item                        |
| PUT    | `/cart/:id/items/:itemId`    | Update quantity                 |
| DELETE | `/cart/:id/items/:itemId`    | Remove item                     |
| POST   | `/cart/:id/coupon`           | Apply coupon                    |
| DELETE | `/cart/:id/coupon`           | Remove coupon                   |
| PUT    | `/cart/:id/shipping-address` | Set address                     |
| GET    | `/cart/:id/shipping-rates`   | Get rates                       |
| PUT    | `/cart/:id/shipping-method`  | Select method                   |
| POST   | `/checkout/:cartId`          | Create order + initiate payment |
| GET    | `/orders/:id/confirmation`   | Order confirmation (token-auth) |

### Customer APIs (authenticated)

| Method              | Route                               | Purpose              |
| ------------------- | ----------------------------------- | -------------------- |
| GET                 | `/account/orders`                   | Order history        |
| GET                 | `/account/orders/:id`               | Order detail         |
| GET/POST/PUT/DELETE | `/account/addresses[/:id]`          | Address CRUD         |
| GET                 | `/account/subscriptions`            | Active subscriptions |
| POST                | `/account/subscriptions/:id/pause`  | Pause                |
| POST                | `/account/subscriptions/:id/cancel` | Cancel               |
| GET                 | `/account/downloads`                | Digital downloads    |

### Admin APIs (role-gated)

Products, categories, orders, customers, coupons, dashboard, settings, and subscriptions CRUD. ~40 endpoints total. All follow EmDash conventions: `parseBody()`/`parseQuery()` with Zod, `apiError()` responses, `handleError()` catch blocks, cursor-based pagination.

### Error Codes

`PRODUCT_NOT_FOUND`, `CART_NOT_FOUND`, `CART_EXPIRED`, `CART_EMPTY`, `INSUFFICIENT_STOCK`, `PRODUCT_UNAVAILABLE`, `INVALID_COUPON`, `COUPON_EXPIRED`, `COUPON_LIMIT_REACHED`, `MINIMUM_NOT_MET`, `PAYMENT_FAILED`, `PAYMENT_PROVIDER_ERROR`, `ORDER_NOT_FOUND`, `ORDER_ALREADY_FULFILLED`, `ORDER_ALREADY_REFUNDED`, `SUBSCRIPTION_NOT_FOUND`, `SUBSCRIPTION_ALREADY_CANCELLED`, `DOWNLOAD_LIMIT_REACHED`, `DOWNLOAD_EXPIRED`

---

## 8. Security

### Payment Security

- Card data never touches our server — provider SDKs handle PCI
- Webhook signatures validated per-provider
- Payment secrets in KV as `settings:secret:*`
- Idempotency keys on payment creation

### Cart Security

- Session token (signed, httpOnly cookie) — not guessable IDs
- Rate limiting on cart operations
- Prices re-validated at checkout (no stale price exploits)

### Order Integrity

- Inventory check + decrement atomic (single SQL transaction)
- Totals recalculated server-side at checkout
- Order items snapshot product data at time of purchase

### CSRF

- `X-EmDash-Request: 1` header required (EmDash standard)
- Webhook endpoints exempt (provider signature auth)

### Authorization

- Storefront: public reads, session-auth for cart/account
- Admin: EDITOR minimum, ADMIN for settings/refunds
- Customers access only their own data

### Edge Cases

- Variant deleted while in cart: recalculation removes, notifies customer
- Price changed between add and checkout: uses current price, shows diff
- Payment succeeds but webhook delayed: poll for 30s, webhook is source of truth
- Double webhook: unique `provider_transaction_id` constraint, duplicates are no-ops
- Subscription renewal during maintenance: cron catches up on next tick

---

## 9. Implementation Phases

### Phase 1: Core Commerce (MVP store)

**Plugins:** `commerce`, `commerce-storefront`, `commerce-shipping-basic`, `commerce-tax-basic`, `commerce-stripe`

Delivers: product catalog, variants, categories, cart, checkout, Stripe payments, orders, fulfillment, refunds, coupons, dashboard, full storefront components.

~40 files, 15-20 tables, 50+ routes.

### Phase 2: Digital Products

**Plugin:** `commerce-digital`

Adds: digital product type, file upload, license keys, download limits, automatic delivery on payment, customer download page.

~10 files, 1 table, 5 routes.

### Phase 3: Subscriptions

**Plugin:** `commerce-subscriptions`

Adds: subscription product type, plan configuration, automated renewal via cron, dunning (retry failed payments), customer pause/cancel, admin management.

~15 files, 2 tables, 10 routes.

### Phase 4: Advanced Commerce

**Plugin:** `commerce-paypal` + enhancements

Adds: PayPal provider, weight-based shipping, abandoned cart recovery, CSV import/export, inventory alerts, basic analytics.

~20 files, 1 new plugin, enhancements across existing.

---

## 10. Testing Strategy

### Unit Tests

- Product validation, cart logic, checkout state machine, coupon engine, subscription lifecycle
- Real in-memory SQLite, fresh DB per test (EmDash standard)

### Integration Tests

- Full checkout flow (cart -> payment -> order -> hooks)
- Provider interface contracts (mock providers)
- Sub-plugin interaction (digital delivery, subscription creation)
- Admin CRUD through API routes
- Cart edge cases

### E2E Tests (Playwright)

- Storefront journey: browse -> cart -> checkout -> confirmation
- Admin journey: create product -> view order -> fulfill -> refund
- Guest vs logged-in checkout
- Coupon application
- Digital download flow (Phase 2)
- Subscription purchase (Phase 3)

### Provider Testing

- Stripe: test mode keys
- PayPal: sandbox
- Shipping/tax: deterministic built-in providers
