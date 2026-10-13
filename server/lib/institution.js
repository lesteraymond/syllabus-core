// The institution's vision and mission (school-wide) and the default EGA list (admin-managed; each program has its own
// copy in program_egas). Shared by routes/institution.js and the submit snapshot in routes/syllabusContent.js.
async function loadOutcomes(db) {
  const [[settings]] = await db.query('SELECT vision, mission_lead, mission_items, version FROM institution_settings WHERE setting_id = 1');
  const [egas] = await db.query('SELECT ega_no, name, short_name FROM institution_egas ORDER BY ega_no');
  let items = [];
  try { items = JSON.parse((settings && settings.mission_items) || '[]'); } catch { items = []; }
  return {
    vision: settings ? settings.vision : '',
    mission: { lead: settings ? settings.mission_lead : '', items },
    version: settings ? settings.version : 1,
    egas: egas.map((e) => ({ no: e.ega_no, name: e.name, short: e.short_name })),
  };
}

module.exports = { loadOutcomes };
