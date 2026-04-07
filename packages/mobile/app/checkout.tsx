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
