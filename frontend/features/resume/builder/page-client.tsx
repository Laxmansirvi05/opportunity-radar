"use client";

import "@/libs/locale";
import { i18n as linguiI18n } from "@/libs/locale";
linguiI18n.load({ en: {} });
linguiI18n.activate("en");

import { useEffect } from "react";
import { sampleResumeData } from "@reactive-resume/schema/resume/sample";
import { BuilderLayoutShell, getBuilderLayout } from "./layout-shell";
import { PreviewPage } from "./components/preview-page";
import {
	useInitializeResumeStore,
	useMergeResumeMetadata,
	useResumeCleanup,
	useResumeStore,
	useResumeUpdateSubscription,
	Resume
} from "./draft";
import { ConfirmDialogProvider } from "@/hooks/use-confirm";
import { PromptDialogProvider } from "@/hooks/use-prompt";
import { DialogManager } from "@/features/resume/dialogs/manager";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/features/theme/provider";

import { useMemo } from "react";
import type { IconProps } from "@phosphor-icons/react";
import { IconContext } from "@phosphor-icons/react";
import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { DirectionProvider } from "@reactive-resume/ui/components/direction";
import { TooltipProvider } from "@reactive-resume/ui/components/tooltip";
import { CommandPalette } from "@/features/command-palette";

const queryClient = new QueryClient();

export function BuilderPageClient({ initialResume }: { initialResume: Resume }) {
	const initializeResumeStore = useInitializeResumeStore();
	const mergeResumeMetadata = useMergeResumeMetadata();
	const isReady = useResumeStore((state) => state.isReady);
	const initializedResumeId = useResumeStore((state) => state.resumeId);
	const isInitialized = isReady && initializedResumeId === initialResume.id;

	useResumeCleanup();
	useResumeUpdateSubscription();

	useEffect(() => {
		document.documentElement.classList.add("resume-builder-theme");

		return () => {
			document.documentElement.classList.remove("resume-builder-theme");
		};
	}, []);

	useEffect(() => {
		if (isInitialized) return;
		initializeResumeStore(initialResume);
	}, [initializeResumeStore, isInitialized, initialResume]);

	useEffect(() => {
		if (!isInitialized) return;
		mergeResumeMetadata(initialResume);
	}, [mergeResumeMetadata, initialResume, isInitialized]);

	const iconContextValue = useMemo<IconProps>(() => ({ size: 16, weight: "regular" }), []);

	if (!isInitialized) return null;

	const initialLayout = getBuilderLayout();

	return (
		<QueryClientProvider client={queryClient}>
			<MotionConfig reducedMotion="user">
				<LazyMotion features={domAnimation}>
					<I18nProvider i18n={linguiI18n}>
						<IconContext.Provider value={iconContextValue}>
							<ThemeProvider theme="dark">
								<HotkeysProvider>
									<DirectionProvider>
										<TooltipProvider>
											<ConfirmDialogProvider>
												<PromptDialogProvider>
													<BuilderLayoutShell initialLayout={initialLayout}>
														<PreviewPage />
													</BuilderLayoutShell>
													<DialogManager />
													<CommandPalette />
													{/* Toaster now mounted once, globally, in app/layout.tsx —
														having one here too would double-render every toast
														while on this page. */}
												</PromptDialogProvider>
											</ConfirmDialogProvider>
										</TooltipProvider>
									</DirectionProvider>
								</HotkeysProvider>
							</ThemeProvider>
						</IconContext.Provider>
					</I18nProvider>
				</LazyMotion>
			</MotionConfig>
		</QueryClientProvider>
	);
}
