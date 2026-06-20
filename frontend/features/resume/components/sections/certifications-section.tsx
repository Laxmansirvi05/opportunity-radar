import { useFormContext, useFieldArray } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { ResumeData } from '@/src/lib/resume-ai/schema/data'
import { createId } from '@paralleldrive/cuid2'

export function CertificationsSection() {
  const { register, control, formState: { errors } } = useFormContext<ResumeData>()
  const { fields, append, remove } = useFieldArray({
    control,
    // @ts-ignore: RHF fails to infer complex nested schema paths
    name: 'sections.certifications.items'
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Certifications</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ id: createId(), hidden: false, title: '', issuer: '', date: '', website: { url: '', label: '', inlineLink: false }, description: '' })}
        >
          Add Certification
        </Button>
      </div>
      
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">No certifications added yet.</p>
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
              <Label>Certification Title *</Label>
              <Input {...register(`sections.certifications.items.${index}.title` as const, { required: 'Title is required' })} />
              {errors.sections?.certifications?.items?.[index]?.title && (
                <p className="text-sm text-red-500">{errors.sections.certifications.items[index]?.title?.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Issuer</Label>
              <Input {...register(`sections.certifications.items.${index}.issuer` as const)} />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input {...register(`sections.certifications.items.${index}.date` as const)} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
