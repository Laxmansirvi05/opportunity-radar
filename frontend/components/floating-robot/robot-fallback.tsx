/**
 * Shown while the Spline scene is loading, and permanently if it fails or
 * times out. Purely visual — the wrapper in floating-robot.tsx is what
 * actually owns the drag/tap gestures, so the Notes quick-capture flow
 * works identically whether this or the real 3D scene is showing.
 */
export function RobotFallback() {
  return (
    <div className="w-full h-full rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shadow-lg">
      <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
        smart_toy
      </span>
    </div>
  )
}
