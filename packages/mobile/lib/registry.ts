import {
	screens as commerceScreens,
	configureCommerceApi,
	type PluginScreenProps,
} from "@emdash-cms/plugin-commerce/mobile";
import type { ComponentType } from "react";

export type { PluginScreenProps } from "@emdash-cms/plugin-commerce/mobile";

const screenRegistry: Record<string, ComponentType<PluginScreenProps>> = {
	...commerceScreens,
};

export function getScreen(id: string): ComponentType<PluginScreenProps> | undefined {
	return screenRegistry[id];
}

export function initializePlugin(
	pluginId: string,
	baseUrl: string,
	getAuthToken: () => string | null,
): void {
	if (pluginId === "commerce") configureCommerceApi({ baseUrl, getAuthToken });
}
