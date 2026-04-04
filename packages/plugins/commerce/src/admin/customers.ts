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
				["Name", "Email", "Orders", "Total Spent", "Joined"],
				items.map((c) => [
					c.name as string,
					c.email as string,
					String(c.totalOrders ?? 0),
					formatCurrency((c.totalSpent as number) ?? 0, "USD"),
					formatDate(c.createdAt as string),
				]),
			),
		],
	};
}
