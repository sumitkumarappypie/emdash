const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the monorepo root for shared packages (e.g., commerce plugin)
config.watchFolders = [monorepoRoot];

// pnpm uses symlinks
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = false;

// Search mobile's node_modules first, then monorepo root
config.resolver.nodeModulesPaths = [
	path.resolve(projectRoot, "node_modules"),
	path.resolve(monorepoRoot, "node_modules"),
];

// Pin React to mobile package's copy (18.3.1).
// The monorepo also has React 19 (for the admin SPA). Without this,
// pnpm hoisting causes expo-router and other deps to resolve React 19,
// producing "Objects are not valid as a React child" at runtime.
// Use require.resolve to find the actual file regardless of node_modules layout
// (works with both pnpm strict symlinks and hoisted node_modules in CI).
const PINNED_MODULES = {
	react: require.resolve("react", { paths: [projectRoot] }),
	"react/jsx-runtime": require.resolve("react/jsx-runtime", { paths: [projectRoot] }),
	"react/jsx-dev-runtime": require.resolve("react/jsx-dev-runtime", { paths: [projectRoot] }),
};

// Resolve workspace plugin mobile entries to absolute paths.
// The babel alias + Metro relative path resolution breaks for files in subdirectories.
// Using resolveRequest with absolute paths works regardless of the importing file's location.
const PLUGIN_MOBILE_ENTRIES = {
	"@emdash-cms/plugin-commerce/mobile": path.resolve(
		monorepoRoot,
		"packages/plugins/commerce/src/mobile/index.ts",
	),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
	if (PINNED_MODULES[moduleName]) {
		return { filePath: PINNED_MODULES[moduleName], type: "sourceFile" };
	}
	if (PLUGIN_MOBILE_ENTRIES[moduleName]) {
		return { filePath: PLUGIN_MOBILE_ENTRIES[moduleName], type: "sourceFile" };
	}
	return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
