export default function OpportunityDetailsLoading() {
  return (
    <div className="flex flex-col gap-6 w-full pb-12 animate-pulse">
      {/* Back Button Skeleton */}
      <div className="w-32 h-5 bg-outline-variant/30 rounded"></div>

      {/* Header Card Skeleton */}
      <div className="bg-surface border border-outline-variant rounded-2xl p-6 md:p-8 flex flex-col md:flex-row gap-6 md:items-start justify-between shadow-sm">
        <div className="flex flex-col md:flex-row gap-6 items-start w-full">
          <div className="w-20 h-20 rounded-xl bg-outline-variant/30 shrink-0"></div>
          <div className="flex flex-col gap-3 w-full max-w-xl">
            <div className="h-8 bg-outline-variant/30 rounded w-3/4"></div>
            <div className="flex gap-3 mt-1">
              <div className="h-5 bg-outline-variant/30 rounded w-24"></div>
              <div className="h-5 bg-outline-variant/30 rounded w-20"></div>
              <div className="h-5 bg-outline-variant/30 rounded w-24"></div>
            </div>
            <div className="flex gap-2 mt-3">
              <div className="h-6 bg-outline-variant/30 rounded-lg w-16"></div>
              <div className="h-6 bg-outline-variant/30 rounded-lg w-20"></div>
              <div className="h-6 bg-outline-variant/30 rounded-lg w-14"></div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-4 md:mt-0 min-w-[200px] w-full md:w-auto">
          <div className="h-12 bg-outline-variant/30 rounded-xl w-full"></div>
          <div className="h-10 bg-outline-variant/30 rounded-xl w-full"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Skeleton */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-surface border border-outline-variant rounded-2xl p-6 md:p-8 shadow-sm flex flex-col gap-4">
            <div className="h-6 bg-outline-variant/30 rounded w-48 mb-2"></div>
            <div className="h-4 bg-outline-variant/30 rounded w-full"></div>
            <div className="h-4 bg-outline-variant/30 rounded w-[95%]"></div>
            <div className="h-4 bg-outline-variant/30 rounded w-[98%]"></div>
            <div className="h-4 bg-outline-variant/30 rounded w-3/4"></div>
            <div className="h-4 bg-outline-variant/30 rounded w-[90%] mt-4"></div>
            <div className="h-4 bg-outline-variant/30 rounded w-[85%]"></div>
          </div>
        </div>

        {/* Sidebar Skeleton */}
        <div className="flex flex-col gap-6">
          <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-5">
            <div className="h-6 bg-outline-variant/30 rounded w-32 mb-1"></div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="w-5 h-5 rounded bg-outline-variant/30"></div>
                <div className="flex flex-col gap-2 w-full">
                  <div className="h-3 bg-outline-variant/30 rounded w-16"></div>
                  <div className="h-4 bg-outline-variant/30 rounded w-24"></div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-4">
            <div className="h-6 bg-outline-variant/30 rounded w-32"></div>
            <div className="h-5 bg-outline-variant/30 rounded w-24"></div>
          </div>
        </div>
      </div>
    </div>
  )
}
