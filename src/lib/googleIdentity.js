const GSI_SRC = 'https://accounts.google.com/gsi/client';

let gsiPromise;
export function loadGoogleIdentity() {
  if (window.google?.accounts?.id && window.google?.accounts?.oauth2) return Promise.resolve();
  gsiPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GSI_SRC;
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    s.onerror = () => { gsiPromise = undefined; reject(new Error('Could not load Google Sign-In.')); };
    document.head.appendChild(s);
  });
  return gsiPromise;
}
