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
    <div className="flex-1 flex flex-col md:flex-row -m-margin-mobile md:-m-gutter h-[calc(100vh-64px)] overflow-hidden">
      {children}
    </div>
  )
}
