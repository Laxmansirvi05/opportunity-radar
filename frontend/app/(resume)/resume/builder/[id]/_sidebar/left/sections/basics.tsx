// @ts-nocheck
import type z from "zod";
import { Trans } from "@/lib/resume-toolkit/lingui-dummy";
import { basicsSchema } from "@/lib/resume-toolkit/schema/resume/data";
import { FormControl, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { URLInput } from "@/components/input/url-input";
import { useCurrentBuilderResumeSelector, useUpdateResumeData } from "@/lib/resume-toolkit/draft";
import { useSyncFormValues } from "@/hooks/use-sync-form-values";
import { useAppForm } from "@/libs/tanstack-form";
import { SectionBase } from "../shared/section-base";
import { CustomFieldsSection } from "./custom-fields";

export function BasicsSectionBuilder() {
	return (
		<SectionBase type="basics">
			<BasicsSectionForm />
		</SectionBase>
	);
}

const formSchema = basicsSchema;

type FormValues = z.infer<typeof formSchema>;

function BasicsSectionForm() {
	const basics = useCurrentBuilderResumeSelector((resume) => resume.data.basics);
	const updateResumeData = useUpdateResumeData();

	const persist = (data: FormValues) => {
		updateResumeData((draft) => {
			draft.basics = data;
		});
	};

	const form = useAppForm({
		defaultValues: basics,
		validators: { onChange: formSchema },
		onSubmit: ({ value }) => {
			persist(value);
		},
	});
	useSyncFormValues(form, basics);

	return (
		<form
			className="space-y-4"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				void form.handleSubmit();
			}}
		>
			<form.Field name="name">
				{(field) => (
					<FormItem hasError={field.state.meta.isTouched && field.state.meta.errors.length > 0}>
						<FormLabel>
							<Trans>Name</Trans>
						</FormLabel>
						<FormControl
							render={
								<Input
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => {
										field.handleChange(e.target.value);
										void form.handleSubmit();
									}}
								/>
							}
						/>
						<FormMessage errors={field.state.meta.errors} />
					</FormItem>
				)}
			</form.Field>

			<form.Field name="headline">
				{(field) => (
					<FormItem hasError={field.state.meta.isTouched && field.state.meta.errors.length > 0}>
						<FormLabel>
							<Trans>Headline</Trans>
						</FormLabel>
						<FormControl
							render={
								<Input
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => {
										field.handleChange(e.target.value);
										void form.handleSubmit();
									}}
								/>
							}
						/>
						<FormMessage errors={field.state.meta.errors} />
					</FormItem>
				)}
			</form.Field>

			<form.Field name="email">
				{(field) => (
					<FormItem hasError={field.state.meta.isTouched && field.state.meta.errors.length > 0}>
						<FormLabel>
							<Trans>Email</Trans>
						</FormLabel>
						<FormControl
							render={
								<Input
									type="email"
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => {
										field.handleChange(e.target.value);
										void form.handleSubmit();
									}}
								/>
							}
						/>
						<FormMessage errors={field.state.meta.errors} />
					</FormItem>
				)}
			</form.Field>

			<form.Field name="phone">
				{(field) => (
					<FormItem hasError={field.state.meta.isTouched && field.state.meta.errors.length > 0}>
						<FormLabel>
							<Trans>Phone</Trans>
						</FormLabel>
						<FormControl
							render={
								<Input
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => {
										field.handleChange(e.target.value);
										void form.handleSubmit();
									}}
								/>
							}
						/>
						<FormMessage errors={field.state.meta.errors} />
					</FormItem>
				)}
			</form.Field>

			<form.Field name="location">
				{(field) => (
					<FormItem hasError={field.state.meta.isTouched && field.state.meta.errors.length > 0}>
						<FormLabel>
							<Trans>Location</Trans>
						</FormLabel>
						<FormControl
							render={
								<Input
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => {
										field.handleChange(e.target.value);
										void form.handleSubmit();
									}}
								/>
							}
						/>
						<FormMessage errors={field.state.meta.errors} />
					</FormItem>
				)}
			</form.Field>

			<form.Field name="website">
				{(field) => (
					<FormItem hasError={field.state.meta.isTouched && field.state.meta.errors.length > 0}>
						<FormLabel>
							<Trans>Website</Trans>
						</FormLabel>
						<URLInput
							name={field.name}
							value={field.state.value}
							onChange={(value) => {
								field.handleChange(value);
								void form.handleSubmit();
							}}
						/>
						<FormMessage errors={field.state.meta.errors} />
					</FormItem>
				)}
			</form.Field>

			<CustomFieldsSection form={form} />
		</form>
	);
}
