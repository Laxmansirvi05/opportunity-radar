export default function ProtectedLayoutLoading() {
  return (
    <div className="flex-1 flex flex-col h-full bg-surface-container-lowest overflow-hidden animate-pulse">
      <div className="p-4 md:p-8 border-b border-outline-variant bg-surface shrink-0">
        <div className="h-8 bg-surface-container-high rounded w-1/3 mb-2"></div>
        <div className="h-4 bg-surface-container rounded w-1/4"></div>
      </div>
      
      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-6xl mx-auto w-full flex flex-col gap-6">
          <div className="h-40 bg-surface-container rounded-2xl w-full"></div>
          <div className="h-40 bg-surface-container rounded-2xl w-full"></div>
          <div className="h-40 bg-surface-container rounded-2xl w-full"></div>
        </div>
      </div>
    </div>
  )
}
