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
