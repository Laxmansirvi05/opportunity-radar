/**
 * Search layout override.
 * The (protected) layout applies default padding via `p-margin-mobile md:p-gutter`.
 * The search page needs a full-bleed layout for the filters sidebar,
 * so we override with zero padding and let the search page manage its own layout.
 */
export default function SearchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex-1 flex flex-col md:flex-row h-[calc(100vh-120px)] md:h-[calc(100vh-88px)] overflow-hidden -m-margin-mobile md:-m-gutter">
      {children}
    </div>
  )
}
