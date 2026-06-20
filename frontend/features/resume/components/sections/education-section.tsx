import { useFormContext, useFieldArray } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { ResumeData } from '@/src/lib/resume-ai/schema/data'
import { createId } from '@paralleldrive/cuid2'

export function EducationSection() {
  const { register, control, formState: { errors } } = useFormContext<ResumeData>()
  const { fields, append, remove } = useFieldArray({
    control,
    // @ts-ignore: RHF fails to infer complex nested schema paths
    name: 'sections.education.items'
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Education</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ id: createId(), hidden: false, school: '', degree: '', area: '', grade: '', location: '', period: '', website: { url: '', label: '', inlineLink: false }, description: '' })}
        >
          Add Education
        </Button>
      </div>
      
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">No education added yet.</p>
      )}

      {fields.map((field, index) => (
        <Card key={field.id} className="p-4 relative space-y-4">
          <Button 
            type="button" 
            variant="destructive" 
            size="sm" 
            className="absolute top-2 right-2"
            onClick={() => remove(index)}
          >
            Delete
          </Button>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 pt-6">
            <div className="space-y-2">
              <Label>School / University *</Label>
              <Input {...register(`sections.education.items.${index}.school` as const, { required: 'School is required' })} />
              {errors.sections?.education?.items?.[index]?.school && (
                <p className="text-sm text-red-500">{errors.sections.education.items[index]?.school?.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Degree</Label>
              <Input {...register(`sections.education.items.${index}.degree` as const)} />
            </div>
            <div className="space-y-2">
              <Label>Area of Study</Label>
              <Input {...register(`sections.education.items.${index}.area` as const)} />
            </div>
            <div className="space-y-2">
              <Label>Period (e.g. 2018 - 2022)</Label>
              <Input {...register(`sections.education.items.${index}.period` as const)} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
