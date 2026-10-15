import { tr } from "../i18n/index.js";
import { useEffect, useRef } from 'react';
import { loadGoogleIdentity } from '../lib/googleIdentity';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
// Google's rendered button is 400px wide max and 40px tall.
const GSI_W = 400;
const GSI_H = 40;

// The visible button is our own `.btn` (so size, radius, font and text match the
// Sign In button). Google's official button is rendered invisibly on top of it,
// stretched to cover it, so clicks still go through the real Google flow.
export default function GoogleSignInButton({ onCredential, onError, label = 'Sign in with Google', loginHint }) {
  const wrapRef = useRef(null);
  const gsiRef = useRef(null);
  const cb = useRef({ onCredential, onError });
  cb.current = { onCredential, onError };

  useEffect(() => {
    if (!CLIENT_ID) { cb.current.onError?.('Google sign-in is not configured (missing VITE_GOOGLE_CLIENT_ID).'); return; }
    let cancelled = false;
    const wrap = wrapRef.current;
    const gsi = gsiRef.current;

    const fit = () => {
      const { width, height } = wrap.getBoundingClientRect();
      gsi.style.transform = `scale(${width / GSI_W}, ${height / GSI_H})`;
    };

    loadGoogleIdentity().then(() => {
      if (cancelled) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        ...(loginHint ? { login_hint: loginHint } : {}),
        callback: (resp) => cb.current.onCredential(resp.credential), // resp.credential is the id_token
      });
      window.google.accounts.id.renderButton(gsi, { theme: 'outline', size: 'large', text: 'signin_with', width: GSI_W });
      fit();
    }).catch((e) => cb.current.onError?.(e.message));

    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => { cancelled = true; ro.disconnect(); };
  }, [loginHint]);

  return (
    <div className="google-btn-wrap" ref={wrapRef}>
      <span className="btn outline wide google-btn-face" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
          <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
        </svg>
        {tr(label)}
      </span>
      <div className="google-btn-gsi" ref={gsiRef} style={{ width: GSI_W, height: GSI_H }} />
    </div>
  );
}
