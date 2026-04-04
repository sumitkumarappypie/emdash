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
				["Code", "Type", "Value", "Status", "Uses", "Created"],
				items.map((c) => {
					const type = c.type as string;
					const value = c.value as number;
					let display = String(value);
					if (type === "percentage") display = `${value}%`;
					else if (type === "fixed_amount") display = `$${value}`;
					else if (type === "free_shipping") display = "Free Shipping";

					return [
						c.code as string,
						type,
						display,
						statusBadge(c.status as string),
						`${c.usageCount ?? 0}${c.usageLimit ? `/${c.usageLimit}` : ""}`,
						formatDate(c.createdAt as string),
					];
				}),
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
