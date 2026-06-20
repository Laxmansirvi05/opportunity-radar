import type { ResumeData } from "@/lib/resume-toolkit/schema/resume/data";

export const hasTemplatePicture = (picture: ResumeData["picture"]) => !picture.hidden && picture.url.trim() !== "";
