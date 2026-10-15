// A controller is tied to an account. Late responses cannot change another user's language.
export function createLanguagePreference({ apply, persist, onSaved }) {
  let account = null;
  let saved = 'en';
  let version = 0;
  let pending = false;
  return {
    reset(id, language = 'en') { account = id; saved = language === 'tl' ? 'tl' : 'en'; version++; pending = false; apply(saved); },
    async change(language) {
      if (!['en', 'tl'].includes(language)) throw new Error('Choose English or Tagalog.');
      if (pending || language === saved) return;
      const owner = account;
      const revision = version;
      const previous = saved;
      pending = true;
      apply(language);
      try {
        const result = await persist(language);
        if (revision !== version || owner !== account) return;
        saved = result.preferredLanguage;
        apply(saved);
        onSaved(owner, saved);
      } catch (error) {
        if (revision === version && owner === account) { apply(previous); throw error; }
      } finally { if (revision === version) pending = false; }
    },
  };
}
