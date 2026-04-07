import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchProduct } from "@/lib/api";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PriceDisplay } from "@/components/PriceDisplay";
import { useCart } from "@/providers/CartProvider";
import { useTheme } from "@/providers/ThemeProvider";

export default function ProductDetailScreen() {
	const theme = useTheme();
	const { slug } = useLocalSearchParams<{ slug: string }>();
	const { addItem } = useCart();

	const { data: product, isLoading } = useQuery({
		queryKey: ["product", slug],
		queryFn: () => fetchProduct(slug),
		enabled: !!slug,
	});

	if (isLoading || !product) return <LoadingScreen />;

	const imageUri = product.images[0];

	return (
		<ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
			{imageUri ? (
				<Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
			) : (
				<View style={[styles.image, { backgroundColor: theme.surface }]} />
			)}
			<View style={styles.content}>
				<Text style={[styles.name, { color: theme.text }]}>{product.name}</Text>
				<PriceDisplay price={product.price} compareAtPrice={product.compareAtPrice} size="large" />

				{product.description ? (
					<Text style={[styles.description, { color: theme.textMuted }]}>
						{product.description}
					</Text>
				) : null}

				<Pressable
					style={[styles.addButton, { backgroundColor: theme.primary }]}
					onPress={() => addItem(product.id, 1)}
				>
					<Text style={styles.addButtonText}>Add to Cart</Text>
				</Pressable>
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	image: { width: "100%", aspectRatio: 1 },
	content: { padding: 20, gap: 12 },
	name: { fontSize: 24, fontWeight: "800" },
	description: { fontSize: 15, lineHeight: 22 },
	addButton: { borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
	addButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
