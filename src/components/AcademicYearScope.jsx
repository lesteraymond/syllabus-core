import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Select from './Select';
import { academicYears as yearsApi } from '../lib/api';
import { t } from '../i18n';
import { currentOf, normalizeSelection, readStored, writeStored, yearOptions, yearParam } from '../lib/academicYearScope';

// The academic year scope of the whole application: which years this person may see (from the server), which one is current, and what each group of screens has selected.
// App.jsx owns it (useAcademicYearScope) and provides it; the screens read it with useYearScope() and place a <YearFilter group="data|queue" /> in their header.
const Context = createContext(null);
export const AcademicYearContext = Context;
export const useYearScope = () => useContext(Context);

export function useAcademicYearScope(user) {
  const active = !!user && user.role !== 'student' && !user.mustChangePassword;
  const userId = user ? user.id : null;
  const [years, setYears] = useState([]);
  const [stored, setStored] = useState({ data: '', queue: '' });
  const reload = useCallback(() => (active ? yearsApi.list().then(setYears).catch(() => setYears([])) : Promise.resolve()), [active]);
  useEffect(() => { if (active) { setStored(readStored(window.localStorage, userId)); reload(); } else setYears([]); }, [active, userId, reload]);
  const isAdmin = !!user && user.role === 'admin';
  return useMemo(() => {
    const current = currentOf(years);
    const options = (group) => yearOptions({ years, group, isAdmin }, t);
    const selection = (group) => normalizeSelection(stored[group], options(group), group);
    return {
      years, current, isAdmin, options, selection,
      param: (group) => yearParam(selection(group)), // what a list request sends as ?year=
      select: (group, value) => { const next = { ...stored, [group]: value }; setStored(next); writeStored(window.localStorage, userId, next); },
      reload,
    };
  }, [years, stored, isAdmin, userId, reload]);
}

// The dropdown placed in a screen's header. Nothing is shown when there is no scope (before login, in tests) or no academic year exists yet.
// `catalog`: the Program & Subjects screen, whose catalog is always ONE year (no "all years" option).
export function YearFilter({ group = 'data', catalog = false }) {
  const scope = useYearScope();
  if (!scope) return null;
  const options = scope.options(group).filter((o) => !catalog || o.value !== 'all');
  // shown even with a single year: a person who has only the current year (the first year, or a faculty member before an earlier year exists) must still be told which academic year they are in
  if (options.length < 1) return null;
  const selected = scope.selection(group);
  // no visible "Academic year" caption: the dropdown shows the year itself; its accessible name stays (aria-label)
  return <div className="field year-filter">
    <Select value={catalog && selected === 'all' ? '' : selected} onChange={(e) => scope.select(group, e.target.value)} aria-label={t('term.academicYear')}>
      {options.map((o) => <option key={o.value || 'current'} value={o.value} data-short={o.short}>{o.label}</option>)}
    </Select>
  </div>;
}
