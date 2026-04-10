import { z } from "zod";

export const pluginMobileTabSchema = z.object({
	key: z.string().min(1),
	label: z.string().min(1),
	icon: z.string().min(1),
	screen: z.string().min(1),
	badge: z.string().optional(),
});

export const pluginMobileConfigSchema = z
	.object({
		native: z.boolean().optional(),
		entryUrl: z.string().optional(),
		label: z.string().optional(),
		icon: z.string().optional(),
		tabs: z.array(pluginMobileTabSchema).optional(),
		supportsCart: z.boolean().optional(),
		cartScreen: z.string().optional(),
		cartBadgeKey: z.string().optional(),
	})
	.optional();
