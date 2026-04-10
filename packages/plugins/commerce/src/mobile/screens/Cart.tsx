import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { fetchCart, updateCartItem, removeCartItem } from "../api/client";
import type { CartItem } from "../api/types";
import type { PluginScreenProps } from "../types";

const CART_STORAGE_KEY = "commerce_cart_id";

function CartItemRow({
	item,
	theme,
	onUpdateQuantity,
	onRemove,
}: {
	item: CartItem;
	theme: PluginScreenProps["theme"];
	onUpdateQuantity: (qty: number) => void;
	onRemove: () => void;
}) {
	const formatPrice = (price: number) =>
		new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price);

	return (
		<View style={[styles.itemRow, { borderBottomColor: theme.surface }]}>
			<View style={styles.itemInfo}>
				<Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
				<Text style={[styles.itemPrice, { color: theme.textMuted }]}>
					{formatPrice(item.unitPrice)} each
				</Text>
			</View>
			<View style={styles.itemActions}>
				<Pressable
					style={[styles.qtyButton, { backgroundColor: theme.surface }]}
					onPress={() => onUpdateQuantity(Math.max(0, item.quantity - 1))}
				>
					<Text style={{ color: theme.text }}>-</Text>
				</Pressable>
				<Text style={[styles.qty, { color: theme.text }]}>{item.quantity}</Text>
				<Pressable
					style={[styles.qtyButton, { backgroundColor: theme.surface }]}
					onPress={() => onUpdateQuantity(item.quantity + 1)}
				>
					<Text style={{ color: theme.text }}>+</Text>
				</Pressable>
				<Pressable onPress={onRemove}>
					<Text style={{ color: theme.error, marginLeft: 12 }}>Remove</Text>
				</Pressable>
			</View>
			<Text style={[styles.itemTotal, { color: theme.text }]}>{formatPrice(item.total)}</Text>
		</View>
	);
}

export default function CartScreen({ theme, navigate, updateCartBadge }: PluginScreenProps) {
	const queryClient = useQueryClient();

	const { data: cartId } = useQuery({
		queryKey: ["commerce:cart-id"],
		queryFn: () => AsyncStorage.getItem(CART_STORAGE_KEY),
	});

	const { data: cart, isLoading } = useQuery({
		queryKey: ["commerce:cart", cartId],
		queryFn: () => fetchCart(cartId!),
		enabled: !!cartId,
	});

	const updateMutation = useMutation({
		mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
			quantity === 0 ? removeCartItem(itemId) : updateCartItem(itemId, quantity),
		onSuccess: (updatedCart) => {
			queryClient.setQueryData(["commerce:cart", cartId], updatedCart);
			updateCartBadge(updatedCart.itemCount);
		},
	});

	const removeMutation = useMutation({
		mutationFn: (itemId: string) => removeCartItem(itemId),
		onSuccess: (updatedCart) => {
			queryClient.setQueryData(["commerce:cart", cartId], updatedCart);
			updateCartBadge(updatedCart.itemCount);
		},
	});

	if (isLoading) {
		return (
			<View style={[styles.loading, { backgroundColor: theme.background }]}>
				<Text style={{ color: theme.textMuted }}>Loading...</Text>
			</View>
		);
	}

	if (!cart || !cart.items || cart.items.length === 0) {
		return (
			<View style={[styles.empty, { backgroundColor: theme.background }]}>
				<Text style={[styles.emptyText, { color: theme.textMuted }]}>Your cart is empty</Text>
			</View>
		);
	}

	const formatPrice = (price: number) =>
		new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price);

	return (
		<View style={[styles.container, { backgroundColor: theme.background }]}>
			<FlatList
				data={cart.items}
				keyExtractor={(item) => item.id}
				renderItem={({ item }) => (
					<CartItemRow
						item={item}
						theme={theme}
						onUpdateQuantity={(qty) => updateMutation.mutate({ itemId: item.id, quantity: qty })}
						onRemove={() => removeMutation.mutate(item.id)}
					/>
				)}
			/>
			<View style={[styles.footer, { borderTopColor: theme.surface }]}>
				<View style={styles.subtotalRow}>
					<Text style={[styles.subtotalLabel, { color: theme.textMuted }]}>Subtotal</Text>
					<Text style={[styles.subtotalValue, { color: theme.text }]}>
						{formatPrice(cart.subtotal)}
					</Text>
				</View>
				<Pressable
					style={[styles.checkoutButton, { backgroundColor: theme.primary }]}
					onPress={() => navigate("commerce:checkout", {})}
				>
					<Text style={styles.checkoutText}>Checkout</Text>
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	loading: { flex: 1, justifyContent: "center", alignItems: "center" },
	empty: { flex: 1, justifyContent: "center", alignItems: "center" },
	emptyText: { fontSize: 16 },
	itemRow: { padding: 16, borderBottomWidth: 1 },
	itemInfo: { marginBottom: 8 },
	itemName: { fontSize: 16, fontWeight: "600" },
	itemPrice: { fontSize: 13, marginTop: 2 },
	itemActions: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
	qtyButton: {
		width: 32,
		height: 32,
		borderRadius: 8,
		justifyContent: "center",
		alignItems: "center",
	},
	qty: { fontSize: 16, fontWeight: "600", marginHorizontal: 12 },
	itemTotal: { fontSize: 16, fontWeight: "700", textAlign: "right" },
	footer: { padding: 16, borderTopWidth: 1, gap: 12 },
	subtotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
	subtotalLabel: { fontSize: 16 },
	subtotalValue: { fontSize: 22, fontWeight: "700" },
	checkoutButton: { borderRadius: 12, padding: 16, alignItems: "center" },
	checkoutText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
