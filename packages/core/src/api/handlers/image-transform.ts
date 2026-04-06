export interface TransformParams {
	w: number | null;
	h: number | null;
	fit: "cover" | "contain" | "fill";
	format: "webp" | "jpeg" | "png" | null;
}

const MAX_DIMENSION = 2000;
const VALID_FITS = new Set(["cover", "contain", "fill"]);
const VALID_FORMATS = new Set(["webp", "jpeg", "png"]);

export function parseTransformParams(url: URL): TransformParams | null {
	const wStr = url.searchParams.get("w");
	const hStr = url.searchParams.get("h");
	if (!wStr && !hStr) return null;

	const w = wStr ? parseInt(wStr, 10) : null;
	const h = hStr ? parseInt(hStr, 10) : null;
	if ((wStr && (isNaN(w!) || w! <= 0)) || (hStr && (isNaN(h!) || h! <= 0))) return null;

	const fitStr = url.searchParams.get("fit");
	const formatStr = url.searchParams.get("format");

	return {
		w: w ? Math.min(w, MAX_DIMENSION) : null,
		h: h ? Math.min(h, MAX_DIMENSION) : null,
		fit: (fitStr && VALID_FITS.has(fitStr) ? fitStr : "cover") as TransformParams["fit"],
		format: (formatStr && VALID_FORMATS.has(formatStr)
			? formatStr
			: null) as TransformParams["format"],
	};
}
