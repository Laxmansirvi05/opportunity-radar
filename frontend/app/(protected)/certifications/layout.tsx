/**
 * Certifications layout override.
 * The (protected) layout applies default padding via `p-margin-mobile md:p-gutter`.
 * The certifications page needs a full-bleed layout for the filters sidebar to
 * sit flush against the nav rail, so we override with zero padding and let the
 * page manage its own layout — mirrors the search page's override.
 */
export default function CertificationsLayout({
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
