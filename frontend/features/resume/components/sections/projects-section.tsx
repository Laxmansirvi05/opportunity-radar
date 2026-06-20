import { useFormContext, useFieldArray } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { ResumeData } from '@/src/lib/resume-ai/schema/data'
import { createId } from '@paralleldrive/cuid2'

export function ProjectsSection() {
  const { register, control, formState: { errors } } = useFormContext<ResumeData>()
  const { fields, append, remove } = useFieldArray({
    control,
    // @ts-ignore: RHF fails to infer complex nested schema paths
    name: 'sections.projects.items'
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Projects</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ id: createId(), hidden: false, name: '', period: '', website: { url: '', label: '', inlineLink: false }, description: '' })}
        >
          Add Project
        </Button>
      </div>
      
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">No projects added yet.</p>
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
              <Label>Project Name *</Label>
              <Input {...register(`sections.projects.items.${index}.name` as const, { required: 'Project name is required' })} />
              {errors.sections?.projects?.items?.[index]?.name && (
                <p className="text-sm text-red-500">{errors.sections.projects.items[index]?.name?.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Period (e.g. 2021 - 2022)</Label>
              <Input {...register(`sections.projects.items.${index}.period` as const)} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
