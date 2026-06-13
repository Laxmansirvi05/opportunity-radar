export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-xl animate-pulse">
      {/* Header Section */}
      <header className="mb-lg flex flex-col md:flex-row md:justify-between md:items-end gap-md">
        <div className="w-full md:w-1/3">
          <div className="h-8 bg-surface-container-high rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-surface-container rounded w-1/2"></div>
        </div>
        <div className="flex gap-sm">
          <div className="w-32 h-10 bg-surface-container-high rounded-xl"></div>
          <div className="w-10 h-10 bg-surface-container-high rounded-xl"></div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        {/* Left Column */}
        <div className="lg:col-span-2 flex flex-col gap-gutter">
          
          {/* Progress Summary */}
          <section className="bg-surface border border-outline-variant/30 rounded-2xl p-md shadow-sm">
            <div className="h-6 bg-surface-container-high rounded w-1/4 mb-md"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-surface-container-lowest p-sm rounded-lg h-16"></div>
              ))}
            </div>
          </section>

          {/* Fresh Opportunities */}
          <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md">
            <div className="h-6 bg-surface-container-high rounded w-1/3 mb-md"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-surface-container-high rounded-xl h-40"></div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-gutter">
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-md h-64"></div>
        </div>
      </div>
    </div>
  )
}
