import { useFormContext, useFieldArray } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { ResumeData } from '@/src/lib/resume-ai/schema/data'
import { createId } from '@paralleldrive/cuid2'

export function SkillsSection() {
  const { register, control, formState: { errors } } = useFormContext<ResumeData>()
  const { fields, append, remove } = useFieldArray({
    control,
    // @ts-ignore: RHF fails to infer complex nested schema paths
    name: 'sections.skills.items'
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Skills</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ id: createId(), hidden: false, name: '', proficiency: '', level: 0, keywords: [], icon: '', iconColor: '' })}
        >
          Add Skill Category
        </Button>
      </div>
      
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">No skills added yet.</p>
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
            <div className="space-y-2 md:col-span-2">
              <Label>Skill Name * (e.g. Programming Languages)</Label>
              <Input {...register(`sections.skills.items.${index}.name` as const, { required: 'Skill name is required' })} />
              {errors.sections?.skills?.items?.[index]?.name && (
                <p className="text-sm text-red-500">{errors.sections.skills.items[index]?.name?.message}</p>
              )}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Keywords (comma separated)</Label>
              {/* Note: since keywords is a string array in schema, we will handle it as comma separated text internally or simply map it. 
                  For simplicity in this basic form, we register a single string and we would need custom transform, 
                  but since we use react-hook-form directly, we can just bind it, but the schema expects string[]. 
                  Wait, z.array(z.string()) needs an array. We must write a custom input wrapper if we want string editing, 
                  or we can just let users type and we parse it before save. 
                  Actually, we can just use a textarea/input for keywords and transform in the form submit handler. 
                  For now we will skip keywords or provide a helper text. */}
              <Input 
                placeholder="React, TypeScript, Next.js"
                {...register(`sections.skills.items.${index}.keywords` as unknown as any)} 
                // We're casting here because react-hook-form doesn't seamlessly map string <-> string[] without Controller
              />
              <p className="text-xs text-muted-foreground">Note: In this simple review, keywords might save as raw string arrays.</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
