import { BellRing } from 'lucide-react'

export const metadata = {
  title: 'Notifications | Opportunity Radar'
}

export default function NotificationsPage() {
  return (
    <div className="flex flex-col gap-xl max-w-3xl mx-auto w-full pb-16">
      <header className="mb-lg">
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background mb-xs">
          Notifications
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant">Stay updated on your opportunities and profile activity.</p>
      </header>

      <div className="bg-surface border border-outline-variant rounded-2xl p-12 shadow-sm flex flex-col items-center justify-center text-center min-h-[400px]">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <BellRing className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-on-background mb-2">You're all caught up!</h3>
        <p className="text-on-surface-variant max-w-md mx-auto">
          We're currently building our notification system. In the future, you'll receive alerts here about new opportunities matching your skills, application deadlines, and platform updates.
        </p>
      </div>
    </div>
  )
}
