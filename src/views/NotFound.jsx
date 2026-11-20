// Shown for any address other than the app's root (e.g. /adadasd); the screen itself lives in the #hash.
export default function NotFound() {
  return (
    <main className="loading-screen" role="alert">
      <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 16, padding: '40px 48px', maxWidth: 420, textAlign: 'center', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)' }}>
        <div aria-hidden="true" style={{ color: '#dc2626', fontSize: 40, fontWeight: 700, lineHeight: 1, margin: '0 auto 20px' }}>404</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Page not found</h2>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--muted)', textWrap: 'balance' }}>This page doesn't exist.</p>
        <a className="btn primary" href="/" style={{ textDecoration: 'none' }}>Go to dashboard</a>
      </div>
    </main>
  );
}
