import type { PluginContext } from "emdash";

import type { Order, Product } from "./types.js";

export type CommerceEvent =
	| { type: "commerce:product:afterSave"; product: Product }
	| { type: "commerce:order:created"; order: Order }
	| { type: "commerce:order:statusChanged"; order: Order; previousStatus: string }
	| { type: "commerce:order:paid"; order: Order }
	| { type: "commerce:order:refunded"; order: Order; amount: number }
	| { type: "commerce:inventory:low"; productId: string; remaining: number }
	| { type: "commerce:checkout:beforeComplete"; cartId: string }
	| { type: "commerce:cart:beforeAdd"; cartId: string; productId: string }
	| { type: "commerce:cart:afterUpdate"; cartId: string };

export async function dispatchCommerceEvent(
	ctx: PluginContext,
	event: CommerceEvent,
): Promise<void> {
	ctx.log.info(`Commerce event: ${event.type}`);

	// Store event for audit trail
	const eventId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
	await ctx.kv.set(`state:events:${eventId}`, {
		...event,
		timestamp: new Date().toISOString(),
	});

	// Dispatch email notifications for key events
	if (ctx.email) {
		switch (event.type) {
			case "commerce:order:created": {
				await ctx.email.send({
					to: event.order.customerEmail,
					subject: `Order Confirmed: ${event.order.orderNumber}`,
					html: buildOrderConfirmationEmail(event.order),
				});
				break;
			}
			case "commerce:order:paid": {
				await ctx.email.send({
					to: event.order.customerEmail,
					subject: `Payment Received: ${event.order.orderNumber}`,
					html: buildPaymentReceivedEmail(event.order),
				});
				break;
			}
			case "commerce:order:refunded": {
				await ctx.email.send({
					to: event.order.customerEmail,
					subject: `Refund Processed: ${event.order.orderNumber}`,
					html: buildRefundEmail(event.order, event.amount),
				});
				break;
			}
			case "commerce:inventory:low": {
				const adminEmail = await ctx.kv.get<string>("settings:admin_email");
				if (adminEmail) {
					await ctx.email.send({
						to: adminEmail,
						subject: `Low Stock Alert: ${event.productId}`,
						html: `<p>Product ${event.productId} has only ${event.remaining} units remaining.</p>`,
					});
				}
				break;
			}
		}
	}
}

function buildOrderConfirmationEmail(order: Order): string {
	return `<h1>Order Confirmed</h1>
<p>Thank you for your order, ${order.customerName}!</p>
<p><strong>Order Number:</strong> ${order.orderNumber}</p>
<p><strong>Total:</strong> ${formatCurrency(order.total, order.currency)}</p>
<p>We'll send you another email when your order ships.</p>`;
}

function buildPaymentReceivedEmail(order: Order): string {
	return `<h1>Payment Received</h1>
<p>We've received your payment for order ${order.orderNumber}.</p>
<p><strong>Amount:</strong> ${formatCurrency(order.total, order.currency)}</p>`;
}

function buildRefundEmail(order: Order, amount: number): string {
	return `<h1>Refund Processed</h1>
<p>A refund of ${formatCurrency(amount, order.currency)} has been processed for order ${order.orderNumber}.</p>
<p>Please allow 5-10 business days for the refund to appear on your statement.</p>`;
}

function formatCurrency(amount: number, currency: string): string {
	return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}
