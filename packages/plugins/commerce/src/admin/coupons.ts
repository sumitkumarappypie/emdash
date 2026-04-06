import type { PluginContext } from "emdash";

import { createCoupon, updateCoupon } from "../coupons.js";
import { header, table, formatDate, statusBadge } from "./blocks.js";

export async function buildCouponList(ctx: PluginContext) {
	const coupons = await ctx.storage.coupons!.query({
		limit: 50,
	});

	const items = coupons.items.map((i) => i.data as Record<string, unknown>);

	return {
		blocks: [
			header("Coupons"),
			{
				type: "actions",
				elements: [
					{ type: "button", label: "New Coupon", action_id: "coupon:create", style: "primary" },
				],
			},
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
				{ emptyText: "No coupons yet. Click 'New Coupon' to create one." },
			),
		],
	};
}

function buildCouponForm(existing?: Record<string, unknown>) {
	const isEdit = !!existing;
	return {
		blocks: [
			header(isEdit ? `Edit Coupon: ${existing!.code}` : "New Coupon"),
			{
				type: "form",
				fields: [
					{
						type: "text_input",
						action_id: "code",
						label: "Coupon Code",
						placeholder: "e.g. SUMMER20",
						initial_value: (existing?.code as string) ?? "",
					},
					{
						type: "text_input",
						action_id: "description",
						label: "Description",
						placeholder: "20% off summer sale",
						initial_value: (existing?.description as string) ?? "",
					},
					{
						type: "select",
						action_id: "type",
						label: "Discount Type",
						options: [
							{ label: "Percentage", value: "percentage" },
							{ label: "Fixed Amount", value: "fixed_amount" },
							{ label: "Free Shipping", value: "free_shipping" },
						],
						initial_value: (existing?.type as string) ?? "percentage",
					},
					{
						type: "number_input",
						action_id: "value",
						label: "Discount Value",
						initial_value: (existing?.value as number) ?? 10,
						min: 0,
					},
					...(isEdit
						? [
								{
									type: "select" as const,
									action_id: "status",
									label: "Status",
									options: [
										{ label: "Active", value: "active" },
										{ label: "Inactive", value: "inactive" },
									],
									initial_value: (existing?.status as string) ?? "active",
								},
							]
						: []),
					{
						type: "number_input",
						action_id: "minimumOrderAmount",
						label: "Minimum Order Amount (0 = no minimum)",
						initial_value: (existing?.minimumOrderAmount as number) ?? 0,
						min: 0,
					},
					{
						type: "number_input",
						action_id: "maximumDiscountAmount",
						label: "Maximum Discount (0 = no cap)",
						initial_value: (existing?.maximumDiscountAmount as number) ?? 0,
						min: 0,
					},
					{
						type: "number_input",
						action_id: "usageLimit",
						label: "Usage Limit (0 = unlimited)",
						initial_value: (existing?.usageLimit as number) ?? 0,
						min: 0,
					},
					{
						type: "number_input",
						action_id: "perCustomerLimit",
						label: "Per-Customer Limit (0 = unlimited)",
						initial_value: (existing?.perCustomerLimit as number) ?? 0,
						min: 0,
					},
				],
				submit: {
					label: isEdit ? "Save Changes" : "Create Coupon",
					action_id: isEdit ? `coupon:save:${existing!.id}` : "coupon:save:new",
				},
			},
			{
				type: "actions",
				elements: [{ type: "button", label: "Cancel", action_id: "nav:coupons" }],
			},
		],
	};
}

export async function handleCouponAction(actionId: string, value: unknown, ctx: PluginContext) {
	if (actionId === "coupon:create") {
		return buildCouponForm();
	}

	if (actionId.startsWith("coupon:edit:")) {
		const id = actionId.replace("coupon:edit:", "");
		const coupon = await ctx.storage.coupons!.get(id);
		if (!coupon) return { blocks: [{ type: "section", text: "Coupon not found" }] };
		return buildCouponForm(coupon as Record<string, unknown>);
	}

	if (actionId.startsWith("coupon:save:")) {
		const formValues = value as Record<string, unknown>;
		const id = actionId.replace("coupon:save:", "");
		// Convert 0 values to null for optional fields
		if (formValues.minimumOrderAmount === 0) formValues.minimumOrderAmount = null;
		if (formValues.maximumDiscountAmount === 0) formValues.maximumDiscountAmount = null;
		if (formValues.usageLimit === 0) formValues.usageLimit = null;
		if (formValues.perCustomerLimit === 0) formValues.perCustomerLimit = null;

		if (id === "new") {
			await createCoupon(ctx.storage.coupons!, formValues);
			const list = await buildCouponList(ctx);
			return { ...list, toast: { type: "success", message: "Coupon created" } };
		} else {
			await updateCoupon(ctx.storage.coupons!, id, formValues);
			const list = await buildCouponList(ctx);
			return { ...list, toast: { type: "success", message: "Coupon updated" } };
		}
	}

	return buildCouponList(ctx);
}
