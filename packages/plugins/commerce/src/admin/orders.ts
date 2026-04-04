import type { PluginContext } from "emdash";

import {
	header,
	table,
	button,
	statsRow,
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
				["Order #", "Customer", "Total", "Payment", "Fulfillment", "Date"],
				items.map((o) => [
					o.orderNumber as string,
					o.customerEmail as string,
					formatCurrency(o.total as number, (o.currency as string) ?? "USD"),
					statusBadge(o.paymentStatus as string),
					statusBadge(o.fulfillmentStatus as string),
					formatDate(o.createdAt as string),
				]),
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
				statsRow([
					{ label: "Status", value: statusBadge(o.status as string) },
					{ label: "Payment", value: statusBadge(o.paymentStatus as string) },
					{ label: "Fulfillment", value: statusBadge(o.fulfillmentStatus as string) },
					{
						label: "Total",
						value: formatCurrency(o.total as number, (o.currency as string) ?? "USD"),
					},
				]),
				{
					type: "section",
					fields: [
						{ type: "mrkdwn", text: `*Customer:* ${o.customerName}` },
						{ type: "mrkdwn", text: `*Email:* ${o.customerEmail}` },
						{ type: "mrkdwn", text: `*Date:* ${formatDate(o.createdAt as string)}` },
					],
				},
				header("Items"),
				table(
					["Product", "SKU", "Qty", "Price", "Total"],
					items.map((item) => [
						item.productName as string,
						(item.sku as string) || "—",
						String(item.quantity),
						formatCurrency(item.unitPrice as number, (o.currency as string) ?? "USD"),
						formatCurrency(item.totalPrice as number, (o.currency as string) ?? "USD"),
					]),
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
