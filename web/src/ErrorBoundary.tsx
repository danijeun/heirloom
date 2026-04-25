import React from "react";

type S = { err?: Error };

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, S> {
  state: S = {};
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { console.error(err); }
  render() {
    if (this.state.err) {
      return (
        <div className="app">
          <h1>Heirloom</h1>
          <div className="card">
            <h2 className="error">Something went wrong</h2>
            <p className="muted">{this.state.err.message}</p>
            <button onClick={() => location.reload()}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
