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
