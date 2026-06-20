// @ts-nocheck
import type { basicsSchema } from "@/lib/resume-toolkit/schema/resume/data";
import type z from "zod";
import { t } from "@/lib/resume-toolkit/lingui-dummy";
import { Trans } from "@/lib/resume-toolkit/lingui-dummy";
import { DotsSixVerticalIcon, LinkIcon, ListPlusIcon, XIcon } from "@phosphor-icons/react";
import { Reorder, useDragControls } from "motion/react";
import { Button } from "@/components/ui/button";
import { FormControl, FormItem } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { generateId } from "@/lib/resume-toolkit/utils/string";
import { IconPicker } from "@/components/input/icon-picker";
import { withForm } from "@/libs/tanstack-form";

type FormValues = z.infer<typeof basicsSchema>;
type CustomField = FormValues["customFields"][number];

const defaultValues: FormValues = {
	name: "",
	headline: "",
	email: "",
	phone: "",
	location: "",
	website: { url: "", label: "" },
	customFields: [],
};

export const CustomFieldsSection = withForm({
	defaultValues,
	render: ({ form }) => {
		return (
			<form.Field name="customFields" mode="array">
				{(customFieldsField) => (
					<Reorder.Group
						className="touch-none space-y-4"
						values={customFieldsField.state.value}
						onReorder={(fields) => {
							customFieldsField.setValue(fields);
							void form.handleSubmit();
						}}
					>
						{customFieldsField.state.value.map((field: CustomField, index: number) => (
							<CustomFieldItem key={field.id} field={field}>
								<form.Field name={`customFields[${index}].icon`}>
									{(iconField) => (
										<FormItem className="shrink-0">
											<FormControl
												render={
													<IconPicker
														name={iconField.name}
														value={iconField.state.value}
														className="rounded-r-none! border-e-0!"
														onChange={(icon) => {
															iconField.handleChange(icon);
															void form.handleSubmit();
														}}
													/>
												}
											/>
										</FormItem>
									)}
								</form.Field>

								<form.Field name={`customFields[${index}].text`}>
									{(textField) => (
										<FormItem className="flex-1">
											<FormControl
												render={
													<Input
														name={textField.name}
														value={textField.state.value}
														className="rounded-l-none!"
														onChange={(e) => {
															textField.handleChange(e.target.value);
															void form.handleSubmit();
														}}
													/>
												}
											/>
										</FormItem>
									)}
								</form.Field>

								<form.Field name={`customFields[${index}].link`}>
									{(linkField) => (
										<Popover>
											<PopoverTrigger
												render={
													<Button size="icon" variant="ghost" className="ms-1">
														<LinkIcon />
													</Button>
												}
											/>

											<PopoverContent align="center">
												<div className="flex flex-col gap-y-1.5">
													<Label htmlFor={linkField.name} className="text-muted-foreground text-xs">
														<Trans>Enter the URL to link to</Trans>
													</Label>

													<Input
														type="url"
														value={linkField.state.value}
														id={linkField.name}
														placeholder={t({
															comment: "Placeholder text for custom link URL field in resume builder",
															message: "Must start with https://",
														})}
														onChange={(e) => {
															linkField.handleChange(e.target.value);
															void form.handleSubmit();
														}}
													/>
												</div>
											</PopoverContent>
										</Popover>
									)}
								</form.Field>

								<Button
									size="icon"
									variant="ghost"
									onClick={() => {
										customFieldsField.removeValue(index);
										void form.handleSubmit();
									}}
								>
									<XIcon />
								</Button>
							</CustomFieldItem>
						))}

						<Button
							variant="ghost"
							onClick={() => {
								customFieldsField.pushValue({ id: generateId(), icon: "acorn", text: "", link: "" });
								void form.handleSubmit();
							}}
						>
							<ListPlusIcon />
							<Trans>Add a custom field</Trans>
						</Button>
					</Reorder.Group>
				)}
			</form.Field>
		);
	},
});

type CustomFieldItemProps = {
	field: CustomField;
	children: React.ReactNode;
};

function CustomFieldItem({ field, children }: CustomFieldItemProps) {
	const controls = useDragControls();

	return (
		<Reorder.Item
			key={field.id}
			value={field}
			dragListener={false}
			dragControls={controls}
			initial={{ opacity: 0, y: -10 }}
			animate={{ opacity: 1, y: 0 }}
			className="flex touch-none items-center"
		>
			<Button
				size="icon"
				variant="ghost"
				className="me-2 touch-none"
				onPointerDown={(e) => {
					e.preventDefault();
					controls.start(e);
				}}
			>
				<DotsSixVerticalIcon />
			</Button>

			{children}
		</Reorder.Item>
	);
}
