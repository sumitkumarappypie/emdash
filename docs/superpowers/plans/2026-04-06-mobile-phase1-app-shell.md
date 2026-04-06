# Mobile Phase 1 Part 2: App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the Expo (React Native) app shell with dynamic tab navigation, shared providers (auth, theme, config, cart), API client, and a managed WebView container for third-party plugins.

**Architecture:** Expo SDK 52 + Expo Router (file-based routing) + React Query for data fetching. The app fetches `/app/config` on launch to discover installed plugins and build navigation dynamically. First-party plugin screens are imported at build time. Third-party plugins open in a WebView with bridge handler. Auth uses core customer endpoints with tokens stored in Expo SecureStore.

**Tech Stack:** Expo SDK 52, React Native 0.76, Expo Router, @tanstack/react-query, react-native-webview, expo-secure-store, TypeScript.

**Spec:** `docs/superpowers/specs/2026-04-06-emdash-mobile-architecture-design.md`

**Depends on:** Phase 1 Part 1 (core changes) — all server endpoints must exist.

---

## File Map

### New Package: `packages/mobile/`

| File | Responsibility |
|------|---------------|
| `package.json` | Expo project config + dependencies |
| `app.json` | Expo app config (name, scheme, plugins) |
| `tsconfig.json` | TypeScript config |
| `app/_layout.tsx` | Root layout — Stack navigator + providers |
| `app/(tabs)/_layout.tsx` | Tab navigator — built from app config |
| `app/(tabs)/index.tsx` | Home screen |
| `app/(tabs)/shop.tsx` | Commerce product list (native) |
| `app/(tabs)/cart.tsx` | Commerce cart (native) |
| `app/(tabs)/account.tsx` | Customer account (native) |
| `app/product/[slug].tsx` | Product detail (native, stack screen) |
| `app/checkout.tsx` | Checkout (native, stack screen) |
| `app/login.tsx` | Customer login/register |
| `app/plugin/[id].tsx` | WebView container for third-party plugins |
| `lib/api.ts` | HTTP client for EmDash API |
| `lib/types.ts` | Shared TypeScript types (AppConfig, Product, Cart, etc.) |
| `providers/ConfigProvider.tsx` | App config from server (site, theme, plugins) |
| `providers/AuthProvider.tsx` | Customer auth state + SecureStore |
| `providers/ThemeProvider.tsx` | Theme colors from config |
| `providers/CartProvider.tsx` | Cart state (create, add, update, remove) |
| `components/WebViewScreen.tsx` | Managed WebView with bridge handler |
| `components/ProductCard.tsx` | Product card for grid/list display |
| `components/CartItem.tsx` | Cart line item with quantity controls |
| `components/PriceDisplay.tsx` | Formatted price with currency |
| `components/LoadingScreen.tsx` | Full-screen loading indicator |
| `hooks/useProducts.ts` | React Query hooks for product API |
| `hooks/useCart.ts` | React Query hooks for cart API |

---

## Task 1: Initialize Expo Project

**Files:**
- Create: `packages/mobile/package.json`
- Create: `packages/mobile/app.json`
- Create: `packages/mobile/tsconfig.json`
- Create: `packages/mobile/.gitignore`

- [ ] **Step 1: Create the package directory**

```bash
mkdir -p packages/mobile
```

- [ ] **Step 2: Create package.json**

Create `packages/mobile/package.json`:

```json
{
  "name": "@emdash-cms/mobile",
  "version": "0.1.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "ios": "expo start --ios",
    "android": "expo start --android",
    "web": "expo start --web",
    "lint": "expo lint"
  },
  "dependencies": {
    "@expo/vector-icons": "^14.0.0",
    "@tanstack/react-query": "^5.60.0",
    "expo": "~52.0.0",
    "expo-constants": "~17.0.0",
    "expo-linking": "~7.0.0",
    "expo-router": "~4.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-status-bar": "~2.0.0",
    "react": "18.3.1",
    "react-native": "0.76.6",
    "react-native-safe-area-context": "~4.12.0",
    "react-native-screens": "~4.4.0",
    "react-native-webview": "13.12.5"
  },
  "devDependencies": {
    "@types/react": "~18.3.0",
    "typescript": "~5.3.3"
  }
}
```

- [ ] **Step 3: Create app.json**

Create `packages/mobile/app.json`:

```json
{
  "expo": {
    "name": "EmDash",
    "slug": "emdash-mobile",
    "version": "0.1.0",
    "scheme": "emdash",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.emdash.mobile"
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#ffffff"
      },
      "package": "com.emdash.mobile"
    },
    "plugins": ["expo-router", "expo-secure-store"],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

- [ ] **Step 4: Create tsconfig.json**

Create `packages/mobile/tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 5: Create .gitignore**

Create `packages/mobile/.gitignore`:

```
node_modules/
.expo/
dist/
*.jks
*.p8
*.p12
*.key
*.mobileprovision
*.orig.*
web-build/
```

- [ ] **Step 6: Install dependencies**

```bash
cd packages/mobile && npm install
```

- [ ] **Step 7: Commit**

```bash
git add packages/mobile/package.json packages/mobile/app.json packages/mobile/tsconfig.json packages/mobile/.gitignore
git commit -m "feat(mobile): initialize Expo project for mobile app shell"
```

---

## Task 2: API Client + Types

**Files:**
- Create: `packages/mobile/lib/api.ts`
- Create: `packages/mobile/lib/types.ts`

- [ ] **Step 1: Create shared types**

Create `packages/mobile/lib/types.ts`:

```typescript
export interface AppConfig {
	site: {
		name: string;
		url: string;
		locale: string;
	};
	theme: ThemeColors;
	plugins: AppPlugin[];
	navigation: {
		tabs: AppTab[];
	};
	features: Record<string, boolean>;
}

export interface ThemeColors {
	primary: string;
	secondary: string;
	background: string;
	surface: string;
	text: string;
	textMuted: string;
	error: string;
	success: string;
}

export interface AppPlugin {
	id: string;
	name: string;
	version: string;
	native: boolean;
	mobile?: {
		native?: boolean;
		entryUrl?: string;
		label?: string;
		icon?: string;
		tabs?: AppTab[];
	};
}

export interface AppTab {
	key: string;
	label: string;
	icon: string;
	screen: string;
	badge?: string;
}

export interface Customer {
	id: string;
	email: string;
	name: string;
	status: string;
	created_at: string;
}

export interface AuthState {
	customer: Customer | null;
	token: string | null;
	loading: boolean;
}

export interface Product {
	id: string;
	slug: string;
	name: string;
	description?: string;
	price: number;
	compareAtPrice?: number;
	images: string[];
	status: string;
	productType: string;
	variants?: ProductVariant[];
}

export interface ProductVariant {
	id: string;
	name: string;
	sku?: string;
	price: number;
	inventoryQuantity: number;
}

export interface CartItem {
	id: string;
	productId: string;
	variantId?: string;
	name: string;
	variantName?: string;
	image?: string;
	quantity: number;
	unitPrice: number;
	total: number;
}

export interface Cart {
	id: string;
	items: CartItem[];
	subtotal: number;
	itemCount: number;
}

export interface ListResponse<T> {
	items: T[];
	nextCursor?: string;
}
```

