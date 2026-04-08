import type { ComponentType } from "react";

import { screens as commerceScreens, type PluginScreenProps } from "@emdash-cms/plugin-commerce/mobile";

export type { PluginScreenProps } from "@emdash-cms/plugin-commerce/mobile";

const screenRegistry: Record<string, ComponentType<PluginScreenProps>> = {
	...commerceScreens,
};

export function getScreen(id: string): ComponentType<PluginScreenProps> | undefined {
	return screenRegistry[id];
}
