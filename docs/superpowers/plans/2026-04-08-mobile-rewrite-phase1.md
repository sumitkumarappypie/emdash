# Mobile App Rewrite (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the EmDash mobile app from scratch with a Shopify-style plugin architecture where the shell provides only infrastructure and plugins own their screens.

**Architecture:** Expo Router shell with 4 providers (Config, Theme, Auth, Plugin), dynamic tabs from `/app/config`, a static screen registry that maps plugin screen IDs to React Native components, and a development build via `expo-dev-client` (no Expo Go).

**Tech Stack:** Expo SDK 52, expo-router 4, expo-dev-client, React Query, expo-secure-store, React Native 0.76.9

**Spec:** `docs/superpowers/specs/2026-04-08-mobile-rewrite-phase1.md`

---

### Task 1: Clean slate — delete old mobile code and scaffold project config

**Files:**
- Delete: all files in `packages/mobile/` except `.env`
- Create: `packages/mobile/package.json`
- Create: `packages/mobile/app.json`
- Create: `packages/mobile/tsconfig.json`
- Create: `packages/mobile/babel.config.js`
- Create: `packages/mobile/.gitignore`

- [ ] **Step 1: Delete everything in packages/mobile except .env**

```bash
cd packages/mobile
# Preserve .env
cp .env /tmp/emdash-mobile-env-backup
# Remove all files
rm -rf app components hooks lib providers package.json package-lock.json tsconfig.json babel.config.js app.json node_modules android .expo
# Restore .env
cp /tmp/emdash-mobile-env-backup .env
```

- [ ] **Step 2: Create package.json**

```json
{
	"name": "@emdash-cms/mobile",
	"version": "0.1.0",
	"private": true,
	"main": "expo-router/entry",
	"scripts": {
		"start": "expo start",
		"android": "expo run:android",
		"ios": "expo run:ios",
		"web": "expo start --web",
		"lint": "expo lint"
	},
	"dependencies": {
		"@expo/vector-icons": "~14.0.4",
		"@react-native-async-storage/async-storage": "1.23.1",
		"@tanstack/react-query": "^5.60.0",
		"expo": "~52.0.0",
		"expo-constants": "~17.0.0",
		"expo-dev-client": "~5.0.20",
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

- [ ] **Step 3: Create app.json**

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

- [ ] **Step 5: Create babel.config.js**

```javascript
module.exports = function (api) {
	api.cache(true);
	return {
		presets: ["babel-preset-expo"],
		plugins: [
			[
				"module-resolver",
				{
					alias: {
						"@": ".",
						"@emdash-cms/plugin-commerce/mobile":
							"../../plugins/commerce/src/mobile/index.ts",
					},
				},
			],
		],
	};
};
```

- [ ] **Step 6: Create .gitignore**

```
node_modules/
.expo/
android/
ios/
dist/
npm-debug.*
*.jks
*.p8
*.p12
*.key
*.mobileprovision
*.orig.*
web-build/
```

- [ ] **Step 7: Install dependencies**

```bash
cd ../.. && pnpm install
```

- [ ] **Step 8: Commit**

```bash
git add packages/mobile/
git commit -m "chore(mobile): clean slate — delete old code, scaffold project config"
```

---

### Task 2: Shell types and API client

**Files:**
- Create: `packages/mobile/lib/types.ts`
- Create: `packages/mobile/lib/api.ts`

- [ ] **Step 1: Create lib/types.ts — shell-only types**

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
	mobile?: PluginMobileConfig;
}

export interface PluginMobileConfig {
	native?: boolean;
	entryUrl?: string;
	label?: string;
	icon?: string;
	tabs?: AppTab[];
	supportsCart?: boolean;
	cartScreen?: string;
	cartBadgeKey?: string;
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
```

- [ ] **Step 2: Create lib/api.ts — shell API client**

```typescript
import type { AppConfig, Customer } from "./types";

let baseUrl = "";
let authToken: string | null = null;

export function setBaseUrl(url: string): void {
	baseUrl = url.replace(/\/$/, "");
}

export function getBaseUrl(): string {
	return baseUrl;
}

export function setAuthToken(token: string | null): void {
	authToken = token;
}

export function getAuthToken(): string | null {
	return authToken;
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
			(error as { error?: { message?: string } })?.error?.message ||
				`Request failed: ${response.status}`,
			(error as { error?: { code?: string } })?.error?.code || "REQUEST_FAILED",
			response.status,
		);
	}

	const json = await response.json();
	return ((json as { data?: T }).data ?? json) as T;
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
```

