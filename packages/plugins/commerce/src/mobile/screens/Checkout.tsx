import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { createCheckout, fetchCart } from "../api/client";
import type { PluginScreenProps } from "../types";

const CART_STORAGE_KEY = "commerce_cart_id";

export default function CheckoutScreen({
	theme,
	navigate,
	authToken,
	requestLogin,
	updateCartBadge,
}: PluginScreenProps) {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [isCustomerPrefilled, setIsCustomerPrefilled] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);

	const { data: cartId } = useQuery({
		queryKey: ["commerce:cart-id"],
		queryFn: () => AsyncStorage.getItem(CART_STORAGE_KEY),
	});

	const { data: cart } = useQuery({
		queryKey: ["commerce:cart", cartId],
		queryFn: () => fetchCart(cartId!),
		enabled: !!cartId,
	});

	// Pre-fill customer info when logged in
	useEffect(() => {
		if (!authToken) {
			setIsCustomerPrefilled(false);
			return;
		}

		(async () => {
			try {
				const response = await fetch(
					`${AsyncStorage.getItem("emdash_base_url") ?? ""}/_emdash/api/customers/me`,
					{
						headers: {
							Authorization: `Bearer ${authToken}`,
							"X-EmDash-Request": "1",
						},
					},
				);
				if (response.ok) {
					const json = await response.json();
					const customer = (json as { data?: { name?: string; email?: string } }).data;
					if (customer?.name) setName(customer.name);
					if (customer?.email) setEmail(customer.email);
					setIsCustomerPrefilled(true);
				}
			} catch {
				// Silently fail — user can type manually
			}
		})();
	}, [authToken]);

	if (success) {
		return (
			<View style={[styles.empty, { backgroundColor: theme.background }]}>
				<Text style={[styles.successHeading, { color: theme.success }]}>Order Placed!</Text>
				<Text style={{ color: theme.textMuted }}>Thank you for your purchase.</Text>
				<Pressable
					style={[styles.button, { backgroundColor: theme.primary, marginTop: 24 }]}
					onPress={() => navigate("commerce:product-list", {})}
				>
					<Text style={styles.buttonText}>Continue Shopping</Text>
				</Pressable>
			</View>
		);
	}

	if (!cart || !cart.items || cart.items.length === 0) {
		return (
			<View style={[styles.empty, { backgroundColor: theme.background }]}>
				<Text style={{ color: theme.textMuted }}>Your cart is empty</Text>
			</View>
		);
	}

	const formatPrice = (price: number) =>
		new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price);

	const handleCheckout = async () => {
		// Require login before checkout
		if (!authToken) {
			const loggedIn = await requestLogin();
			if (!loggedIn) return;
		}

		setError("");
		setLoading(true);
		try {
			await createCheckout({
				cartId: cart.id,
				email,
				shippingAddress: { name },
			});
			await AsyncStorage.removeItem(CART_STORAGE_KEY);
			updateCartBadge(0);
			setSuccess(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Checkout failed");
		} finally {
			setLoading(false);
		}
	};

	return (
		<ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
			<View style={styles.section}>
				<Text style={[styles.sectionTitle, { color: theme.text }]}>Contact</Text>
				{isCustomerPrefilled && (
					<Text style={{ color: theme.success, fontSize: 13, marginBottom: 4 }}>
						Signed in as {email}
					</Text>
				)}
				<TextInput
					style={[styles.input, { color: theme.text, backgroundColor: theme.surface }]}
					placeholder="Name"
					placeholderTextColor={theme.textMuted}
					value={name}
					onChangeText={setName}
					editable={!isCustomerPrefilled}
				/>
				<TextInput
					style={[styles.input, { color: theme.text, backgroundColor: theme.surface }]}
					placeholder="Email"
					placeholderTextColor={theme.textMuted}
					value={email}
					onChangeText={setEmail}
					keyboardType="email-address"
					autoCapitalize="none"
					editable={!isCustomerPrefilled}
				/>
			</View>

			<View style={styles.section}>
				<Text style={[styles.sectionTitle, { color: theme.text }]}>Order Summary</Text>
				{cart.items.map((item) => (
					<View key={item.id} style={styles.summaryRow}>
						<Text style={[styles.summaryName, { color: theme.text }]}>
							{item.name} x{item.quantity}
						</Text>
						<Text style={{ color: theme.text }}>{formatPrice(item.total)}</Text>
					</View>
				))}
				<View style={[styles.totalRow, { borderTopColor: theme.surface }]}>
					<Text style={[styles.totalLabel, { color: theme.text }]}>Total</Text>
					<Text style={[styles.totalValue, { color: theme.text }]}>
						{formatPrice(cart.subtotal)}
					</Text>
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
	totalRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		borderTopWidth: 1,
		paddingTop: 12,
		marginTop: 8,
	},
	totalLabel: { fontSize: 17, fontWeight: "700" },
	totalValue: { fontSize: 22, fontWeight: "700" },
	error: { fontSize: 14, marginBottom: 12 },
	button: { borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 40 },
	buttonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
