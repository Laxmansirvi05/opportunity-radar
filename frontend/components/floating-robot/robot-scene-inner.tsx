'use client'

import Spline from '@splinetool/react-spline'
import type { Application } from '@splinetool/runtime'

interface RobotSceneProps {
  onLoad: (app: Application) => void
}

/**
 * The actual Spline canvas — imported only via next/dynamic(..., {ssr:
 * false}) from floating-robot.tsx, never directly, so the (sizeable) Spline
 * runtime never lands in the server render or blocks initial hydration.
 *
 * pointer-events is deliberately none here: the wrapper div in
 * floating-robot.tsx owns every drag/tap gesture, and this scene is used as
 * a purely visual asset underneath it. Without this, the scene's own
 * internal camera/hover interactions (if any are authored into it) could
 * intercept a pointerdown before the drag/triple-tap logic ever sees it.
 */
export default function RobotSceneInner({ onLoad }: RobotSceneProps) {
  return (
    <Spline
      scene="/robot-scene.splinecode"
      onLoad={onLoad}
      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  )
}
