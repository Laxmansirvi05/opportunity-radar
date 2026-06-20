// @ts-nocheck
import type { experienceItemSchema } from "@/lib/resume-toolkit/schema/resume/data";
import type z from "zod";
import { plural } from "@/lib/resume-toolkit/lingui-dummy";
import { Trans } from "@/lib/resume-toolkit/lingui-dummy";
import { AnimatePresence, Reorder } from "motion/react";
import { cn } from "@/lib/resume-toolkit/utils/style";
import { useCurrentResume, useUpdateResumeData } from "@/lib/resume-toolkit/draft";
import { SectionBase } from "../shared/section-base";
import { SectionAddItemButton, SectionItem } from "../shared/section-item";

export function ExperienceSectionBuilder() {
	const resume = useCurrentResume();
	const section = resume.data.sections.experience;
	const updateResumeData = useUpdateResumeData();

	const handleReorder = (items: z.infer<typeof experienceItemSchema>[]) => {
		updateResumeData((draft) => {
			draft.sections.experience.items = items;
		});
	};

	return (
		<SectionBase type="experience" className={cn("rounded-md border", section.items.length === 0 && "border-dashed")}>
			<Reorder.Group axis="y" values={section.items} onReorder={handleReorder}>
				<AnimatePresence initial={false} mode="popLayout">
					{section.items.map((item) => {
						return (
							<SectionItem
								key={item.id}
								type="experience"
								item={item}
								title={item.company}
								subtitle={item.position || plural(item.roles.length, { one: "# role", other: "# roles" })}
							/>
						);
					})}
				</AnimatePresence>
			</Reorder.Group>

			<SectionAddItemButton type="experience">
				<Trans>Add a new experience</Trans>
			</SectionAddItemButton>
		</SectionBase>
	);
}
