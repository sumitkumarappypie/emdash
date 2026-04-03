import { describe, it, expect, beforeEach } from "vitest";

import {
	createCart,
	addCartItem,
	CommerceError,
} from "../../../../../plugins/commerce/src/cart.js";
import { createOrderFromCart } from "../../../../../plugins/commerce/src/checkout.js";
import {
	getOrder,
	getOrderItems,
	fulfillOrder,
	markOrderPaid,
	updateOrderStatus,
} from "../../../../../plugins/commerce/src/orders.js";

const ORDER_NUMBER_RE = /^ORD-\d+$/;

function createMockStorage<T = unknown>() {
	const store = new Map<string, T>();
	return {
		get: async (id: string): Promise<T | null> => store.get(id) ?? null,
		put: async (id: string, data: T): Promise<void> => {
			store.set(id, data);
		},
		delete: async (id: string): Promise<boolean> => store.delete(id),
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
		_store: store,
	};
}

describe("Checkout & Order Management", () => {
	let cartStorage: ReturnType<typeof createMockStorage>;
	let cartItemStorage: ReturnType<typeof createMockStorage>;
	let productStorage: ReturnType<typeof createMockStorage>;
	let variantStorage: ReturnType<typeof createMockStorage>;
	let orderStorage: ReturnType<typeof createMockStorage>;
	let orderItemStorage: ReturnType<typeof createMockStorage>;
	let customerStorage: ReturnType<typeof createMockStorage>;
	let orderCounterStorage: ReturnType<typeof createMockStorage>;

	function makeStorages() {
		return {
			carts: cartStorage as never,
			cartItems: cartItemStorage as never,
			orders: orderStorage as never,
			orderItems: orderItemStorage as never,
			products: productStorage as never,
			variants: variantStorage as never,
			customers: customerStorage as never,
			orderCounter: orderCounterStorage as never,
		};
	}

	beforeEach(async () => {
		cartStorage = createMockStorage();
		cartItemStorage = createMockStorage();
		productStorage = createMockStorage();
		variantStorage = createMockStorage();
		orderStorage = createMockStorage();
		orderItemStorage = createMockStorage();
		customerStorage = createMockStorage();
		orderCounterStorage = createMockStorage();

		// Initialize order counter
		await orderCounterStorage.put("current", { value: 1000 });

		// Create test products
		await productStorage.put("prod-a", {
			id: "prod-a",
			name: "Widget A",
			status: "active",
			basePrice: 25,
			sku: "SKU-A",
			trackInventory: true,
			inventoryQuantity: 10,
		});

		await productStorage.put("prod-b", {
			id: "prod-b",
			name: "Widget B",
			status: "active",
			basePrice: 50,
			sku: "SKU-B",
			trackInventory: false,
			inventoryQuantity: 0,
		});
	});

	async function createTestCartWithItems() {
		const cart = await createCart(cartStorage as never, { sessionId: "sess-checkout" });

		await addCartItem(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			cart.id,
			{ productId: "prod-a", quantity: 2 },
		);

		await addCartItem(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			cart.id,
			{ productId: "prod-b", quantity: 1 },
		);

		return cart;
	}

	describe("createOrderFromCart", () => {
		it("converts cart to order with correct totals", async () => {
			const cart = await createTestCartWithItems();

			const order = await createOrderFromCart(makeStorages(), cart.id, {
				email: "buyer@example.com",
				name: "Test Buyer",
				paymentProvider: "stripe",
			});

			expect(order.customerEmail).toBe("buyer@example.com");
			expect(order.customerName).toBe("Test Buyer");
			expect(order.paymentProvider).toBe("stripe");
			expect(order.status).toBe("pending");
			expect(order.paymentStatus).toBe("unpaid");
			expect(order.fulfillmentStatus).toBe("unfulfilled");
			// prod-a: 25 * 2 = 50, prod-b: 50 * 1 = 50
			expect(order.subtotal).toBe(100);
			expect(order.total).toBe(100);
			expect(order.orderNumber).toMatch(ORDER_NUMBER_RE);
		});

		it("snapshots product data in order items", async () => {
			const cart = await createTestCartWithItems();

			const order = await createOrderFromCart(makeStorages(), cart.id, {
				email: "buyer@example.com",
				name: "Test Buyer",
				paymentProvider: "stripe",
			});

			const items = await getOrderItems(orderItemStorage as never, order.id);
			expect(items).toHaveLength(2);

			const widgetA = items.find((i) => i.productId === "prod-a");
			expect(widgetA).toBeDefined();
			expect(widgetA!.productName).toBe("Widget A");
			expect(widgetA!.unitPrice).toBe(25);
			expect(widgetA!.quantity).toBe(2);
			expect(widgetA!.totalPrice).toBe(50);
			expect(widgetA!.sku).toBe("SKU-A");

			const widgetB = items.find((i) => i.productId === "prod-b");
			expect(widgetB).toBeDefined();
			expect(widgetB!.productName).toBe("Widget B");
			expect(widgetB!.unitPrice).toBe(50);
			expect(widgetB!.quantity).toBe(1);
			expect(widgetB!.totalPrice).toBe(50);
			expect(widgetB!.sku).toBe("SKU-B");
		});

		it("generates sequential order numbers", async () => {
			const cart1 = await createTestCartWithItems();
			const order1 = await createOrderFromCart(makeStorages(), cart1.id, {
				email: "buyer1@example.com",
				name: "Buyer One",
				paymentProvider: "stripe",
			});

			// Create a second cart
			const cart2 = await createCart(cartStorage as never, { sessionId: "sess-checkout-2" });
			await addCartItem(
				cartStorage as never,
				cartItemStorage as never,
				productStorage as never,
				variantStorage as never,
				cart2.id,
				{ productId: "prod-b", quantity: 1 },
			);

			const order2 = await createOrderFromCart(makeStorages(), cart2.id, {
				email: "buyer2@example.com",
				name: "Buyer Two",
				paymentProvider: "stripe",
			});

			expect(order1.orderNumber).toBe("ORD-1001");
			expect(order2.orderNumber).toBe("ORD-1002");
		});

		it("rejects checkout on empty cart", async () => {
			const cart = await createCart(cartStorage as never, { sessionId: "sess-empty" });

			await expect(
				createOrderFromCart(makeStorages(), cart.id, {
					email: "buyer@example.com",
					name: "Test Buyer",
					paymentProvider: "stripe",
				}),
			).rejects.toThrow(CommerceError);

			await expect(
				createOrderFromCart(makeStorages(), cart.id, {
					email: "buyer@example.com",
					name: "Test Buyer",
					paymentProvider: "stripe",
				}),
			).rejects.toMatchObject({ code: "CART_EMPTY" });
		});

		it("rejects checkout on expired cart", async () => {
			const cart = await createCart(cartStorage as never, { sessionId: "sess-expired" });

			// Manually expire the cart
			const expired = { ...cart, expiresAt: new Date(Date.now() - 1000).toISOString() };
			await cartStorage.put(cart.id, expired);

			await expect(
				createOrderFromCart(makeStorages(), cart.id, {
					email: "buyer@example.com",
					name: "Test Buyer",
					paymentProvider: "stripe",
				}),
			).rejects.toThrow(CommerceError);

			await expect(
				createOrderFromCart(makeStorages(), cart.id, {
					email: "buyer@example.com",
					name: "Test Buyer",
					paymentProvider: "stripe",
				}),
			).rejects.toMatchObject({ code: "CART_EXPIRED" });
		});

		it("deletes cart after successful order creation", async () => {
			const cart = await createTestCartWithItems();

			await createOrderFromCart(makeStorages(), cart.id, {
				email: "buyer@example.com",
				name: "Test Buyer",
				paymentProvider: "stripe",
			});

			const deletedCart = await cartStorage.get(cart.id);
			expect(deletedCart).toBeNull();
		});

		it("decrements inventory on checkout", async () => {
			const cart = await createTestCartWithItems();

			await createOrderFromCart(makeStorages(), cart.id, {
				email: "buyer@example.com",
				name: "Test Buyer",
				paymentProvider: "stripe",
			});

			const product = (await productStorage.get("prod-a")) as Record<string, unknown>;
			expect(product).not.toBeNull();
			// Started with 10, ordered 2
			expect(product.inventoryQuantity).toBe(8);
		});
	});

	describe("Order operations", () => {
		it("gets an order by id", async () => {
			const cart = await createTestCartWithItems();
			const order = await createOrderFromCart(makeStorages(), cart.id, {
				email: "buyer@example.com",
				name: "Test Buyer",
				paymentProvider: "stripe",
			});

			const fetched = await getOrder(orderStorage as never, order.id);
			expect(fetched).not.toBeNull();
			expect(fetched!.id).toBe(order.id);
			expect(fetched!.orderNumber).toBe(order.orderNumber);
		});

		it("updates order status", async () => {
			const cart = await createTestCartWithItems();
			const order = await createOrderFromCart(makeStorages(), cart.id, {
				email: "buyer@example.com",
				name: "Test Buyer",
				paymentProvider: "stripe",
			});

			const updated = await updateOrderStatus(orderStorage as never, order.id, "processing");
			expect(updated).not.toBeNull();
			expect(updated!.status).toBe("processing");
		});

		it("marks order as paid", async () => {
			const cart = await createTestCartWithItems();
			const order = await createOrderFromCart(makeStorages(), cart.id, {
				email: "buyer@example.com",
				name: "Test Buyer",
				paymentProvider: "stripe",
			});

			const paid = await markOrderPaid(orderStorage as never, order.id, "pi_123abc");
			expect(paid).not.toBeNull();
			expect(paid!.paymentStatus).toBe("paid");
			expect(paid!.status).toBe("paid");
			expect(paid!.paymentIntentId).toBe("pi_123abc");
		});

		it("fulfills order items and updates order status to shipped", async () => {
			const cart = await createTestCartWithItems();
			const order = await createOrderFromCart(makeStorages(), cart.id, {
				email: "buyer@example.com",
				name: "Test Buyer",
				paymentProvider: "stripe",
			});

			const items = await getOrderItems(orderItemStorage as never, order.id);
			const itemIds = items.map((i) => i.id);

			const fulfilled = await fulfillOrder(
				orderStorage as never,
				orderItemStorage as never,
				order.id,
				{
					itemIds,
					trackingNumber: "TRACK-123",
					trackingUrl: "https://tracking.example.com/TRACK-123",
				},
			);

			expect(fulfilled).not.toBeNull();
			expect(fulfilled!.fulfillmentStatus).toBe("fulfilled");
			expect(fulfilled!.status).toBe("shipped");
			expect(fulfilled!.trackingNumber).toBe("TRACK-123");
			expect(fulfilled!.trackingUrl).toBe("https://tracking.example.com/TRACK-123");

			// All items should be fulfilled
			const updatedItems = await getOrderItems(orderItemStorage as never, order.id);
			for (const item of updatedItems) {
				expect(item.fulfillmentStatus).toBe("fulfilled");
			}
		});
	});
});
