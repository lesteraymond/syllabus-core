import { useCallback, useEffect, useMemo, useState } from 'react';
import { outcomes } from '../../lib/api';
import { createModel } from '../../lib/syllabusModel';
import { CURRENT_SCHOOL_YEAR } from '../../lib/schoolYear';

// Loads the admin-managed catalog (institution + programs) and a program's outcomes when it is chosen.
// Returns { model, programList, loading, error, refresh, version }; `model` is null until the institution data has arrived.
//
// options.snapshot: the vision, mission, EGAs and program outcomes stored when the syllabus was submitted
//   ({ institution, program: { code, pos } }). When given, the model uses those texts instead of the live ones, so a later
//   admin edit does not change a syllabus that is already locked.
// options.live: keep the data fresh while the builder is open (re-fetch when the tab regains focus). `refresh()` re-fetches
//   on demand (the builder calls it when the Learning Outcomes step opens). `version` changes on every re-fetch.
export function useCatalog(programCode, { snapshot = null, live = false } = {}) {
  const [institution, setInstitution] = useState(null);
  const [programList, setProgramList] = useState([]);
  const [pos, setPos] = useState({}); // code -> { pos, egas } of that program
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    Promise.all([outcomes.institution(), outcomes.programs()])
      .then(([inst, progs]) => { if (alive) { setInstitution(inst); setProgramList(progs); } })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [version]);

  useEffect(() => {
    if (!programCode) return undefined;
    let alive = true;
    outcomes.program(programCode)
      .then((p) => { if (alive) setPos((x) => ({ ...x, [programCode]: { pos: p.pos, egas: p.egas } })); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [programCode, version]);

  useEffect(() => {
    if (!live) return undefined;
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible); };
  }, [live, refresh]);

  const model = useMemo(() => {
    if (!institution && !snapshot) return null;
    const programs = {};
    programList.forEach((p) => { const own = pos[p.code]; programs[p.code] = { name: p.name, pos: own ? own.pos : [], egas: own ? own.egas : undefined }; });
    if (snapshot && snapshot.program) programs[snapshot.program.code] = { name: snapshot.program.name, pos: snapshot.program.pos, egas: snapshot.program.egas }; // an older snapshot has no egas: the institution list is used
    return createModel({ institution: snapshot && snapshot.institution ? snapshot.institution : institution, programs, year: CURRENT_SCHOOL_YEAR.startYear });
  }, [institution, programList, pos, snapshot]);

  return { model, programList, loading: !model && !error, error, refresh, version };
}
