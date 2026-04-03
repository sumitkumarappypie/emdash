import type { Transaction, TransactionStatus, TransactionType } from "./types.js";

type StorageCollection<T = unknown> = {
	get(id: string): Promise<T | null>;
	put(id: string, data: T): Promise<void>;
	query(opts?: {
		where?: Record<string, unknown>;
		orderBy?: Record<string, string>;
		limit?: number;
	}): Promise<{ items: Array<{ id: string; data: T }>; hasMore: boolean }>;
};

export async function recordTransaction(
	storage: StorageCollection<Transaction>,
	input: {
		orderId: string;
		type: TransactionType;
		amount: number;
		currency: string;
		provider: string;
		providerTransactionId: string;
		status: TransactionStatus;
		metadata?: Record<string, unknown>;
	},
): Promise<Transaction> {
	const id = crypto.randomUUID();
	const txn: Transaction = {
		id,
		orderId: input.orderId,
		type: input.type,
		amount: input.amount,
		currency: input.currency,
		provider: input.provider,
		providerTransactionId: input.providerTransactionId,
		status: input.status,
		metadata: input.metadata ?? {},
		createdAt: new Date().toISOString(),
	};

	await storage.put(id, txn);
	return txn;
}

export async function getTransactionsByOrder(
	storage: StorageCollection<Transaction>,
	orderId: string,
): Promise<Transaction[]> {
	const result = await storage.query({
		where: { orderId },
		orderBy: { createdAt: "desc" },
		limit: 100,
	});
	return result.items.map((item) => item.data);
}
