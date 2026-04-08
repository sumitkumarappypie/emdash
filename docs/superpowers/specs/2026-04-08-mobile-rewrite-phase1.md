# EmDash Mobile App Rewrite — Phase 1

**Date**: 2026-04-08
**Status**: Design
**Author**: Sumit Tiwari + Claude

---

## 1. Overview

A clean rewrite of the EmDash mobile app following the Shopify plugin architecture: the shell provides only infrastructure (auth, theme, config, navigation), and each plugin owns its screens, business logic, cart, and checkout.

**Phase 1 scope:** Native plugin screens only. WebView bridge for third-party plugins is Phase 2 (additive, no refactoring required).

**What changed from the original spec:**
- Per-plugin cart instead of unified cart (each plugin manages its own cart/checkout)
- Shell has zero commerce knowledge — no CartProvider, no product types
- Development build (`expo-dev-client`) instead of Expo Go
- Simplified tab model — Home + plugin tabs + Account (no core Cart tab)

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                EmDash Mobile Shell                    │
│             (Expo Router + Dev Client)                │
│                                                      │
│  Providers (infrastructure only):                    │
│  ┌─────────┐ ┌───────┐ ┌──────┐ ┌──────────────┐   │
│  │ Config  │ │ Theme │ │ Auth │ │ PluginState  │   │
│  └────┬────┘ └───┬───┘ └──┬───┘ └──────┬───────┘   │
│       └──────────┴────────┴────────────┘            │
│                      │                               │
│  Dynamic Tabs (from /app/config):                    │
│  ┌──────┐ ┌──────────┐ ┌─────────┐                  │
│  │ Home │ │ Shop ... │ │ Account │                  │
│  └──┬───┘ └────┬─────┘ └────┬────┘                  │
│     │          │             │                       │
│  Screen Registry:                                    │
│  ┌──────────────────────────────────────────────┐   │
│  │  "commerce:product-list" → ProductListScreen  │   │
│  │  "commerce:product-detail" → ProductDetail    │   │
│  │  "commerce:cart" → CartScreen                 │   │
│  │  "commerce:checkout" → CheckoutScreen         │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────┘
                           │ HTTPS
               ┌───────────┴───────────┐
               │   EmDash Server       │
               │   /_emdash/api/*      │
               └───────────────────────┘
```

### Design Principles

1. **Shell knows nothing about plugins.** No product types, no cart logic, no commerce imports.
2. **Tabs are config-driven.** The `/app/config` response determines what tabs appear.
3. **Plugin screens are self-contained.** They own their API client, state, and UI.
4. **Shell passes infrastructure via `PluginScreenProps`.** This is the only contract.
5. **Per-plugin cart.** Each plugin that supports cart owns its cart/checkout flow. Shell only shows a contextual cart icon with a badge count.

---

## 3. Shell Providers

### ConfigProvider
- Fetches `GET /_emdash/api/app/config` on mount
- Stores `AppConfig` (site info, theme, plugins, navigation, features)
- Exposes: `config`, `loading`, `error`, `reload()`
- Uses `EXPO_PUBLIC_EMDASH_URL` env var for base URL

### ThemeProvider
- Reads `config.theme` from ConfigProvider
- Provides 8 color tokens: primary, secondary, background, surface, text, textMuted, error, success
- Falls back to default theme if config hasn't loaded

### AuthProvider
- Manages customer auth (email/password login via existing commerce endpoints)
- Stores token in `expo-secure-store`
- Exposes: `customer`, `token`, `loading`, `login()`, `logout()`
- Sets auth token on the shell API client

### PluginProvider
- Tracks per-plugin state: `{ [pluginId]: { cartBadge: number } }`
- Tracks which plugin is currently active (for contextual cart icon)
- Exposes: `setActivePlugin()`, `updatePluginBadge()`, `getPluginState()`
- Initializes plugin API clients on config load (calls each plugin's `configure*Api()`)

---

## 4. Navigation & Routing

### Tab Assembly

Tabs are built from `/app/config`:

| Position | Source | Examples |
|---|---|---|
| First | Always "Home" (shell-owned) | Home |
| Middle | `plugins[].mobile.tabs[]` | Shop, Menu, Rewards |
| Last | Always "Account" (shell-owned) | Account |

### Expo Router File Structure

```
app/
  _layout.tsx          → Root providers + Stack navigator
  (tabs)/
    _layout.tsx        → Dynamic tab bar built from config
    index.tsx          → Home screen (shell-owned, shows public content)
    account.tsx        → Account screen (shell-owned, login/profile)
    [plugin].tsx       → Renders any plugin tab screen via registry
  screen/
    [id].tsx           → Renders any plugin screen via registry (non-tab)
  login.tsx            → Login modal
```

### Screen Resolution Flow

1. **Tab press** — `(tabs)/[plugin].tsx` receives the tab's `screen` field (e.g., `"commerce:product-list"`) as the route param
2. **Plugin navigation** — plugin calls `navigate("commerce:product-detail", { slug: "blue-shirt" })`
3. **Shell pushes** — `screen/[id].tsx` receives `id="commerce:product-detail"` and `params={ slug: "blue-shirt" }`
4. **Registry lookup** — `registry[id]` returns the component, rendered with `PluginScreenProps`

### Contextual Cart Icon

- When `(tabs)/[plugin].tsx` mounts, it sets `activePlugin` in PluginProvider
- If `activePlugin` has `supportsCart: true`, the header shows a cart icon
- Badge count comes from `pluginState[pluginId].cartBadge`
- Tapping the cart icon navigates to the plugin's `cartScreen` (e.g., `"commerce:cart"`)
- When user is on Home or Account (no active plugin), cart icon is hidden

---

## 5. Screen Registry

```typescript
// lib/registry.ts
import type { ComponentType } from "react";
import type { PluginScreenProps } from "@emdash-cms/plugin-commerce/mobile";

// Static imports — one line per plugin
import { screens as commerceScreens } from "@emdash-cms/plugin-commerce/mobile";

// Merged registry
export const screenRegistry: Record<string, ComponentType<PluginScreenProps>> = {
  ...commerceScreens,
  // Future: ...formsScreens, ...bookingScreens
};

export function getScreen(id: string): ComponentType<PluginScreenProps> | undefined {
  return screenRegistry[id];
}
```

### Plugin Screen Contract (PluginScreenProps)

```typescript
interface PluginScreenProps {
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
  navigate: (screen: string, params?: Record<string, string>) => void;
  goBack: () => void;
  params: Record<string, string>;
  authToken: string | null;
  updateCartBadge: (count: number) => void;
}
```

This is the **only interface** between shell and plugin screens. Plugin screens never import shell providers.

---

## 6. Shell API Client (`lib/api.ts`)

The shell API client handles **only shell concerns**:

```typescript
// Configuration
setBaseUrl(url: string): void
setAuthToken(token: string | null): void

// App config
fetchAppConfig(): Promise<AppConfig>

// Customer auth
loginCustomer(email, password): Promise<{ customer, token }>
registerCustomer(email, name, password): Promise<{ customer, token }>
validateSession(): Promise<{ customer }>
logoutCustomer(): Promise<void>

// Public content (for Home screen)
fetchPublicContent(collection, params?): Promise<{ items, nextCursor? }>
```

**No commerce, cart, or product functions.** Plugins bring their own API clients.

---

## 7. Shell Types (`lib/types.ts`)

```typescript
// Only types the shell needs
interface AppConfig {
  site: { name: string; url: string; locale: string };
  theme: ThemeColors;
  plugins: AppPlugin[];
  navigation: { tabs: AppTab[] };
  features: Record<string, boolean>;
}

interface ThemeColors { /* 8 color tokens */ }

