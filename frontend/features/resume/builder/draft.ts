import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { WritableDraft } from "immer";
import { t } from "@lingui/core/macro";
import { useParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { immer } from "zustand/middleware/immer";
import { create } from "zustand/react";

export type Resume = {
	id: string;
	name: string;
	slug: string;
	tags: string[];
	data: ResumeData;
	isLocked: boolean;
	updatedAt: Date;
	hasPassword?: boolean;
	isPublic?: boolean;
};

type ResumeStoreState = {
	resume: Resume | null;
	resumeId?: string;
	isReady: boolean;
};

type ResumeStoreActions = {
	initialize: (resume: Resume | null) => void;
	reset: () => void;
	replaceResumeDraft: (resume: Resume) => void;
	replaceResumeFromServer: (resume: Resume) => void;
	updateResumeData: (fn: (draft: WritableDraft<ResumeData>) => void) => void;
	patchResume: (fn: (draft: WritableDraft<Resume>) => void) => void;
	mergeResumeMetadata: (resume: Resume) => void;
};

type ResumeStore = ResumeStoreState & ResumeStoreActions;

let lockedToastId: string | number | undefined;

import { patchResumeData, updateResume } from "@/features/resume-toolkit/services/resume-actions";

let saveTimeout: ReturnType<typeof setTimeout>;
function debouncedSaveData(id: string, data: ResumeData) {
	clearTimeout(saveTimeout);
	saveTimeout = setTimeout(() => {
		patchResumeData(id, data).catch(console.error);
	}, 1500);
}

let updateTimeout: ReturnType<typeof setTimeout>;
function debouncedUpdateResume(id: string, updates: Partial<Resume>) {
	clearTimeout(updateTimeout);
	updateTimeout = setTimeout(() => {
		updateResume(id, { 
			title: updates.name, 
			slug: updates.slug, 
			tags: updates.tags, 
			is_locked: updates.isLocked, 
			is_public: updates.isPublic 
		}).catch(console.error);
	}, 1500);
}

export const useResumeStore = create<ResumeStore>()(
	immer((set, get) => ({
		resume: null,
		resumeId: undefined,
		isReady: false,

		initialize: (resume) => {
			set((state) => {
				state.resume = resume;
				state.resumeId = resume?.id;
				state.isReady = resume !== null;
			});
		},

		reset: () => {
			set((state) => {
				state.resume = null;
				state.resumeId = undefined;
				state.isReady = false;
			});
		},

		replaceResumeDraft: (resume) => {
			set((state) => {
				state.resume = resume;
				state.resumeId = resume.id;
				state.isReady = true;
			});
		},

		replaceResumeFromServer: (resume) => {
			set((state) => {
				state.resume = resume;
				state.resumeId = resume.id;
				state.isReady = true;
			});
		},

		patchResume: (fn) => {
			set((state) => {
				if (!state.resume) return;
				fn(state.resume as WritableDraft<Resume>);
			});

			const updated = get().resume;
			if (updated) {
				debouncedUpdateResume(updated.id, updated);
			}
		},

		mergeResumeMetadata: (resume) => {
			set((state) => {
				if (!state.resume || state.resume.id !== resume.id) return;

				state.resume.name = resume.name;
				state.resume.slug = resume.slug;
				state.resume.tags = resume.tags;
				state.resume.isLocked = resume.isLocked;
				state.resume.updatedAt = resume.updatedAt;
				state.resume.hasPassword = resume.hasPassword;
				state.resume.isPublic = resume.isPublic;
			});
		},

		updateResumeData: (fn) => {
			const currentResume = get().resume;
			if (!currentResume) return;

			if (currentResume.isLocked) {
				lockedToastId = toast.error(t`This resume is locked and cannot be updated.`, {
					id: lockedToastId,
				});
				return;
			}

			set((state) => {
				if (!state.resume) return;
				fn(state.resume.data as WritableDraft<ResumeData>);
			});

			const updated = get().resume;
			if (updated) {
				debouncedSaveData(updated.id, updated.data);
			}
		},
	})),
);

export function useInitializeResumeStore() {
	return useResumeStore((state) => state.initialize);
}

function useResetResumeStore() {
	return useResumeStore((state) => state.reset);
}

export function useMergeResumeMetadata() {
	return useResumeStore((state) => state.mergeResumeMetadata);
}

export function usePatchResume() {
	return useResumeStore((state) => state.patchResume);
}

function useBuilderResumeSelector<T>(selector: (resume: Resume) => T): T | undefined {
	const params = useParams() as { resumeId?: string };
	const resumeId = params?.resumeId;

	return useResumeStore((state) => {
		if (!resumeId || !state.resume || state.resume.id !== resumeId) return undefined;
		return selector(state.resume);
	});
}

export function useCurrentBuilderResumeSelector<T>(selector: (resume: Resume) => T): T {
	const selected = useBuilderResumeSelector(selector);
	if (selected === undefined) throw new Error("Resume data is required before rendering this component.");
	return selected;
}

export function useResume(): Resume | undefined {
	return useBuilderResumeSelector((resume) => resume);
}

export function useCurrentResume(): Resume {
	const resume = useResume();
	if (!resume) throw new Error("Resume data is required before rendering this component.");
	return resume;
}

export function useResumeData(): ResumeData | undefined {
	return useBuilderResumeSelector((resume) => resume.data);
}

export function useUpdateResumeData() {
	const updateResumeData = useResumeStore((state) => state.updateResumeData);

	return useCallback(
		(fn: (draft: WritableDraft<ResumeData>) => void) => {
			updateResumeData(fn);
		},
		[updateResumeData],
	);
}

export function useResumeUpdateSubscription() {
	// Stub out subscription to remote changes
}

export function useResumeCleanup() {
	const params = useParams() as { resumeId?: string };
	const resumeId = params?.resumeId;
	const reset = useResetResumeStore();

	useEffect(() => {
		if (!resumeId) return;
		return () => {
			reset();
		};
	}, [resumeId, reset]);
}
