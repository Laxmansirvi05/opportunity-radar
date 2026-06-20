// @ts-nocheck
import type { MessageDescriptor } from "@/lib/resume-toolkit/lingui-dummy";
import type { SectionTitleResolver } from "@reactive-resume/pdf/section-title";
import type { CustomSectionType, SectionType } from "@/lib/resume-toolkit/schema/resume/data";
import { i18n } from "@/lib/resume-toolkit/lingui-dummy";
import { msg } from "@/lib/resume-toolkit/lingui-dummy";

type SectionTranslator = {
	_: (descriptor: MessageDescriptor) => string;
};

const sectionTitleMessages = {
	summary: msg`Summary`,
	profiles: msg`Profiles`,
	experience: msg`Experience`,
	education: msg`Education`,
	projects: msg`Projects`,
	skills: msg`Skills`,
	languages: msg`Languages`,
	interests: msg`Interests`,
	awards: msg`Awards`,
	certifications: msg`Certifications`,
	publications: msg`Publications`,
	volunteer: msg`Volunteer`,
	references: msg`References`,
	"cover-letter": msg`Cover Letter`,
} satisfies Record<"summary" | SectionType | CustomSectionType, MessageDescriptor>;

export const createSectionTitleResolver = (translator: SectionTranslator = i18n): SectionTitleResolver => {
	return ({ sectionId, sectionKind, customSectionType, defaultEnglishTitle }) => {
		const sectionType = sectionKind === "custom" ? customSectionType : sectionId;
		const message = sectionTitleMessages[sectionType as keyof typeof sectionTitleMessages];

		if (!message) return defaultEnglishTitle ?? sectionId;

		return translator._(message) || defaultEnglishTitle || sectionId;
	};
};
