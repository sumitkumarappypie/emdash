import { useQuery } from "@tanstack/react-query";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { fetchProducts } from "../api/client";
import type { Product } from "../api/types";
import type { PluginScreenProps } from "../types";

function PriceTag({ price, currency = "USD" }: { price: number; currency?: string }) {
	const formatted = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(price);
	return <Text style={styles.price}>{formatted}</Text>;
}

function ProductCard({
	product,
	onPress,
	theme,
}: {
	product: Product;
	onPress: () => void;
	theme: PluginScreenProps["theme"];
}) {
	const imageUri = product.images[0];
	return (
		<Pressable style={[styles.card, { backgroundColor: theme.surface }]} onPress={onPress}>
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
				<PriceTag price={product.basePrice} currency={product.currency} />
			</View>
		</Pressable>
	);
}

export default function ProductListScreen({ theme, navigate }: PluginScreenProps) {
	const { data, isLoading, error } = useQuery({
		queryKey: ["commerce:products"],
		queryFn: () => fetchProducts({ limit: 20 }),
	});

	if (isLoading) {
		return (
			<View style={[styles.loading, { backgroundColor: theme.background }]}>
				<Text style={{ color: theme.textMuted }}>Loading...</Text>
			</View>
		);
	}

	if (error) {
		return (
			<View style={[styles.loading, { backgroundColor: theme.background }]}>
				<Text style={{ color: theme.error }}>
					{error instanceof Error ? error.message : "Failed to load products"}
				</Text>
			</View>
		);
	}

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
						theme={theme}
						onPress={() => navigate("commerce:product-detail", { slug: item.slug })}
					/>
				)}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	loading: { flex: 1, justifyContent: "center", alignItems: "center" },
	list: { padding: 6 },
	card: { flex: 1, borderRadius: 12, overflow: "hidden", margin: 6 },
	image: { width: "100%", aspectRatio: 1 },
	placeholder: { justifyContent: "center", alignItems: "center" },
	info: { padding: 10, gap: 4 },
	name: { fontSize: 14, fontWeight: "600" },
	price: { fontSize: 14, fontWeight: "700" },
});
