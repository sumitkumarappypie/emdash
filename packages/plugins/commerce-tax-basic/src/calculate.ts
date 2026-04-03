export interface TaxRate {
	country: string;
	state?: string;
	rate: number;
	name: string;
}

export interface TaxConfig {
	rates: TaxRate[];
}

export function calculateTax(
	config: TaxConfig,
	items: Array<{ itemId: string; amount: number }>,
	address: { country: string; state?: string },
): {
	lineItems: Array<{ itemId: string; taxAmount: number; taxRate: number; taxName: string }>;
	totalTax: number;
} {
	// Find best matching rate: state-specific first, then country-only
	const rate =
		config.rates.find((r) => r.country === address.country && r.state === address.state) ??
		config.rates.find((r) => r.country === address.country && !r.state);

	if (!rate) {
		return {
			lineItems: items.map((item) => ({
				itemId: item.itemId,
				taxAmount: 0,
				taxRate: 0,
				taxName: "No Tax",
			})),
			totalTax: 0,
		};
	}

	const lineItems = items.map((item) => ({
		itemId: item.itemId,
		taxAmount: Math.round(item.amount * (rate.rate / 100) * 100) / 100,
		taxRate: rate.rate,
		taxName: rate.name,
	}));

	const totalTax = Math.round(lineItems.reduce((sum, li) => sum + li.taxAmount, 0) * 100) / 100;

	return { lineItems, totalTax };
}
