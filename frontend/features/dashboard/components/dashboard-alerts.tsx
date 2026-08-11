'use client'

import { useState } from 'react'

export type Alert = {
  id: string
  title: string
  subtitle: string
  description: string
}

export function DashboardAlerts({ initialAlerts }: { initialAlerts: Alert[] }) {
  const [cleared, setCleared] = useState(false)

  const alerts = cleared ? [] : initialAlerts

  return (
    <section className="bg-surface-container-lowest border border-error/50 rounded-2xl p-4 shadow-sm">
      <h3 className="font-label-md font-bold text-error mb-4 flex items-center gap-2 uppercase tracking-wider">
        <span className="material-symbols-outlined text-[18px]">notifications_active</span>
        Urgent Alerts
      </h3>
      {alerts.length > 0 ? (
        <div className="flex flex-col gap-2">
          {alerts.map((alert) => (
            <div key={alert.id} className="p-3 bg-error-container/10 rounded-xl border-l-4 border-error">
              <div className="flex justify-between mb-1">
                <span className="font-label-md font-bold text-on-background">{alert.title}</span>
                {alert.subtitle && (
                  <span className="text-[10px] text-error font-bold uppercase">{alert.subtitle}</span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant">{alert.description}</p>
            </div>
          ))}
          <button 
            onClick={() => setCleared(true)}
            className="w-full mt-4 py-2 text-error font-label-md font-bold hover:bg-error-container/20 rounded-lg transition-colors cursor-pointer"
          >
            Clear All
          </button>
        </div>
      ) : (
        <div className="p-4 text-center border-2 border-dashed border-error/20 rounded-xl">
          <p className="font-label-md text-on-surface-variant">No active alerts</p>
        </div>
      )}
    </section>
  )
}
