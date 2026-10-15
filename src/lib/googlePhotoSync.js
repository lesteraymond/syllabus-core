// Access tokens live only in memory and are used only to import the current user's photo.
export function createGooglePhotoAccess(oauth2, clientId, email) {
  let cached;
  let pending;
  let resolvePending;
  let rejectPending;
  const fail = message => { cached = undefined; pending = undefined; rejectPending?.(new Error(message)); };
  const client = oauth2.initTokenClient({
    client_id: clientId,
    scope: 'openid email profile',
    hint: email,
    prompt: '',
    callback: response => {
      if (response.error || !response.access_token) {
        fail('Google photo access was not granted. Please try again.');
        return;
      }
      cached = { token: response.access_token, expires: Date.now() + Number(response.expires_in || 0) * 1000 };
      pending = undefined;
      resolvePending?.(cached.token);
    },
    error_callback: response => fail(response.type === 'popup_closed'
      ? 'Google photo sync was cancelled. Your current photo has been kept.'
      : 'Could not open Google photo sync. Allow popups for this site and try again.'),
  });
  return () => {
    if (cached && cached.expires > Date.now() + 60000) return Promise.resolve(cached.token);
    if (pending) return pending;
    const result = new Promise((resolve, reject) => { resolvePending = resolve; rejectPending = reject; });
    pending = result;
    // Keep this call synchronous with the menu click so browsers allow Google's popup.
    try { client.requestAccessToken(); }
    catch { fail('Could not start Google photo sync. Please try again.'); }
    return result;
  };
}
