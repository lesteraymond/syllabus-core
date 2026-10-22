import { useEffect, useState } from 'react';
import { compliance } from './api';

// The signed-in user's syllabi with their latest compliance check (an administrator sees every submitted one). Read once when the screen opens;
// a failed read leaves `rows` empty, so the screen shows "no data" instead of breaking. `refresh` is a number to change to read again.
export function useComplianceRows(refresh = 0) {
  const [state, setState] = useState({ rows: [], loading: true });
  useEffect(() => {
    let live = true;
    compliance.list('all').then(
      (r) => { if (live) setState({ rows: Array.isArray(r && r.syllabi) ? r.syllabi : [], loading: false }); },
      () => { if (live) setState({ rows: [], loading: false }); },
    );
    return () => { live = false; };
  }, [refresh]);
  return state;
}
