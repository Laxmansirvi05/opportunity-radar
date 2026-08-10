import React from 'react'

export function HubEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-8 text-center bg-surface-container-lowest">
      <div className="w-[100%] max-w-[520px] mx-auto flex flex-col items-center">
        <div className="w-16 h-16 bg-primary-container text-on-primary-container rounded-2xl flex items-center justify-center mb-6 shadow-sm">
          <span className="material-symbols-outlined text-[32px]">forum</span>
        </div>
        <h2 className="text-xl font-bold text-on-surface mb-2">
          Welcome to the Hub
        </h2>
        <p className="text-on-surface-variant mb-8">
          This is the global community conversation for all Opportunity Radar members.
          Be the first to start the discussion! Ask a question, share a resource, or introduce yourself.
        </p>
      </div>
    </div>
  )
}
