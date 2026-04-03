import type { Product } from "./types.js";
import { createProductSchema, updateProductSchema } from "./validation.js";

type StorageCollection = {
	get(id: string): Promise<Product | null>;
	put(id: string, data: Product): Promise<void>;
	delete(id: string): Promise<boolean>;
	exists(id: string): Promise<boolean>;
	query(opts?: {
		where?: Record<string, unknown>;
		orderBy?: Record<string, string>;
		limit?: number;
		cursor?: string;
	}): Promise<{ items: Array<{ id: string; data: Product }>; hasMore: boolean; cursor?: string }>;
	count(where?: Record<string, unknown>): Promise<number>;
};

function generateId(): string {
	return crypto.randomUUID();
}

export async function createProduct(
	storage: StorageCollection,
	input: Record<string, unknown>,
): Promise<Product> {
	const validated = createProductSchema.parse(input);
	const now = new Date().toISOString();
	const id = generateId();

	const product: Product = {
		id,
		slug: validated.slug,
		status: validated.status,
		name: validated.name,
		description: validated.description,
		shortDescription: validated.shortDescription,
		productType: validated.productType,
		sku: validated.sku,
		barcode: validated.barcode,
		basePrice: validated.basePrice,
		compareAtPrice: validated.compareAtPrice,
		currency: validated.currency,
		trackInventory: validated.trackInventory,
		inventoryQuantity: validated.inventoryQuantity,
		lowStockThreshold: validated.lowStockThreshold,
		weight: validated.weight,
		weightUnit: validated.weightUnit,
		dimensionsLength: validated.dimensionsLength,
		dimensionsWidth: validated.dimensionsWidth,
		dimensionsHeight: validated.dimensionsHeight,
		dimensionUnit: validated.dimensionUnit,
		taxClass: validated.taxClass,
		isFeatured: validated.isFeatured,
		sortOrder: validated.sortOrder,
		images: validated.images,
		metadata: validated.metadata,
		createdAt: now,
		updatedAt: now,
	};

	await storage.put(id, product);
	return product;
}

export async function getProduct(storage: StorageCollection, id: string): Promise<Product | null> {
	return storage.get(id);
}

export async function getProductBySlug(
	storage: StorageCollection,
	slug: string,
): Promise<Product | null> {
	const result = await storage.query({ where: { slug }, limit: 1 });
	return result.items[0]?.data ?? null;
}

export async function listProducts(
	storage: StorageCollection,
	opts: {
		status?: string;
		productType?: string;
		featured?: boolean;
		limit?: number;
		cursor?: string;
	},
): Promise<{ items: Product[]; hasMore: boolean; cursor?: string }> {
	const where: Record<string, unknown> = {};
	if (opts.status) where.status = opts.status;
	if (opts.productType) where.productType = opts.productType;
	if (opts.featured !== undefined) where.isFeatured = opts.featured;

	const result = await storage.query({
		where: Object.keys(where).length > 0 ? where : undefined,
		orderBy: { createdAt: "desc" },
		limit: Math.min(opts.limit ?? 50, 100),
		cursor: opts.cursor,
	});

	return {
		items: result.items.map((item) => item.data),
		hasMore: result.hasMore,
		cursor: result.cursor,
	};
}

export async function updateProduct(
	storage: StorageCollection,
	id: string,
	input: Record<string, unknown>,
): Promise<Product | null> {
	const existing = await storage.get(id);
	if (!existing) return null;

	const validated = updateProductSchema.parse(input);
	const updated: Product = {
		...existing,
		...validated,
		id,
		updatedAt: new Date().toISOString(),
	};

	await storage.put(id, updated);
	return updated;
}

export async function deleteProduct(storage: StorageCollection, id: string): Promise<boolean> {
	const existing = await storage.get(id);
	if (!existing) return false;

	const archived: Product = {
		...existing,
		status: "archived",
		updatedAt: new Date().toISOString(),
	};

	await storage.put(id, archived);
	return true;
}
