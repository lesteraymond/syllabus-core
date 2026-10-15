import { useEffect, useRef, useState } from 'react';
import { loadGoogleIdentity } from './googleIdentity';
import { createGooglePhotoAccess } from './googlePhotoSync';

export function useGooglePhotoSync(email) {
  const requestRef = useRef(null);
  const errorRef = useRef(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    requestRef.current = null;
    errorRef.current = null;
    setLoading(true);
    const initialize = async () => {
      try {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId) throw new Error('Google photo sync is not configured. Contact your administrator.');
        await loadGoogleIdentity();
        if (!cancelled) requestRef.current = createGooglePhotoAccess(window.google.accounts.oauth2, clientId, email);
      } catch (error) { if (!cancelled) errorRef.current = error; }
      finally { if (!cancelled) setLoading(false); }
    };
    initialize();
    return () => { cancelled = true; requestRef.current = null; };
  }, [email]);
  return {
    loading,
    requestAccess: () => {
      if (errorRef.current) throw errorRef.current;
      if (!requestRef.current) throw new Error('Google photo sync is still loading. Please try again.');
      return requestRef.current();
    },
  };
}