- [ ] **Step 2: Create API client**

Create `packages/mobile/lib/api.ts`:

```typescript
import type { AppConfig, Cart, Customer, ListResponse, Product } from "./types";

let baseUrl = "";
let authToken: string | null = null;

export function setBaseUrl(url: string): void {
	baseUrl = url.replace(/\/$/, "");
}

export function setAuthToken(token: string | null): void {
	authToken = token;
}

async function request<T>(
	path: string,
	options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
	const { method = "GET", body, auth = true } = options;

	const headers: Record<string, string> = {
		"X-EmDash-Request": "1",
		"X-EmDash-App": "1",
	};

	if (body) {
		headers["Content-Type"] = "application/json";
	}

	if (auth && authToken) {
		headers["Authorization"] = `Bearer ${authToken}`;
	}

	const response = await fetch(`${baseUrl}/_emdash/api${path}`, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined,
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new ApiError(
			error?.error?.message || `Request failed: ${response.status}`,
			error?.error?.code || "REQUEST_FAILED",
			response.status,
		);
	}

	const json = await response.json();
	return json.data ?? json;
}

export class ApiError extends Error {
	constructor(
		message: string,
		public code: string,
		public status: number,
	) {
		super(message);
		this.name = "ApiError";
	}
}

// Plugin API helper (commerce routes use POST with body)
async function pluginRequest<T>(pluginId: string, route: string, body?: unknown): Promise<T> {
	return request<T>(`/plugins/${pluginId}/${route}`, {
		method: "POST",
		body: body ?? {},
	});
}

// ── App Config ────────────────────────────────────────

export async function fetchAppConfig(): Promise<AppConfig> {
	return request<AppConfig>("/app/config", { auth: false });
}

// ── Customer Auth ─────────────────────────────────────

export async function registerCustomer(input: {
	email: string;
	name: string;
	password: string;
}): Promise<{ customer: Customer; token: string }> {
	return request("/customers/register", { method: "POST", body: input, auth: false });
}

export async function loginCustomer(input: {
	email: string;
	password: string;
}): Promise<{ customer: Customer; token: string }> {
	return request("/customers/login", { method: "POST", body: input, auth: false });
}

export async function validateSession(): Promise<{ customer: Customer }> {
	return request("/customers/session");
}

export async function logoutCustomer(): Promise<void> {
	await request("/customers/logout", { method: "POST" });
}

// ── Public Content ────────────────────────────────────

export async function fetchPublicContent<T = unknown>(
	collection: string,
	params?: { slug?: string; limit?: number; cursor?: string },
): Promise<T> {
	const query = new URLSearchParams();
	if (params?.slug) query.set("slug", params.slug);
	if (params?.limit) query.set("limit", String(params.limit));
	if (params?.cursor) query.set("cursor", params.cursor);
	const qs = query.toString();
	return request<T>(`/public/content/${collection}${qs ? `?${qs}` : ""}`, { auth: false });
}

// ── Commerce: Products ────────────────────────────────

export async function fetchProducts(params?: {
	limit?: number;
	cursor?: string;
}): Promise<ListResponse<Product>> {
	return pluginRequest("commerce", "products/list", {
		status: "active",
		limit: params?.limit ?? 20,
		cursor: params?.cursor,
	});
}

export async function fetchProduct(slug: string): Promise<Product> {
	const result = await pluginRequest<{ product: Product }>("commerce", "products/get", { slug });
	return result.product;
}

// ── Commerce: Cart ────────────────────────────────────

export async function createCart(): Promise<Cart> {
	return pluginRequest("commerce", "cart/create", {});
}

export async function fetchCart(cartId: string): Promise<Cart> {
	return pluginRequest("commerce", "cart/get", { cartId });
}

export async function addToCart(
	cartId: string,
	productId: string,
	quantity: number,
	variantId?: string,
): Promise<Cart> {
	return pluginRequest("commerce", "cart/add-item", {
		cartId,
		productId,
		variantId,
		quantity,
	});
}

export async function updateCartItem(itemId: string, quantity: number): Promise<Cart> {
	return pluginRequest("commerce", "cart/update-item", { itemId, quantity });
}

export async function removeCartItem(itemId: string): Promise<Cart> {
	return pluginRequest("commerce", "cart/remove-item", { itemId });
}

// ── Commerce: Checkout ────────────────────────────────

export async function createCheckout(params: {
	cartId: string;
	email: string;
	name: string;
	notes?: string;
}): Promise<{ order: unknown }> {
	return pluginRequest("commerce", "checkout/create", params);
}

// ── Push Notifications ────────────────────────────────

export async function registerPushDevice(pushToken: string, platform: "ios" | "android"): Promise<void> {
	await request("/push/register", {
		method: "POST",
		body: { pushToken, platform },
	});
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/mobile/lib/
git commit -m "feat(mobile): add API client and shared TypeScript types"
```

---

## Task 3: Providers (Config, Auth, Theme, Cart)

**Files:**
- Create: `packages/mobile/providers/ConfigProvider.tsx`
- Create: `packages/mobile/providers/AuthProvider.tsx`
- Create: `packages/mobile/providers/ThemeProvider.tsx`
- Create: `packages/mobile/providers/CartProvider.tsx`

- [ ] **Step 1: Create ConfigProvider**

