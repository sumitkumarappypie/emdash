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

## 8. Plugin Dependency Model (Shopify Pattern)

Following Shopify's approach, plugins fall into two strict categories:

### First-party plugins → Native code, monorepo

First-party plugins (commerce, forms, etc.) live in the EmDash monorepo. Their mobile screens are React Native `.tsx` files that share the shell's dependency tree. There is no "install plugin deps" step — it's all one codebase, one `node_modules`, one build.

```
packages/
  mobile/              ← shell app (depends on shared deps)
  plugins/commerce/    ← first-party, same monorepo
    src/mobile/        ← native screens, uses same react-native/react-query/etc.
  plugins/forms/       ← first-party, same monorepo
    src/mobile/        ← native screens
```

If a first-party plugin needs a new native module (e.g., a maps plugin needing `react-native-maps`), it gets added to the shell's `package.json` — because they share the same build. This is exactly how Shopify manages native features across teams in their monorepo.

### Third-party plugins → WebView only (Phase 2)

Third-party developers **never ship native code** into the app. They build web pages that run inside the shell's managed WebView via App Bridge. The dependency problem doesn't exist because third-party code is just HTML/JS loaded at a URL at runtime.

This is the core Shopify insight: you can't let arbitrary third-party code into your native build. WebView is the sandbox.

### Summary

| Plugin type | Code location | Dependencies | Native access |
|---|---|---|---|
| First-party | Monorepo (`packages/plugins/*/src/mobile/`) | Shared with shell | Full React Native |
| Third-party | External URL | None (web only) | Via App Bridge postMessage |

---

## 9. Commerce Plugin Mobile Package

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

## 10. Dependencies

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

### Tamagui (UI Component Library)

```
tamagui: ^1.120.0
@tamagui/config: ^1.120.0
@tamagui/font-inter: ^1.120.0
```

Tamagui v1 stable — verified with Expo SDK 52. Provides themed components (Button, Card, Input, Sheet, XStack, YStack, etc.) and a token-based theme system that maps directly to our `/app/config` theme colors.

---

## 11. Tamagui Theme Integration

### How `/app/config` theme maps to Tamagui tokens

The shell's ThemeProvider creates a Tamagui theme from the server's `ThemeColors`:

```typescript
// Map AppConfig theme → Tamagui theme tokens
function buildTamaguiTheme(colors: ThemeColors) {
  return {
    background: colors.background,
    backgroundHover: colors.surface,
    backgroundPress: colors.surface,
    color: colors.text,
    colorHover: colors.text,
    colorPress: colors.text,
    borderColor: colors.surface,
    placeholderColor: colors.textMuted,
    // Semantic tokens
    primary: colors.primary,
    secondary: colors.secondary,
    surface: colors.surface,
    textMuted: colors.textMuted,
    error: colors.error,
    success: colors.success,
  };
}
```

Each white-label customer gets different colors from their EmDash deployment's `/app/config`, and the entire UI automatically re-themes.

### Component usage in screens

Plugin screens use Tamagui components instead of raw `View`/`Text`/`Pressable`:

```tsx
// Before (raw RN)
<View style={[styles.card, { backgroundColor: theme.surface }]}>
  <Text style={[styles.name, { color: theme.text }]}>{product.name}</Text>
  <Pressable style={[styles.button, { backgroundColor: theme.primary }]}>
    <Text style={{ color: "#fff" }}>Add to Cart</Text>
  </Pressable>
</View>

// After (Tamagui)
<Card padded elevate>
  <Text fontSize="$5" fontWeight="600">{product.name}</Text>
  <Button theme="primary" onPress={handleAdd}>Add to Cart</Button>
</Card>
```

Tamagui handles theming, hover/press states, animations, and platform consistency automatically.

---

## 12. White-Label Build System

### Per-customer configuration

Static config uses `app.config.ts` (replaces `app.json`) with environment variables:

