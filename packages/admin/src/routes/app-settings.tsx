/**
 * Mobile App Settings page
 *
 * Branding configuration (app name, bundle IDs, colors) and build triggering.
 */

import { Button, Input } from "@cloudflare/kumo";
import { CheckCircle, FloppyDisk, Rocket, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { DialogError, getMutationError } from "../components/DialogError.js";
import {
	fetchBranding,
	updateBranding,
	triggerBuild,
	type AppBranding,
} from "../lib/api/app-branding.js";

export function AppSettingsPage() {
	const queryClient = useQueryClient();

	const { data: branding, isLoading } = useQuery({
		queryKey: ["appBranding"],
		queryFn: fetchBranding,
		staleTime: Infinity,
	});

	const [formData, setFormData] = React.useState<Partial<AppBranding>>({});
	const [saveStatus, setSaveStatus] = React.useState<{
		type: "success" | "error";
		message: string;
	} | null>(null);

	const [buildPlatform, setBuildPlatform] = React.useState<"both" | "android" | "ios">("both");
	const [buildStatus, setBuildStatus] = React.useState<{
		type: "success" | "error";
		message: string;
	} | null>(null);

	React.useEffect(() => {
		if (branding) setFormData(branding);
	}, [branding]);

	React.useEffect(() => {
		if (saveStatus) {
			const timer = setTimeout(setSaveStatus, 3000, null);
			return () => clearTimeout(timer);
		}
	}, [saveStatus]);

	React.useEffect(() => {
		if (buildStatus) {
			const timer = setTimeout(setBuildStatus, 5000, null);
			return () => clearTimeout(timer);
		}
	}, [buildStatus]);

	const saveMutation = useMutation({
		mutationFn: (data: Partial<AppBranding>) => updateBranding(data),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["appBranding"] });
			setSaveStatus({ type: "success", message: "App branding saved successfully" });
		},
		onError: (error) => {
			setSaveStatus({
				type: "error",
				message: error instanceof Error ? error.message : "Failed to save branding",
			});
		},
	});

	const buildMutation = useMutation({
		mutationFn: (platform: "android" | "ios" | "both") => triggerBuild(platform),
		onSuccess: (data) => {
			setBuildStatus({ type: "success", message: data.message || "Build triggered successfully" });
		},
		onError: (error) => {
			setBuildStatus({
				type: "error",
				message: error instanceof Error ? error.message : "Failed to trigger build",
			});
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		saveMutation.mutate(formData);
	};

	const handleChange = (key: keyof AppBranding, value: string) => {
		setFormData((prev) => ({ ...prev, [key]: value }));
	};

	const handleBuild = () => {
		buildMutation.mutate(buildPlatform);
	};

	if (isLoading) {
		return (
			<div className="space-y-6 p-6">
				<h1 className="text-2xl font-bold">Mobile App</h1>
				<div className="rounded-lg border bg-kumo-base p-6">
					<p className="text-kumo-subtle">Loading app settings...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6 p-6">
			<div>
				<h1 className="text-2xl font-bold">Mobile App</h1>
				<p className="text-sm text-muted-foreground mt-1">
					Configure your mobile app branding and trigger builds.
				</p>
			</div>

			{/* Save status banner */}
			{saveStatus && (
				<div
					className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
						saveStatus.type === "success"
							? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200"
							: "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
					}`}
				>
					{saveStatus.type === "success" ? (
						<CheckCircle className="h-4 w-4 flex-shrink-0" />
					) : (
						<WarningCircle className="h-4 w-4 flex-shrink-0" />
					)}
					{saveStatus.message}
				</div>
			)}

			{/* Branding Section */}
			<form onSubmit={handleSubmit} className="space-y-6">
				<div className="rounded-lg border bg-kumo-base p-6">
					<h2 className="mb-4 text-lg font-semibold">App Identity</h2>
					<div className="space-y-4">
						<Input
							label="App Name"
							value={formData.appName || ""}
							onChange={(e) => handleChange("appName", e.target.value)}
							description="Display name shown on the home screen"
						/>
						<Input
							label="App Slug"
							value={formData.appSlug || ""}
							onChange={(e) => handleChange("appSlug", e.target.value)}
							description="URL-safe identifier used in Expo (e.g. my-app)"
						/>
						<Input
							label="URL Scheme"
							value={formData.scheme || ""}
							onChange={(e) => handleChange("scheme", e.target.value)}
							description="Deep link scheme (e.g. myapp)"
						/>
					</div>
				</div>

				<div className="rounded-lg border bg-kumo-base p-6">
					<h2 className="mb-4 text-lg font-semibold">Platform Identifiers</h2>
					<div className="space-y-4">
						<Input
							label="iOS Bundle Identifier"
							value={formData.iosBundle || ""}
							onChange={(e) => handleChange("iosBundle", e.target.value)}
							description="Apple bundle ID (e.g. com.example.myapp)"
						/>
						<Input
							label="Android Package Name"
							value={formData.androidPackage || ""}
							onChange={(e) => handleChange("androidPackage", e.target.value)}
							description="Android package name (e.g. com.example.myapp)"
						/>
					</div>
				</div>

				<div className="rounded-lg border bg-kumo-base p-6">
					<h2 className="mb-4 text-lg font-semibold">Colors</h2>
					<div className="space-y-4">
						<div>
							<Input
								label="Splash Background Color"
								value={formData.splashBgColor || ""}
								onChange={(e) => handleChange("splashBgColor", e.target.value)}
								description="Background color for the splash screen (hex, e.g. #ffffff)"
							/>
							{formData.splashBgColor && (
								<div
									className="mt-2 h-8 w-16 rounded border"
									style={{ backgroundColor: formData.splashBgColor }}
								/>
							)}
						</div>
						<div>
							<Input
								label="Accent Color"
								value={formData.accentColor || ""}
								onChange={(e) => handleChange("accentColor", e.target.value)}
								description="Primary accent color used throughout the app (hex, e.g. #2271b1)"
							/>
							{formData.accentColor && (
								<div
									className="mt-2 h-8 w-16 rounded border"
									style={{ backgroundColor: formData.accentColor }}
								/>
							)}
						</div>
					</div>
				</div>

				{/* Save Button */}
				<div className="flex justify-end">
					<Button type="submit" disabled={saveMutation.isPending} icon={<FloppyDisk />}>
						{saveMutation.isPending ? "Saving..." : "Save Branding"}
					</Button>
				</div>
			</form>

			{/* Build Section */}
			<div className="rounded-lg border bg-kumo-base p-6">
				<h2 className="mb-4 text-lg font-semibold">Build App</h2>
				<p className="text-sm text-kumo-subtle mb-4">
					Trigger a new build via GitHub Actions. This will compile your app with the latest
					branding settings and plugin configuration.
				</p>

				<div className="flex items-end gap-3">
					<div className="flex-1 max-w-xs">
						<label className="block text-sm font-medium mb-1.5">Platform</label>
						<select
							value={buildPlatform}
							onChange={(e) => setBuildPlatform(e.target.value as "both" | "android" | "ios")}
							className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
						>
							<option value="both">Android + iOS</option>
							<option value="android">Android only</option>
							<option value="ios">iOS only</option>
						</select>
					</div>
					<Button
						type="button"
						onClick={handleBuild}
						disabled={buildMutation.isPending}
						icon={<Rocket />}
					>
						{buildMutation.isPending ? "Triggering..." : "Build App"}
					</Button>
				</div>

				{/* Build status */}
				{buildStatus && (
					<div
						className={`mt-4 flex items-center gap-2 rounded-lg border p-3 text-sm ${
							buildStatus.type === "success"
								? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200"
								: "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
						}`}
					>
						{buildStatus.type === "success" ? (
							<CheckCircle className="h-4 w-4 flex-shrink-0" />
						) : (
							<WarningCircle className="h-4 w-4 flex-shrink-0" />
						)}
						{buildStatus.message}
					</div>
				)}

				{/* Build mutation error (shown via DialogError for inline display) */}
				<DialogError message={getMutationError(buildMutation.error)} className="mt-4" />
			</div>
		</div>
	);
}
