import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import type { Product } from "@/lib/types";
import { PriceDisplay } from "./PriceDisplay";

interface ProductCardProps {
	product: Product;
	onPress: () => void;
}

export function ProductCard({ product, onPress }: ProductCardProps) {
	const theme = useTheme();
	const imageUri = product.images[0];

	return (
		<Pressable
			style={[styles.card, { backgroundColor: theme.surface }]}
			onPress={onPress}
		>
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
				<PriceDisplay price={product.price} compareAtPrice={product.compareAtPrice} size="small" />
			</View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	card: {
		flex: 1,
		borderRadius: 12,
		overflow: "hidden",
		margin: 6,
	},
	image: {
		width: "100%",
		aspectRatio: 1,
	},
	placeholder: {
		justifyContent: "center",
		alignItems: "center",
	},
	info: {
		padding: 10,
		gap: 4,
	},
	name: {
		fontSize: 14,
		fontWeight: "600",
	},
});
