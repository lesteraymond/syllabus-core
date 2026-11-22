import { Component } from 'react';
import { t as translateUI } from '../i18n/index.js';

// Catches a crash while rendering any screen, so the person sees a message and a way out instead of a blank page.
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error) { console.error('Screen crashed:', error); }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="loading-screen" role="alert">
        <div style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 16, padding: '40px 48px', maxWidth: 420, textAlign: 'center', boxShadow: 'var(--shadow)' }}>
          <div aria-hidden="true" style={{ width: 56, height: 56, borderRadius: '50%', color: 'var(--red)', fontSize: 40, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>!</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>{translateUI("ui.something_went_wrong_8d886c")}</h2>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--muted)', textWrap: 'balance' }}>{translateUI("ui.reloading_usually_fixes_it_3e8be9")}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button type="button" className="btn primary" onClick={() => window.location.reload()}>{translateUI("ui.reload_cce715")}</button>
            <a className="btn outline" href="/" style={{ textDecoration: 'none' }}>{translateUI("ui.go_to_dashboard_e5fa87")}</a>
          </div>
        </div>
      </main>
    );
  }
}