- [ ] **Step 3: Commit**

```bash
git add packages/mobile/lib/
git commit -m "feat(mobile): add shell types and API client"
```

---

### Task 3: Shell providers — Config, Theme, Auth

**Files:**
- Create: `packages/mobile/providers/ConfigProvider.tsx`
- Create: `packages/mobile/providers/ThemeProvider.tsx`
- Create: `packages/mobile/providers/AuthProvider.tsx`

- [ ] **Step 1: Create providers/ConfigProvider.tsx**

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

- [ ] **Step 2: Create providers/ThemeProvider.tsx**

```tsx
import { createContext, useContext, type ReactNode } from "react";

import type { ThemeColors } from "@/lib/types";
import { useConfig } from "./ConfigProvider";

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
```

- [ ] **Step 3: Create providers/AuthProvider.tsx**

```tsx
import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import * as api from "@/lib/api";
import type { Customer } from "@/lib/types";

interface AuthContextValue {
	customer: Customer | null;
	token: string | null;
	loading: boolean;
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

const TOKEN_KEY = "emdash_auth_token";

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
					api.setAuthToken(stored);
					const { customer: c } = await api.validateSession();
					setToken(stored);
					setCustomer(c);
				}
			} catch {
				await SecureStore.deleteItemAsync(TOKEN_KEY);
				api.setAuthToken(null);
			} finally {
				setLoading(false);
			}
		})();
	}, []);

	const login = useCallback(async (email: string, password: string) => {
		const result = await api.loginCustomer({ email, password });
		await SecureStore.setItemAsync(TOKEN_KEY, result.token);
		api.setAuthToken(result.token);
		setToken(result.token);
		setCustomer(result.customer);
	}, []);

	const register = useCallback(async (email: string, name: string, password: string) => {
		const result = await api.registerCustomer({ email, name, password });
		await SecureStore.setItemAsync(TOKEN_KEY, result.token);
		api.setAuthToken(result.token);
		setToken(result.token);
		setCustomer(result.customer);
	}, []);

	const logout = useCallback(async () => {
		try {
			await api.logoutCustomer();
		} catch {
			// Ignore server errors on logout
		}
		await SecureStore.deleteItemAsync(TOKEN_KEY);
		api.setAuthToken(null);
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

- [ ] **Step 4: Commit**

```bash
git add packages/mobile/providers/
git commit -m "feat(mobile): add Config, Theme, Auth providers"
```

---

### Task 4: PluginProvider — plugin state, cart badges, API initialization

**Files:**
- Create: `packages/mobile/providers/PluginProvider.tsx`
- Create: `packages/mobile/lib/registry.ts`

- [ ] **Step 1: Create lib/registry.ts — screen registry**

```typescript
import type { ComponentType } from "react";

import { screens as commerceScreens, type PluginScreenProps } from "@emdash-cms/plugin-commerce/mobile";

export type { PluginScreenProps } from "@emdash-cms/plugin-commerce/mobile";

const screenRegistry: Record<string, ComponentType<PluginScreenProps>> = {
	...commerceScreens,
};

