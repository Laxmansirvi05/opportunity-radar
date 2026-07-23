import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { sampleResumeData } from "@reactive-resume/schema/resume/sample";
import type { ResumeData } from "@reactive-resume/schema/resume/data";
import {
	createResume,
	duplicateResume,
	getResumeBySlug,
	listResumes,
	updateResume,
} from "@/features/resume-toolkit/services/resume-actions";

export type RouterInput = {
	resume: {
		create: { name: string; slug: string; tags?: string[]; withSampleData?: boolean };
		update: { id: string; name: string; slug: string; tags?: string[] };
		duplicate: { id: string; name: string; slug: string; tags?: string[] };
	};
};

type MutationOptions<TInput, TResult> = { mutationFn: (input: TInput) => Promise<TResult> };

const asMutationOptions = <TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>): MutationOptions<TInput, TResult> => ({
	mutationFn,
});

/**
 * Compatibility adapter for the Reactive Resume dialogs.  It keeps their UI
 * unchanged while routing mutations through Opportunity Radar server actions
 * and Supabase/Auth instead of the original oRPC backend.
 */
export const orpc = {
	resume: {
		create: {
			mutationOptions: () =>
				asMutationOptions<RouterInput["resume"]["create"], string>(async (input) => {
					const result = await createResume(
						input.name,
						input.withSampleData ? sampleResumeData : defaultResumeData,
						{ slug: input.slug, tags: input.tags },
					);
					if (!result.success) throw new Error(result.error);
					return result.id;
				}),
		},
		update: {
			mutationOptions: () =>
				asMutationOptions<
					RouterInput["resume"]["update"],
					{ id: string; name: string; slug: string; tags: string[]; isLocked: boolean; isPublic: boolean; hasPassword: boolean }
				>(async (input) => {
					const result = await updateResume(input.id, {
						title: input.name,
						slug: input.slug,
						tags: input.tags || [],
					});
					if (!result.success || !result.resume) throw new Error(result.error || "Unable to update resume");
					return {
						id: result.resume.id,
						name: result.resume.title,
						slug: result.resume.slug,
						tags: result.resume.tags || [],
						isLocked: result.resume.is_locked,
						isPublic: result.resume.is_public,
						hasPassword: false,
					};
				}),
		},
		duplicate: {
			mutationOptions: () =>
				asMutationOptions<RouterInput["resume"]["duplicate"], string>(async (input) => {
					const result = await duplicateResume(input.id, {
						title: input.name,
						slug: input.slug,
						tags: input.tags,
					});
					if (!result.success) throw new Error(result.error);
					return result.id;
				}),
		},
		import: {
			mutationOptions: () => asMutationOptions<{ data: ResumeData; name: string }, string>(async (input) => {
				const result = await createResume(input.name, input.data);
				if (!result.success) throw new Error(result.error);
				return result.id;
			}),
		},
		list: {
			queryOptions: ({ enabled = true }: { enabled?: boolean } = {}) => ({
				queryKey: ["resumes"],
				enabled,
				queryFn: async () => {
					const result = await listResumes();
					if (!result.success) throw new Error(result.error);
					return result.resumes.map((resume) => ({ ...resume, name: resume.title }));
				},
			}),
		},
		getBySlug: {
			queryOptions: ({ input }: { input: { username?: string; slug: string } }) => ({
				queryKey: ["resume", input.slug],
				queryFn: async () => {
					const result = await getResumeBySlug(input.slug);
					if (!result.success || !result.resume) throw new Error(result.error || "Resume not found");
					return { ...result.resume, name: result.resume.title };
				},
			}),
		},
	},
};

export const client = {
	ai: {
		parsePdf: async ({ file, mediaType }: { file: { name: string; data: string }; mediaType: string }): Promise<ResumeData> => {
			const binary = Uint8Array.from(atob(file.data), (character) => character.charCodeAt(0));
			const formData = new FormData();
			formData.append("file", new File([binary], file.name, { type: mediaType }));
			const response = await fetch("/api/resume/parse", { method: "POST", body: formData });
			const payload = await response.json().catch(() => null);
			if (!response.ok) throw new Error(payload?.error || "Resume parsing failed.");
			return payload as ResumeData;
		},
	},
};
