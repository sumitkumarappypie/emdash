import type { Category } from "./types.js";
import { createCategorySchema, updateCategorySchema } from "./validation.js";

type StorageCollection = {
	get(id: string): Promise<Category | null>;
	put(id: string, data: Category): Promise<void>;
	delete(id: string): Promise<boolean>;
	exists(id: string): Promise<boolean>;
	query(opts?: {
		where?: Record<string, unknown>;
		orderBy?: Record<string, string>;
		limit?: number;
		cursor?: string;
	}): Promise<{ items: Array<{ id: string; data: Category }>; hasMore: boolean; cursor?: string }>;
	count(where?: Record<string, unknown>): Promise<number>;
};

function generateId(): string {
	return crypto.randomUUID();
}

export async function createCategory(
	storage: StorageCollection,
	input: Record<string, unknown>,
): Promise<Category> {
	const validated = createCategorySchema.parse(input);
	const now = new Date().toISOString();
	const id = generateId();

	const category: Category = {
		id,
		slug: validated.slug,
		name: validated.name,
		description: validated.description,
		image: validated.image,
		parentId: validated.parentId,
		sortOrder: validated.sortOrder,
		createdAt: now,
		updatedAt: now,
	};

	await storage.put(id, category);
	return category;
}

export async function getCategory(
	storage: StorageCollection,
	id: string,
): Promise<Category | null> {
	return storage.get(id);
}

export async function getCategoryBySlug(
	storage: StorageCollection,
	slug: string,
): Promise<Category | null> {
	const result = await storage.query({ where: { slug }, limit: 1 });
	return result.items[0]?.data ?? null;
}

export async function listCategories(
	storage: StorageCollection,
	opts: {
		parentId?: string | null;
		limit?: number;
		cursor?: string;
	},
): Promise<{ items: Category[]; hasMore: boolean; cursor?: string }> {
	const where: Record<string, unknown> = {};
	if (opts.parentId !== undefined) where.parentId = opts.parentId;

	const result = await storage.query({
		where: Object.keys(where).length > 0 ? where : undefined,
		orderBy: { sortOrder: "asc" },
		limit: Math.min(opts.limit ?? 50, 100),
		cursor: opts.cursor,
	});

	return {
		items: result.items.map((item) => item.data),
		hasMore: result.hasMore,
		cursor: result.cursor,
	};
}

export async function updateCategory(
	storage: StorageCollection,
	id: string,
	input: Record<string, unknown>,
): Promise<Category | null> {
	const existing = await storage.get(id);
	if (!existing) return null;

	const validated = updateCategorySchema.parse(input);
	const updated: Category = {
		...existing,
		...validated,
		id,
		updatedAt: new Date().toISOString(),
	};

	await storage.put(id, updated);
	return updated;
}

export async function deleteCategory(storage: StorageCollection, id: string): Promise<boolean> {
	const existing = await storage.get(id);
	if (!existing) return false;

	return storage.delete(id);
}

export async function getCategoryTree(storage: StorageCollection): Promise<CategoryNode[]> {
	const result = await storage.query({ orderBy: { sortOrder: "asc" }, limit: 1000 });
	const categories = result.items.map((item) => item.data);

	const byId = new Map<string, CategoryNode>();
	for (const cat of categories) {
		byId.set(cat.id, { ...cat, children: [] });
	}

	const roots: CategoryNode[] = [];
	for (const node of byId.values()) {
		if (node.parentId && byId.has(node.parentId)) {
			byId.get(node.parentId)!.children.push(node);
		} else {
			roots.push(node);
		}
	}
	return roots;
}

export interface CategoryNode extends Category {
	children: CategoryNode[];
}
