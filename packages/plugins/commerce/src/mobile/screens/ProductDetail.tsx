import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchProduct, addToCart, createCart, fetchCart } from "../api/client";
import type { PluginScreenProps } from "../types";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CART_STORAGE_KEY = "commerce_cart_id";

export default function ProductDetailScreen({
	theme,
	params,
	navigate,
	authToken,
	requestLogin,
	updateCartBadge,
}: PluginScreenProps) {
	const slug = params.slug ?? "";
	const [adding, setAdding] = useState(false);
	const [added, setAdded] = useState(false);

	const { data: product, isLoading } = useQuery({
		queryKey: ["commerce:product", slug],
		queryFn: () => fetchProduct(slug),
		enabled: !!slug,
	});

	if (isLoading || !product) {
		return (
			<View style={[styles.loading, { backgroundColor: theme.background }]}>
				<Text style={{ color: theme.textMuted }}>Loading...</Text>
			</View>
		);
	}

	const imageUri = product.images[0];

	const formatPrice = (price: number) =>
		new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: product.currency ?? "USD",
		}).format(price);

	const doAddToCart = async () => {
		let cartId = await AsyncStorage.getItem(CART_STORAGE_KEY);
		if (!cartId) {
			const newCart = await createCart();
			cartId = newCart.id;
			await AsyncStorage.setItem(CART_STORAGE_KEY, cartId);
		}
		try {
			const cart = await addToCart(cartId, product.id, 1);
			updateCartBadge(cart.itemCount);
		} catch {
			// Cart may have expired, create a new one
			const newCart = await createCart();
			await AsyncStorage.setItem(CART_STORAGE_KEY, newCart.id);
			const cart = await addToCart(newCart.id, product.id, 1);
			updateCartBadge(cart.itemCount);
		}
		setAdded(true);
		setTimeout(() => setAdded(false), 2000);
	};

	const handleAddToCart = async () => {
		setAdding(true);
		try {
			// Require login before adding to cart
			if (!authToken) {
				const loggedIn = await requestLogin();
				if (!loggedIn) return;
			}
			await doAddToCart();
		} catch {
			// Silently fail for now
		} finally {
			setAdding(false);
		}
	};

	return (
		<ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
			{imageUri ? (
				<Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
			) : (
				<View style={[styles.image, { backgroundColor: theme.surface }]} />
			)}
			<View style={styles.content}>
				<Text style={[styles.name, { color: theme.text }]}>{product.name}</Text>
				<View style={styles.priceRow}>
					<Text style={[styles.price, { color: theme.text }]}>
						{formatPrice(product.basePrice)}
					</Text>
					{product.compareAtPrice ? (
						<Text style={[styles.comparePrice, { color: theme.textMuted }]}>
							{formatPrice(product.compareAtPrice)}
						</Text>
					) : null}
				</View>

				{product.description ? (
					<Text style={[styles.description, { color: theme.textMuted }]}>
						{product.description}
					</Text>
				) : null}

				<Pressable
					style={[
						styles.addButton,
						{
							backgroundColor: added ? theme.success : theme.primary,
							opacity: adding ? 0.6 : 1,
						},
					]}
					onPress={handleAddToCart}
					disabled={adding}
				>
					<Text style={styles.addButtonText}>
						{added ? "Added!" : adding ? "Adding..." : "Add to Cart"}
					</Text>
				</Pressable>
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	loading: { flex: 1, justifyContent: "center", alignItems: "center" },
	image: { width: "100%", aspectRatio: 1 },
	content: { padding: 20, gap: 12 },
	name: { fontSize: 24, fontWeight: "800" },
	priceRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
	price: { fontSize: 22, fontWeight: "700" },
	comparePrice: { fontSize: 16, textDecorationLine: "line-through" },
	description: { fontSize: 15, lineHeight: 22 },
	addButton: { borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
	addButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
