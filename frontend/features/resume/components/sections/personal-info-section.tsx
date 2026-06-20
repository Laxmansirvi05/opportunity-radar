import { useFormContext } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ResumeData } from '@/src/lib/resume-ai/schema/data'

export function PersonalInfoSection() {
  const { register, formState: { errors } } = useFormContext<ResumeData>()

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Personal Information</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name *</Label>
          <Input id="name" {...register('basics.name', { required: 'Name is required' })} />
          {errors.basics?.name && <p className="text-sm text-red-500">{errors.basics.name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input id="email" type="email" {...register('basics.email', { required: 'Email is required' })} />
          {errors.basics?.email && <p className="text-sm text-red-500">{errors.basics.email.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" type="tel" {...register('basics.phone')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" {...register('basics.location')} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="headline">Headline</Label>
          <Input id="headline" {...register('basics.headline')} />
        </div>
      </div>
    </div>
  )
}
