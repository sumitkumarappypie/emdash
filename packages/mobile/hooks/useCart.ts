// Re-export the CartProvider hook for convenience.
// Cart state is managed by CartProvider, not React Query,
// because cart mutations need to be synchronous and shared across screens.
export { useCart } from "@/providers/CartProvider";
