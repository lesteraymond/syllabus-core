// Bundled and run by scripts/live-claude/render-ui.mjs. Renders ONE stored run (the exact object the browser receives from GET /compliance) through the real faculty
// AI Checker component and writes what a faculty member would be shown. Offline: no network, no database, no model.
import React from 'react';
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import ComplianceCard from '../../src/views/ComplianceCard';
import { setLanguage } from '../../src/i18n';

const run = JSON.parse(fs.readFileSync(process.env.LIVE_UI_RUN, 'utf8'));
const out = process.env.LIVE_UI_OUT;
const result = {};
for (const language of ['en', 'tl']) {
  setLanguage(language);
  const markup = renderToStaticMarkup(<ComplianceCard run={run} onApplyDraft={async () => true} />);
  fs.writeFileSync(`${out}.${language}.html`, markup);
  result[language] = markup.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ');
}
fs.writeFileSync(`${out}.text.json`, JSON.stringify(result));
