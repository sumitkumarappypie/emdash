import { CommerceError } from "./cart.js";
import type { Order, OrderItem, OrderStatus, FulfillmentStatus } from "./types.js";

type StorageCollection<T = unknown> = {
	get(id: string): Promise<T | null>;
	put(id: string, data: T): Promise<void>;
	delete(id: string): Promise<boolean>;
	query(opts?: {
		where?: Record<string, unknown>;
		orderBy?: Record<string, string>;
		limit?: number;
	}): Promise<{ items: Array<{ id: string; data: T }>; hasMore: boolean }>;
};

export async function getOrder(
	storage: StorageCollection<Order>,
	id: string,
): Promise<Order | null> {
	return storage.get(id);
}

export async function getOrderByNumber(
	storage: StorageCollection<Order>,
	orderNumber: string,
): Promise<Order | null> {
	const result = await storage.query({ where: { orderNumber }, limit: 1 });
	return result.items[0]?.data ?? null;
}

export async function listOrders(
	storage: StorageCollection<Order>,
	opts: {
		status?: OrderStatus;
		paymentStatus?: string;
		fulfillmentStatus?: FulfillmentStatus;
		limit?: number;
		cursor?: string;
	} = {},
): Promise<{ items: Order[]; hasMore: boolean }> {
	const where: Record<string, unknown> = {};
	if (opts.status) where.status = opts.status;
	if (opts.paymentStatus) where.paymentStatus = opts.paymentStatus;
	if (opts.fulfillmentStatus) where.fulfillmentStatus = opts.fulfillmentStatus;

	const result = await storage.query({
		where: Object.keys(where).length > 0 ? where : undefined,
		orderBy: { createdAt: "desc" },
		limit: Math.min(opts.limit ?? 50, 100),
	});

	return {
		items: result.items.map((item) => item.data),
		hasMore: result.hasMore,
	};
}

export async function getOrderItems(
	storage: StorageCollection<OrderItem>,
	orderId: string,
): Promise<OrderItem[]> {
	const result = await storage.query({ where: { orderId }, limit: 1000 });
	return result.items.map((item) => item.data);
}

export async function updateOrderStatus(
	storage: StorageCollection<Order>,
	orderId: string,
	status: OrderStatus,
): Promise<Order | null> {
	const order = await storage.get(orderId);
	if (!order) return null;

	const updated: Order = {
		...order,
		status,
		updatedAt: new Date().toISOString(),
	};

	await storage.put(orderId, updated);
	return updated;
}

export async function fulfillOrder(
	orderStorage: StorageCollection<Order>,
	orderItemStorage: StorageCollection<OrderItem>,
	orderId: string,
	input: {
		itemIds: string[];
		trackingNumber?: string;
		trackingUrl?: string;
	},
): Promise<Order | null> {
	const order = await orderStorage.get(orderId);
	if (!order) return null;

	// Mark specified items as fulfilled
	for (const itemId of input.itemIds) {
		const item = await orderItemStorage.get(itemId);
		if (!item) {
			throw new CommerceError("ORDER_ITEM_NOT_FOUND", `Order item ${itemId} not found`);
		}
		if (item.orderId !== orderId) {
			throw new CommerceError(
				"ORDER_ITEM_MISMATCH",
				`Order item ${itemId} does not belong to order ${orderId}`,
			);
		}
		const updatedItem: OrderItem = {
			...item,
			fulfillmentStatus: "fulfilled",
		};
		await orderItemStorage.put(itemId, updatedItem);
	}

	// Check if all items are fulfilled
	const allItems = await getOrderItems(orderItemStorage, orderId);
	const allFulfilled = allItems.every((item) => item.fulfillmentStatus === "fulfilled");
	const someFulfilled = allItems.some((item) => item.fulfillmentStatus === "fulfilled");

	let fulfillmentStatus: FulfillmentStatus = "unfulfilled";
	if (allFulfilled) {
		fulfillmentStatus = "fulfilled";
	} else if (someFulfilled) {
		fulfillmentStatus = "partially_fulfilled";
	}

	const updated: Order = {
		...order,
		fulfillmentStatus,
		status: allFulfilled ? "shipped" : order.status,
		trackingNumber: input.trackingNumber ?? order.trackingNumber,
		trackingUrl: input.trackingUrl ?? order.trackingUrl,
		updatedAt: new Date().toISOString(),
	};

	await orderStorage.put(orderId, updated);
	return updated;
}

export async function markOrderPaid(
	storage: StorageCollection<Order>,
	orderId: string,
	paymentIntentId: string,
): Promise<Order | null> {
	const order = await storage.get(orderId);
	if (!order) return null;

	const updated: Order = {
		...order,
		paymentStatus: "paid",
		status: "paid",
		paymentIntentId,
		updatedAt: new Date().toISOString(),
	};

	await storage.put(orderId, updated);
	return updated;
}
