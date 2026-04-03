import type { Variant } from "./types.js";
import { createVariantSchema, updateVariantSchema } from "./validation.js";

type StorageCollection = {
	get(id: string): Promise<Variant | null>;
	put(id: string, data: Variant): Promise<void>;
	delete(id: string): Promise<boolean>;
	exists(id: string): Promise<boolean>;
	query(opts?: {
		where?: Record<string, unknown>;
		orderBy?: Record<string, string>;
		limit?: number;
		cursor?: string;
	}): Promise<{ items: Array<{ id: string; data: Variant }>; hasMore: boolean; cursor?: string }>;
	count(where?: Record<string, unknown>): Promise<number>;
};

function generateId(): string {
	return crypto.randomUUID();
}

function cartesian(arrays: string[][]): string[][] {
	return arrays.reduce<string[][]>(
		(acc, curr) => acc.flatMap((combo) => curr.map((val) => [...combo, val])),
		[[]],
	);
}

export async function createVariant(
	storage: StorageCollection,
	productId: string,
	input: Record<string, unknown>,
): Promise<Variant> {
	const validated = createVariantSchema.parse(input);
	const now = new Date().toISOString();
	const id = generateId();

	const variant: Variant = {
		id,
		productId,
		name: validated.name,
		sku: validated.sku,
		barcode: validated.barcode,
		price: validated.price,
		compareAtPrice: validated.compareAtPrice,
		inventoryQuantity: validated.inventoryQuantity,
		trackInventory: validated.trackInventory,
		weight: validated.weight,
		dimensionsLength: validated.dimensionsLength,
		dimensionsWidth: validated.dimensionsWidth,
		dimensionsHeight: validated.dimensionsHeight,
		optionValues: validated.optionValues,
		sortOrder: validated.sortOrder,
		status: validated.status,
		createdAt: now,
		updatedAt: now,
	};

	await storage.put(id, variant);
	return variant;
}

export async function getVariant(storage: StorageCollection, id: string): Promise<Variant | null> {
	return storage.get(id);
}

export async function listVariantsByProduct(
	storage: StorageCollection,
	productId: string,
): Promise<Variant[]> {
	const result = await storage.query({
		where: { productId },
		orderBy: { sortOrder: "asc" },
		limit: 100,
	});
	return result.items.map((item) => item.data);
}

export async function updateVariant(
	storage: StorageCollection,
	id: string,
	input: Record<string, unknown>,
): Promise<Variant | null> {
	const existing = await storage.get(id);
	if (!existing) return null;

	const validated = updateVariantSchema.parse(input);
	const updated: Variant = {
		...existing,
		...validated,
		id,
		updatedAt: new Date().toISOString(),
	};

	await storage.put(id, updated);
	return updated;
}

export async function deleteVariant(storage: StorageCollection, id: string): Promise<boolean> {
	return storage.delete(id);
}

export async function generateVariantCombinations(
	storage: StorageCollection,
	productId: string,
	optionTypes: Record<string, string[]>,
): Promise<Variant[]> {
	const keys = Object.keys(optionTypes);
	const valueSets = Object.values(optionTypes);
	const combos = cartesian(valueSets);
	const variants: Variant[] = [];

	for (let i = 0; i < combos.length; i++) {
		const optionValues: Record<string, string> = {};
		for (let j = 0; j < keys.length; j++) {
			optionValues[keys[j]!] = combos[i]![j]!;
		}

		const name = Object.values(optionValues).join(" / ");
		const variant = await createVariant(storage, productId, {
			name,
			optionValues,
			sortOrder: i,
		});
		variants.push(variant);
	}

	return variants;
}
