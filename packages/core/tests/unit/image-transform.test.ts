import { describe, it, expect } from "vitest";

import { parseTransformParams } from "../../src/api/handlers/image-transform.js";

describe("parseTransformParams", () => {
	it("returns null when no params", () => {
		const url = new URL("https://example.com/image.jpg");
		expect(parseTransformParams(url)).toBeNull();
	});

	it("parses w and h", () => {
		const url = new URL("https://example.com/image.jpg?w=800&h=600");
		const result = parseTransformParams(url);
		expect(result).toEqual({
			w: 800,
			h: 600,
			fit: "cover",
			format: null,
		});
	});

	it("parses w only", () => {
		const url = new URL("https://example.com/image.jpg?w=400");
		const result = parseTransformParams(url);
		expect(result).toEqual({
			w: 400,
			h: null,
			fit: "cover",
			format: null,
		});
	});

	it("parses h only", () => {
		const url = new URL("https://example.com/image.jpg?h=300");
		const result = parseTransformParams(url);
		expect(result).toEqual({
			w: null,
			h: 300,
			fit: "cover",
			format: null,
		});
	});

	it("parses fit param", () => {
		const url = new URL("https://example.com/image.jpg?w=100&fit=contain");
		const result = parseTransformParams(url);
		expect(result).not.toBeNull();
		expect(result!.fit).toBe("contain");
	});

	it("defaults fit to cover for invalid values", () => {
		const url = new URL("https://example.com/image.jpg?w=100&fit=stretch");
		const result = parseTransformParams(url);
		expect(result).not.toBeNull();
		expect(result!.fit).toBe("cover");
	});

	it("parses format param", () => {
		const url = new URL("https://example.com/image.jpg?w=100&format=webp");
		const result = parseTransformParams(url);
		expect(result).not.toBeNull();
		expect(result!.format).toBe("webp");
	});

	it("returns null format for invalid format values", () => {
		const url = new URL("https://example.com/image.jpg?w=100&format=bmp");
		const result = parseTransformParams(url);
		expect(result).not.toBeNull();
		expect(result!.format).toBeNull();
	});

	it("clamps width to 2000", () => {
		const url = new URL("https://example.com/image.jpg?w=5000");
		const result = parseTransformParams(url);
		expect(result).not.toBeNull();
		expect(result!.w).toBe(2000);
	});

	it("clamps height to 2000", () => {
		const url = new URL("https://example.com/image.jpg?h=3000");
		const result = parseTransformParams(url);
		expect(result).not.toBeNull();
		expect(result!.h).toBe(2000);
	});

	it("ignores invalid values (non-numeric w)", () => {
		const url = new URL("https://example.com/image.jpg?w=abc");
		expect(parseTransformParams(url)).toBeNull();
	});

	it("ignores invalid values (non-numeric h)", () => {
		const url = new URL("https://example.com/image.jpg?h=abc");
		expect(parseTransformParams(url)).toBeNull();
	});

	it("ignores zero width", () => {
		const url = new URL("https://example.com/image.jpg?w=0");
		expect(parseTransformParams(url)).toBeNull();
	});

	it("ignores negative width", () => {
		const url = new URL("https://example.com/image.jpg?w=-100");
		expect(parseTransformParams(url)).toBeNull();
	});
});
