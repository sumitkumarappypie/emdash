import { describe, it, expect, beforeEach } from "vitest";

import {
	getProviderRegistry,
	registerProvider,
	unregisterProvider,
} from "../../../../../plugins/commerce/src/providers.js";

function createMockKV() {
	const store = new Map<string, unknown>();
	return {
		get: async <T>(key: string) => (store.get(key) as T) ?? null,
		set: async (key: string, value: unknown) => {
			store.set(key, value);
		},
	};
}

describe("Provider registry", () => {
	let kv: ReturnType<typeof createMockKV>;

	beforeEach(() => {
		kv = createMockKV();
	});

	it("returns empty registry by default", async () => {
		const registry = await getProviderRegistry(kv);
		expect(registry).toEqual({
			paymentProviders: [],
			shippingProviders: [],
			taxProvider: null,
		});
	});

	it("registers a payment provider", async () => {
		await registerProvider(kv, "payment", "stripe");
		const registry = await getProviderRegistry(kv);
		expect(registry.paymentProviders).toEqual(["stripe"]);
	});

	it("registers multiple payment providers without duplicates", async () => {
		await registerProvider(kv, "payment", "stripe");
		await registerProvider(kv, "payment", "paypal");
		await registerProvider(kv, "payment", "stripe");
		const registry = await getProviderRegistry(kv);
		expect(registry.paymentProviders).toEqual(["stripe", "paypal"]);
	});

	it("registers a shipping provider", async () => {
		await registerProvider(kv, "shipping", "fedex");
		const registry = await getProviderRegistry(kv);
		expect(registry.shippingProviders).toEqual(["fedex"]);
	});

	it("registers a tax provider (replaces previous)", async () => {
		await registerProvider(kv, "tax", "taxjar");
		await registerProvider(kv, "tax", "avalara");
		const registry = await getProviderRegistry(kv);
		expect(registry.taxProvider).toBe("avalara");
	});

	it("unregisters a payment provider", async () => {
		await registerProvider(kv, "payment", "stripe");
		await registerProvider(kv, "payment", "paypal");
		await unregisterProvider(kv, "payment", "stripe");
		const registry = await getProviderRegistry(kv);
		expect(registry.paymentProviders).toEqual(["paypal"]);
	});

	it("unregisters a shipping provider", async () => {
		await registerProvider(kv, "shipping", "fedex");
		await registerProvider(kv, "shipping", "ups");
		await unregisterProvider(kv, "shipping", "fedex");
		const registry = await getProviderRegistry(kv);
		expect(registry.shippingProviders).toEqual(["ups"]);
	});

	it("unregisters a tax provider", async () => {
		await registerProvider(kv, "tax", "taxjar");
		await unregisterProvider(kv, "tax", "taxjar");
		const registry = await getProviderRegistry(kv);
		expect(registry.taxProvider).toBeNull();
	});
});