Create `packages/mobile/providers/ConfigProvider.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { fetchAppConfig, setBaseUrl } from "@/lib/api";
import type { AppConfig } from "@/lib/types";

interface ConfigContextValue {
	config: AppConfig | null;
	loading: boolean;
	error: string | null;
	reload: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextValue>({
	config: null,
	loading: true,
	error: null,
	reload: async () => {},
});

export function useConfig(): ConfigContextValue {
	return useContext(ConfigContext);
}

// Set this before the provider mounts
const SITE_URL = process.env.EXPO_PUBLIC_EMDASH_URL ?? "http://localhost:4321";

export function ConfigProvider({ children }: { children: ReactNode }) {
	const [config, setConfig] = useState<AppConfig | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = async () => {
		try {
			setLoading(true);
			setError(null);
			setBaseUrl(SITE_URL);
			const data = await fetchAppConfig();
			setConfig(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load config");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	return (
		<ConfigContext.Provider value={{ config, loading, error, reload: load }}>
			{children}
		</ConfigContext.Provider>
	);
}
```

- [ ] **Step 2: Create AuthProvider**

Create `packages/mobile/providers/AuthProvider.tsx`:

```tsx
import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import {
	loginCustomer,
	logoutCustomer,
	registerCustomer,
	setAuthToken,
	validateSession,
} from "@/lib/api";
import type { AuthState, Customer } from "@/lib/types";

interface AuthContextValue extends AuthState {
	login: (email: string, password: string) => Promise<void>;
	register: (email: string, name: string, password: string) => Promise<void>;
	logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
	customer: null,
	token: null,
	loading: true,
	login: async () => {},
	register: async () => {},
	logout: async () => {},
});

export function useAuth(): AuthContextValue {
	return useContext(AuthContext);
}

const TOKEN_KEY = "emdash_customer_token";

export function AuthProvider({ children }: { children: ReactNode }) {
	const [customer, setCustomer] = useState<Customer | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	// Restore session on mount
	useEffect(() => {
		(async () => {
			try {
				const stored = await SecureStore.getItemAsync(TOKEN_KEY);
				if (stored) {
					setAuthToken(stored);
					const { customer: c } = await validateSession();
					setCustomer(c);
					setToken(stored);
				}
			} catch {
				// Token expired or invalid — clear it
				await SecureStore.deleteItemAsync(TOKEN_KEY);
				setAuthToken(null);
			} finally {
				setLoading(false);
			}
		})();
	}, []);

	const login = useCallback(async (email: string, password: string) => {
		const result = await loginCustomer({ email, password });
		await SecureStore.setItemAsync(TOKEN_KEY, result.token);
		setAuthToken(result.token);
		setToken(result.token);
		setCustomer(result.customer);
	}, []);

	const register = useCallback(async (email: string, name: string, password: string) => {
		const result = await registerCustomer({ email, name, password });
		await SecureStore.setItemAsync(TOKEN_KEY, result.token);
		setAuthToken(result.token);
		setToken(result.token);
		setCustomer(result.customer);
	}, []);

	const logout = useCallback(async () => {
		try {
			await logoutCustomer();
		} catch {
			// Ignore errors — we're clearing local state either way
		}
		await SecureStore.deleteItemAsync(TOKEN_KEY);
		setAuthToken(null);
		setToken(null);
		setCustomer(null);
	}, []);

	return (
		<AuthContext.Provider value={{ customer, token, loading, login, register, logout }}>
			{children}
		</AuthContext.Provider>
	);
}
```

- [ ] **Step 3: Create ThemeProvider**

Create `packages/mobile/providers/ThemeProvider.tsx`:

```tsx
import { createContext, useContext, type ReactNode } from "react";
import { StyleSheet } from "react-native";

import { useConfig } from "./ConfigProvider";
import type { ThemeColors } from "@/lib/types";

const DEFAULT_THEME: ThemeColors = {
	primary: "#3B82F6",
	secondary: "#6366F1",
	background: "#FFFFFF",
	surface: "#F9FAFB",
	text: "#111827",
	textMuted: "#6B7280",
	error: "#EF4444",
	success: "#10B981",
};

const ThemeContext = createContext<ThemeColors>(DEFAULT_THEME);

export function useTheme(): ThemeColors {
	return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
	const { config } = useConfig();
	const theme = config?.theme ?? DEFAULT_THEME;

	return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

// Helper to create themed styles
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
	factory: (theme: ThemeColors) => T,
): T {
	const theme = useTheme();
	return StyleSheet.create(factory(theme));
}
```

- [ ] **Step 4: Create CartProvider**

Create `packages/mobile/providers/CartProvider.tsx`:

```tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import * as api from "@/lib/api";
import type { Cart } from "@/lib/types";

interface CartContextValue {
	cart: Cart | null;
	loading: boolean;
	addItem: (productId: string, quantity: number, variantId?: string) => Promise<void>;
	updateItem: (itemId: string, quantity: number) => Promise<void>;
	removeItem: (itemId: string) => Promise<void>;
	refresh: () => Promise<void>;
	clear: () => Promise<void>;
}

const CartContext = createContext<CartContextValue>({
	cart: null,
	loading: false,
	addItem: async () => {},
	updateItem: async () => {},
	removeItem: async () => {},
	refresh: async () => {},
	clear: async () => {},
});

export function useCart(): CartContextValue {
	return useContext(CartContext);
}

const CART_ID_KEY = "emdash_cart_id";

export function CartProvider({ children }: { children: ReactNode }) {
	const [cart, setCart] = useState<Cart | null>(null);
	const [cartId, setCartId] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	// Restore cart on mount
	useEffect(() => {
		(async () => {
			const stored = await AsyncStorage.getItem(CART_ID_KEY);
			if (stored) {
				setCartId(stored);
				try {
					const c = await api.fetchCart(stored);
					setCart(c);
				} catch {
					// Cart expired — clear it
					await AsyncStorage.removeItem(CART_ID_KEY);
				}
			}
		})();
	}, []);

	const ensureCart = useCallback(async (): Promise<string> => {
		if (cartId) return cartId;
		const newCart = await api.createCart();
		const id = newCart.id;
		await AsyncStorage.setItem(CART_ID_KEY, id);
		setCartId(id);
		setCart(newCart);
		return id;
	}, [cartId]);

	const addItem = useCallback(
		async (productId: string, quantity: number, variantId?: string) => {
			setLoading(true);
			try {
				const id = await ensureCart();
				const updated = await api.addToCart(id, productId, quantity, variantId);
				setCart(updated);
			} finally {
				setLoading(false);
			}
		},
		[ensureCart],
	);

	const updateItem = useCallback(async (itemId: string, quantity: number) => {
		setLoading(true);
		try {
			const updated = await api.updateCartItem(itemId, quantity);
			setCart(updated);
		} finally {
			setLoading(false);
		}
	}, []);

	const removeItem = useCallback(async (itemId: string) => {
		setLoading(true);
		try {
			const updated = await api.removeCartItem(itemId);
			setCart(updated);
		} finally {
			setLoading(false);
		}
	}, []);

	const refresh = useCallback(async () => {
		if (!cartId) return;
		try {
			const c = await api.fetchCart(cartId);
			setCart(c);
		} catch {
			// ignore
		}
	}, [cartId]);

	const clear = useCallback(async () => {
		await AsyncStorage.removeItem(CART_ID_KEY);
		setCartId(null);
		setCart(null);
	}, []);

	return (
		<CartContext.Provider value={{ cart, loading, addItem, updateItem, removeItem, refresh, clear }}>
			{children}
		</CartContext.Provider>
	);
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/providers/
git commit -m "feat(mobile): add Config, Auth, Theme, and Cart providers"
```

