import type { PluginContext } from "emdash";

import { header, statsRow, table, formatCurrency, formatDate, statusBadge } from "./blocks.js";

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
			statsRow([
				{ label: "Today's Revenue", value: formatCurrency(todayRevenue, "USD") },
				{ label: "Orders Today", value: String(todayOrders.length) },
				{ label: "Pending Fulfillment", value: String(pendingCount) },
			]),
			header("Recent Orders"),
			table(
				["Order", "Customer", "Total", "Status", "Date"],
				allOrders
					.slice(0, 10)
					.map((o) => [
						o.orderNumber as string,
						o.customerEmail as string,
						formatCurrency(o.total as number, (o.currency as string) ?? "USD"),
						statusBadge(o.status as string),
						formatDate(o.createdAt as string),
					]),
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
			statsRow([
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
				["Order", "Total", "Status"],
				recent.map((o) => [
					o.orderNumber as string,
					formatCurrency(o.total as number, (o.currency as string) ?? "USD"),
					statusBadge(o.status as string),
				]),
			),
		],
	};
}
