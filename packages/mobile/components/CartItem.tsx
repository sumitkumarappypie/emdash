import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import type { CartItem as CartItemType } from "@/lib/types";
import { PriceDisplay } from "./PriceDisplay";

interface CartItemProps {
	item: CartItemType;
	onUpdateQuantity: (quantity: number) => void;
	onRemove: () => void;
}

export function CartItemRow({ item, onUpdateQuantity, onRemove }: CartItemProps) {
	const theme = useTheme();

	return (
		<View style={[styles.row, { borderBottomColor: theme.surface }]}>
			{item.image ? (
				<Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
			) : (
				<View style={[styles.image, { backgroundColor: theme.surface }]} />
			)}
			<View style={styles.info}>
				<Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
					{item.name}
				</Text>
				{item.variantName && (
					<Text style={[styles.variant, { color: theme.textMuted }]}>{item.variantName}</Text>
				)}
				<PriceDisplay price={item.total} size="small" />
			</View>
			<View style={styles.controls}>
				<View style={styles.quantity}>
					<Pressable
						onPress={() => (item.quantity > 1 ? onUpdateQuantity(item.quantity - 1) : onRemove())}
						style={[styles.qtyButton, { borderColor: theme.textMuted }]}
					>
						<Text style={{ color: theme.text }}>-</Text>
					</Pressable>
					<Text style={[styles.qtyText, { color: theme.text }]}>{item.quantity}</Text>
					<Pressable
						onPress={() => onUpdateQuantity(item.quantity + 1)}
						style={[styles.qtyButton, { borderColor: theme.textMuted }]}
					>
						<Text style={{ color: theme.text }}>+</Text>
					</Pressable>
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		padding: 12,
		borderBottomWidth: 1,
		gap: 12,
	},
	image: { width: 64, height: 64, borderRadius: 8 },
	info: { flex: 1, justifyContent: "center", gap: 2 },
	name: { fontSize: 15, fontWeight: "600" },
	variant: { fontSize: 13 },
	controls: { justifyContent: "center" },
	quantity: { flexDirection: "row", alignItems: "center", gap: 10 },
	qtyButton: {
		width: 28,
		height: 28,
		borderRadius: 14,
		borderWidth: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	qtyText: { fontSize: 15, fontWeight: "600", minWidth: 20, textAlign: "center" },
});
