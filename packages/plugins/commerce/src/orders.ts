import { CommerceError } from "./cart.js";
import type { StorageCollection } from "./storage-types.js";
import type { Order, OrderItem, OrderStatus, FulfillmentStatus } from "./types.js";

export async function getOrder(storage: StorageCollection, id: string): Promise<Order | null> {
	return storage.get(id);
}

export async function getOrderByNumber(
	storage: StorageCollection,
	orderNumber: string,
): Promise<Order | null> {
	const result = await storage.query({ where: { orderNumber }, limit: 1 });
	return result.items[0]?.data ?? null;
}

export async function listOrders(
	storage: StorageCollection,
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
	storage: StorageCollection,
	orderId: string,
): Promise<OrderItem[]> {
	const result = await storage.query({ where: { orderId }, limit: 1000 });
	return result.items.map((item) => item.data);
}

export async function updateOrderStatus(
	storage: StorageCollection,
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
	orderStorage: StorageCollection,
	orderItemStorage: StorageCollection,
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

export async function refundOrder(
	orderStorage: StorageCollection,
	transactionStorage: StorageCollection,
	orderId: string,
	input: { amount?: number; reason?: string },
	inventoryStorages?: {
		orderItems: StorageCollection;
		products: StorageCollection;
	},
): Promise<Order> {
	const order = await orderStorage.get(orderId);
	if (!order) throw new CommerceError("ORDER_NOT_FOUND", "Order not found");
	if (order.paymentStatus === "unpaid")
		throw new CommerceError("ORDER_NOT_PAID", "Cannot refund unpaid order");
	if (order.paymentStatus === "refunded")
		throw new CommerceError("ORDER_ALREADY_REFUNDED", "Order already fully refunded");

	const refundAmount = input.amount ?? order.total;
	if (refundAmount > order.total)
		throw new CommerceError("REFUND_EXCEEDS_TOTAL", "Refund amount exceeds order total");

	const isFullRefund = refundAmount >= order.total;
	const transactionType = isFullRefund ? ("refund" as const) : ("partial_refund" as const);

	// Record refund transaction
	const txnId = crypto.randomUUID();
	await transactionStorage.put(txnId, {
		id: txnId,
		orderId,
		type: transactionType,
		amount: refundAmount,
		currency: order.currency,
		provider: order.paymentProvider ?? "",
		providerTransactionId: `refund-${txnId}`,
		status: "succeeded",
		metadata: { reason: input.reason ?? "" },
		createdAt: new Date().toISOString(),
	});

	// Restore inventory on full refund
	if (isFullRefund && inventoryStorages) {
		const items = await getOrderItems(inventoryStorages.orderItems, orderId);
		for (const item of items) {
			const product = await inventoryStorages.products.get(item.productId);
			if (!product || !product.trackInventory) continue;
			const restored = ((product.inventoryQuantity as number) ?? 0) + item.quantity;
			await inventoryStorages.products.put(item.productId, {
				...product,
				inventoryQuantity: restored,
				updatedAt: new Date().toISOString(),
			});
		}
	}

	const updated: Order = {
		...order,
		paymentStatus: isFullRefund ? "refunded" : "partially_refunded",
		status: isFullRefund ? "refunded" : order.status,
		updatedAt: new Date().toISOString(),
	};

	await orderStorage.put(orderId, updated);
	return updated;
}

export async function markOrderPaid(
	storage: StorageCollection,
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
