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
 * SCENE_OVERDRAW exists because the .splinecode composes the robot with a
 * large transparent margin: measured against the wrapper, the robot itself
 * drew only about half the box's width. That left a wide dead ring that still
 * accepted a grab (so the robot felt like it only responded on one side) and
 * meant raising ROBOT_SIZE grew the hit box far more than the visible robot.
 *
 * It is applied by making the canvas physically larger and pulling it back to
 * centre — NOT by transform: scale(). Scaling a canvas magnifies pixels that
 * have already been rasterised, which is exactly what made the robot look
 * soft; giving Spline a larger canvas instead makes it render more pixels, so
 * the robot fills its hit box and stays sharp at any device pixel ratio.
 *
 * The canvas overflows the wrapper, which is harmless: the spill is
 * transparent and the whole scene is pointer-events:none, so it never steals
 * a click from anything underneath.
 */
const SCENE_OVERDRAW = 1.95

export default function RobotSceneInner({ onLoad }: RobotSceneProps) {
  const size = `${SCENE_OVERDRAW * 100}%`
  const offset = `${((SCENE_OVERDRAW - 1) / 2) * -100}%`

  return (
    <Spline
      scene="/robot-scene.splinecode"
      onLoad={onLoad}
      style={{
        width: size,
        height: size,
        marginLeft: offset,
        marginTop: offset,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    />
  )
}
