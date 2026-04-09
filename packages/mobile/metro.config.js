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
const PINNED_MODULES = {
	react: path.resolve(projectRoot, "node_modules/react/index.js"),
	"react/jsx-runtime": path.resolve(
		projectRoot,
		"node_modules/react/jsx-runtime.js",
	),
	"react/jsx-dev-runtime": path.resolve(
		projectRoot,
		"node_modules/react/jsx-dev-runtime.js",
	),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
	if (PINNED_MODULES[moduleName]) {
		return { filePath: PINNED_MODULES[moduleName], type: "sourceFile" };
	}
	return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
