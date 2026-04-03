import { describe, it, expect, beforeEach } from "vitest";

import {
	createProduct,
	getProduct,
	getProductBySlug,
	listProducts,
	updateProduct,
	deleteProduct,
} from "../../../../../plugins/commerce/src/products.js";

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
					const av = (a.data as Record<string, unknown>)[field] as string;
					const bv = (b.data as Record<string, unknown>)[field] as string;
					return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
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

describe("Product CRUD", () => {
	let storage: ReturnType<typeof createMockStorage>;

	beforeEach(() => {
		storage = createMockStorage();
	});

	it("creates a product and returns it with generated id", async () => {
		const product = await createProduct(storage, {
			name: "Test Product",
			slug: "test-product",
			basePrice: 29.99,
		});

		expect(product.id).toBeDefined();
		expect(product.name).toBe("Test Product");
		expect(product.slug).toBe("test-product");
		expect(product.basePrice).toBe(29.99);
		expect(product.status).toBe("draft");
		expect(product.productType).toBe("physical");
	});

	it("retrieves a product by id", async () => {
		const created = await createProduct(storage, {
			name: "Test Product",
			slug: "test-product",
			basePrice: 29.99,
		});

		const retrieved = await getProduct(storage, created.id);
		expect(retrieved).toEqual(created);
	});

	it("retrieves a product by slug", async () => {
		const created = await createProduct(storage, {
			name: "Test Product",
			slug: "test-product",
			basePrice: 29.99,
		});

		const retrieved = await getProductBySlug(storage, "test-product");
		expect(retrieved).toEqual(created);
	});

	it("returns null for nonexistent product", async () => {
		const result = await getProduct(storage, "nonexistent");
		expect(result).toBeNull();
	});

	it("lists products with pagination", async () => {
		await createProduct(storage, { name: "Product A", slug: "product-a", basePrice: 10 });
		await createProduct(storage, { name: "Product B", slug: "product-b", basePrice: 20 });

		const result = await listProducts(storage, { limit: 50 });
		expect(result.items).toHaveLength(2);
	});

	it("lists products filtered by status", async () => {
		await createProduct(storage, {
			name: "Active",
			slug: "active",
			basePrice: 10,
			status: "active",
		});
		await createProduct(storage, { name: "Draft", slug: "draft", basePrice: 20, status: "draft" });

		const result = await listProducts(storage, { status: "active", limit: 50 });
		expect(result.items).toHaveLength(1);
		expect(result.items[0]!.name).toBe("Active");
	});

	it("updates a product", async () => {
		const created = await createProduct(storage, {
			name: "Original",
			slug: "original",
			basePrice: 10,
		});

		const updated = await updateProduct(storage, created.id, { name: "Updated", basePrice: 15 });
		expect(updated!.name).toBe("Updated");
		expect(updated!.basePrice).toBe(15);
		expect(updated!.slug).toBe("original");
	});

	it("returns null when updating nonexistent product", async () => {
		const result = await updateProduct(storage, "nonexistent", { name: "Nope" });
		expect(result).toBeNull();
	});

	it("deletes a product (archives it)", async () => {
		const created = await createProduct(storage, {
			name: "To Delete",
			slug: "to-delete",
			basePrice: 10,
		});

		const deleted = await deleteProduct(storage, created.id);
		expect(deleted).toBe(true);

		const retrieved = await getProduct(storage, created.id);
		expect(retrieved!.status).toBe("archived");
	});
});
