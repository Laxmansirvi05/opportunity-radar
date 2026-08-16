import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Catches any exception the Spline runtime throws during its own WebGL
 * setup (e.g. no WebGL support in the current browser/context) — next/dynamic
 * only handles the *loading* state, not a runtime throw from the loaded
 * module, so without this a Spline failure would take the whole app shell
 * down with it instead of just falling back to RobotFallback.
 */
export class RobotErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[FloatingRobot] Spline scene failed to render:', error)
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}
