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
 *
 * SCENE_SCALE exists because the .splinecode composes the robot with a large
 * transparent margin: measured against the wrapper, the robot itself drew only
 * about half the box's width. That left a wide dead ring that still accepted
 * a grab (so the robot felt like it only responded on one side) and meant
 * raising ROBOT_SIZE grew the hit box far more than the visible robot.
 * Scaling the canvas up makes the drawn robot roughly fill its own hit box,
 * so what you see is what you can grab.
 *
 * overflow:visible is required with it — Spline's own wrapper sets
 * overflow:hidden, which crops the scaled scene back to the unscaled box
 * (live-reproduced: the robot rendered larger but sliced off at the edges
 * instead of simply appearing bigger). The overflow is harmless: the spill is
 * transparent and the whole scene is pointer-events:none, so it never steals
 * a click from anything underneath.
 */
const SCENE_SCALE = 1.95

export default function RobotSceneInner({ onLoad }: RobotSceneProps) {
  return (
    <Spline
      scene="/robot-scene.splinecode"
      onLoad={onLoad}
      style={{
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
        transform: `scale(${SCENE_SCALE})`,
        transformOrigin: 'center center',
      }}
    />
  )
}