export function getScreen(id: string): ComponentType<PluginScreenProps> | undefined {
	return screenRegistry[id];
}
```

- [ ] **Step 2: Create providers/PluginProvider.tsx**

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { getBaseUrl, getAuthToken } from "@/lib/api";
import { useConfig } from "./ConfigProvider";
import type { AppPlugin } from "@/lib/types";

// Import plugin initializers
import { configureCommerceApi } from "@emdash-cms/plugin-commerce/mobile";

interface PluginState {
	cartBadge: number;
}

interface PluginContextValue {
	activePlugin: AppPlugin | null;
	setActivePlugin: (plugin: AppPlugin | null) => void;
	pluginState: Record<string, PluginState>;
	updatePluginBadge: (pluginId: string, count: number) => void;
}

const PluginContext = createContext<PluginContextValue>({
	activePlugin: null,
	setActivePlugin: () => {},
	pluginState: {},
	updatePluginBadge: () => {},
});

export function usePlugin(): PluginContextValue {
	return useContext(PluginContext);
}

export function PluginProvider({ children }: { children: ReactNode }) {
	const { config } = useConfig();
	const [activePlugin, setActivePlugin] = useState<AppPlugin | null>(null);
	const [pluginState, setPluginState] = useState<Record<string, PluginState>>({});

	// Initialize plugin API clients when config loads
	useEffect(() => {
		if (!config) return;

		const baseUrl = getBaseUrl();

		for (const plugin of config.plugins) {
			if (plugin.id === "commerce" && plugin.mobile?.native) {
				configureCommerceApi({ baseUrl, getAuthToken: () => getAuthToken() });
			}
			// Future plugins: add similar initialization here
		}
	}, [config]);

	const updatePluginBadge = useCallback((pluginId: string, count: number) => {
		setPluginState((prev) => ({
			...prev,
			[pluginId]: { ...prev[pluginId], cartBadge: count },
		}));
	}, []);

	const value = useMemo(
		() => ({ activePlugin, setActivePlugin, pluginState, updatePluginBadge }),
		[activePlugin, pluginState, updatePluginBadge],
	);

	return <PluginContext.Provider value={value}>{children}</PluginContext.Provider>;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/mobile/lib/registry.ts packages/mobile/providers/PluginProvider.tsx
git commit -m "feat(mobile): add screen registry and PluginProvider"
```

---

### Task 5: Shared components — LoadingScreen, ErrorBoundary

**Files:**
- Create: `packages/mobile/components/LoadingScreen.tsx`
- Create: `packages/mobile/components/ErrorBoundary.tsx`

- [ ] **Step 1: Create components/LoadingScreen.tsx**

```tsx
import { ActivityIndicator, StyleSheet, View } from "react-native";

export function LoadingScreen() {
	return (
		<View style={styles.container}>
			<ActivityIndicator size="large" color="#3B82F6" />
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#FFFFFF",
	},
});
```

- [ ] **Step 2: Create components/ErrorBoundary.tsx**

```tsx
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
	onReset?: () => void;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error("ErrorBoundary caught:", error, info.componentStack);
	}

	handleReset = () => {
		this.setState({ hasError: false, error: null });
		this.props.onReset?.();
	};

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) return this.props.fallback;
			return (
				<View style={styles.container}>
					<Text style={styles.title}>Something went wrong</Text>
					<Text style={styles.message}>{this.state.error?.message}</Text>
					<Pressable style={styles.button} onPress={this.handleReset}>
						<Text style={styles.buttonText}>Try Again</Text>
					</Pressable>
				</View>
			);
		}
		return this.props.children;
	}
}

const styles = StyleSheet.create({
	container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
	title: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 8 },
	message: { fontSize: 14, color: "#6B7280", textAlign: "center", marginBottom: 24 },
	button: { backgroundColor: "#3B82F6", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
	buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
```

- [ ] **Step 3: Commit**

```bash
git add packages/mobile/components/
git commit -m "feat(mobile): add LoadingScreen and ErrorBoundary components"
```

---

### Task 6: Root layout — providers + Stack navigator

**Files:**
- Create: `packages/mobile/app/_layout.tsx`

- [ ] **Step 1: Create app/_layout.tsx**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AuthProvider } from "@/providers/AuthProvider";
import { ConfigProvider, useConfig } from "@/providers/ConfigProvider";
import { PluginProvider } from "@/providers/PluginProvider";
import { ThemeProvider, useTheme } from "@/providers/ThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Pressable, StyleSheet, Text, View } from "react-native";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 5 * 60 * 1000,
			retry: 2,
		},
	},
});

function AppContent() {
	const { loading, error, reload } = useConfig();
	const theme = useTheme();

	if (loading) return <LoadingScreen />;

	if (error) {
		return (
			<View style={[styles.errorContainer, { backgroundColor: theme.background }]}>
				<Text style={[styles.errorTitle, { color: theme.text }]}>Could not connect</Text>
				<Text style={[styles.errorMessage, { color: theme.textMuted }]}>{error}</Text>
				<Pressable style={[styles.retryButton, { backgroundColor: theme.primary }]} onPress={reload}>
					<Text style={styles.retryText}>Retry</Text>
				</Pressable>
			</View>
		);
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
				<Stack.Screen name="screen/[id]" options={{ title: "" }} />
			</Stack>
		</>
	);
}

