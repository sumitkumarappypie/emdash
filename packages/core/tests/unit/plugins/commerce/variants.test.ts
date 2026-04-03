import { describe, it, expect, beforeEach } from "vitest";

import {
	createVariant,
	getVariant,
	listVariantsByProduct,
	updateVariant,
	deleteVariant,
	generateVariantCombinations,
} from "../../../../../plugins/commerce/src/variants.js";

// Mock storage collection
function createMockStorage() {
	const store = new Map<string, unknown>();
	return {
		get: async (id: string) => store.get(id) ?? null,
		put: async (id: string, data: unknown) => {
			store.set(id, data);
		},
		delete: async (id: string) => store.delete(id),
		exists: async (id: string) => store.has(id),
		query: async (opts?: {
			where?: Record<string, unknown>;
			orderBy?: Record<string, string>;
			limit?: number;
			cursor?: string;
		}) => {
			let items = Array.from(store.entries(), ([id, data]) => ({ id, data }));
			if (opts?.where) {
				for (const [key, value] of Object.entries(opts.where)) {
					items = items.filter((item) => (item.data as Record<string, unknown>)[key] === value);
				}
			}
			if (opts?.orderBy) {
				const [field, dir] = Object.entries(opts.orderBy)[0]!;
				items.sort((a, b) => {
					const av = (a.data as Record<string, unknown>)[field];
					const bv = (b.data as Record<string, unknown>)[field];
					if (typeof av === "number" && typeof bv === "number") {
						return dir === "asc" ? av - bv : bv - av;
					}
					const as = String(av);
					const bs = String(bv);
					return dir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
				});
			}
			const limit = opts?.limit ?? 50;
			return { items: items.slice(0, limit), hasMore: items.length > limit };
		},
		count: async (where?: Record<string, unknown>) => {
			if (!where) return store.size;
			let count = 0;
			for (const data of store.values()) {
				let match = true;
				for (const [key, value] of Object.entries(where)) {
					if ((data as Record<string, unknown>)[key] !== value) {
						match = false;
						break;
					}
				}
				if (match) count++;
			}
			return count;
		},
	};
}

describe("Variant CRUD", () => {
	let storage: ReturnType<typeof createMockStorage>;
	const productId = "product-123";

	beforeEach(() => {
		storage = createMockStorage();
	});

	it("creates a variant and returns it with generated id", async () => {
		const variant = await createVariant(storage, productId, {
			name: "Red / Small",
			optionValues: { color: "Red", size: "Small" },
		});

		expect(variant.id).toBeDefined();
		expect(variant.productId).toBe(productId);
		expect(variant.name).toBe("Red / Small");
		expect(variant.optionValues).toEqual({ color: "Red", size: "Small" });
		expect(variant.status).toBe("active");
	});

	it("retrieves a variant by id", async () => {
		const created = await createVariant(storage, productId, {
			name: "Blue / Large",
			optionValues: { color: "Blue", size: "Large" },
		});

		const retrieved = await getVariant(storage, created.id);
		expect(retrieved).toEqual(created);
	});

	it("returns null for nonexistent variant", async () => {
		const result = await getVariant(storage, "nonexistent");
		expect(result).toBeNull();
	});

	it("lists variants scoped to a productId", async () => {
		const otherProductId = "other-product-456";

		await createVariant(storage, productId, { name: "Variant A", optionValues: { size: "S" } });
		await createVariant(storage, productId, { name: "Variant B", optionValues: { size: "M" } });
		await createVariant(storage, otherProductId, {
			name: "Other Variant",
			optionValues: { size: "L" },
		});

		const variants = await listVariantsByProduct(storage, productId);
		expect(variants).toHaveLength(2);
		for (const v of variants) {
			expect(v.productId).toBe(productId);
		}
	});

	it("generates cartesian product of variant combinations", async () => {
		const variants = await generateVariantCombinations(storage, productId, {
			color: ["Red", "Blue"],
			size: ["S", "M"],
		});

		expect(variants).toHaveLength(4);

		const names = variants.map((v) => v.name);
		expect(names).toContain("Red / S");
		expect(names).toContain("Red / M");
		expect(names).toContain("Blue / S");
		expect(names).toContain("Blue / M");

		for (const v of variants) {
			expect(v.productId).toBe(productId);
		}
	});

	it("updates a variant", async () => {
		const created = await createVariant(storage, productId, {
			name: "Original",
			optionValues: { size: "S" },
			price: 10,
		});

		const updated = await updateVariant(storage, created.id, { name: "Updated", price: 15 });
		expect(updated!.name).toBe("Updated");
		expect(updated!.price).toBe(15);
		expect(updated!.productId).toBe(productId);
	});

	it("returns null when updating nonexistent variant", async () => {
		const result = await updateVariant(storage, "nonexistent", { name: "Nope" });
		expect(result).toBeNull();
	});

	it("deletes a variant (hard delete)", async () => {
		const created = await createVariant(storage, productId, {
			name: "To Delete",
			optionValues: { size: "XL" },
		});

		const deleted = await deleteVariant(storage, created.id);
		expect(deleted).toBe(true);

		const retrieved = await getVariant(storage, created.id);
		expect(retrieved).toBeNull();
	});

	it("returns false when deleting nonexistent variant", async () => {
		const result = await deleteVariant(storage, "nonexistent");
		expect(result).toBe(false);
	});
});
