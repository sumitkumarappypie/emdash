import type { StorageCollection } from "./storage-types.js";
import type { Customer } from "./types.js";
import { createCustomerSchema, updateCustomerSchema } from "./validation.js";

function generateId(): string {
	return crypto.randomUUID();
}

export async function createCustomer(
	storage: StorageCollection,
	input: Record<string, unknown>,
): Promise<Customer> {
	const validated = createCustomerSchema.parse(input);
	const now = new Date().toISOString();
	const id = generateId();

	const customer: Customer = {
		id,
		userId: null,
		email: validated.email,
		name: validated.name,
		phone: validated.phone,
		passwordHash: null,
		defaultShippingAddress: validated.defaultShippingAddress,
		defaultBillingAddress: validated.defaultBillingAddress,
		totalOrders: 0,
		totalSpent: 0,
		tags: validated.tags,
		acceptsMarketing: validated.acceptsMarketing,
		createdAt: now,
		updatedAt: now,
	};

	await storage.put(id, customer);
	return customer;
}

export async function getCustomer(
	storage: StorageCollection,
	id: string,
): Promise<Customer | null> {
	return storage.get(id);
}

export async function getCustomerByEmail(
	storage: StorageCollection,
	email: string,
): Promise<Customer | null> {
	const result = await storage.query({ where: { email }, limit: 1 });
	return result.items[0]?.data ?? null;
}

export async function listCustomers(
	storage: StorageCollection,
	opts: {
		search?: string;
		limit?: number;
		cursor?: string;
	},
): Promise<{ items: Customer[]; hasMore: boolean; cursor?: string }> {
	const where: Record<string, unknown> = {};
	if (opts.search) where.search = opts.search;

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

export async function updateCustomer(
	storage: StorageCollection,
	id: string,
	input: Record<string, unknown>,
): Promise<Customer | null> {
	const existing = await storage.get(id);
	if (!existing) return null;

	const validated = updateCustomerSchema.parse(input);
	const updated: Customer = {
		...existing,
		...validated,
		id,
		updatedAt: new Date().toISOString(),
	};

	await storage.put(id, updated);
	return updated;
}

export async function incrementOrderStats(
	storage: StorageCollection,
	customerId: string,
	orderTotal: number,
): Promise<Customer | null> {
	const existing = await storage.get(customerId);
	if (!existing) return null;

	const updated: Customer = {
		...existing,
		totalOrders: existing.totalOrders + 1,
		totalSpent: existing.totalSpent + orderTotal,
		updatedAt: new Date().toISOString(),
	};

	await storage.put(customerId, updated);
	return updated;
}
