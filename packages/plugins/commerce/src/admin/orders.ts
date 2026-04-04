import type { PluginContext } from "emdash";

import {
	header,
	table,
	button,
	fields,
	stats,
	formatCurrency,
	formatDate,
	statusBadge,
} from "./blocks.js";

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

export async function handleOrderAction(
	actionId: string,
	value: string | undefined,
	ctx: PluginContext,
) {
	if (actionId === "order:view" && value) {
		const order = await ctx.storage.orders!.get(value);
		if (!order) return { blocks: [{ type: "section", text: "Order not found" }] };

		const o = order as Record<string, unknown>;
		const orderItems = await ctx.storage.orderItems!.query({
			where: { orderId: value },
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
					{ label: "Customer", value: o.customerName as string },
					{ label: "Email", value: o.customerEmail as string },
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
				...(o.paymentStatus === "paid" && o.fulfillmentStatus !== "fulfilled"
					? [button("Fulfill Order", "order:fulfill", value, "primary")]
					: []),
				...(o.paymentStatus === "paid" ? [button("Refund", "order:refund", value, "danger")] : []),
				button("Back to Orders", "order:list"),
			],
		};
	}

	return buildOrderList(ctx);
}
