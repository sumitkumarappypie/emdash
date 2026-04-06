import type { PluginContext } from "emdash";

import { dispatchCommerceEvent } from "../hooks.js";
import { fulfillOrder, refundOrder } from "../orders.js";
import { header, table, fields, stats, formatCurrency, formatDate, statusBadge } from "./blocks.js";

export async function buildOrderList(ctx: PluginContext) {
	const orders = await ctx.storage.orders!.query({
		orderBy: { createdAt: "desc" },
		limit: 50,
	});

	const items = orders.items.map((i) => i.data as Record<string, unknown>);

	return {
		blocks: [
			header("Orders"),
			table(
				[
					{ key: "orderNumber", label: "Order #" },
					{ key: "customer", label: "Customer" },
					{ key: "total", label: "Total" },
					{ key: "payment", label: "Payment", format: "badge" },
					{ key: "fulfillment", label: "Fulfillment", format: "badge" },
					{ key: "date", label: "Date" },
				],
				items.map((o) => ({
					orderNumber: o.orderNumber as string,
					customer: o.customerEmail as string,
					total: formatCurrency(o.total as number, (o.currency as string) ?? "USD"),
					payment: statusBadge(o.paymentStatus as string),
					fulfillment: statusBadge(o.fulfillmentStatus as string),
					date: formatDate(o.createdAt as string),
				})),
				{ emptyText: "No orders yet" },
			),
		],
	};
}

async function buildOrderDetail(orderId: string, ctx: PluginContext) {
	const order = await ctx.storage.orders!.get(orderId);
	if (!order) return { blocks: [{ type: "section", text: "Order not found" }] };

	const o = order as Record<string, unknown>;
	const orderItems = await ctx.storage.orderItems!.query({
		where: { orderId },
		limit: 100,
	});
	const items = orderItems.items.map((i) => i.data as Record<string, unknown>);

	return {
		blocks: [
			header(`Order ${o.orderNumber}`),
			stats([
				{ label: "Status", value: statusBadge(o.status as string) },
				{ label: "Payment", value: statusBadge(o.paymentStatus as string) },
				{ label: "Fulfillment", value: statusBadge(o.fulfillmentStatus as string) },
				{
					label: "Total",
					value: formatCurrency(o.total as number, (o.currency as string) ?? "USD"),
				},
			]),
			fields([
				{ label: "Customer", value: (o.customerName as string) || "—" },
				{ label: "Email", value: (o.customerEmail as string) || "—" },
				{ label: "Date", value: formatDate(o.createdAt as string) },
			]),
			header("Items"),
			table(
				[
					{ key: "product", label: "Product" },
					{ key: "sku", label: "SKU" },
					{ key: "qty", label: "Qty" },
					{ key: "price", label: "Price" },
					{ key: "total", label: "Total" },
				],
				items.map((item) => ({
					product: item.productName as string,
					sku: (item.sku as string) || "—",
					qty: String(item.quantity),
					price: formatCurrency(item.unitPrice as number, (o.currency as string) ?? "USD"),
					total: formatCurrency(item.totalPrice as number, (o.currency as string) ?? "USD"),
				})),
			),
			{
				type: "actions",
				elements: [
					...(o.paymentStatus === "paid" && o.fulfillmentStatus !== "fulfilled"
						? [
								{
									type: "button",
									label: "Fulfill Order",
									action_id: "order:fulfill",
									value: orderId,
									style: "primary",
								},
							]
						: []),
					...(o.paymentStatus === "paid"
						? [
								{
									type: "button",
									label: "Refund",
									action_id: "order:refund",
									value: orderId,
									style: "danger",
								},
							]
						: []),
					{ type: "button", label: "Back to Orders", action_id: "nav:orders" },
				],
			},
		],
	};
}

export async function handleOrderAction(actionId: string, value: unknown, ctx: PluginContext) {
	const strValue = typeof value === "string" ? value : undefined;

	if (actionId === "order:view" && strValue) {
		return buildOrderDetail(strValue, ctx);
	}

	if (actionId === "order:fulfill" && strValue) {
		// Fulfill all items
		const orderItems = await ctx.storage.orderItems!.query({
			where: { orderId: strValue },
			limit: 100,
		});
		const itemIds = orderItems.items.map((i) => i.id);

		await fulfillOrder(ctx.storage.orders!, ctx.storage.orderItems!, strValue, { itemIds });

		const detail = await buildOrderDetail(strValue, ctx);
		return { ...detail, toast: { type: "success", message: "Order fulfilled" } };
	}

	if (actionId === "order:refund" && strValue) {
		const refunded = await refundOrder(
			ctx.storage.orders!,
			ctx.storage.transactions!,
			strValue,
			{},
			{ orderItems: ctx.storage.orderItems!, products: ctx.storage.products! },
		);

		await dispatchCommerceEvent(ctx, {
			type: "commerce:order:refunded",
			order: refunded,
			amount: refunded.total,
		});

		const detail = await buildOrderDetail(strValue, ctx);
		return { ...detail, toast: { type: "success", message: "Order refunded" } };
	}

	if (actionId === "order:list") {
		return buildOrderList(ctx);
	}

	return buildOrderList(ctx);
}
