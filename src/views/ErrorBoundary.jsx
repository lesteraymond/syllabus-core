import { Component } from 'react';

// Catches a crash while rendering any screen, so the person sees a message and a way out instead of a blank page.
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error) { console.error('Screen crashed:', error); }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="loading-screen" role="alert">
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 16, padding: '40px 48px', maxWidth: 420, textAlign: 'center', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)' }}>
          <div aria-hidden="true" style={{ width: 56, height: 56, borderRadius: '50%', color: '#dc2626', fontSize: 40, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>!</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Something went wrong</h2>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--muted)', textWrap: 'balance' }}>Reloading usually fixes it.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button type="button" className="btn primary" onClick={() => window.location.reload()}>Reload</button>
            <a className="btn outline" href="/" style={{ textDecoration: 'none' }}>Go to dashboard</a>
          </div>
        </div>
      </main>
    );
  }
}
