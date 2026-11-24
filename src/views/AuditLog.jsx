import { useCallback, useEffect, useMemo, useState } from 'react';
import { t as translateUI, tr } from '../i18n/index.js';
import { logs as logsApi, users as usersApi } from '../lib/api';
import { buildAuditCsv, filterAuditRows, shapeAuditRow } from '../lib/auditLog';
import { downloadCsv } from '../lib/reportCsv';
import { Icon, PageHead } from '../components/ui';
import Select from '../components/Select';
import StableButton from '../components/StableButton';

const CATEGORY_KEYS = {
  security: 'auditLog.cat.security',
  account: 'auditLog.cat.account',
  syllabus: 'auditLog.cat.syllabus',
};

const ALERT_ACTIONS = new Set(['login_failed', 'user_disable', 'user_delete', 'reject']);

// Admin-only immutable system Audit Log (separated from personal Dashboard Recent Activity).
export default function AuditLog({ user, notify }) {
  const [people, setPeople] = useState([]);
  const [selectedUser, setSelectedUser] = useState('all');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ rows: [], loading: true, error: '' });

  useEffect(() => {
    let live = true;
    usersApi.list()
      .then((list) => { if (live) setPeople(Array.isArray(list) ? list : []); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const load = useCallback((who) => {
    setState((prev) => ({ ...prev, loading: true, error: '' }));
    return logsApi.list({ scope: 'all', userId: who === 'all' ? undefined : who })
      .then((rows) => { setState({ rows: Array.isArray(rows) ? rows : [], loading: false, error: '' }); })
      .catch((e) => { setState({ rows: [], loading: false, error: e.message || '' }); });
  }, []);

  useEffect(() => {
    let active = true;
    setState((prev) => ({ ...prev, loading: true, error: '' }));
    logsApi.list({ scope: 'all', userId: selectedUser === 'all' ? undefined : selectedUser })
      .then((rows) => { if (active) setState({ rows: Array.isArray(rows) ? rows : [], loading: false, error: '' }); })
      .catch((e) => { if (active) setState({ rows: [], loading: false, error: e.message || '' }); });
    return () => { active = false; };
  }, [selectedUser]);

  const shaped = useMemo(() => state.rows.map((l, i) => shapeAuditRow(l, i, user?.id ?? null)), [state.rows, user?.id]);
  const visible = useMemo(() => filterAuditRows(shaped, { category, query }), [shaped, category, query]);

  const handleExport = () => {
    downloadCsv(buildAuditCsv(visible), 'audit-log.csv');
    notify?.(translateUI('auditLog.exported'));
  };

  return (
    <>
      <PageHead
        title={translateUI('auditLog.title')}
        subtitle={translateUI('auditLog.subtitle')}
        actions={
          <>
            <StableButton type="button" className="btn outline" disabled={state.loading} onClick={() => load(selectedUser)}>
              <Icon name="revise" size={15} />
              <span>{translateUI('auditLog.refresh')}</span>
            </StableButton>
            <StableButton type="button" className="btn primary" disabled={visible.length === 0} onClick={handleExport}>
              <Icon name="downloadSimple" size={15} />
              <span>{translateUI('auditLog.exportCsv')}</span>
            </StableButton>
          </>
        }
      />

      <section className="card al-card">
        <div className="al-toolbar">
          <div className="al-toolbar-title">
            <h3>{translateUI('auditLog.eventsHeading', { count: visible.length })}</h3>
          </div>
          <div className="al-controls">
            <div className="al-select">
              <Select aria-label={translateUI('auditLog.filterUser')} value={selectedUser} onChange={(e) => setSelectedUser(e.target.value || 'all')}>
                <option value="all">{translateUI('auditLog.allUsers')}</option>
                {people.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {(p.firstName + ' ' + p.lastName).trim() || p.email}
                  </option>
                ))}
              </Select>
            </div>
            <div className="al-select">
              <Select aria-label={translateUI('auditLog.filterCategory')} value={category} onChange={(e) => setCategory(e.target.value || 'all')}>
                <option value="all">{translateUI('auditLog.cat.all')}</option>
                <option value="security">{translateUI('auditLog.cat.security')}</option>
                <option value="syllabus">{translateUI('auditLog.cat.syllabus')}</option>
                <option value="account">{translateUI('auditLog.cat.account')}</option>
              </Select>
            </div>
            <div className="al-search">
              <Icon name="magnifyingGlass" size={15} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={translateUI('auditLog.searchPlaceholder')}
                aria-label={translateUI('auditLog.searchPlaceholder')}
              />
            </div>
          </div>
        </div>

        {state.error && <div className="al-banner"><div className="info-banner warning" role="alert">{translateUI('accountActivity.unreadable') + tr(state.error)}</div></div>}

        {state.loading ? (
          <div className="empty al-empty" role="status" aria-busy="true">{translateUI('accountActivity.loading')}</div>
        ) : visible.length === 0 ? (
          <div className="empty al-empty">{translateUI('auditLog.empty')}</div>
        ) : (
          <div className="table-wrap al-table-wrap">
            <table className="al-table">
              <thead>
                <tr>
                  <th>{translateUI('auditLog.col.when')}</th>
                  <th>{translateUI('auditLog.col.actor')}</th>
                  <th>{translateUI('auditLog.col.category')}</th>
                  <th>{translateUI('auditLog.col.event')}</th>
                  <th>{translateUI('auditLog.col.details')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((it) => {
                  const isAlert = ALERT_ACTIONS.has(it.action);
                  const details = [it.detail, it.note && tr(it.note)].filter(Boolean).join(' · ');
                  return (
                    <tr key={it.key} className={isAlert ? 'is-alert' : undefined}>
                      <td className="al-col-time">
                        <time dateTime={it.iso}>{it.date ? `${it.date}, ${it.time}` : it.time}</time>
                      </td>
                      <td className="al-col-actor">{it.actor}</td>
                      <td className="al-col-cat">
                        <span className={'al-tag is-' + it.category + (isAlert ? ' is-alert' : '')}>
                          {translateUI(CATEGORY_KEYS[it.category] || 'auditLog.cat.syllabus')}
                        </span>
                      </td>
                      <td className="al-col-event">
                        <span>{tr(it.verb)}</span>
                        {it.subject ? <strong className="al-subject"> {it.subject}</strong> : null}
                      </td>
                      <td className="al-col-details">
                        {details ? details : <span className="al-dash" aria-hidden="true">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
