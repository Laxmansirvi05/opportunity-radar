import { z } from "zod";
import { customSectionSchema } from "@reactive-resume/schema/resume/sections/custom";

export const dialogSchemas = z.discriminatedUnion("type", [
	customSectionSchema,
]);

export type DialogSchemas = z.infer<typeof dialogSchemas>;
