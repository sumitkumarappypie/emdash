import { describe, it, expect, beforeEach } from "vitest";

import {
	createCategory,
	getCategory,
	getCategoryBySlug,
	listCategories,
	updateCategory,
	deleteCategory,
	getCategoryTree,
} from "../../../../../plugins/commerce/src/categories.js";

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

describe("Category CRUD", () => {
	let storage: ReturnType<typeof createMockStorage>;

	beforeEach(() => {
		storage = createMockStorage();
	});

	it("creates a category and retrieves it by id", async () => {
		const category = await createCategory(storage, {
			name: "Electronics",
			slug: "electronics",
		});

		expect(category.id).toBeDefined();
		expect(category.name).toBe("Electronics");
		expect(category.slug).toBe("electronics");
		expect(category.parentId).toBeNull();
		expect(category.sortOrder).toBe(0);

		const retrieved = await getCategory(storage, category.id);
		expect(retrieved).toEqual(category);
	});

	it("returns null for nonexistent category", async () => {
		const result = await getCategory(storage, "nonexistent");
		expect(result).toBeNull();
	});

	it("retrieves a category by slug", async () => {
		const created = await createCategory(storage, {
			name: "Electronics",
			slug: "electronics",
		});

		const retrieved = await getCategoryBySlug(storage, "electronics");
		expect(retrieved).toEqual(created);
	});

	it("returns null for nonexistent slug", async () => {
		const result = await getCategoryBySlug(storage, "nonexistent");
		expect(result).toBeNull();
	});

	it("lists categories", async () => {
		await createCategory(storage, { name: "Electronics", slug: "electronics" });
		await createCategory(storage, { name: "Clothing", slug: "clothing" });

		const result = await listCategories(storage, { limit: 50 });
		expect(result.items).toHaveLength(2);
	});

	it("lists categories filtered by parentId", async () => {
		const parent = await createCategory(storage, { name: "Electronics", slug: "electronics" });
		await createCategory(storage, {
			name: "Phones",
			slug: "phones",
			parentId: parent.id,
		});
		await createCategory(storage, { name: "Clothing", slug: "clothing" });

		const result = await listCategories(storage, { parentId: parent.id });
		expect(result.items).toHaveLength(1);
		expect(result.items[0]!.name).toBe("Phones");
	});

	it("builds a category tree with nested children", async () => {
		const electronics = await createCategory(storage, {
			name: "Electronics",
			slug: "electronics",
			sortOrder: 0,
		});
		await createCategory(storage, {
			name: "Phones",
			slug: "phones",
			parentId: electronics.id,
			sortOrder: 0,
		});
		await createCategory(storage, {
			name: "Laptops",
			slug: "laptops",
			parentId: electronics.id,
			sortOrder: 1,
		});

		const tree = await getCategoryTree(storage);

		expect(tree).toHaveLength(1);
		expect(tree[0]!.name).toBe("Electronics");
		expect(tree[0]!.children).toHaveLength(2);

		const childNames = tree[0]!.children.map((c) => c.name);
		expect(childNames).toContain("Phones");
		expect(childNames).toContain("Laptops");
	});

	it("updates a category", async () => {
		const created = await createCategory(storage, {
			name: "Electronics",
			slug: "electronics",
		});

		const updated = await updateCategory(storage, created.id, {
			name: "Consumer Electronics",
		});

		expect(updated!.name).toBe("Consumer Electronics");
		expect(updated!.slug).toBe("electronics");
	});

	it("returns null when updating nonexistent category", async () => {
		const result = await updateCategory(storage, "nonexistent", { name: "Nope" });
		expect(result).toBeNull();
	});

	it("deletes a category", async () => {
		const created = await createCategory(storage, {
			name: "Electronics",
			slug: "electronics",
		});

		const deleted = await deleteCategory(storage, created.id);
		expect(deleted).toBe(true);

		const retrieved = await getCategory(storage, created.id);
		expect(retrieved).toBeNull();
	});

	it("returns false when deleting nonexistent category", async () => {
		const result = await deleteCategory(storage, "nonexistent");
		expect(result).toBe(false);
	});
});
