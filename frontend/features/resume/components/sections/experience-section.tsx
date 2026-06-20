import { useFormContext, useFieldArray } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { ResumeData } from '@/src/lib/resume-ai/schema/data'
import { createId } from '@paralleldrive/cuid2'

export function ExperienceSection() {
  const { register, control, formState: { errors } } = useFormContext<ResumeData>()
  const { fields, append, remove } = useFieldArray({
    control,
    // @ts-ignore: RHF fails to infer complex nested schema paths
    name: 'sections.experience.items'
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Experience</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ id: createId(), hidden: false, company: '', position: '', location: '', period: '', website: { url: '', label: '', inlineLink: false }, description: '', roles: [] })}
        >
          Add Experience
        </Button>
      </div>
      
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">No experience added yet.</p>
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
              <Label>Company *</Label>
              <Input {...register(`sections.experience.items.${index}.company` as const, { required: 'Company is required' })} />
              {errors.sections?.experience?.items?.[index]?.company && (
                <p className="text-sm text-red-500">{errors.sections.experience.items[index]?.company?.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Position / Title</Label>
              <Input {...register(`sections.experience.items.${index}.position` as const)} />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input {...register(`sections.experience.items.${index}.location` as const)} />
            </div>
            <div className="space-y-2">
              <Label>Period (e.g. 2020 - Present)</Label>
              <Input {...register(`sections.experience.items.${index}.period` as const)} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
