import { Field, Toggle } from './ui';
import { t as translateUI } from '../i18n/index.js';
import Select from './Select';

// Rendered only by the administrator branch; the API independently enforces access.
export default function AdministrativeSettings({ administration, adminBusy, updateAdmin }) {
  return (
<div className="settings-grid">
            <div className="settings-card"><h3>{translateUI("ui.institutional_standard_2f4462")}</h3><Field label={translateUI("ui.default_syllabus_template_6c0a16")}><Select value={administration.template} disabled={adminBusy} onChange={event => updateAdmin('template', event.target.value)}><option value="Undergraduate Syllabus v4">{translateUI("ui.undergraduate_syllabus_v4_7600c5")}</option><option value="Undergraduate Syllabus v3">{translateUI("ui.undergraduate_syllabus_v3_3225ea")}</option></Select></Field>{/* the academic year is no longer a default here: the current academic year is set on Program & Subjects and applies to everyone */}<Field label={translateUI("ui.default_department_86b0e7")}><input value={administration.department} maxLength={255} required disabled={adminBusy} onChange={event => updateAdmin('department', event.target.value)} /></Field></div>
            <div className="settings-card"><h3>{translateUI("ui.ai_notifications_35351e")}</h3><Toggle disabled={adminBusy} on={administration.aiChecking} set={value => updateAdmin('aiChecking', value)} title={translateUI("ui.ai_compliance_checking_df4d0c")} text={translateUI('policy.aiHelp')} /><Toggle disabled={adminBusy} on={administration.strictValidation} set={value => updateAdmin('strictValidation', value)} title={translateUI("ui.strict_format_validation_8d19a0")} text={translateUI('policy.strictHelp')} /><Toggle disabled={adminBusy} on={administration.emailNotifications} set={value => updateAdmin('emailNotifications', value)} title={translateUI("ui.email_notifications_128113")} text={translateUI('policy.emailHelp')} /></div>
          </div>
  );
}