interface AppPlugin {
  id: string;
  name: string;
  version: string;
  mobile?: {
    native?: boolean;
    entryUrl?: string;
    label?: string;
    icon?: string;
    tabs?: AppTab[];
    supportsCart?: boolean;
    cartScreen?: string;
    cartBadgeKey?: string;
  };
}

interface AppTab {
  key: string;
  label: string;
  icon: string;
  screen: string;
  badge?: string;
}

interface Customer {
  id: string;
  email: string;
  name: string;
  status: string;
  created_at: string;
}

interface AuthState {
  customer: Customer | null;
  token: string | null;
  loading: boolean;
}
```

**No Product, Cart, CartItem types.** Those live in the commerce plugin package.

---

## 8. Commerce Plugin Mobile Package

Already built at `packages/plugins/commerce/src/mobile/`. Self-contained:

- **`api/client.ts`** — Commerce-specific API client (`configureCommerceApi()`, `fetchProducts()`, `addToCart()`, etc.)
- **`screens/`** — ProductList, ProductDetail, Cart, Checkout
- **`types.ts`** — PluginScreenProps definition + commerce types (Product, Cart, CartItem)
- **`index.ts`** — Screen registry export

The shell calls `configureCommerceApi({ baseUrl, getAuthToken })` during plugin initialization. After that, commerce screens handle everything themselves.

### Metro/Babel Resolution

Commerce screens are in `@emdash-cms/plugin-commerce` package. Metro can't resolve `exports` field, so we use babel `module-resolver`:

```javascript
// babel.config.js
plugins: [
  ["module-resolver", {
    alias: {
      "@emdash-cms/plugin-commerce/mobile":
        "../../plugins/commerce/src/mobile/index.ts"
    }
  }]
]
```

---

## 9. Dependencies

```json
{
  "dependencies": {
    "@expo/vector-icons": "~14.0.4",
    "@react-native-async-storage/async-storage": "1.23.1",
    "@tanstack/react-query": "^5.60.0",
    "expo": "~52.0.0",
    "expo-dev-client": "~5.0.20",
    "expo-constants": "~17.0.0",
    "expo-linking": "~7.0.0",
    "expo-router": "~4.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-status-bar": "~2.0.0",
    "react": "18.3.1",
    "react-native": "0.76.9",
    "react-native-safe-area-context": "~4.12.0",
    "react-native-screens": "~4.4.0",
    "react-native-webview": "13.12.5"
  },
  "devDependencies": {
    "@babel/runtime": "^7.26.0",
    "@types/react": "~18.3.0",
    "babel-plugin-module-resolver": "^5.0.3",
    "typescript": "~5.3.3"
  }
}
```

All versions pinned to Expo SDK 52 compatible. `expo-dev-client` included from day one.

---

## 10. Error Handling

| Scenario | Handling |
|---|---|
| Config fetch fails | Retry screen with "Could not connect" message and retry button |
| Plugin screen throws | React error boundary wraps plugin screens, shows "Something went wrong" with back button |
| API errors in plugin | Plugin handles via React Query retries and error states |
| Auth token expired | AuthProvider detects 401, clears token, shows login |
| Network offline | React Query pauses, UI shows offline indicator |

---

## 11. What Phase 2 Adds (no refactoring)

| Feature | How it fits |
|---|---|
| WebView container | New `WebViewScreen` component, rendered when `plugin.mobile.native === false` |
| App Bridge | `postMessage` protocol in WebViewScreen, injects `window.__EMDASH_BRIDGE__` |
| Third-party plugins | Config already has `entryUrl` field, registry falls through to WebView |
| Push notifications | New provider, expo-notifications, register endpoint |
| Deep linking | Expo Router handles `emdash://` scheme natively |