---

## Task 4: Shared Components

**Files:**
- Create: `packages/mobile/components/LoadingScreen.tsx`
- Create: `packages/mobile/components/PriceDisplay.tsx`
- Create: `packages/mobile/components/ProductCard.tsx`
- Create: `packages/mobile/components/CartItem.tsx`

- [ ] **Step 1: Create LoadingScreen**

Create `packages/mobile/components/LoadingScreen.tsx`:

```tsx
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";

export function LoadingScreen() {
	const theme = useTheme();

	return (
		<View style={[styles.container, { backgroundColor: theme.background }]}>
			<ActivityIndicator size="large" color={theme.primary} />
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
});
```

- [ ] **Step 2: Create PriceDisplay**

Create `packages/mobile/components/PriceDisplay.tsx`:

```tsx
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";

interface PriceDisplayProps {
	price: number;
	compareAtPrice?: number;
	currency?: string;
	size?: "small" | "medium" | "large";
}

export function PriceDisplay({ price, compareAtPrice, currency = "USD", size = "medium" }: PriceDisplayProps) {
	const theme = useTheme();
	const fontSize = size === "small" ? 14 : size === "large" ? 24 : 18;

	const formatted = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(price);

	const compareFormatted = compareAtPrice
		? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(compareAtPrice)
		: null;

	return (
		<View style={styles.container}>
			<Text style={[styles.price, { color: theme.text, fontSize }]}>{formatted}</Text>
			{compareFormatted && (
				<Text style={[styles.comparePrice, { color: theme.textMuted, fontSize: fontSize - 4 }]}>
					{compareFormatted}
				</Text>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flexDirection: "row", alignItems: "baseline", gap: 6 },
	price: { fontWeight: "700" },
	comparePrice: { textDecorationLine: "line-through" },
});
```

- [ ] **Step 3: Create ProductCard**

Create `packages/mobile/components/ProductCard.tsx`:

```tsx
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import type { Product } from "@/lib/types";
import { PriceDisplay } from "./PriceDisplay";

interface ProductCardProps {
	product: Product;
	onPress: () => void;
}

export function ProductCard({ product, onPress }: ProductCardProps) {
	const theme = useTheme();
	const imageUri = product.images[0];

	return (
		<Pressable
			style={[styles.card, { backgroundColor: theme.surface }]}
			onPress={onPress}
		>
			{imageUri ? (
				<Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
			) : (
				<View style={[styles.image, styles.placeholder, { backgroundColor: theme.background }]}>
					<Text style={{ color: theme.textMuted }}>No image</Text>
				</View>
			)}
			<View style={styles.info}>
				<Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
					{product.name}
				</Text>
				<PriceDisplay price={product.price} compareAtPrice={product.compareAtPrice} size="small" />
			</View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	card: {
		flex: 1,
		borderRadius: 12,
		overflow: "hidden",
		margin: 6,
	},
	image: {
		width: "100%",
		aspectRatio: 1,
	},
	placeholder: {
		justifyContent: "center",
		alignItems: "center",
	},
	info: {
		padding: 10,
		gap: 4,
	},
	name: {
		fontSize: 14,
		fontWeight: "600",
	},
});
```

- [ ] **Step 4: Create CartItem**

Create `packages/mobile/components/CartItem.tsx`:

