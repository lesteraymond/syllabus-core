import { Field, Toggle } from './ui';
import StableButton from './StableButton';
import { t as translateUI } from '../i18n/index.js';

// Rendered only by the administrator branch; the API independently enforces access.
export default function AdministrativeSettings({ administration, adminBusy, updateAdmin, onViewStandard = () => {} }) {
  return (
<div className="settings-grid">
            <div className="settings-card"><h3>{translateUI("ui.institutional_standard_2f4462")}</h3><Field label={translateUI("settings.standard_label")}><output className="static-value">{administration.template}</output><small className="muted">{translateUI("settings.standard_note")}</small><StableButton type="button" className="btn outline" onClick={onViewStandard}>{translateUI("standard.view")}</StableButton></Field><Field label={translateUI("settings.year_label")}><input value={administration.academicYear} maxLength={9} inputMode="numeric" placeholder="2026–2027" disabled={adminBusy} onChange={event => updateAdmin('academicYear', event.target.value.replace(/[-‐-―]/g, '–'))} /><small className="muted">{translateUI("settings.year_note")}</small></Field><Field label={translateUI("settings.department_label")}><output className="static-value">{administration.department}</output><small className="muted">{translateUI("settings.department_note")}</small></Field></div>
            <div className="settings-card"><h3>{translateUI("ui.ai_notifications_35351e")}</h3><Toggle disabled={adminBusy} on={administration.aiChecking} set={value => updateAdmin('aiChecking', value)} title={translateUI("ui.ai_compliance_checking_df4d0c")} text={translateUI("ui.enable_automated_syllabus_quality_checks_95e692")} /><Toggle disabled={adminBusy} on={administration.strictValidation} set={value => updateAdmin('strictValidation', value)} title={translateUI("ui.strict_format_validation_8d19a0")} text={translateUI("ui.require_all_template_sections_before_submission_f069fd")} /><Toggle disabled={adminBusy} on={administration.emailNotifications} set={value => updateAdmin('emailNotifications', value)} title={translateUI("ui.email_notifications_128113")} text={translateUI("ui.notify_users_about_review_and_revision_updates_119ca1")} /></div>
          </div>
  );
}
