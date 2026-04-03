import { describe, it, expect } from "vitest";

import { calculateTax } from "../../../../../plugins/commerce-tax-basic/src/calculate.js";

describe("calculateTax", () => {
	it("applies tax rate for matching region", () => {
		const config = {
			rates: [
				{ country: "US", state: "CA", rate: 8.25, name: "CA Sales Tax" },
				{ country: "US", state: "NY", rate: 8.0, name: "NY Sales Tax" },
			],
		};
		const items = [{ itemId: "item-1", amount: 150 }];
		const address = { country: "US", state: "CA" };

		const result = calculateTax(config, items, address);

		expect(result.lineItems).toHaveLength(1);
		expect(result.lineItems[0]).toEqual({
			itemId: "item-1",
			taxAmount: 12.38,
			taxRate: 8.25,
			taxName: "CA Sales Tax",
		});
		expect(result.totalTax).toBe(12.38);
	});

	it("returns zero tax for region with no rate", () => {
		const config = {
			rates: [{ country: "US", state: "CA", rate: 8.25, name: "CA Sales Tax" }],
		};
		const items = [{ itemId: "item-2", amount: 100 }];
		const address = { country: "DE" };

		const result = calculateTax(config, items, address);

		expect(result.lineItems).toHaveLength(1);
		expect(result.lineItems[0]).toEqual({
			itemId: "item-2",
			taxAmount: 0,
			taxRate: 0,
			taxName: "No Tax",
		});
		expect(result.totalTax).toBe(0);
	});

	it("matches country-only rate when no state-specific rate", () => {
		const config = {
			rates: [{ country: "GB", rate: 20, name: "UK VAT" }],
		};
		const items = [{ itemId: "item-3", amount: 200 }];
		const address = { country: "GB", state: "England" };

		const result = calculateTax(config, items, address);

		expect(result.lineItems).toHaveLength(1);
		expect(result.lineItems[0]).toEqual({
			itemId: "item-3",
			taxAmount: 40,
			taxRate: 20,
			taxName: "UK VAT",
		});
		expect(result.totalTax).toBe(40);
	});
});
