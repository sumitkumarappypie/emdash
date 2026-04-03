import { describe, it, expect } from "vitest";

import { calculateShippingRates } from "../../../../../plugins/commerce-shipping-basic/src/rates.js";

describe("calculateShippingRates", () => {
	it("returns flat rate when configured", () => {
		const config = {
			methods: [
				{
					id: "standard",
					name: "Standard Shipping",
					type: "flat_rate" as const,
					price: 5.99,
					currency: "USD",
					estimatedDays: 5,
				},
			],
		};
		const result = calculateShippingRates(config, { subtotal: 20, currency: "USD" });
		expect(result.rates).toHaveLength(1);
		expect(result.rates[0]).toMatchObject({
			id: "standard",
			name: "Standard Shipping",
			description: "Flat rate shipping",
			price: 5.99,
			currency: "USD",
			estimatedDays: 5,
		});
	});

	it("returns free shipping when cart exceeds threshold", () => {
		const config = {
			methods: [
				{
					id: "free",
					name: "Free Shipping",
					type: "free_over" as const,
					threshold: 50,
					currency: "USD",
					estimatedDays: 7,
				},
			],
		};
		const result = calculateShippingRates(config, { subtotal: 75, currency: "USD" });
		expect(result.rates).toHaveLength(1);
		expect(result.rates[0]).toMatchObject({
			id: "free",
			name: "Free Shipping",
			price: 0,
			currency: "USD",
			estimatedDays: 7,
		});
	});

	it("excludes free shipping when cart is below threshold", () => {
		const config = {
			methods: [
				{
					id: "free",
					name: "Free Shipping",
					type: "free_over" as const,
					threshold: 50,
					currency: "USD",
					estimatedDays: 7,
				},
			],
		};
		const result = calculateShippingRates(config, { subtotal: 30, currency: "USD" });
		expect(result.rates).toHaveLength(0);
	});
});
