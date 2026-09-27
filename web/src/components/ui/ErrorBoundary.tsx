import { Component, type ReactNode } from "react";

/** If WebGL is unavailable the dive still works — the DOM layers carry the colours on their own. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("3D scene disabled:", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
