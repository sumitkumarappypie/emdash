import type { PluginContext } from "emdash";

import { header, stats, table, formatCurrency, formatDate, statusBadge } from "./blocks.js";

export async function buildDashboard(ctx: PluginContext) {
	const orders = await ctx.storage.orders!.query({
		orderBy: { createdAt: "desc" },
		limit: 10,
	});

	const allOrders = orders.items.map((i) => i.data as Record<string, unknown>);
	const todayStr = new Date().toISOString().split("T")[0]!;
	const todayOrders = allOrders.filter((o) => (o.createdAt as string).startsWith(todayStr));

	const todayRevenue = todayOrders
		.filter((o) => o.paymentStatus === "paid")
		.reduce((sum, o) => sum + (o.total as number), 0);

	const pendingCount = allOrders.filter(
		(o) => o.fulfillmentStatus === "unfulfilled" && o.paymentStatus === "paid",
	).length;

	return {
		blocks: [
			header("Commerce Dashboard"),
			stats([
				{ label: "Today's Revenue", value: formatCurrency(todayRevenue, "USD") },
				{ label: "Orders Today", value: String(todayOrders.length) },
				{ label: "Pending Fulfillment", value: String(pendingCount) },
			]),
			header("Recent Orders"),
			table(
				[
					{ key: "order", label: "Order" },
					{ key: "customer", label: "Customer" },
					{ key: "total", label: "Total" },
					{ key: "status", label: "Status", format: "badge" },
					{ key: "date", label: "Date" },
				],
				allOrders.slice(0, 10).map((o) => ({
					order: o.orderNumber as string,
					customer: o.customerEmail as string,
					total: formatCurrency(o.total as number, (o.currency as string) ?? "USD"),
					status: statusBadge(o.status as string),
					date: formatDate(o.createdAt as string),
				})),
				{ emptyText: "No orders yet" },
			),
		],
	};
}

export async function buildRevenueWidget(ctx: PluginContext) {
	const orders = await ctx.storage.orders!.query({
		orderBy: { createdAt: "desc" },
		limit: 50,
	});

	const allOrders = orders.items.map((i) => i.data as Record<string, unknown>);
	const paidOrders = allOrders.filter((o) => o.paymentStatus === "paid");
	const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.total as number), 0);

	return {
		blocks: [
			stats([
				{ label: "Total Revenue", value: formatCurrency(totalRevenue, "USD") },
				{ label: "Paid Orders", value: String(paidOrders.length) },
			]),
		],
	};
}

export async function buildRecentOrdersWidget(ctx: PluginContext) {
	const orders = await ctx.storage.orders!.query({
		orderBy: { createdAt: "desc" },
		limit: 5,
	});

	const recent = orders.items.map((i) => i.data as Record<string, unknown>);

	return {
		blocks: [
			table(
				[
					{ key: "order", label: "Order" },
					{ key: "total", label: "Total" },
					{ key: "status", label: "Status", format: "badge" },
				],
				recent.map((o) => ({
					order: o.orderNumber as string,
					total: formatCurrency(o.total as number, (o.currency as string) ?? "USD"),
					status: statusBadge(o.status as string),
				})),
				{ emptyText: "No recent orders" },
			),
		],
	};
}