export default function RootLayout() {
	return (
		<ErrorBoundary>
			<QueryClientProvider client={queryClient}>
				<ConfigProvider>
					<ThemeProvider>
						<AuthProvider>
							<PluginProvider>
								<AppContent />
							</PluginProvider>
						</AuthProvider>
					</ThemeProvider>
				</ConfigProvider>
			</QueryClientProvider>
		</ErrorBoundary>
	);
}

const styles = StyleSheet.create({
	errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
	errorTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
	errorMessage: { fontSize: 14, textAlign: "center", marginBottom: 24 },
	retryButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
	retryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
```

- [ ] **Step 2: Commit**

```bash
git add packages/mobile/app/_layout.tsx
git commit -m "feat(mobile): add root layout with providers and Stack navigator"
```

---

### Task 7: Dynamic tab bar layout

**Files:**
- Create: `packages/mobile/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Create app/(tabs)/_layout.tsx**

This builds the tab bar dynamically from `/app/config`. Home and Account are always present; plugin tabs are inserted in between.

```tsx
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs, useRouter } from "expo-router";
import { Pressable } from "react-native";

import { useConfig } from "@/providers/ConfigProvider";
import { usePlugin } from "@/providers/PluginProvider";
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
	const { activePlugin, pluginState } = usePlugin();
	const router = useRouter();

	// Find the cart-supporting plugin for the header cart icon
	const cartPlugin = activePlugin?.mobile?.supportsCart ? activePlugin : null;
	const cartBadge = cartPlugin ? pluginState[cartPlugin.id]?.cartBadge ?? 0 : 0;

	// Gather plugin tabs from config
	const pluginTabs = config?.plugins
		.flatMap((p) => (p.mobile?.tabs ?? []).map((tab) => ({ ...tab, pluginId: p.id })))
		?? [];

	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: theme.primary,
				tabBarInactiveTintColor: theme.textMuted,
				tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.surface },
				headerStyle: { backgroundColor: theme.background },
				headerTintColor: theme.text,
				headerRight: cartPlugin
					? () => (
							<Pressable
								onPress={() =>
									router.push(`/screen/${cartPlugin.mobile!.cartScreen}` as any)
								}
								style={{ marginRight: 16 }}
							>
								<FontAwesome name="shopping-cart" size={22} color={theme.text} />
								{cartBadge > 0 && (
									<FontAwesome name="circle" size={8} color={theme.primary} style={{ position: "absolute", top: -2, right: -4 }} />
								)}
							</Pressable>
						)
					: undefined,
			}}
		>
			{/* Home tab — always first */}
			<Tabs.Screen
				name="index"
				options={{
					title: config?.site.name ?? "Home",
					tabBarIcon: ({ color }) => <FontAwesome name="home" size={22} color={color} />,
				}}
			/>

			{/* Plugin tabs — dynamic from config */}
			{pluginTabs.map((tab) => (
				<Tabs.Screen
					key={tab.key}
					name={`[plugin]`}
					options={{
						title: tab.label,
						tabBarIcon: ({ color }) => (
							<FontAwesome name={getIcon(tab.icon)} size={22} color={color} />
						),
						href: { pathname: "/(tabs)/[plugin]", params: { plugin: tab.screen } },
					}}
				/>
			))}

			{/* Account tab — always last */}
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

- [ ] **Step 2: Commit**

```bash
git add packages/mobile/app/\(tabs\)/_layout.tsx
git commit -m "feat(mobile): add dynamic tab bar layout from config"
```

---

### Task 8: Shell-owned screens — Home, Account, Login

**Files:**
- Create: `packages/mobile/app/(tabs)/index.tsx`
- Create: `packages/mobile/app/(tabs)/account.tsx`
- Create: `packages/mobile/app/login.tsx`

- [ ] **Step 1: Create app/(tabs)/index.tsx — Home screen**

```tsx
import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchPublicContent } from "@/lib/api";
import { useConfig } from "@/providers/ConfigProvider";
import { useTheme } from "@/providers/ThemeProvider";

interface ContentItem {
	id: string;
	title: string;
	slug: string;
	status: string;
	created_at: string;
}

export default function HomeScreen() {
	const theme = useTheme();
	const { config } = useConfig();

	const { data: pages } = useQuery({
		queryKey: ["public-pages"],
		queryFn: () => fetchPublicContent<{ items: ContentItem[] }>("pages", { limit: 10 }),
	});

	const { data: posts } = useQuery({
		queryKey: ["public-posts"],
		queryFn: () => fetchPublicContent<{ items: ContentItem[] }>("posts", { limit: 10 }),
	});

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

			{pages?.items && pages.items.length > 0 && (
				<View style={styles.section}>
					<Text style={[styles.sectionTitle, { color: theme.text }]}>Pages</Text>
					{pages.items.map((page) => (
						<View key={page.id} style={[styles.card, { backgroundColor: theme.surface }]}>
							<Text style={[styles.cardTitle, { color: theme.text }]}>{page.title}</Text>
							<Text style={[styles.cardDate, { color: theme.textMuted }]}>
								{new Date(page.created_at).toLocaleDateString()}
							</Text>
						</View>
					))}
				</View>
			)}

			{posts?.items && posts.items.length > 0 && (
				<View style={styles.section}>
					<Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Posts</Text>
					{posts.items.map((post) => (
						<View key={post.id} style={[styles.card, { backgroundColor: theme.surface }]}>
							<Text style={[styles.cardTitle, { color: theme.text }]}>{post.title}</Text>
							<Text style={[styles.cardDate, { color: theme.textMuted }]}>
								{new Date(post.created_at).toLocaleDateString()}
							</Text>
						</View>
					))}
				</View>
			)}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	hero: { padding: 24, paddingTop: 40, alignItems: "center", gap: 8 },
	siteName: { fontSize: 28, fontWeight: "800" },
	subtitle: { fontSize: 16 },
	section: { paddingHorizontal: 16, marginTop: 24 },
	sectionTitle: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
	card: {
		padding: 16,
		borderRadius: 12,
		marginBottom: 10,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	cardTitle: { fontSize: 16, fontWeight: "600", flex: 1 },
	cardDate: { fontSize: 13 },
});
```

- [ ] **Step 2: Create app/(tabs)/account.tsx — Account screen**

```tsx
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";

export default function AccountScreen() {
	const theme = useTheme();
	const { customer, loading, logout } = useAuth();
	const router = useRouter();

	if (loading) {
		return (
			<View style={[styles.container, { backgroundColor: theme.background }]}>
				<Text style={{ color: theme.textMuted }}>Loading...</Text>
			</View>
		);
	}

	if (!customer) {
		return (
			<View style={[styles.container, { backgroundColor: theme.background }]}>
				<Text style={[styles.heading, { color: theme.text }]}>Account</Text>
				<Text style={[styles.subtitle, { color: theme.textMuted }]}>
					Sign in to manage your account
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
			<Text style={[styles.heading, { color: theme.text }]}>Account</Text>
			<View style={[styles.card, { backgroundColor: theme.surface }]}>
				<Text style={[styles.name, { color: theme.text }]}>{customer.name}</Text>
				<Text style={{ color: theme.textMuted }}>{customer.email}</Text>
			</View>
			<Pressable
				style={[styles.button, { backgroundColor: theme.error }]}
				onPress={logout}
			>
				<Text style={styles.buttonText}>Sign Out</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center", gap: 16 },
	heading: { fontSize: 24, fontWeight: "800" },
	subtitle: { fontSize: 15, textAlign: "center" },
	card: { padding: 20, borderRadius: 12, width: "100%", alignItems: "center", gap: 4 },
	name: { fontSize: 18, fontWeight: "700" },
	button: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 10 },
	buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
```

- [ ] **Step 3: Create app/login.tsx — Login modal**

```tsx
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";

export default function LoginScreen() {
	const theme = useTheme();
	const { login } = useAuth();
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const handleLogin = async () => {
		setError("");
		setLoading(true);
		try {
			await login(email, password);
			router.back();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Login failed");
		} finally {
			setLoading(false);
		}
	};

	return (
		<View style={[styles.container, { backgroundColor: theme.background }]}>
			<Text style={[styles.heading, { color: theme.text }]}>Sign In</Text>

			<TextInput
				style={[styles.input, { color: theme.text, backgroundColor: theme.surface }]}
				placeholder="Email"
				placeholderTextColor={theme.textMuted}
				value={email}
				onChangeText={setEmail}
				keyboardType="email-address"
				autoCapitalize="none"
			/>
			<TextInput
				style={[styles.input, { color: theme.text, backgroundColor: theme.surface }]}
				placeholder="Password"
				placeholderTextColor={theme.textMuted}
				value={password}
				onChangeText={setPassword}
				secureTextEntry
			/>

			{error ? <Text style={[styles.error, { color: theme.error }]}>{error}</Text> : null}

			<Pressable
				style={[styles.button, { backgroundColor: theme.primary, opacity: loading ? 0.6 : 1 }]}
				onPress={handleLogin}
				disabled={loading}
			>
				<Text style={styles.buttonText}>{loading ? "Signing in..." : "Sign In"}</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 24, justifyContent: "center", gap: 14 },
	heading: { fontSize: 24, fontWeight: "800", textAlign: "center", marginBottom: 12 },
	input: { borderRadius: 10, padding: 14, fontSize: 16 },
	error: { fontSize: 14, textAlign: "center" },
	button: { borderRadius: 10, padding: 16, alignItems: "center", marginTop: 8 },
	buttonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
```

- [ ] **Step 4: Commit**

```bash
git add packages/mobile/app/
git commit -m "feat(mobile): add Home, Account, Login screens"
```

---

### Task 9: Plugin screen renderers — [plugin].tsx and screen/[id].tsx

**Files:**
- Create: `packages/mobile/app/(tabs)/[plugin].tsx`
- Create: `packages/mobile/app/screen/[id].tsx`

- [ ] **Step 1: Create app/(tabs)/[plugin].tsx — plugin tab screen renderer**

This is the catch-all tab route. It receives a plugin screen ID as the route param, looks it up in the registry, and renders it with `PluginScreenProps`.

```tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import { Text, View } from "react-native";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { getScreen } from "@/lib/registry";
import { useAuth } from "@/providers/AuthProvider";
import { useConfig } from "@/providers/ConfigProvider";
import { usePlugin } from "@/providers/PluginProvider";
import { useTheme } from "@/providers/ThemeProvider";

export default function PluginTabScreen() {
	const { plugin: screenId } = useLocalSearchParams<{ plugin: string }>();
	const theme = useTheme();
	const { token } = useAuth();
	const { config } = useConfig();
	const { setActivePlugin, updatePluginBadge } = usePlugin();
	const router = useRouter();

	// Find which plugin owns this screen
	const ownerPlugin = config?.plugins.find((p) =>
		p.mobile?.tabs?.some((t) => t.screen === screenId),
	);

	// Set active plugin for contextual cart icon
	useEffect(() => {
		setActivePlugin(ownerPlugin ?? null);
		return () => setActivePlugin(null);
	}, [ownerPlugin, setActivePlugin]);

	const navigate = useCallback(
		(screen: string, params?: Record<string, string>) => {
			const query = params ? `?${new URLSearchParams(params).toString()}` : "";
			router.push(`/screen/${screen}${query}` as any);
		},
		[router],
	);

	const goBack = useCallback(() => {
		router.back();
	}, [router]);

	const handleUpdateCartBadge = useCallback(
		(count: number) => {
			if (ownerPlugin) {
				updatePluginBadge(ownerPlugin.id, count);
			}
		},
		[ownerPlugin, updatePluginBadge],
	);

	if (!screenId) {
		return (
			<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
				<Text style={{ color: theme.textMuted }}>No screen specified</Text>
			</View>
		);
	}

	const Screen = getScreen(screenId);
	if (!Screen) {
		return (
			<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
				<Text style={{ color: theme.textMuted }}>Screen not found: {screenId}</Text>
			</View>
		);
	}

	return (
		<ErrorBoundary>
			<Screen
				theme={theme}
				navigate={navigate}
				goBack={goBack}
				params={{}}
				authToken={token}
				updateCartBadge={handleUpdateCartBadge}
			/>
		</ErrorBoundary>
	);
}
```

- [ ] **Step 2: Create app/screen/[id].tsx — non-tab plugin screen renderer**

This handles screens pushed via `navigate()` — product detail, cart, checkout, etc.

```tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { Text, View } from "react-native";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { getScreen } from "@/lib/registry";
import { useAuth } from "@/providers/AuthProvider";
import { useConfig } from "@/providers/ConfigProvider";
import { usePlugin } from "@/providers/PluginProvider";
import { useTheme } from "@/providers/ThemeProvider";

export default function PluginScreen() {
	const params = useLocalSearchParams<{ id: string } & Record<string, string>>();
	const { id: screenId, ...screenParams } = params;
	const theme = useTheme();
	const { token } = useAuth();
	const { config } = useConfig();
	const { updatePluginBadge } = usePlugin();
	const router = useRouter();

	// Find owner plugin from screen ID prefix (e.g., "commerce:cart" → "commerce")
	const pluginId = screenId?.split(":")[0];
	const ownerPlugin = config?.plugins.find((p) => p.id === pluginId);

	const navigate = useCallback(
		(screen: string, navParams?: Record<string, string>) => {
			const query = navParams ? `?${new URLSearchParams(navParams).toString()}` : "";
			router.push(`/screen/${screen}${query}` as any);
		},
		[router],
	);

	const goBack = useCallback(() => {
		router.back();
	}, [router]);

	const handleUpdateCartBadge = useCallback(
		(count: number) => {
			if (ownerPlugin) {
				updatePluginBadge(ownerPlugin.id, count);
			}
		},
		[ownerPlugin, updatePluginBadge],
	);

	if (!screenId) {
		return (
			<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
				<Text style={{ color: theme.textMuted }}>No screen specified</Text>
			</View>
		);
	}

	const Screen = getScreen(screenId);
	if (!Screen) {
		return (
			<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
				<Text style={{ color: theme.textMuted }}>Screen not found: {screenId}</Text>
			</View>
		);
	}

	return (
		<ErrorBoundary>
			<Screen
				theme={theme}
				navigate={navigate}
				goBack={goBack}
				params={screenParams as Record<string, string>}
				authToken={token}
				updateCartBadge={handleUpdateCartBadge}
			/>
		</ErrorBoundary>
	);
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/mobile/app/
git commit -m "feat(mobile): add plugin screen renderers — tab and stack"
```

---

### Task 10: Build and verify on device

**Files:**
- Modify: `packages/mobile/` (prebuild + run)

- [ ] **Step 1: Generate Android native project**

```bash
cd packages/mobile
npx expo prebuild --platform android
```

- [ ] **Step 2: Build and install on emulator**

```bash
npx expo run:android
```

This creates a development build APK, installs it on the emulator, and starts Metro. The dev build does NOT use Expo Go — it's our own compiled app with expo-dev-client.

- [ ] **Step 3: Verify app loads**

Expected: The app should show the loading screen, then the Home tab with site name and public content from the Cloudflare deployment.

- [ ] **Step 4: Verify Shop tab works**

Navigate to the Shop tab. Expected: Product list loads from the commerce plugin API.

- [ ] **Step 5: Verify product detail + cart flow**

Tap a product → product detail shows → tap "Add to Cart" → cart icon appears in header with badge → tap cart icon → cart screen shows.

- [ ] **Step 6: Verify Account + Login**

Tap Account tab → shows Sign In button → tap it → login modal opens.

- [ ] **Step 7: Add android/ to .gitignore and commit**

The `android/` directory is generated by `expo prebuild` and should not be committed.

```bash
# Already in .gitignore from Task 1
git add -A packages/mobile/
git commit -m "feat(mobile): verified working development build with plugin screens"
```

---

### Task 11: Clean up old tasks and update plan docs

**Files:**
- Modify: `docs/superpowers/plans/2026-04-06-mobile-phase1-core-changes.md` (mark superseded)

- [ ] **Step 1: Mark old plan as superseded**

Add a note to the top of the old plan file:

```markdown
> **SUPERSEDED** by `2026-04-08-mobile-rewrite-phase1.md`. This plan was for incremental changes; the app was rewritten from scratch instead.
```

- [ ] **Step 2: Commit**

```bash
git add docs/
git commit -m "docs(mobile): mark old Phase 1 plan as superseded by rewrite"
```
