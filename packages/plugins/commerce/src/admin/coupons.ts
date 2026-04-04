import type { PluginContext } from "emdash";

import { header, table, button, formatDate, statusBadge } from "./blocks.js";

export async function buildCouponList(ctx: PluginContext) {
	const coupons = await ctx.storage.coupons!.query({
		orderBy: { createdAt: "desc" },
		limit: 50,
	});

	const items = coupons.items.map((i) => i.data as Record<string, unknown>);

	return {
		blocks: [
			header("Coupons"),
			button("New Coupon", "coupon:create", undefined, "primary"),
			table(
				[
					{ key: "code", label: "Code" },
					{ key: "type", label: "Type" },
					{ key: "value", label: "Value" },
					{ key: "status", label: "Status", format: "badge" },
					{ key: "uses", label: "Uses" },
					{ key: "created", label: "Created" },
				],
				items.map((c) => {
					const type = c.type as string;
					const val = c.value as number;
					let display = String(val);
					if (type === "percentage") display = `${val}%`;
					else if (type === "fixed_amount") display = `$${val}`;
					else if (type === "free_shipping") display = "Free Shipping";

					return {
						code: c.code as string,
						type,
						value: display,
						status: statusBadge(c.status as string),
						uses: `${c.usageCount ?? 0}${c.usageLimit ? `/${c.usageLimit}` : ""}`,
						created: formatDate(c.createdAt as string),
					};
				}),
				{ emptyText: "No coupons yet" },
			),
		],
	};
}

export async function handleCouponAction(
	_actionId: string,
	_value: string | undefined,
	ctx: PluginContext,
) {
	return buildCouponList(ctx);
}
