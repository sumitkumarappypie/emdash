import { describe, it, expect, beforeEach } from "vitest";

import {
	createCart,
	addCartItem,
	recalculateCart,
} from "../../../../../plugins/commerce/src/cart.js";
import { createOrderFromCart } from "../../../../../plugins/commerce/src/checkout.js";
import {
	createCoupon,
	validateCoupon,
	calculateDiscount,
} from "../../../../../plugins/commerce/src/coupons.js";
import {
	getOrder,
	getOrderItems,
	fulfillOrder,
	markOrderPaid,
} from "../../../../../plugins/commerce/src/orders.js";
import { createProduct } from "../../../../../plugins/commerce/src/products.js";

const ORDER_NUMBER_RE = /^ORD-\d+$/;

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
			cursor?: string;
		}): Promise<{ items: Array<{ id: string; data: T }>; hasMore: boolean }> => {
			let items = Array.from(store.entries(), ([id, data]) => ({ id, data }));
			if (opts?.where) {
				for (const [key, value] of Object.entries(opts.where)) {
					items = items.filter((item) => (item.data as Record<string, unknown>)[key] === value);
				}
			}
			if (opts?.orderBy) {
				const [field, dir] = Object.entries(opts.orderBy)[0]!;
				items.sort((a, b) => {
					const av = (a.data as Record<string, unknown>)[field as string] as string;
					const bv = (b.data as Record<string, unknown>)[field as string] as string;
					return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
				});
			}
			const limit = opts?.limit ?? 50;
			return { items: items.slice(0, limit), hasMore: items.length > limit };
		},
		count: async (where?: Record<string, unknown>): Promise<number> => {
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

describe("Full Checkout Flow (Integration)", () => {
	let productStorage: ReturnType<typeof createMockStorage>;
	let variantStorage: ReturnType<typeof createMockStorage>;
	let _categoryStorage: ReturnType<typeof createMockStorage>;
	let cartStorage: ReturnType<typeof createMockStorage>;
	let cartItemStorage: ReturnType<typeof createMockStorage>;
	let orderStorage: ReturnType<typeof createMockStorage>;
	let orderItemStorage: ReturnType<typeof createMockStorage>;
	let _transactionStorage: ReturnType<typeof createMockStorage>;
	let customerStorage: ReturnType<typeof createMockStorage>;
	let couponStorage: ReturnType<typeof createMockStorage>;
	let orderCounterStorage: ReturnType<typeof createMockStorage>;

	function makeCheckoutStorages() {
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
		productStorage = createMockStorage();
		variantStorage = createMockStorage();
		_categoryStorage = createMockStorage();
		cartStorage = createMockStorage();
		cartItemStorage = createMockStorage();
		orderStorage = createMockStorage();
		orderItemStorage = createMockStorage();
		_transactionStorage = createMockStorage();
		customerStorage = createMockStorage();
		couponStorage = createMockStorage();
		orderCounterStorage = createMockStorage();

		// Initialize order counter
		await orderCounterStorage.put("current", { value: 1000 } as never);
	});

	describe("Happy path: create product → cart → add item → checkout → pay → fulfill", () => {
		it("completes the full order lifecycle", async () => {
			// Step 1: Create a product
			const product = await createProduct(productStorage as never, {
				name: "Integration Widget",
				slug: "integration-widget",
				basePrice: 49.99,
				status: "active",
				sku: "INT-001",
				trackInventory: true,
				inventoryQuantity: 20,
			});

			expect(product.id).toBeDefined();
			expect(product.name).toBe("Integration Widget");
			expect(product.status).toBe("active");

			// Step 2: Create a cart
			const cart = await createCart(cartStorage as never, { sessionId: "integration-sess" });

			expect(cart.id).toBeDefined();
			expect(cart.subtotal).toBe(0);
			expect(cart.total).toBe(0);

			// Step 3: Add product to cart
			const cartItem = await addCartItem(
				cartStorage as never,
				cartItemStorage as never,
				productStorage as never,
				variantStorage as never,
				cart.id,
				{ productId: product.id, quantity: 3 },
			);

			expect(cartItem.productId).toBe(product.id);
			expect(cartItem.quantity).toBe(3);
			expect(cartItem.unitPrice).toBe(49.99);
			expect(cartItem.totalPrice).toBe(149.97);

			// Step 4: Recalculate cart
			const recalculated = await recalculateCart(
				cartStorage as never,
				cartItemStorage as never,
				cart.id,
			);

			expect(recalculated).not.toBeNull();
			expect(recalculated!.subtotal).toBe(149.97);
			expect(recalculated!.total).toBe(149.97);

			// Step 5: Create order from cart (checkout)
			const order = await createOrderFromCart(makeCheckoutStorages(), cart.id, {
				email: "customer@example.com",
				name: "Jane Doe",
				paymentProvider: "stripe",
			});

			// Step 6: Verify order fields
			expect(order.id).toBeDefined();
			expect(order.orderNumber).toMatch(ORDER_NUMBER_RE);
			expect(order.customerEmail).toBe("customer@example.com");
			expect(order.customerName).toBe("Jane Doe");
			expect(order.paymentProvider).toBe("stripe");
			expect(order.status).toBe("pending");
			expect(order.paymentStatus).toBe("unpaid");
			expect(order.fulfillmentStatus).toBe("unfulfilled");
			expect(order.subtotal).toBe(149.97);
			expect(order.total).toBe(149.97);

			// Step 7: Verify order items snapshot product data
			const orderItems = await getOrderItems(orderItemStorage as never, order.id);

			expect(orderItems).toHaveLength(1);
			const item = orderItems[0]!;
			expect(item.productId).toBe(product.id);
			expect(item.productName).toBe("Integration Widget");
			expect(item.sku).toBe("INT-001");
			expect(item.quantity).toBe(3);
			expect(item.unitPrice).toBe(49.99);
			expect(item.totalPrice).toBe(149.97);
			expect(item.fulfillmentStatus).toBe("unfulfilled");

			// Step 8: Verify cart was deleted
			const deletedCart = await cartStorage.get(cart.id);
			expect(deletedCart).toBeNull();

			// Step 9: Mark order paid
			const paidOrder = await markOrderPaid(orderStorage as never, order.id, "pi_integration_abc");

			expect(paidOrder).not.toBeNull();
			expect(paidOrder!.paymentStatus).toBe("paid");
			expect(paidOrder!.status).toBe("paid");
			expect(paidOrder!.paymentIntentId).toBe("pi_integration_abc");

			// Step 10: Fulfill order
			const itemIds = orderItems.map((i) => i.id);
			const fulfilledOrder = await fulfillOrder(
				orderStorage as never,
				orderItemStorage as never,
				order.id,
				{
					itemIds,
					trackingNumber: "TRACK-INT-001",
					trackingUrl: "https://tracking.example.com/TRACK-INT-001",
				},
			);

			// Step 11: Verify fulfillment status
			expect(fulfilledOrder).not.toBeNull();
			expect(fulfilledOrder!.fulfillmentStatus).toBe("fulfilled");
			expect(fulfilledOrder!.status).toBe("shipped");
			expect(fulfilledOrder!.trackingNumber).toBe("TRACK-INT-001");
			expect(fulfilledOrder!.trackingUrl).toBe("https://tracking.example.com/TRACK-INT-001");

			// All order items should be fulfilled
			const finalItems = await getOrderItems(orderItemStorage as never, order.id);
			for (const finalItem of finalItems) {
				expect(finalItem.fulfillmentStatus).toBe("fulfilled");
			}
		});

		it("verifies order can be retrieved after creation", async () => {
			const product = await createProduct(productStorage as never, {
				name: "Lookup Widget",
				slug: "lookup-widget",
				basePrice: 10,
				status: "active",
			});

			const cart = await createCart(cartStorage as never, { sessionId: "lookup-sess" });
			await addCartItem(
				cartStorage as never,
				cartItemStorage as never,
				productStorage as never,
				variantStorage as never,
				cart.id,
				{ productId: product.id, quantity: 1 },
			);

			const order = await createOrderFromCart(makeCheckoutStorages(), cart.id, {
				email: "lookup@example.com",
				name: "Lookup User",
				paymentProvider: "stripe",
			});

			const fetched = await getOrder(orderStorage as never, order.id);
			expect(fetched).not.toBeNull();
			expect(fetched!.id).toBe(order.id);
			expect(fetched!.orderNumber).toBe(order.orderNumber);
		});
	});

	describe("Coupon flow: create coupon → validate → calculate discount", () => {
		it("validates and applies a 10% coupon to a cart with items", async () => {
			// Step 1: Create product and cart with items
			const product = await createProduct(productStorage as never, {
				name: "Coupon Widget",
				slug: "coupon-widget",
				basePrice: 100,
				status: "active",
			});

			const cart = await createCart(cartStorage as never, { sessionId: "coupon-sess" });

			await addCartItem(
				cartStorage as never,
				cartItemStorage as never,
				productStorage as never,
				variantStorage as never,
				cart.id,
				{ productId: product.id, quantity: 2 },
			);

			const recalculated = await recalculateCart(
				cartStorage as never,
				cartItemStorage as never,
				cart.id,
			);

			expect(recalculated!.subtotal).toBe(200);

			// Step 2: Create coupon (10% off)
			const coupon = await createCoupon(couponStorage as never, {
				code: "SAVE10",
				type: "percentage",
				value: 10,
			});

			expect(coupon.id).toBeDefined();
			expect(coupon.code).toBe("SAVE10");
			expect(coupon.type).toBe("percentage");
			expect(coupon.value).toBe(10);
			expect(coupon.status).toBe("active");

			// Step 3: Validate coupon against cart
			const cartItems = await cartItemStorage.query({ where: { cartId: cart.id } });
			const items = cartItems.items.map((entry) => entry.data);

			const validationError = validateCoupon(coupon, recalculated!, items as never);

			// Step 4: Verify coupon is valid (null means valid)
			expect(validationError).toBeNull();

			// Step 5: Calculate discount amount
			const discount = calculateDiscount(coupon, recalculated!, items as never, []);

			// Step 6: Verify discount amount (10% of $200 = $20)
			expect(discount).toBe(20);
		});

		it("rejects expired coupon during validation", async () => {
			const product = await createProduct(productStorage as never, {
				name: "Expired Widget",
				slug: "expired-widget",
				basePrice: 50,
				status: "active",
			});

			const cart = await createCart(cartStorage as never, { sessionId: "expired-coupon-sess" });
			await addCartItem(
				cartStorage as never,
				cartItemStorage as never,
				productStorage as never,
				variantStorage as never,
				cart.id,
				{ productId: product.id, quantity: 1 },
			);
			const recalculated = await recalculateCart(
				cartStorage as never,
				cartItemStorage as never,
				cart.id,
			);

			const expiredCoupon = await createCoupon(couponStorage as never, {
				code: "EXPIRED",
				type: "percentage",
				value: 15,
				expiresAt: new Date(Date.now() - 86400000).toISOString(),
			});

			const cartItems = await cartItemStorage.query({ where: { cartId: cart.id } });
			const items = cartItems.items.map((entry) => entry.data);

			const error = validateCoupon(expiredCoupon, recalculated!, items as never);
			expect(error).toBe("COUPON_EXPIRED");
		});

		it("rejects coupon when minimum order amount is not met", async () => {
			const product = await createProduct(productStorage as never, {
				name: "Cheap Widget",
				slug: "cheap-widget",
				basePrice: 10,
				status: "active",
			});

			const cart = await createCart(cartStorage as never, { sessionId: "minimum-sess" });
			await addCartItem(
				cartStorage as never,
				cartItemStorage as never,
				productStorage as never,
				variantStorage as never,
				cart.id,
				{ productId: product.id, quantity: 1 },
			);
			const recalculated = await recalculateCart(
				cartStorage as never,
				cartItemStorage as never,
				cart.id,
			);

			expect(recalculated!.subtotal).toBe(10);

			const coupon = await createCoupon(couponStorage as never, {
				code: "BIGORDER",
				type: "fixed_amount",
				value: 5,
				minimumOrderAmount: 50,
			});

			const cartItems = await cartItemStorage.query({ where: { cartId: cart.id } });
			const items = cartItems.items.map((entry) => entry.data);

			const error = validateCoupon(coupon, recalculated!, items as never);
			expect(error).toBe("MINIMUM_NOT_MET");
		});
	});

	describe("Multi-item order flow", () => {
		it("handles multiple products with correct totals and sequential order numbers", async () => {
			// Create two products
			const productA = await createProduct(productStorage as never, {
				name: "Product Alpha",
				slug: "product-alpha",
				basePrice: 25,
				status: "active",
				sku: "ALPHA-001",
			});

			const productB = await createProduct(productStorage as never, {
				name: "Product Beta",
				slug: "product-beta",
				basePrice: 75,
				status: "active",
				sku: "BETA-001",
			});

			// First order
			const cart1 = await createCart(cartStorage as never, { sessionId: "multi-sess-1" });
			await addCartItem(
				cartStorage as never,
				cartItemStorage as never,
				productStorage as never,
				variantStorage as never,
				cart1.id,
				{ productId: productA.id, quantity: 2 },
			);
			await addCartItem(
				cartStorage as never,
				cartItemStorage as never,
				productStorage as never,
				variantStorage as never,
				cart1.id,
				{ productId: productB.id, quantity: 1 },
			);

			const recalc1 = await recalculateCart(
				cartStorage as never,
				cartItemStorage as never,
				cart1.id,
			);
			// Alpha: 25 * 2 = 50, Beta: 75 * 1 = 75, total = 125
			expect(recalc1!.subtotal).toBe(125);

			const order1 = await createOrderFromCart(makeCheckoutStorages(), cart1.id, {
				email: "first@example.com",
				name: "First Buyer",
				paymentProvider: "stripe",
			});

			expect(order1.subtotal).toBe(125);
			expect(order1.total).toBe(125);
			expect(order1.orderNumber).toBe("ORD-1001");

			const items1 = await getOrderItems(orderItemStorage as never, order1.id);
			expect(items1).toHaveLength(2);

			const alphaItem = items1.find((i) => i.productId === productA.id);
			expect(alphaItem).toBeDefined();
			expect(alphaItem!.productName).toBe("Product Alpha");
			expect(alphaItem!.sku).toBe("ALPHA-001");
			expect(alphaItem!.quantity).toBe(2);
			expect(alphaItem!.totalPrice).toBe(50);

			const betaItem = items1.find((i) => i.productId === productB.id);
			expect(betaItem).toBeDefined();
			expect(betaItem!.productName).toBe("Product Beta");
			expect(betaItem!.sku).toBe("BETA-001");
			expect(betaItem!.quantity).toBe(1);
			expect(betaItem!.totalPrice).toBe(75);

			// Second order gets the next sequential number
			const cart2 = await createCart(cartStorage as never, { sessionId: "multi-sess-2" });
			await addCartItem(
				cartStorage as never,
				cartItemStorage as never,
				productStorage as never,
				variantStorage as never,
				cart2.id,
				{ productId: productB.id, quantity: 1 },
			);

			const order2 = await createOrderFromCart(makeCheckoutStorages(), cart2.id, {
				email: "second@example.com",
				name: "Second Buyer",
				paymentProvider: "stripe",
			});

			expect(order2.orderNumber).toBe("ORD-1002");
		});
	});
});