```typescript
// app.config.ts
export default {
  name: process.env.APP_NAME || "EmDash",
  slug: process.env.APP_SLUG || "emdash-mobile",
  version: process.env.APP_VERSION || "0.1.0",
  scheme: process.env.APP_SCHEME || "emdash",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  icon: process.env.APP_ICON || "./assets/icon.png",
  splash: {
    image: process.env.APP_SPLASH || "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: process.env.APP_SPLASH_BG || "#ffffff",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: process.env.APP_IOS_BUNDLE || "com.emdash.mobile",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: process.env.APP_ANDROID_ICON || "./assets/adaptive-icon.png",
      backgroundColor: process.env.APP_SPLASH_BG || "#ffffff",
    },
    package: process.env.APP_ANDROID_PACKAGE || "com.emdash.mobile",
  },
  plugins: ["expo-router", "expo-secure-store"],
  experiments: { typedRoutes: true },
};
```

### GitHub Actions build pipeline

```yaml
# .github/workflows/build-mobile.yml (simplified)
jobs:
  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { java-version: "17" }
      - run: pnpm install
      - run: |
          cd packages/mobile
          APP_NAME="${{ inputs.app_name }}" \
          APP_ANDROID_PACKAGE="${{ inputs.android_package }}" \
          EXPO_PUBLIC_EMDASH_URL="${{ inputs.emdash_url }}" \
          npx expo prebuild --platform android --clean
      - run: |
          cd packages/mobile/android
          ./gradlew assembleRelease
      - uses: actions/upload-artifact@v4
        with:
          name: android-apk
          path: packages/mobile/android/app/build/outputs/apk/release/*.apk

  build-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: |
          cd packages/mobile
          APP_NAME="${{ inputs.app_name }}" \
          APP_IOS_BUNDLE="${{ inputs.ios_bundle }}" \
          EXPO_PUBLIC_EMDASH_URL="${{ inputs.emdash_url }}" \
          npx expo prebuild --platform ios --clean
      - run: |
          cd packages/mobile/ios
          xcodebuild -workspace EmDash.xcworkspace \
            -scheme EmDash -configuration Release \
            -archivePath build/EmDash.xcarchive archive
```

Each customer triggers a build with their own env vars → unique branded APK/IPA.

### What stays dynamic (runtime) vs static (build-time)

| Aspect | When it's set | Source |
|---|---|---|
| App name, icon, splash, bundle ID | **Build-time** (env vars → `expo prebuild`) | GitHub Actions inputs |
| Theme colors, branding, site name | **Runtime** (`/app/config`) | EmDash server |
| Tabs, plugin screens, features | **Runtime** (`/app/config`) | EmDash server |

This means a customer can change their theme colors without rebuilding the app. They only need a rebuild for app name/icon/bundle ID changes.

---

## 13. Error Handling

| Scenario | Handling |
|---|---|
| Config fetch fails | Retry screen with "Could not connect" message and retry button |
| Plugin screen throws | React error boundary wraps plugin screens, shows "Something went wrong" with back button |
| API errors in plugin | Plugin handles via React Query retries and error states |
| Auth token expired | AuthProvider detects 401, clears token, shows login |
| Network offline | React Query pauses, UI shows offline indicator |

---

## 14. What Phase 2 Adds (no refactoring)

| Feature | How it fits |
|---|---|
| WebView container | New `WebViewScreen` component, rendered when `plugin.mobile.native === false` |
| App Bridge | `postMessage` protocol in WebViewScreen, injects `window.__EMDASH_BRIDGE__` |
| Third-party plugins | Config already has `entryUrl` field, registry falls through to WebView |
| Push notifications | New provider, expo-notifications, register endpoint |
| Deep linking | Expo Router handles `emdash://` scheme natively |

None of these require changes to the Phase 1 shell architecture.

---

## 15. Files to Create

| File | Purpose |
|---|---|
| `app.config.ts` | Dynamic Expo config with env vars for white-label |
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
| `lib/tamagui.config.ts` | Tamagui theme config with dynamic token mapping |
| `.github/workflows/build-mobile.yml` | GitHub Actions build pipeline for white-label APK/IPA |
