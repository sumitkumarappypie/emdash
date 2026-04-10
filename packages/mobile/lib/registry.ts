// Use direct path into the package (not exports subpath) because Metro
// has unstable_enablePackageExports disabled and can't resolve /mobile.
import {
	screens as commerceScreens,
	configureCommerceApi,
	type PluginScreenProps,
} from "@emdash-cms/plugin-commerce/src/mobile/index";
import type { ComponentType } from "react";

export type { PluginScreenProps } from "@emdash-cms/plugin-commerce/src/mobile/index";

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
