module.exports = function (api) {
	api.cache(true);
	return {
		presets: ["babel-preset-expo"],
		plugins: [
			[
				"module-resolver",
				{
					alias: {
						"@": ".",
						"@emdash-cms/plugin-commerce/mobile":
							"../plugins/commerce/src/mobile/index.ts",
					},
				},
			],
			// Tamagui extracts styles at compile time for performance
			[
				"@tamagui/babel-plugin",
				{
					components: ["tamagui"],
					config: "./lib/tamagui.config.ts",
				},
			],
		],
	};
};
