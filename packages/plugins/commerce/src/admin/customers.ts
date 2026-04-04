import type { PluginContext } from "emdash";

import { header, table, formatCurrency, formatDate } from "./blocks.js";

export async function buildCustomerList(ctx: PluginContext) {
	const customers = await ctx.storage.customers!.query({
		orderBy: { createdAt: "desc" },
		limit: 50,
	});

	const items = customers.items.map((i) => i.data as Record<string, unknown>);

	return {
		blocks: [
			header("Customers"),
			table(
				[
					{ key: "name", label: "Name" },
					{ key: "email", label: "Email" },
					{ key: "orders", label: "Orders" },
					{ key: "spent", label: "Total Spent" },
					{ key: "joined", label: "Joined" },
				],
				items.map((c) => ({
					name: c.name as string,
					email: c.email as string,
					orders: String(c.totalOrders ?? 0),
					spent: formatCurrency((c.totalSpent as number) ?? 0, "USD"),
					joined: formatDate(c.createdAt as string),
				})),
				{ emptyText: "No customers yet" },
			),
		],
	};
}
