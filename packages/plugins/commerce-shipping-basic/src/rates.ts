export interface ShippingMethod {
	id: string;
	name: string;
	type: "flat_rate" | "free_over";
	price?: number;
	threshold?: number;
	currency: string;
	estimatedDays?: number;
}

export interface ShippingConfig {
	methods: ShippingMethod[];
}

export function calculateShippingRates(
	config: ShippingConfig,
	cart: { subtotal: number; currency: string },
): {
	rates: Array<{
		id: string;
		name: string;
		description: string;
		price: number;
		currency: string;
		estimatedDays: number | null;
	}>;
} {
	const rates = [];
	for (const method of config.methods) {
		switch (method.type) {
			case "flat_rate":
				rates.push({
					id: method.id,
					name: method.name,
					description: "Flat rate shipping",
					price: method.price ?? 0,
					currency: method.currency,
					estimatedDays: method.estimatedDays ?? null,
				});
				break;
			case "free_over":
				if (cart.subtotal >= (method.threshold ?? 0)) {
					rates.push({
						id: method.id,
						name: method.name,
						description: `Free shipping on orders over ${method.threshold}`,
						price: 0,
						currency: method.currency,
						estimatedDays: method.estimatedDays ?? null,
					});
				}
				break;
		}
	}
	return { rates };
}
