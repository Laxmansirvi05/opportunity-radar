import { z } from "zod";
import { resumeDialogSchemas } from "./resume/schema";

// The builder opens dialogs for every Reactive Resume section.  Keep the
// registry in one discriminated union so `openDialog` remains type-safe and
// every renderer can receive its original payload.
export const dialogSchemaRegistries = [{ domain: "resume", schemas: resumeDialogSchemas }] as const;
export const dialogTypeSchema = z.discriminatedUnion("type", resumeDialogSchemas);
export const dialogSchemas = dialogTypeSchema;

export type DialogSchema = z.infer<typeof dialogTypeSchema>;
export type DialogSchemas = DialogSchema;
export type DialogType = DialogSchema["type"];
export type DialogData<T extends DialogType> = Extract<DialogSchema, { type: T }>["data"];
export type DialogProps<T extends DialogType> = DialogData<T> extends undefined
	? Record<string, never>
	: { data: DialogData<T> };
