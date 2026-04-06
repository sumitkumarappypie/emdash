// Shared storage collection type compatible with PluginContext.storage.
// Uses `any` for data because plugin context returns StorageCollection<unknown>.
// Our functions provide type safety through Zod validation and typed return values.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StorageCollection = {
	get(id: string): Promise<any>;
	put(id: string, data: any): Promise<void>;
	delete(id: string): Promise<boolean>;
	exists?(id: string): Promise<boolean>;
	query(opts?: {
		where?: Record<string, unknown>;
		orderBy?: Record<string, string>;
		limit?: number;
		cursor?: string;
	}): Promise<{ items: Array<{ id: string; data: any }>; hasMore: boolean; cursor?: string }>;
	count?(where?: Record<string, unknown>): Promise<number>;
};
