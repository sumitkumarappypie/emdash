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
