import { Field, Toggle } from './ui';
import { t as translateUI } from '../i18n/index.js';

// Rendered only by the administrator branch; the API independently enforces access.
export default function AdministrativeSettings({ administration, adminBusy, updateAdmin }) {
  return (
<div className="settings-grid">
            <div className="settings-card"><h3>{translateUI("ui.institutional_standard_2f4462")}</h3><Field label={translateUI("ui.default_syllabus_template_6c0a16")}><select value={administration.template} disabled={adminBusy} onChange={event => updateAdmin('template', event.target.value)}><option value="Undergraduate Syllabus v4">{translateUI("ui.undergraduate_syllabus_v4_7600c5")}</option><option value="Undergraduate Syllabus v3">{translateUI("ui.undergraduate_syllabus_v3_3225ea")}</option></select></Field><Field label={translateUI("ui.default_academic_year_9141f3")}><select value={administration.academicYear} disabled={adminBusy} onChange={event => updateAdmin('academicYear', event.target.value)}><option>2026–2027</option><option>2025–2026</option></select></Field><Field label={translateUI("ui.default_department_86b0e7")}><input value={administration.department} maxLength={255} required disabled={adminBusy} onChange={event => updateAdmin('department', event.target.value)} /></Field></div>
            <div className="settings-card"><h3>{translateUI("ui.ai_notifications_35351e")}</h3><Toggle disabled={adminBusy} on={administration.aiChecking} set={value => updateAdmin('aiChecking', value)} title={translateUI("ui.ai_compliance_checking_df4d0c")} text={translateUI("ui.enable_automated_syllabus_quality_checks_95e692")} /><Toggle disabled={adminBusy} on={administration.strictValidation} set={value => updateAdmin('strictValidation', value)} title={translateUI("ui.strict_format_validation_8d19a0")} text={translateUI("ui.require_all_template_sections_before_submission_f069fd")} /><Toggle disabled={adminBusy} on={administration.emailNotifications} set={value => updateAdmin('emailNotifications', value)} title={translateUI("ui.email_notifications_128113")} text={translateUI("ui.notify_users_about_review_and_revision_updates_119ca1")} /></div>
          </div>
  );
}