```tsx
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import type { CartItem as CartItemType } from "@/lib/types";
import { PriceDisplay } from "./PriceDisplay";

interface CartItemProps {
	item: CartItemType;
	onUpdateQuantity: (quantity: number) => void;
	onRemove: () => void;
}

export function CartItemRow({ item, onUpdateQuantity, onRemove }: CartItemProps) {
	const theme = useTheme();

	return (
		<View style={[styles.row, { borderBottomColor: theme.surface }]}>
			{item.image ? (
				<Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
			) : (
				<View style={[styles.image, { backgroundColor: theme.surface }]} />
			)}
			<View style={styles.info}>
				<Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
					{item.name}
				</Text>
				{item.variantName && (
					<Text style={[styles.variant, { color: theme.textMuted }]}>{item.variantName}</Text>
				)}
				<PriceDisplay price={item.total} size="small" />
			</View>
			<View style={styles.controls}>
				<View style={styles.quantity}>
					<Pressable
						onPress={() => (item.quantity > 1 ? onUpdateQuantity(item.quantity - 1) : onRemove())}
						style={[styles.qtyButton, { borderColor: theme.textMuted }]}
					>
						<Text style={{ color: theme.text }}>-</Text>
					</Pressable>
					<Text style={[styles.qtyText, { color: theme.text }]}>{item.quantity}</Text>
					<Pressable
						onPress={() => onUpdateQuantity(item.quantity + 1)}
						style={[styles.qtyButton, { borderColor: theme.textMuted }]}
					>
						<Text style={{ color: theme.text }}>+</Text>
					</Pressable>
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		padding: 12,
		borderBottomWidth: 1,
		gap: 12,
	},
	image: { width: 64, height: 64, borderRadius: 8 },
	info: { flex: 1, justifyContent: "center", gap: 2 },
	name: { fontSize: 15, fontWeight: "600" },
	variant: { fontSize: 13 },
	controls: { justifyContent: "center" },
	quantity: { flexDirection: "row", alignItems: "center", gap: 10 },
	qtyButton: {
		width: 28,
		height: 28,
		borderRadius: 14,
		borderWidth: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	qtyText: { fontSize: 15, fontWeight: "600", minWidth: 20, textAlign: "center" },
});
```

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/components/
git commit -m "feat(mobile): add shared UI components (LoadingScreen, ProductCard, CartItem, PriceDisplay)"
```

---

## Task 5: WebView Container with Bridge Handler

**Files:**
- Create: `packages/mobile/components/WebViewScreen.tsx`

- [ ] **Step 1: Create WebViewScreen**

Create `packages/mobile/components/WebViewScreen.tsx`:

```tsx
import { useNavigation, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { useAuth } from "@/providers/AuthProvider";
import { useConfig } from "@/providers/ConfigProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { useCart } from "@/providers/CartProvider";
import { LoadingScreen } from "./LoadingScreen";

interface WebViewScreenProps {
	url: string;
	title?: string;
}

interface BridgeMessage {
	type: string;
	id: string;
	method: string;
	params: Record<string, unknown>;
}

export function WebViewScreen({ url, title }: WebViewScreenProps) {
	const theme = useTheme();
	const { config } = useConfig();
	const { token } = useAuth();
	const { cart } = useCart();
	const router = useRouter();
	const navigation = useNavigation();
	const webViewRef = useRef<WebView>(null);

	useEffect(() => {
		if (title) {
			navigation.setOptions({ title });
		}
	}, [title, navigation]);

	const siteUrl = config?.site.url ?? "";
	const fullUrl = url.startsWith("http") ? url : `${siteUrl}${url}`;

	// Bridge context injected before page loads
	const bridgeContext = JSON.stringify({
		version: 1,
		auth: { customerToken: token },
		theme,
		site: config?.site ?? { name: "", url: "", locale: "en" },
		device: {
			platform: Platform.OS,
			colorScheme: "light",
			safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 },
		},
		cart: cart ? { id: cart.id, itemCount: cart.itemCount } : null,
	});

	const injectedJS = `window.__EMDASH_BRIDGE__ = ${bridgeContext}; true;`;

	const handleMessage = (event: WebViewMessageEvent) => {
		try {
			const data: BridgeMessage = JSON.parse(event.nativeEvent.data);
			if (data.type !== "emdash-bridge") return;

			switch (data.method) {
				case "navigate":
					router.push(data.params.screen as string);
					break;
				case "dismiss":
					router.back();
					break;
				case "setTitle":
					navigation.setOptions({ title: data.params.title as string });
					break;
				case "toast":
					// Phase 2: native toast
					console.log("[Bridge Toast]", data.params.message);
					break;
				case "updateCartBadge":
					// Phase 2: update tab badge
					break;
				case "getAuth":
					sendResponse(data.id, { customerToken: token });
					break;
				case "ready":
					// Page loaded
					break;
				default:
					console.log("[Bridge] Unknown method:", data.method);
			}
		} catch {
			// Ignore non-bridge messages
		}
	};

	const sendResponse = (id: string, result: unknown) => {
		const js = `window.postMessage(${JSON.stringify({
			type: "emdash-bridge-response",
			id,
			result,
		})});`;
		webViewRef.current?.injectJavaScript(js);
	};

	return (
		<View style={[styles.container, { backgroundColor: theme.background }]}>
			<WebView
				ref={webViewRef}
				source={{
					uri: fullUrl,
					headers: {
						"X-EmDash-App": "1",
						"User-Agent": `EmDashApp/1.0 (${Platform.OS})`,
					},
				}}
				injectedJavaScriptBeforeContentLoaded={injectedJS}
				onMessage={handleMessage}
				startInLoadingState
				renderLoading={() => <LoadingScreen />}
				style={styles.webview}
				allowsBackForwardNavigationGestures
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	webview: { flex: 1 },
});
```

- [ ] **Step 2: Commit**

```bash
git add packages/mobile/components/WebViewScreen.tsx
git commit -m "feat(mobile): add WebView container with App Bridge handler"
```

---

## Task 6: Root Layout + Tab Navigation

**Files:**
- Create: `packages/mobile/app/_layout.tsx`
- Create: `packages/mobile/app/(tabs)/_layout.tsx`
- Create: `packages/mobile/app/(tabs)/index.tsx`
- Create: `packages/mobile/app/(tabs)/shop.tsx`
- Create: `packages/mobile/app/(tabs)/cart.tsx`
- Create: `packages/mobile/app/(tabs)/account.tsx`
- Create: `packages/mobile/app/login.tsx`
- Create: `packages/mobile/app/product/[slug].tsx`
- Create: `packages/mobile/app/checkout.tsx`
- Create: `packages/mobile/app/plugin/[id].tsx`

- [ ] **Step 1: Create root layout with providers**

Create `packages/mobile/app/_layout.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AuthProvider } from "@/providers/AuthProvider";
import { CartProvider } from "@/providers/CartProvider";
import { ConfigProvider, useConfig } from "@/providers/ConfigProvider";
import { ThemeProvider, useTheme } from "@/providers/ThemeProvider";
import { LoadingScreen } from "@/components/LoadingScreen";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 5 * 60 * 1000,
			retry: 2,
		},
	},
});

function AppContent() {
	const { loading, error } = useConfig();
	const theme = useTheme();

	if (loading) return <LoadingScreen />;

	if (error) {
		// Config failed — show basic app anyway
		console.warn("Failed to load app config:", error);
	}

	return (
		<>
			<StatusBar style="auto" />
			<Stack
				screenOptions={{
					headerStyle: { backgroundColor: theme.background },
					headerTintColor: theme.text,
					contentStyle: { backgroundColor: theme.background },
				}}
			>
				<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
				<Stack.Screen name="login" options={{ title: "Sign In", presentation: "modal" }} />
				<Stack.Screen name="product/[slug]" options={{ title: "" }} />
				<Stack.Screen name="checkout" options={{ title: "Checkout" }} />
				<Stack.Screen name="plugin/[id]" options={{ title: "" }} />
			</Stack>
		</>
	);
}

export default function RootLayout() {
	return (
		<QueryClientProvider client={queryClient}>
			<ConfigProvider>
				<ThemeProvider>
					<AuthProvider>
						<CartProvider>
							<AppContent />
						</CartProvider>
					</AuthProvider>
				</ThemeProvider>
			</ConfigProvider>
		</QueryClientProvider>
	);
}
```

- [ ] **Step 2: Create tab layout**

Create `packages/mobile/app/(tabs)/_layout.tsx`:

```tsx
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs } from "expo-router";

import { useCart } from "@/providers/CartProvider";
import { useConfig } from "@/providers/ConfigProvider";
import { useTheme } from "@/providers/ThemeProvider";

