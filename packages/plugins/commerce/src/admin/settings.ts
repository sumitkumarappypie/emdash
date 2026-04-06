import type { PluginContext } from "emdash";

import { header } from "./blocks.js";

export async function buildSettingsPage(ctx: PluginContext) {
	const storeName = (await ctx.kv.get<string>("settings:store_name")) ?? "";
	const currency = (await ctx.kv.get<string>("settings:currency")) ?? "USD";
	const adminEmail = (await ctx.kv.get<string>("settings:admin_email")) ?? "";
	const storefrontEnabled = (await ctx.kv.get<string>("settings:storefront_enabled")) ?? "enabled";
	const guestCheckout = (await ctx.kv.get<string>("settings:guest_checkout")) ?? "enabled";

	return {
		blocks: [
			header("Commerce Settings"),
			{
				type: "form",
				fields: [
					{
						type: "text_input",
						action_id: "store_name",
						label: "Store Name",
						placeholder: "My Store",
						initial_value: storeName,
					},
					{
						type: "select",
						action_id: "currency",
						label: "Currency",
						options: [
							{ label: "USD — US Dollar", value: "USD" },
							{ label: "EUR — Euro", value: "EUR" },
							{ label: "GBP — British Pound", value: "GBP" },
							{ label: "INR — Indian Rupee", value: "INR" },
							{ label: "CAD — Canadian Dollar", value: "CAD" },
							{ label: "AUD — Australian Dollar", value: "AUD" },
						],
						initial_value: currency,
					},
					{
						type: "text_input",
						action_id: "admin_email",
						label: "Admin Email (for notifications)",
						placeholder: "admin@example.com",
						initial_value: adminEmail,
					},
					{
						type: "select",
						action_id: "storefront_enabled",
						label: "Storefront (public shop pages)",
						options: [
							{ label: "Enabled — shop pages visible to visitors", value: "enabled" },
							{ label: "Disabled — shop pages return 404", value: "disabled" },
						],
						initial_value: storefrontEnabled,
					},
					{
						type: "select",
						action_id: "guest_checkout",
						label: "Guest Checkout",
						options: [
							{ label: "Enabled — anyone can checkout without an account", value: "enabled" },
							{ label: "Disabled — customers must log in to checkout", value: "disabled" },
						],
						initial_value: guestCheckout,
					},
				],
				submit: {
					label: "Save Settings",
					action_id: "settings:save",
				},
			},
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
		if (formData.store_name !== undefined)
			await ctx.kv.set("settings:store_name", formData.store_name);
		if (formData.currency !== undefined) await ctx.kv.set("settings:currency", formData.currency);
		if (formData.admin_email !== undefined)
			await ctx.kv.set("settings:admin_email", formData.admin_email);
		if (formData.storefront_enabled !== undefined)
			await ctx.kv.set("settings:storefront_enabled", formData.storefront_enabled);
		if (formData.guest_checkout !== undefined)
			await ctx.kv.set("settings:guest_checkout", formData.guest_checkout);

		// Always sync "Shop" menu item with storefront setting
		if (ctx.menus) {
			const sfEnabled =
				(formData.storefront_enabled as string | undefined) ??
				(await ctx.kv.get<string>("settings:storefront_enabled")) ??
				"enabled";
			if (sfEnabled === "enabled") {
				await ctx.menus.addItem("primary", { label: "Shop", url: "/shop" });
			} else {
				await ctx.menus.removeItemByUrl("primary", "/shop");
			}
		}

		const page = await buildSettingsPage(ctx);
		return { ...page, toast: { type: "success", message: "Settings saved" } };
	}

	return buildSettingsPage(ctx);
}
