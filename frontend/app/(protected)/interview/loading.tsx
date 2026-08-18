export default function InterviewLoading() {
  return (
    <div className="flex-1 p-4 md:p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full flex flex-col gap-6 animate-pulse">
        {/* Header skeleton */}
        <div>
          <div className="h-8 w-64 rounded-lg bg-surface-container" />
          <div className="h-4 w-96 rounded-lg bg-surface-container mt-2" />
        </div>

        {/* Steps rail skeleton */}
        <div className="flex gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 h-20 rounded-xl bg-surface-container" />
          ))}
        </div>

        {/* Content area skeleton */}
        <div className="rounded-2xl bg-surface-container h-[280px]" />

        {/* CTA skeleton */}
        <div className="h-12 w-48 rounded-lg bg-surface-container mx-auto" />
      </div>
    </div>
  )
}