const ICON_MAP: Record<string, keyof typeof FontAwesome.glyphMap> = {
	home: "home",
	store: "shopping-bag",
	cart: "shopping-cart",
	user: "user",
	gift: "gift",
	search: "search",
	heart: "heart",
	star: "star",
	list: "list",
};

function getIcon(name: string): keyof typeof FontAwesome.glyphMap {
	return ICON_MAP[name] ?? "circle";
}

export default function TabLayout() {
	const theme = useTheme();
	const { config } = useConfig();
	const { cart } = useCart();

	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: theme.primary,
				tabBarInactiveTintColor: theme.textMuted,
				tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.surface },
				headerStyle: { backgroundColor: theme.background },
				headerTintColor: theme.text,
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: config?.site.name ?? "Home",
					tabBarIcon: ({ color }) => <FontAwesome name="home" size={22} color={color} />,
				}}
			/>
			<Tabs.Screen
				name="shop"
				options={{
					title: "Shop",
					tabBarIcon: ({ color }) => <FontAwesome name="shopping-bag" size={22} color={color} />,
				}}
			/>
			<Tabs.Screen
				name="cart"
				options={{
					title: "Cart",
					tabBarBadge: cart && cart.itemCount > 0 ? cart.itemCount : undefined,
					tabBarIcon: ({ color }) => <FontAwesome name="shopping-cart" size={22} color={color} />,
				}}
			/>
			<Tabs.Screen
				name="account"
				options={{
					title: "Account",
					tabBarIcon: ({ color }) => <FontAwesome name="user" size={22} color={color} />,
				}}
			/>
		</Tabs>
	);
}
```

- [ ] **Step 3: Create Home tab screen**

Create `packages/mobile/app/(tabs)/index.tsx`:

```tsx
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useConfig } from "@/providers/ConfigProvider";
import { useTheme } from "@/providers/ThemeProvider";

export default function HomeScreen() {
	const theme = useTheme();
	const { config } = useConfig();
	const router = useRouter();

	return (
		<ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
			<View style={styles.hero}>
				<Text style={[styles.siteName, { color: theme.text }]}>
					{config?.site.name ?? "EmDash"}
				</Text>
				<Text style={[styles.subtitle, { color: theme.textMuted }]}>
					Welcome to your store
				</Text>
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	hero: { padding: 24, paddingTop: 40, alignItems: "center", gap: 8 },
	siteName: { fontSize: 28, fontWeight: "800" },
	subtitle: { fontSize: 16 },
});
```

- [ ] **Step 4: Create Shop tab (product list)**

Create `packages/mobile/app/(tabs)/shop.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";

import { fetchProducts } from "@/lib/api";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ProductCard } from "@/components/ProductCard";
import { useTheme } from "@/providers/ThemeProvider";

export default function ShopScreen() {
	const theme = useTheme();
	const router = useRouter();

	const { data, isLoading } = useQuery({
		queryKey: ["products"],
		queryFn: () => fetchProducts({ limit: 20 }),
	});

	if (isLoading) return <LoadingScreen />;

	return (
		<View style={[styles.container, { backgroundColor: theme.background }]}>
			<FlatList
				data={data?.items ?? []}
				numColumns={2}
				keyExtractor={(item) => item.id}
				contentContainerStyle={styles.list}
				renderItem={({ item }) => (
					<ProductCard
						product={item}
						onPress={() => router.push(`/product/${item.slug}`)}
					/>
				)}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	list: { padding: 6 },
});
```

- [ ] **Step 5: Create Cart tab**

Create `packages/mobile/app/(tabs)/cart.tsx`:

```tsx
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { CartItemRow } from "@/components/CartItem";
import { PriceDisplay } from "@/components/PriceDisplay";
import { useCart } from "@/providers/CartProvider";
import { useTheme } from "@/providers/ThemeProvider";

