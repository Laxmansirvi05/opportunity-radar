/**
 * Route-level skeleton for /certifications. Without this, navigating here
 * shows nothing until the server component's full catalogue fetch resolves —
 * this renders instantly so the click feels immediate while that streams in.
 */
export default function CertificationsLoading() {
  return (
    <div className="flex h-full w-full overflow-hidden bg-surface-container-lowest">
      <aside className="hidden md:block md:w-60 md:border-r md:border-outline-variant shrink-0 p-5">
        <div className="h-4 w-16 bg-surface-container rounded mb-6 animate-pulse" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="mb-6">
            <div className="h-3 w-20 bg-surface-container rounded mb-3 animate-pulse" />
            <div className="flex flex-col gap-2.5">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-3 w-28 bg-surface-container rounded animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <div className="px-4 md:px-8 pt-4 md:pt-6 pb-5 border-b border-outline-variant bg-surface shrink-0">
          <div className="max-w-6xl mx-auto w-full flex flex-col gap-3.5">
            <div className="h-7 w-56 bg-surface-container rounded animate-pulse" />
            <div className="h-12 w-full bg-surface-container-lowest border border-outline-variant rounded-lg animate-pulse" />
          </div>
        </div>

        <div className="flex-1 overflow-hidden p-4 md:p-8">
          <div className="max-w-6xl mx-auto w-full flex flex-col gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="bg-surface border border-outline-variant rounded-2xl px-[23px] py-[19px] flex items-center gap-[19px] animate-pulse"
              >
                <div className="w-[58px] h-[58px] rounded-lg bg-surface-container shrink-0" />
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <div className="h-4 w-2/3 bg-surface-container rounded" />
                  <div className="h-3 w-1/3 bg-surface-container rounded" />
                </div>
                <div className="h-6 w-14 bg-surface-container rounded shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
