export default function InterviewSessionLoading() {
  return (
    <div className="flex-1 p-4 md:p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full flex flex-col items-center gap-6 py-16 animate-pulse">
        {/* Circular avatar placeholder */}
        <div className="w-20 h-20 rounded-full bg-surface-container" />

        {/* Status text */}
        <div className="h-5 w-48 rounded-lg bg-surface-container" />

        {/* Progress bars */}
        <div className="w-full max-w-sm flex flex-col gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 rounded-lg bg-surface-container" />
          ))}
        </div>
      </div>
    </div>
  )
}
