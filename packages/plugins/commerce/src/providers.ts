interface ProviderRegistry {
	paymentProviders: string[];
	shippingProviders: string[];
	taxProvider: string | null;
}

interface KVAccess {
	get<T>(key: string): Promise<T | null>;
	set(key: string, value: unknown): Promise<void>;
}

export async function getProviderRegistry(kv: KVAccess): Promise<ProviderRegistry> {
	const registry = await kv.get<ProviderRegistry>("state:providers");
	return registry ?? { paymentProviders: [], shippingProviders: [], taxProvider: null };
}

export async function registerProvider(
	kv: KVAccess,
	type: "payment" | "shipping" | "tax",
	providerId: string,
): Promise<void> {
	const registry = await getProviderRegistry(kv);
	switch (type) {
		case "payment":
			if (!registry.paymentProviders.includes(providerId)) {
				registry.paymentProviders.push(providerId);
			}
			break;
		case "shipping":
			if (!registry.shippingProviders.includes(providerId)) {
				registry.shippingProviders.push(providerId);
			}
			break;
		case "tax":
			registry.taxProvider = providerId;
			break;
	}
	await kv.set("state:providers", registry);
}

export async function unregisterProvider(
	kv: KVAccess,
	type: "payment" | "shipping" | "tax",
	providerId: string,
): Promise<void> {
	const registry = await getProviderRegistry(kv);
	switch (type) {
		case "payment":
			registry.paymentProviders = registry.paymentProviders.filter((id) => id !== providerId);
			break;
		case "shipping":
			registry.shippingProviders = registry.shippingProviders.filter((id) => id !== providerId);
			break;
		case "tax":
			if (registry.taxProvider === providerId) registry.taxProvider = null;
			break;
	}
	await kv.set("state:providers", registry);
}
