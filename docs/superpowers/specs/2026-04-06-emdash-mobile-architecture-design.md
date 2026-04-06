# EmDash Mobile Architecture: Hybrid Native + WebView

**Date**: 2026-04-06
**Status**: Design
**Author**: Sumit Tiwari

---

## 1. Overview

A mobile app framework for EmDash that follows the Shopify hybrid model: first-party plugins render as native React Native screens, third-party plugins render inside managed WebViews with a communication bridge.

**Design principles:**
- First-party plugins get full native UI (React Native .tsx screens)
- Third-party plugins work out of the box via WebView (their existing Astro pages)
- A bridge protocol connects native and WebView contexts (auth, theme, navigation, state)
- Cross-cutting plugins (themes, i18n, analytics) contribute to a global app config API
- EmDash core gains minimal new surface area to support mobile

**Reference architecture:** [Shopify Mobile Bridge](https://shopify.engineering/mobilebridge-native-webviews) — ~600 screens, ~80% WebView, native for critical flows only.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    EmDash Mobile App                      │
│                   (React Native / Expo)                   │
│                                                          │
│  ┌────────────────────┐  ┌────────────────────────────┐  │
│  │  Native Screens    │  │  WebView Container         │  │
│  │  (first-party)     │  │  (third-party plugins)     │  │
│  │                    │  │                            │  │
│  │  Commerce:         │  │  ┌──────────────────────┐  │  │
│  │   ProductList      │  │  │ Plugin Astro Pages   │  │  │
│  │   ProductDetail    │  │  │                      │  │  │
│  │   Cart             │  │  │ + App Bridge JS SDK  │  │  │
│  │   Checkout         │  │  │   emdash.navigate()  │  │  │
│  │   Account          │  │  │   emdash.setTitle()  │  │  │
│  │                    │  │  │   emdash.toast()     │  │  │
│  │  Forms:            │  │  │   emdash.dismiss()   │  │  │
│  │   FormView         │  │  │   emdash.share()     │  │  │
│  │   FormSubmission   │  │  └──────────────────────┘  │  │
│  └────────┬───────────┘  └─────────────┬──────────────┘  │
│           │                            │                 │
│  ┌────────┴────────────────────────────┴──────────────┐  │
│  │              App Bridge (postMessage)               │  │
│  │  Native → Web: auth, theme, cart, locale, device   │  │
│  │  Web → Native: navigate, title, toast, dismiss     │  │
│  └────────────────────────┬───────────────────────────┘  │
│                           │                              │
│  ┌────────────────────────┴───────────────────────────┐  │
│  │              Shared Services                        │  │
│  │  ThemeProvider | AuthProvider | CartProvider         │  │
│  │  ConfigProvider | NavigationProvider                 │  │
│  └────────────────────────┬───────────────────────────┘  │
└───────────────────────────┼──────────────────────────────┘
                            │ HTTPS
                ┌───────────┴───────────┐
                │   EmDash Server       │
                │   (Astro + Plugins)   │
                │                       │
                │   /_emdash/api/*      │
                │   Plugin routes       │
                │   Storefront pages    │
                └───────────────────────┘
```

### How It Works

1. **App launch** — fetches `/app/config` for theme, branding, installed plugins, and feature flags.
2. **Native screens** — first-party plugin screens (commerce, forms) rendered natively using React Native. They call plugin API routes directly via HTTP.
3. **WebView screens** — third-party plugin storefronts loaded in a managed WebView. The App Bridge JS SDK is injected on load, providing auth tokens, theme, and native capabilities.
4. **Bridge** — two-way `postMessage` communication. Native injects context into WebView; WebView requests native actions (navigation, toast, dismiss).
5. **Cross-cutting plugins** — theme manager, i18n, analytics contribute their config via the `app:config` hook. The app consumes it once and applies globally.

---

## 3. App Bridge Protocol

The bridge is the critical integration layer. It must be designed once and versioned.

### 3.1 Native → WebView (injected on load)

```typescript
interface AppBridgeContext {
  version: 1;
  auth: {
    adminToken?: string;       // API token for admin users
    customerToken?: string;    // Commerce customer session token
  };
  theme: {
    primary: string;           // hex color
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    error: string;
    success: string;
    fontFamily?: string;
    borderRadius?: number;
  };
  site: {
    name: string;
    logo?: string;
    url: string;
    locale: string;
    currency?: string;
  };
  device: {
    platform: "ios" | "android";
    safeAreaInsets: { top: number; bottom: number; left: number; right: number };
    colorScheme: "light" | "dark";
  };
  cart?: {
    id: string;
    itemCount: number;
  };
}
```

Injected as `window.__EMDASH_BRIDGE__` via `injectedJavaScriptBeforeContentLoaded`.

### 3.2 WebView → Native (postMessage API)

```typescript
// JS SDK that plugin web pages include
const emdash = {
  // Navigation
  navigate(screen: string, params?: Record<string, string>): void;
  dismiss(): void;
  setTitle(title: string): void;

  // Feedback
  toast(message: string, type?: "success" | "error" | "info"): void;
  confirm(title: string, message: string): Promise<boolean>;

  // State
  updateCartBadge(count: number): void;
  getAuth(): Promise<{ adminToken?: string; customerToken?: string }>;

  // Platform
  share(url: string, text?: string): void;
  haptic(type: "light" | "medium" | "heavy"): void;

  // Lifecycle
  ready(): void;  // signals that the page has loaded
};
```

Each call serializes to a `postMessage` with `{ type, id, method, params }`. Native responds with `{ type, id, result?, error? }`.

### 3.3 JS SDK Distribution

The App Bridge SDK ships as a `<script>` tag that EmDash core injects into all storefront pages when the request comes from the mobile app (detected via `User-Agent: EmDashApp/1.0` or `X-EmDash-App: 1` header).

Plugin authors don't need to include it manually. It's automatic.

---

## 4. App Config API

A single endpoint that aggregates global configuration from core and all plugins.

### Endpoint

```
GET /_emdash/api/app/config
Authorization: Bearer <token>

Response:
{
  "site": {
    "name": "My Store",
    "tagline": "Best widgets",
    "logo": "/_emdash/api/media/file/logo.png",
    "url": "https://mystore.com",
    "locale": "en",
    "locales": ["en", "es"]
  },
  "theme": {
    "primary": "#7C3AED",
    "secondary": "#A78BFA",
    "background": "#FFFFFF",
    "surface": "#F9FAFB",
    "text": "#111827",
    "textMuted": "#6B7280",
    "error": "#EF4444",
    "success": "#10B981"
  },
  "plugins": [
    {
      "id": "commerce",
      "name": "Commerce",
      "version": "1.0.0",
      "native": true,
      "mobile": {
        "tabs": [
          { "key": "shop", "label": "Shop", "icon": "store", "screen": "commerce:product-list" },
          { "key": "cart", "label": "Cart", "icon": "cart", "screen": "commerce:cart", "badge": "cartCount" }
        ]
      }
    },
    {
      "id": "loyalty-rewards",
      "name": "Loyalty Rewards",
      "version": "2.1.0",
      "native": false,
      "mobile": {
        "entryUrl": "/rewards",
        "icon": "gift",
        "label": "Rewards"
      }
    }
  ],
  "navigation": {
    "tabs": [
      { "key": "home", "label": "Home", "icon": "home", "screen": "home" },
      { "key": "shop", "label": "Shop", "icon": "store", "screen": "commerce:product-list" },
      { "key": "cart", "label": "Cart", "icon": "cart", "screen": "commerce:cart", "badge": "cartCount" },
      { "key": "account", "label": "Account", "icon": "user", "screen": "commerce:account" }
    ]
  },
  "features": {
    "guestCheckout": true,
    "search": true,
    "darkMode": false,
    "pushNotifications": false
  }
}
```

### How Plugins Contribute

Plugins declare their mobile presence via a new `mobile` field in the plugin definition:

```typescript
// First-party plugin (native screens)
definePlugin({
  id: "commerce",
  mobile: {
    native: true,
    tabs: [
      { key: "shop", label: "Shop", icon: "store", screen: "product-list" },
      { key: "cart", label: "Cart", icon: "cart", screen: "cart", badge: "cartCount" }
    ]
  }
});

// Third-party plugin (WebView)
definePlugin({
  id: "loyalty-rewards",
  mobile: {
    entryUrl: "/rewards",
    icon: "gift",
    label: "Rewards"
  }
});
```

Cross-cutting plugins contribute to the config via a new hook:

```typescript
definePlugin({
  id: "theme-manager",
  hooks: {
    "app:config": async (ctx) => ({
      theme: {
        primary: await ctx.kv.get("setting:primaryColor") || "#3B82F6",
        secondary: await ctx.kv.get("setting:secondaryColor") || "#6366F1"
      }
    })
  }
});
```

---

## 5. Authentication for Mobile

### Current State

| Auth type | Mechanism | Mobile-compatible? |
|-----------|-----------|--------------------|
| Admin passkey | WebAuthn + session cookie | Partial (passkeys work on iOS/Android but session cookies don't transfer to WebView) |
| Admin API token | `ec_pat_*` bearer token | Yes, but no mobile flow to create one |
| Commerce customer | Token in request body | Yes |
| Magic link | Email → session cookie | Partial (link opens browser, not app) |

### New Mobile Auth Flow

```
┌─────────────┐         ┌─────────────┐         ┌──────────────┐
│  Mobile App │         │  EmDash API │         │  Email/Auth  │
└──────┬──────┘         └──────┬──────┘         └──────┬───────┘
       │                       │                       │
       │  POST /api/auth/     │                       │
       │  mobile/request       │                       │
       │  { email }           │                       │
       │──────────────────────>│                       │
       │                       │   Send magic link     │
       │                       │──────────────────────>│
       │                       │                       │
       │         User taps link (deep link → app)      │
       │<──────────────────────────────────────────────│
       │                       │                       │
       │  POST /api/auth/     │                       │
       │  mobile/verify        │                       │
       │  { code }            │                       │
       │──────────────────────>│                       │
       │                       │                       │
       │  { token, user }     │                       │
       │<──────────────────────│                       │
       │                       │                       │
       │  Store token in       │                       │
       │  SecureStore          │                       │
       │                       │                       │
       │  Inject token into    │                       │
       │  WebView via bridge   │                       │
```

**Admin users**: magic link → deep link back to app → exchange code for API token → stored in Expo SecureStore.

**Customer users**: existing commerce login flow (email/password → token) works as-is.

**WebView auth**: Native app injects the token into WebView via App Bridge context. The storefront pages read `window.__EMDASH_BRIDGE__.auth` instead of requiring a separate login.

### New Endpoints Required

| Endpoint | Purpose |
|----------|---------|
| `POST /_emdash/api/auth/mobile/request` | Send magic link email with app deep link |
| `POST /_emdash/api/auth/mobile/verify` | Exchange magic link code for API token |
| `POST /_emdash/api/auth/mobile/refresh` | Refresh expired token |
| `GET /_emdash/api/auth/mobile/session` | Validate token + return user info |

---

## 6. Changes Required in EmDash Core

### 6.1 New Plugin Definition Fields

**File**: `packages/core/src/plugins/types.ts`

Add `mobile` field to `PluginDefinition`:

```typescript
interface PluginMobileConfig {
  // First-party: declares native screens exist in a companion RN package
  native?: boolean;

  // Entry URL for WebView rendering (third-party plugins)
  entryUrl?: string;

  // Display metadata
  label?: string;
  icon?: string;  // icon name from a shared icon set

  // Tab contributions (optional)
  tabs?: Array<{
    key: string;
    label: string;
    icon: string;
    screen: string;    // native screen name (first-party) or relative URL (third-party)
    badge?: string;    // state key for badge count
  }>;
}

interface PluginDefinition<TStorage> {
  // ... existing fields
  mobile?: PluginMobileConfig;  // NEW
}
```

### 6.2 New Hook: `app:config`

**File**: `packages/core/src/plugins/hooks.ts`

Add a new hook that plugins can use to contribute to the app config:

```typescript
// New hook type
"app:config": {
  input: void;
  output: Partial<AppConfig>;  // merged into the global config
}
```

This allows theme plugins, i18n plugins, and other cross-cutting plugins to inject their configuration into the mobile app without the app needing to know about each plugin individually.

### 6.3 New API Route: App Config

**File**: `packages/core/src/astro/routes/api/app/config.ts`

```
GET /_emdash/api/app/config
```

Aggregates:
- Site settings (name, logo, URL, locale)
- Theme (from theme plugin via `app:config` hook, or defaults)
- Installed plugins with mobile metadata
- Navigation structure (tabs assembled from plugin declarations)
- Feature flags (guest checkout, search, push, dark mode)

Register in `packages/core/src/astro/integration/routes.ts`.

### 6.4 New API Routes: Mobile Auth

**Files**: `packages/core/src/astro/routes/api/auth/mobile/`

| File | Endpoint | Purpose |
|------|----------|---------|
| `request.ts` | `POST /api/auth/mobile/request` | Send magic link with app deep link |
| `verify.ts` | `POST /api/auth/mobile/verify` | Exchange code for bearer token |
| `refresh.ts` | `POST /api/auth/mobile/refresh` | Refresh expired token |
| `session.ts` | `GET /api/auth/mobile/session` | Validate token + return user |

### 6.5 App Bridge Script Injection

**File**: `packages/core/src/astro/middleware.ts` (or new middleware)

When a request has `User-Agent: EmDashApp/*` or `X-EmDash-App: 1` header:
- Inject the App Bridge `<script>` tag into all storefront HTML responses
- The script sets up `window.__EMDASH_BRIDGE__` and the `emdash.*` SDK methods
- The script establishes the `postMessage` listener for native communication

### 6.6 Plugin Manifest Extension

**File**: `packages/core/src/plugins/manifest.ts`

Add `mobile` field to `PluginManifest` so marketplace plugins declare their mobile capabilities:

```typescript
interface PluginManifest {
  // ... existing fields
  mobile?: PluginMobileConfig;
}
```

This is serialized during `emdash plugin bundle` and available for the mobile app to read from the manifest API.

### 6.7 Image Transform Endpoint (Optional but Recommended)

**File**: `packages/core/src/astro/routes/api/media/transform.ts`

```
GET /_emdash/api/media/file/{key}?w=300&h=300&fit=cover&format=webp
```

Returns resized/optimized images for mobile. On Cloudflare, this proxies to Cloudflare Image Resizing. On Node.js, uses `sharp`.

Without this, mobile apps download full-size images on cellular connections.

---

## 7. Mobile App Structure

### Repository Layout

```
packages/
  mobile/                          # NEW: React Native app (Expo)
    app/
      (tabs)/
        index.tsx                  # Home screen
        shop.tsx                   # → commerce:ProductList
        cart.tsx                   # → commerce:Cart
        account.tsx                # → commerce:Account
      product/[slug].tsx           # → commerce:ProductDetail
      checkout.tsx                 # → commerce:Checkout
      plugin/[id].tsx              # → WebView container for third-party
    components/
      AppBridge.tsx                # WebView wrapper with bridge injection
      WebViewScreen.tsx            # Managed WebView with preloading
      NativeTitle.tsx              # Title bar synced with WebView
    providers/
      ThemeProvider.tsx            # Colors from /app/config
      AuthProvider.tsx             # Token management
      CartProvider.tsx             # Cart state (shared native + WebView)
      ConfigProvider.tsx           # App config from server
    hooks/
      useAppConfig.ts              # Fetch + cache /app/config
      useAuth.ts                   # Login, token refresh, logout
      useCart.ts                   # Cart operations
      useProducts.ts              # Product listing + detail
    lib/
      api.ts                       # HTTP client for EmDash API
      bridge.ts                    # Bridge protocol types + helpers
    app.json                       # Expo config

  plugins/commerce/
    src/
      mobile/                      # NEW: Native screens for commerce
        screens/
          ProductList.tsx
          ProductDetail.tsx
          Cart.tsx
          Checkout.tsx
          Login.tsx
          Register.tsx
          Account.tsx
          OrderDetail.tsx
        hooks/
          useProducts.ts
          useCart.ts
          useCheckout.ts
          useCustomerAuth.ts
        components/
          ProductCard.tsx
          CartItem.tsx
          PriceDisplay.tsx
        index.ts                   # Screen registry export
```

### Templates

```
templates/
  shop-mobile/                     # NEW: React Native commerce template
    app/                           # Expo Router file-based routing
    components/
    providers/
    package.json                   # depends on @emdash-cms/mobile-core
```

Additional templates (blog-mobile, portfolio-mobile) added as demand warrants. Start with one.

---

## 8. WebView Management

### Preloading Strategy (Shopify Pattern)

```typescript
// On app launch, after config loads:
const pluginWebViews = config.plugins
  .filter(p => !p.native && p.mobile?.entryUrl)
  .slice(0, 3);  // preload top 3

for (const plugin of pluginWebViews) {
  WebViewPool.preload({
    pluginId: plugin.id,
    url: `${siteUrl}${plugin.mobile.entryUrl}`,
    bridgeContext: currentBridgeContext
  });
}
```

### WebView Lifecycle

```
preload → hidden, authenticated, HTML loaded
show    → move to foreground, attach to navigation
dismiss → move to background, keep in memory (5 min TTL)
return  → instant, no reload
expire  → destroy after TTL, reclaim memory
```

### URL Interception

When a WebView navigates to a known native route, intercept and open natively:

```typescript
const NATIVE_ROUTES = {
  "/shop": "commerce:product-list",
  "/shop/:slug": "commerce:product-detail",
  "/shop/cart": "commerce:cart",
  "/shop/checkout": "commerce:checkout",
};

// In WebView onNavigationStateChange:
const nativeScreen = matchRoute(url, NATIVE_ROUTES);
if (nativeScreen) {
  navigation.navigate(nativeScreen.screen, nativeScreen.params);
  return false;  // cancel WebView navigation
}
```

---

## 9. Push Notifications

### Architecture

```
EmDash Server                    Push Service              Mobile App
     │                               │                         │
     │  commerce:order:created       │                         │
     │  (plugin hook fires)          │                         │
     │                               │                         │
     │  POST /push/send              │                         │
     │  { token, title, body }       │                         │
     │──────────────────────────────>│                         │
     │                               │  FCM / APNs            │
     │                               │────────────────────────>│
     │                               │                         │
     │                               │                         │  Display
     │                               │                         │  notification
     │                               │                         │
     │                               │                         │  User taps
     │                               │                         │  → deep link
     │                               │                         │  → order screen
```

### Core Changes for Push

**New database table**: `_emdash_push_devices`

| Column | Type | Purpose |
|--------|------|---------|
| id | text PK | ULID |
| user_id | text FK | Admin user or null |
| customer_id | text | Commerce customer or null |
| push_token | text | FCM/APNs token |
| platform | text | "ios" or "android" |
| created_at | text | Timestamp |
| last_seen_at | text | Last app open |

**New hook**: `push:send`

```typescript
"push:send": {
  input: {
    userId?: string;
    customerToken?: string;
    title: string;
    body: string;
    data?: Record<string, string>;  // deep link params
  };
  output: void;
}
```

Plugins fire this hook to send push notifications. A push delivery plugin (FCM, APNs, or a service like OneSignal) handles actual delivery via the exclusive hook pattern.

**New API endpoints**:

| Endpoint | Purpose |
|----------|---------|
| `POST /_emdash/api/push/register` | Register device push token |
| `DELETE /_emdash/api/push/register` | Unregister device |

---

## 10. Payments

### Physical Goods (Commerce Plugin)

No App Store restrictions. Integrate payment SDKs natively:

- **Stripe**: `@stripe/stripe-react-native` for card + Apple Pay + Google Pay
- **PayPal**: `@paypal/react-native-paypal`
- Payment provider configured via commerce plugin settings

### Digital Goods

Must use Apple In-App Purchase / Google Play Billing. This is a separate concern from the commerce plugin and would require a dedicated IAP plugin if needed.

### Commerce Plugin Payment Hook

The commerce plugin already has a `paymentProvider` placeholder in checkout. Extend it:

```typescript
// In commerce plugin definition
hooks: {
  "commerce:payment:process": async (ctx) => {
    // Native app sends payment method token from Stripe SDK
    // Plugin processes payment server-side
    // Returns success/failure
  }
}
```

The native checkout screen collects payment via Stripe's native UI, sends the payment method token to the server, and the commerce plugin processes it.

---

## 11. Phased Delivery

### Phase 1: Prove the Architecture

| Deliverable | Details |
|-------------|---------|
| Core: App Config API | `GET /app/config` + `app:config` hook + `mobile` plugin field |
| Core: Mobile Auth | Magic link flow → API token for mobile |
| Core: App Bridge script injection | Auto-inject when `X-EmDash-App` header present |
| Core: Push device registration | Table + register/unregister endpoints |
| Core: Image transform endpoint | `?w=&h=&fit=` query params on media file endpoint |
| Mobile: Expo app shell | Navigation, providers, config fetching |
| Mobile: Commerce native screens | Product list, product detail, cart, checkout (no payments), account |
| Mobile: WebView container | Bridge injection, auth sharing, preloading |
| Mobile: `shop-mobile` template | First React Native template |

**Exit criteria**: A user installs the commerce plugin, runs `create-emdash` with the `shop-mobile` template, and has a working native shopping app. Third-party plugins open in WebView with shared auth.

### Phase 2: Production-Ready

| Deliverable | Details |
|-------------|---------|
| Stripe payment integration | Native checkout with Apple Pay / Google Pay |
| Push notifications | FCM/APNs delivery via push plugin |
| Offline cart persistence | AsyncStorage + sync on reconnect |
| Portable Text RN renderer | 8 core block types as React Native components |
| Deep linking | `emdash://` scheme + universal links |
| Dark mode | Theme toggle with `app:config` support |

### Phase 3: Ecosystem

| Deliverable | Details |
|-------------|---------|
| App Bridge JS SDK npm package | `@emdash-cms/app-bridge` for third-party plugin authors |
| Bridge documentation | Protocol reference for plugin authors |
| WebView → Native event system | Richer communication (camera, scanner, file picker) |
| Additional templates | blog-mobile, portfolio-mobile |
| App Store submission guide | Documentation for publishing EmDash mobile apps |

---

## 12. Summary of Core Changes

| Area | Change | Files Affected |
|------|--------|---------------|
| **Plugin types** | Add `mobile?: PluginMobileConfig` to `PluginDefinition` | `plugins/types.ts` |
| **Plugin manifest** | Add `mobile` to `PluginManifest` | `plugins/manifest.ts` |
| **Hooks** | Add `app:config` hook type | `plugins/hooks.ts` |
| **API route** | New `GET /api/app/config` | `astro/routes/api/app/config.ts` |
| **API routes** | New mobile auth endpoints (4 routes) | `astro/routes/api/auth/mobile/*.ts` |
| **API routes** | New push device registration (2 routes) | `astro/routes/api/push/*.ts` |
| **API route** | Image transform on media file endpoint | `astro/routes/api/media/file.ts` |
| **Middleware** | Detect mobile app requests, inject App Bridge script | `astro/middleware.ts` |
| **Database** | New `_emdash_push_devices` table | `database/migrations/0XX_push_devices.ts` |
| **Route registration** | Register all new routes | `astro/integration/routes.ts` |
| **Plugin CLI** | Include `mobile` field in `plugin bundle` | `cli/commands/plugin.ts` |

**Total new API routes**: 7 (1 config + 4 auth + 2 push)
**New database tables**: 1 (`_emdash_push_devices`)
**New hooks**: 2 (`app:config`, `push:send`)
**Modified types**: 2 (`PluginDefinition`, `PluginManifest`)