None of these require changes to the Phase 1 shell architecture.

---

## 12. Files to Create

| File | Purpose |
|---|---|
| `app.json` | Expo config with `expo-dev-client` |
| `babel.config.js` | Module resolver for plugin imports |
| `tsconfig.json` | TypeScript config with `@/` alias |
| `package.json` | Dependencies (SDK 52 compatible) |
| `app/_layout.tsx` | Root: QueryClient + providers + Stack + error boundary |
| `app/(tabs)/_layout.tsx` | Dynamic tab bar from config |
| `app/(tabs)/index.tsx` | Home screen (public content) |
| `app/(tabs)/account.tsx` | Login/profile |
| `app/(tabs)/[plugin].tsx` | Plugin tab screen renderer |
| `app/screen/[id].tsx` | Plugin screen renderer (non-tab) |
| `app/login.tsx` | Login modal |
| `lib/api.ts` | Shell API client (config, auth, content) |
| `lib/types.ts` | Shell types only |
| `lib/registry.ts` | Screen registry (static plugin imports) |
| `providers/ConfigProvider.tsx` | App config fetching + caching |
| `providers/ThemeProvider.tsx` | Theme colors from config |
| `providers/AuthProvider.tsx` | Customer auth + SecureStore |
| `providers/PluginProvider.tsx` | Plugin state + cart badge tracking |
| `components/LoadingScreen.tsx` | Loading spinner |
| `components/ErrorBoundary.tsx` | Catches plugin screen crashes |
