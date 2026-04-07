import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { fetchProduct, fetchProducts } from "@/lib/api";

export function useProductList() {
	return useInfiniteQuery({
		queryKey: ["products"],
		queryFn: ({ pageParam }) => fetchProducts({ limit: 20, cursor: pageParam }),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.nextCursor,
	});
}

export function useProduct(slug: string) {
	return useQuery({
		queryKey: ["product", slug],
		queryFn: () => fetchProduct(slug),
		enabled: !!slug,
	});
}
