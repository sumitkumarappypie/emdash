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
