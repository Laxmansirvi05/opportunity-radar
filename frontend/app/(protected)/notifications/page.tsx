import { NotificationsClient } from './notifications-client'

export const metadata = {
  title: 'Notifications | Opportunity Radar'
}

export default function NotificationsPage() {
  return (
    <div className="flex flex-col gap-10 max-w-3xl mx-auto w-full pb-16">
      <header className="mb-6">
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background mb-1">
          Notifications
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant">Stay updated on your opportunities and profile activity.</p>
      </header>

      <NotificationsClient />
    </div>
  )
}
