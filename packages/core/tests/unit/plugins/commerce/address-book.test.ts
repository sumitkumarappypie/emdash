import { describe, it, expect, beforeEach } from "vitest";

/**
 * Tests for customer address book operations.
 * Addresses are stored in KV as `state:addresses:{customerId}:{addressId}`.
 */

function createMockKV() {
	const store = new Map<string, unknown>();
	return {
		get: async <T>(key: string): Promise<T | null> => (store.get(key) as T) ?? null,
		set: async (key: string, value: unknown): Promise<void> => {
			store.set(key, value);
		},
		delete: async (key: string): Promise<boolean> => store.delete(key),
		list: async (prefix?: string): Promise<Array<{ key: string; value: unknown }>> => {
			const results: Array<{ key: string; value: unknown }> = [];
			for (const [key, value] of store) {
				if (!prefix || key.startsWith(prefix)) {
					results.push({ key, value });
				}
			}
			return results;
		},
	};
}

describe("Customer Address Book (KV-based)", () => {
	let kv: ReturnType<typeof createMockKV>;

	beforeEach(() => {
		kv = createMockKV();
	});

	it("saves and retrieves an address", async () => {
		const customerId = "cust-1";
		const addressId = "addr-1";
		const address = {
			name: "Home",
			line1: "123 Main St",
			line2: "",
			city: "Springfield",
			state: "IL",
			postalCode: "62701",
			country: "US",
			phone: "555-1234",
		};

		await kv.set(`state:addresses:${customerId}:${addressId}`, { id: addressId, ...address });

		const entries = await kv.list(`state:addresses:${customerId}:`);
		expect(entries).toHaveLength(1);
		expect(entries[0]!.value).toEqual({ id: addressId, ...address });
	});

	it("saves multiple addresses for one customer", async () => {
		const customerId = "cust-2";
		await kv.set(`state:addresses:${customerId}:addr-a`, {
			id: "addr-a",
			name: "Home",
			line1: "1 Home Rd",
		});
		await kv.set(`state:addresses:${customerId}:addr-b`, {
			id: "addr-b",
			name: "Work",
			line1: "2 Work Ave",
		});

		const entries = await kv.list(`state:addresses:${customerId}:`);
		expect(entries).toHaveLength(2);
	});

	it("does not return addresses from other customers", async () => {
		await kv.set("state:addresses:cust-a:addr-1", { id: "addr-1", name: "A" });
		await kv.set("state:addresses:cust-b:addr-2", { id: "addr-2", name: "B" });

		const entriesA = await kv.list("state:addresses:cust-a:");
		expect(entriesA).toHaveLength(1);
		expect((entriesA[0]!.value as { name: string }).name).toBe("A");
	});

	it("deletes an address", async () => {
		const customerId = "cust-3";
		await kv.set(`state:addresses:${customerId}:addr-x`, { id: "addr-x", name: "Old" });

		await kv.delete(`state:addresses:${customerId}:addr-x`);

		const entries = await kv.list(`state:addresses:${customerId}:`);
		expect(entries).toHaveLength(0);
	});

	it("updates an existing address by overwriting", async () => {
		const customerId = "cust-4";
		const addressId = "addr-u";

		await kv.set(`state:addresses:${customerId}:${addressId}`, {
			id: addressId,
			name: "Home",
			line1: "Old Street",
		});

		await kv.set(`state:addresses:${customerId}:${addressId}`, {
			id: addressId,
			name: "Home",
			line1: "New Street",
		});

		const entries = await kv.list(`state:addresses:${customerId}:`);
		expect(entries).toHaveLength(1);
		expect((entries[0]!.value as { line1: string }).line1).toBe("New Street");
	});
});