export default function CartScreen() {
	const theme = useTheme();
	const router = useRouter();
	const { cart, updateItem, removeItem } = useCart();

	if (!cart || cart.items.length === 0) {
		return (
			<View style={[styles.empty, { backgroundColor: theme.background }]}>
				<Text style={[styles.emptyText, { color: theme.textMuted }]}>Your cart is empty</Text>
			</View>
		);
	}

	return (
		<View style={[styles.container, { backgroundColor: theme.background }]}>
			<FlatList
				data={cart.items}
				keyExtractor={(item) => item.id}
				renderItem={({ item }) => (
					<CartItemRow
						item={item}
						onUpdateQuantity={(qty) => updateItem(item.id, qty)}
						onRemove={() => removeItem(item.id)}
					/>
				)}
			/>
			<View style={[styles.footer, { borderTopColor: theme.surface }]}>
				<View style={styles.subtotalRow}>
					<Text style={[styles.subtotalLabel, { color: theme.textMuted }]}>Subtotal</Text>
					<PriceDisplay price={cart.subtotal} size="large" />
				</View>
				<Pressable
					style={[styles.checkoutButton, { backgroundColor: theme.primary }]}
					onPress={() => router.push("/checkout")}
				>
					<Text style={styles.checkoutText}>Checkout</Text>
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	empty: { flex: 1, justifyContent: "center", alignItems: "center" },
	emptyText: { fontSize: 16 },
	footer: { padding: 16, borderTopWidth: 1, gap: 12 },
	subtotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
	subtotalLabel: { fontSize: 16 },
	checkoutButton: { borderRadius: 12, padding: 16, alignItems: "center" },
	checkoutText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
```

- [ ] **Step 6: Create Account tab**

Create `packages/mobile/app/(tabs)/account.tsx`:

```tsx
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";

export default function AccountScreen() {
	const theme = useTheme();
	const { customer, logout } = useAuth();
	const router = useRouter();

	if (!customer) {
		return (
			<View style={[styles.container, { backgroundColor: theme.background }]}>
				<Text style={[styles.heading, { color: theme.text }]}>Account</Text>
				<Text style={[styles.subtitle, { color: theme.textMuted }]}>
					Sign in to view your orders and manage your account.
				</Text>
				<Pressable
					style={[styles.button, { backgroundColor: theme.primary }]}
					onPress={() => router.push("/login")}
				>
					<Text style={styles.buttonText}>Sign In</Text>
				</Pressable>
			</View>
		);
	}

	return (
		<View style={[styles.container, { backgroundColor: theme.background }]}>
			<Text style={[styles.heading, { color: theme.text }]}>{customer.name}</Text>
			<Text style={[styles.subtitle, { color: theme.textMuted }]}>{customer.email}</Text>

			<Pressable
				style={[styles.outlineButton, { borderColor: theme.error }]}
				onPress={async () => {
					await logout();
				}}
			>
				<Text style={[styles.outlineText, { color: theme.error }]}>Sign Out</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 24, gap: 12 },
	heading: { fontSize: 24, fontWeight: "800" },
	subtitle: { fontSize: 15 },
	button: { borderRadius: 12, padding: 16, alignItems: "center", marginTop: 16 },
	buttonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
	outlineButton: {
		borderRadius: 12,
		padding: 16,
		alignItems: "center",
		marginTop: 24,
		borderWidth: 1,
	},
	outlineText: { fontSize: 17, fontWeight: "600" },
});
```

- [ ] **Step 7: Create Login screen**

Create `packages/mobile/app/login.tsx`:

```tsx
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { ApiError } from "@/lib/api";

export default function LoginScreen() {
	const theme = useTheme();
	const router = useRouter();
	const { login, register } = useAuth();

	const [mode, setMode] = useState<"login" | "register">("login");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async () => {
		setError("");
		setLoading(true);
		try {
			if (mode === "register") {
				await register(email, name, password);
			} else {
				await login(email, password);
			}
			router.back();
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Something went wrong");
		} finally {
			setLoading(false);
		}
	};

	return (
		<View style={[styles.container, { backgroundColor: theme.background }]}>
			<Text style={[styles.heading, { color: theme.text }]}>
				{mode === "login" ? "Sign In" : "Create Account"}
			</Text>

			{error ? <Text style={[styles.error, { color: theme.error }]}>{error}</Text> : null}

			{mode === "register" && (
				<TextInput
					style={[styles.input, { color: theme.text, borderColor: theme.surface, backgroundColor: theme.surface }]}
					placeholder="Name"
					placeholderTextColor={theme.textMuted}
					value={name}
					onChangeText={setName}
					autoCapitalize="words"
				/>
			)}

			<TextInput
				style={[styles.input, { color: theme.text, borderColor: theme.surface, backgroundColor: theme.surface }]}
				placeholder="Email"
				placeholderTextColor={theme.textMuted}
				value={email}
				onChangeText={setEmail}
				autoCapitalize="none"
				keyboardType="email-address"
			/>

			<TextInput
				style={[styles.input, { color: theme.text, borderColor: theme.surface, backgroundColor: theme.surface }]}
				placeholder="Password"
				placeholderTextColor={theme.textMuted}
				value={password}
				onChangeText={setPassword}
				secureTextEntry
			/>

			<Pressable
				style={[styles.button, { backgroundColor: theme.primary, opacity: loading ? 0.6 : 1 }]}
				onPress={handleSubmit}
				disabled={loading}
			>
				<Text style={styles.buttonText}>{loading ? "..." : mode === "login" ? "Sign In" : "Create Account"}</Text>
			</Pressable>

			<Pressable onPress={() => setMode(mode === "login" ? "register" : "login")}>
				<Text style={[styles.switchText, { color: theme.primary }]}>
					{mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
				</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 24, gap: 14 },
	heading: { fontSize: 28, fontWeight: "800", marginBottom: 8 },
	error: { fontSize: 14, padding: 12, borderRadius: 8 },
	input: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 16 },
	button: { borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
	buttonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
	switchText: { fontSize: 14, textAlign: "center", marginTop: 8 },
});
```

- [ ] **Step 8: Create Product Detail screen**

Create `packages/mobile/app/product/[slug].tsx`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchProduct } from "@/lib/api";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PriceDisplay } from "@/components/PriceDisplay";
import { useCart } from "@/providers/CartProvider";
import { useTheme } from "@/providers/ThemeProvider";

export default function ProductDetailScreen() {
	const theme = useTheme();
	const { slug } = useLocalSearchParams<{ slug: string }>();
	const { addItem } = useCart();

	const { data: product, isLoading } = useQuery({
		queryKey: ["product", slug],
		queryFn: () => fetchProduct(slug),
		enabled: !!slug,
	});

	if (isLoading || !product) return <LoadingScreen />;

	const imageUri = product.images[0];

	return (
		<ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
			{imageUri ? (
				<Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
			) : (
				<View style={[styles.image, { backgroundColor: theme.surface }]} />
			)}
			<View style={styles.content}>
				<Text style={[styles.name, { color: theme.text }]}>{product.name}</Text>
				<PriceDisplay price={product.price} compareAtPrice={product.compareAtPrice} size="large" />

				{product.description ? (
					<Text style={[styles.description, { color: theme.textMuted }]}>
						{product.description}
					</Text>
				) : null}

				<Pressable
					style={[styles.addButton, { backgroundColor: theme.primary }]}
					onPress={() => addItem(product.id, 1)}
				>
					<Text style={styles.addButtonText}>Add to Cart</Text>
				</Pressable>
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	image: { width: "100%", aspectRatio: 1 },
	content: { padding: 20, gap: 12 },
	name: { fontSize: 24, fontWeight: "800" },
	description: { fontSize: 15, lineHeight: 22 },
	addButton: { borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
	addButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
```

- [ ] **Step 9: Create Checkout screen**

Create `packages/mobile/app/checkout.tsx`:

```tsx
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { createCheckout } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { useCart } from "@/providers/CartProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { PriceDisplay } from "@/components/PriceDisplay";

export default function CheckoutScreen() {
	const theme = useTheme();
	const router = useRouter();
	const { customer } = useAuth();
	const { cart, clear } = useCart();

	const [name, setName] = useState(customer?.name ?? "");
	const [email, setEmail] = useState(customer?.email ?? "");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);

	if (!cart || cart.items.length === 0) {
		return (
			<View style={[styles.empty, { backgroundColor: theme.background }]}>
				<Text style={{ color: theme.textMuted }}>Your cart is empty</Text>
			</View>
		);
	}

	if (success) {
		return (
			<View style={[styles.empty, { backgroundColor: theme.background }]}>
				<Text style={[styles.successHeading, { color: theme.success }]}>Order Placed!</Text>
				<Text style={{ color: theme.textMuted }}>Thank you for your purchase.</Text>
				<Pressable
					style={[styles.button, { backgroundColor: theme.primary, marginTop: 24 }]}
					onPress={() => router.replace("/")}
				>
					<Text style={styles.buttonText}>Continue Shopping</Text>
				</Pressable>
			</View>
		);
	}

	const handleCheckout = async () => {
		setError("");
		setLoading(true);
		try {
			await createCheckout({ cartId: cart.id, email, name });
			await clear();
			setSuccess(true);
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Checkout failed");
		} finally {
			setLoading(false);
		}
	};

	return (
		<ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
			<View style={styles.section}>
				<Text style={[styles.sectionTitle, { color: theme.text }]}>Contact</Text>
				<TextInput
					style={[styles.input, { color: theme.text, backgroundColor: theme.surface }]}
					placeholder="Name"
					placeholderTextColor={theme.textMuted}
					value={name}
					onChangeText={setName}
				/>
				<TextInput
					style={[styles.input, { color: theme.text, backgroundColor: theme.surface }]}
					placeholder="Email"
					placeholderTextColor={theme.textMuted}
					value={email}
					onChangeText={setEmail}
					keyboardType="email-address"
					autoCapitalize="none"
				/>
			</View>

			<View style={styles.section}>
				<Text style={[styles.sectionTitle, { color: theme.text }]}>Order Summary</Text>
				{cart.items.map((item) => (
					<View key={item.id} style={styles.summaryRow}>
						<Text style={[styles.summaryName, { color: theme.text }]}>
							{item.name} x{item.quantity}
						</Text>
						<PriceDisplay price={item.total} size="small" />
					</View>
				))}
				<View style={[styles.totalRow, { borderTopColor: theme.surface }]}>
					<Text style={[styles.totalLabel, { color: theme.text }]}>Total</Text>
					<PriceDisplay price={cart.subtotal} size="large" />
				</View>
			</View>

			{error ? <Text style={[styles.error, { color: theme.error }]}>{error}</Text> : null}

			<Pressable
				style={[styles.button, { backgroundColor: theme.primary, opacity: loading ? 0.6 : 1 }]}
				onPress={handleCheckout}
				disabled={loading}
			>
				<Text style={styles.buttonText}>{loading ? "Placing Order..." : "Place Order"}</Text>
			</Pressable>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 20 },
	empty: { flex: 1, justifyContent: "center", alignItems: "center" },
	successHeading: { fontSize: 24, fontWeight: "800", marginBottom: 8 },
	section: { marginBottom: 24, gap: 10 },
	sectionTitle: { fontSize: 18, fontWeight: "700" },
	input: { borderRadius: 10, padding: 14, fontSize: 16 },
	summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
	summaryName: { fontSize: 15 },
	totalRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, paddingTop: 12, marginTop: 8 },
	totalLabel: { fontSize: 17, fontWeight: "700" },
	error: { fontSize: 14, marginBottom: 12 },
	button: { borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 40 },
	buttonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
```

- [ ] **Step 10: Create Plugin WebView screen**

Create `packages/mobile/app/plugin/[id].tsx`:

```tsx
import { useLocalSearchParams } from "expo-router";

import { WebViewScreen } from "@/components/WebViewScreen";
import { useConfig } from "@/providers/ConfigProvider";

export default function PluginScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { config } = useConfig();

	const plugin = config?.plugins.find((p) => p.id === id);
	const entryUrl = plugin?.mobile?.entryUrl ?? "/";
	const title = plugin?.mobile?.label ?? plugin?.name ?? "Plugin";

	return <WebViewScreen url={entryUrl} title={title} />;
}
```

- [ ] **Step 11: Commit**

```bash
git add packages/mobile/app/
git commit -m "feat(mobile): add all screens — tabs, product detail, checkout, login, plugin WebView"
```

---

## Task 7: React Query Hooks

**Files:**
- Create: `packages/mobile/hooks/useProducts.ts`
- Create: `packages/mobile/hooks/useCart.ts`

- [ ] **Step 1: Create product hooks**

Create `packages/mobile/hooks/useProducts.ts`:

```typescript
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { fetchProduct, fetchProducts } from "@/lib/api";

export function useProductList() {
	return useInfiniteQuery({
		queryKey: ["products"],
		queryFn: ({ pageParam }) => fetchProducts({ limit: 20, cursor: pageParam }),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.nextCursor,
	});
}

export function useProduct(slug: string) {
	return useQuery({
		queryKey: ["product", slug],
		queryFn: () => fetchProduct(slug),
		enabled: !!slug,
	});
}
```

- [ ] **Step 2: Create cart hooks**

Create `packages/mobile/hooks/useCart.ts`:

```typescript
// Re-export the CartProvider hook for convenience
// Cart state is managed by CartProvider, not React Query,
// because cart mutations need to be synchronous and shared across screens.
export { useCart } from "@/providers/CartProvider";
```

- [ ] **Step 3: Commit**

```bash
git add packages/mobile/hooks/
git commit -m "feat(mobile): add React Query hooks for products and cart"
```

---

## Verification

After all 7 tasks:

- [ ] **Verify the project structure**:

```bash
ls packages/mobile/app/(tabs)/
# Expected: _layout.tsx  account.tsx  cart.tsx  index.tsx  shop.tsx

ls packages/mobile/app/
# Expected: (tabs)/  _layout.tsx  checkout.tsx  login.tsx  plugin/  product/

ls packages/mobile/lib/
# Expected: api.ts  types.ts

ls packages/mobile/providers/
# Expected: AuthProvider.tsx  CartProvider.tsx  ConfigProvider.tsx  ThemeProvider.tsx

ls packages/mobile/components/
# Expected: CartItem.tsx  LoadingScreen.tsx  PriceDisplay.tsx  ProductCard.tsx  WebViewScreen.tsx
```

- [ ] **Install and start**:

```bash
cd packages/mobile
npm install
npx expo start
```

- [ ] **Test on simulator**: Open iOS simulator or Android emulator, scan QR code or press `i`/`a`.

### What the app does after this plan

1. Launches → fetches `/app/config` → applies theme
2. Shows tab bar: Home, Shop, Cart, Account
3. Shop tab → fetches products from commerce plugin → renders grid
4. Tap product → product detail with "Add to Cart"
5. Cart tab → shows items with quantity controls → Checkout button
6. Checkout → collects name/email → places order
7. Account → sign in/register/sign out
8. Plugin WebView → opens third-party plugin at entryUrl with bridge injected

### What's NOT in this plan (separate follow-up)

- `shop-mobile` template (wraps this into `create-emdash` template)
- Infinite scroll pagination on product list
- Search screen
- Push notification registration
- Offline caching
- Dark mode toggle
- Image optimization (using `?w=` params)
