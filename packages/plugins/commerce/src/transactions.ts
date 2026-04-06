import type { StorageCollection } from "./storage-types.js";
import type { Transaction, TransactionStatus, TransactionType } from "./types.js";

export async function recordTransaction(
	storage: StorageCollection,
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
	storage: StorageCollection,
	orderId: string,
): Promise<Transaction[]> {
	const result = await storage.query({
		where: { orderId },
		orderBy: { createdAt: "desc" },
		limit: 100,
	});
	return result.items.map((item) => item.data);
}
