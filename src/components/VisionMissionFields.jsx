import StableButton from './StableButton';
import { Icon } from './ui';
import { t } from '../i18n';

// The school's vision and mission as editable fields (the school card on Program & Subjects and the Add subject form share them).
// `draft` is { vision, lead, items: [string] }; the helpers below turn the saved record into a draft, and a draft into what the server saves.
export const draftOf = (saved) => ({ vision: saved.vision || '', lead: (saved.mission && saved.mission.lead) || '', items: saved.mission && saved.mission.items && saved.mission.items.length ? [...saved.mission.items] : [''] });
export const missionItems = (draft) => draft.items.map((x) => x.trim()).filter(Boolean);
export const draftComplete = (draft) => !!draft && !!draft.vision.trim() && !!draft.lead.trim() && missionItems(draft).length > 0;
export const draftBody = (draft) => ({ vision: draft.vision.trim(), mission: { lead: draft.lead.trim(), items: missionItems(draft) } });
export const draftChanged = (draft, saved) => JSON.stringify(draftBody(draft)) !== JSON.stringify({ vision: (saved.vision || '').trim(), mission: { lead: ((saved.mission && saved.mission.lead) || '').trim(), items: ((saved.mission && saved.mission.items) || []).map((x) => x.trim()).filter(Boolean) } });

export default function VisionMissionFields({ draft, onChange, busy = false, required = false }) {
  const star = required ? ' *' : '';
  const setItem = (i, value) => onChange({ ...draft, items: draft.items.map((x, at) => (at === i ? value : x)) });
  return <div className="institution-form">
    <section className="institution-group">
      <label className="field"><span>{t('inst.vision')}{star}</span><textarea rows={3} value={draft.vision} maxLength={4000} disabled={busy} onChange={(e) => onChange({ ...draft, vision: e.target.value })} /></label>
    </section>
    <section className="institution-group">
      <label className="field"><span>{t('inst.missionLead')}{star}</span><textarea rows={2} value={draft.lead} maxLength={1000} disabled={busy} onChange={(e) => onChange({ ...draft, lead: e.target.value })} /></label>
      <div className="institution-items" role="group" aria-label={t('inst.missionItems')}><span className="institution-label">{t('inst.missionItems')}{star}</span>
        {draft.items.map((x, i) => <div className="institution-item" key={i}>
        <span className="institution-no" aria-hidden="true">{i + 1}</span>
        <textarea rows={2} value={x} maxLength={1000} disabled={busy} aria-label={t('inst.item', { n: i + 1 })} onChange={(e) => setItem(i, e.target.value)} />
        <button type="button" className="icon-btn is-delete" disabled={busy || draft.items.length < 2} title={t('inst.removeItem', { n: i + 1 })} aria-label={t('inst.removeItem', { n: i + 1 })} onClick={() => onChange({ ...draft, items: draft.items.filter((_, at) => at !== i) })}><Icon name="bin" size={18} /></button>
        </div>)}
        <div className="institution-add"><StableButton type="button" className="btn outline" disabled={busy || draft.items.length >= 20} onClick={() => onChange({ ...draft, items: [...draft.items, ''] })}>{t('inst.addItem')}</StableButton></div>
      </div>
    </section>
  </div>;
}
