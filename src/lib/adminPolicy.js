import { useEffect, useState } from 'react';
import { adminSettings } from './api';
import { POLICY_UNKNOWN } from './stepGate.js';

export { POLICY_UNKNOWN, stepsGated } from './stepGate.js';

// The administrator's switches that change the app for everyone (Settings > AI & Notifications; server/lib/adminSettings.js), read from
// GET /api/settings/policy each time a screen that uses them opens, so a change applies the next time it is opened. Until the answer arrives,
// or if it cannot be read, POLICY_UNKNOWN applies (the strict step order; stepGate.js).
export function useAdminPolicy() {
  const [policy, setPolicy] = useState(POLICY_UNKNOWN);
  useEffect(() => {
    let live = true;
    adminSettings.policy().then((p) => {
      if (live && p) setPolicy({ strictValidation: p.strictValidation !== false, aiChecking: p.aiChecking !== false, emailNotifications: p.emailNotifications !== false, loaded: true });
    }).catch(() => { /* keep the strict defaults */ });
    return () => { live = false; };
  }, []);
  return policy;
}
