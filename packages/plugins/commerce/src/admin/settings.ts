import type { PluginContext } from "emdash";

import { header } from "./blocks.js";

export async function buildSettingsPage(ctx: PluginContext) {
	const storeName = (await ctx.kv.get<string>("settings:store_name")) ?? "";
	const currency = (await ctx.kv.get<string>("settings:currency")) ?? "USD";
	const adminEmail = (await ctx.kv.get<string>("settings:admin_email")) ?? "";

	return {
		blocks: [
			header("Commerce Settings"),
			{
				type: "form",
				fields: [
					{
						label: "Store Name",
						name: "store_name",
						type: "string",
						value: storeName,
					},
					{
						label: "Currency",
						name: "currency",
						type: "select",
						value: currency,
						options: [
							{ text: "USD", value: "USD" },
							{ text: "EUR", value: "EUR" },
							{ text: "GBP", value: "GBP" },
							{ text: "INR", value: "INR" },
							{ text: "CAD", value: "CAD" },
							{ text: "AUD", value: "AUD" },
						],
					},
					{
						label: "Admin Email (for notifications)",
						name: "admin_email",
						type: "string",
						value: adminEmail,
					},
				],
			},
			{ type: "button", text: "Save Settings", action_id: "settings:save", style: "primary" },
		],
	};
}

export async function handleSettingsAction(
	actionId: string,
	_value: string | undefined,
	ctx: PluginContext,
	formData?: Record<string, unknown>,
) {
	if (actionId === "settings:save" && formData) {
		if (formData.store_name) await ctx.kv.set("settings:store_name", formData.store_name);
		if (formData.currency) await ctx.kv.set("settings:currency", formData.currency);
		if (formData.admin_email) await ctx.kv.set("settings:admin_email", formData.admin_email);
		return { blocks: [{ type: "section", text: "Settings saved." }] };
	}

	return buildSettingsPage(ctx);
}
