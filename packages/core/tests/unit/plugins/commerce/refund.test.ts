import { describe, it, expect, beforeEach } from "vitest";

import { refundOrder } from "../../../../../plugins/commerce/src/orders.js";
import { getTransactionsByOrder } from "../../../../../plugins/commerce/src/transactions.js";
import type { Order, OrderItem } from "../../../../../plugins/commerce/src/types.js";

function createMockStorage<T = unknown>() {
	const store = new Map<string, T>();
	return {
		get: async (id: string): Promise<T | null> => store.get(id) ?? null,
		put: async (id: string, data: T): Promise<void> => {
			store.set(id, data);
		},
		delete: async (id: string): Promise<boolean> => store.delete(id),
		exists: async (id: string): Promise<boolean> => store.has(id),
		query: async (opts?: {
			where?: Record<string, unknown>;
			orderBy?: Record<string, string>;
			limit?: number;
		}): Promise<{ items: Array<{ id: string; data: T }>; hasMore: boolean }> => {
			let items = Array.from(store.entries(), ([id, data]) => ({ id, data }));
			if (opts?.where) {
				for (const [key, value] of Object.entries(opts.where)) {
					items = items.filter((item) => (item.data as Record<string, unknown>)[key] === value);
				}
			}
			const limit = opts?.limit ?? 50;
			return { items: items.slice(0, limit), hasMore: items.length > limit };
		},
		count: async (): Promise<number> => store.size,
	};
}

function makePaidOrder(overrides: Partial<Order> = {}): Order {
	return {
		id: "order-1",
		orderNumber: "ORD-1001",
		customerId: null,
		customerEmail: "test@example.com",
		customerName: "Test User",
		status: "paid",
		paymentStatus: "paid",
		fulfillmentStatus: "unfulfilled",
		subtotal: 100,
		discountTotal: 0,
		shippingTotal: 0,
		taxTotal: 0,
		total: 100,
		currency: "USD",
		shippingAddress: null,
		billingAddress: null,
		shippingMethod: null,
		trackingNumber: null,
		trackingUrl: null,
		paymentProvider: "stripe",
		paymentIntentId: "pi_test",
		notes: "",
		customerNotes: "",
		metadata: {},
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		...overrides,
	};
}

describe("Refund Flow", () => {
	let orderStorage: ReturnType<typeof createMockStorage<Order>>;
	let transactionStorage: ReturnType<typeof createMockStorage>;
	let orderItemStorage: ReturnType<typeof createMockStorage<OrderItem>>;
	let productStorage: ReturnType<typeof createMockStorage>;

	beforeEach(() => {
		orderStorage = createMockStorage<Order>();
		transactionStorage = createMockStorage();
		orderItemStorage = createMockStorage<OrderItem>();
		productStorage = createMockStorage();
	});

	it("processes a full refund", async () => {
		const order = makePaidOrder();
		await orderStorage.put(order.id, order);

		const refunded = await refundOrder(
			orderStorage as never,
			transactionStorage as never,
			order.id,
			{},
		);

		expect(refunded.paymentStatus).toBe("refunded");
		expect(refunded.status).toBe("refunded");
	});

	it("processes a partial refund", async () => {
		const order = makePaidOrder({ total: 100 });
		await orderStorage.put(order.id, order);

		const refunded = await refundOrder(
			orderStorage as never,
			transactionStorage as never,
			order.id,
			{ amount: 25, reason: "Damaged item" },
		);

		expect(refunded.paymentStatus).toBe("partially_refunded");
		expect(refunded.status).toBe("paid"); // Overall status unchanged for partial
	});

	it("records refund transaction", async () => {
		const order = makePaidOrder({ total: 100 });
		await orderStorage.put(order.id, order);

		await refundOrder(orderStorage as never, transactionStorage as never, order.id, { amount: 25 });

		const txns = await getTransactionsByOrder(transactionStorage as never, order.id);
		expect(txns).toHaveLength(1);
		expect(txns[0]!.type).toBe("partial_refund");
		expect(txns[0]!.amount).toBe(25);
		expect(txns[0]!.status).toBe("succeeded");
	});

	it("rejects refund on unpaid order", async () => {
		const order = makePaidOrder({ paymentStatus: "unpaid" });
		await orderStorage.put(order.id, order);

		await expect(
			refundOrder(orderStorage as never, transactionStorage as never, order.id, {}),
		).rejects.toMatchObject({ code: "ORDER_NOT_PAID" });
	});

	it("rejects refund exceeding order total", async () => {
		const order = makePaidOrder({ total: 100 });
		await orderStorage.put(order.id, order);

		await expect(
			refundOrder(orderStorage as never, transactionStorage as never, order.id, {
				amount: 150,
			}),
		).rejects.toMatchObject({ code: "REFUND_EXCEEDS_TOTAL" });
	});

	it("rejects refund on already-refunded order", async () => {
		const order = makePaidOrder({ paymentStatus: "refunded" });
		await orderStorage.put(order.id, order);

		await expect(
			refundOrder(orderStorage as never, transactionStorage as never, order.id, {}),
		).rejects.toMatchObject({ code: "ORDER_ALREADY_REFUNDED" });
	});

	it("restores inventory on full refund", async () => {
		const order = makePaidOrder({ total: 100 });
		await orderStorage.put(order.id, order);

		const orderItem: OrderItem = {
			id: "oi-1",
			orderId: order.id,
			productId: "prod-1",
			variantId: null,
			productName: "Widget",
			variantName: "",
			sku: "W-001",
			quantity: 2,
			unitPrice: 50,
			totalPrice: 100,
			fulfillmentStatus: "unfulfilled",
			metadata: {},
		};
		await orderItemStorage.put(orderItem.id, orderItem);

		await productStorage.put("prod-1", {
			id: "prod-1",
			trackInventory: true,
			inventoryQuantity: 8,
		});

		await refundOrder(
			orderStorage as never,
			transactionStorage as never,
			order.id,
			{},
			{
				orderItems: orderItemStorage as never,
				products: productStorage as never,
			},
		);

		const updated = await productStorage.get("prod-1");
		expect((updated as Record<string, unknown>).inventoryQuantity).toBe(10); // 8 + 2 restored
	});
});
