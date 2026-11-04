// Captures real app screens at 1920x1080 for the promo. Usage: node capture.mjs <toolsDir>
import { createRequire } from 'module';
const require = createRequire(process.argv[2] + '/');
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 2 } });
const p = await b.newPage();

// Demo data: swap real names/photos for neutral ones so no personal data appears on screen.
await p.evaluateOnNewDocument(() => {
  const map = [[/Boseng Del Rosario/g,'Dr. Ana Villanueva'],[/Jp Del Rosario/gi,'Maria Reyes'],[/\bBoseng\b/g,'Ana'],[/asdasdas/g,'Introduces systems analysis, design and implementation for business information systems.'],[/sasd/g,'IT 201'],[/hellow wolrd/g,'explain core concepts'],[/BSS/g,'Business Systems']];
  const scrubDoc = (doc) => {
    const w = doc.createTreeWalker(doc.body || doc, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) { let t = n.nodeValue; for (const [r, v] of map) t = t.replace(r, v); if (t !== n.nodeValue) n.nodeValue = t; }
    try {
    doc.querySelectorAll('img').forEach(i => { if (/avatar|photo|upload|blob|data:|\/api\//i.test(i.src) && !/logo/i.test(i.src)) { i.style.opacity='0'; const q=i.parentElement; if (q && q.getBoundingClientRect().width < 60) q.style.background='linear-gradient(135deg,#2c36b4,#d9a441)'; } });
    } catch (e) {}
  };
  const scrub = () => { scrubDoc(document); document.querySelectorAll('iframe').forEach(f => { try { scrubDoc(f.contentDocument); } catch {} }); };
  const rf = window.fetch; window.fetch = async (...a) => { const r = await rf(...a); if (!/\/api\//.test(String(a[0] && a[0].url || a[0])) || !/json/.test(r.headers.get('content-type') || '')) return r; let t = await r.text(); for (const [re, v] of map) t = t.replace(re, v); return new Response(t, { status: r.status, statusText: r.statusText, headers: r.headers }); };
  new MutationObserver(() => scrubDoc(document)).observe(document, { subtree: true, childList: true, characterData: true });
  window.__scrub = scrub; setInterval(scrub, 100);
});
await p.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
await p.type('input[type=text],input[type=email],input:not([type])', 'admin@university.edu.ph');
await p.type('input[type=password]', 'admin123');
await Promise.all([p.click('button[type=submit]'), new Promise(r => setTimeout(r, 4000))]);
const navs = await p.$$eval('.sidebar button, .sidebar a', els => els.map(e => e.getAttribute('aria-label') || e.textContent.trim()));
console.log(navs);
const wait = ms => new Promise(r => setTimeout(r, ms));
const clickText = async (sel, text) => { const h = await p.evaluateHandle((sel, text) => [...document.querySelectorAll(sel)].find(e => e.textContent.trim().includes(text)), sel, text); const el = h.asElement(); if (!el) throw new Error('no ' + text); await el.click(); };
const nav = async label => { await p.click(`.sidebar [aria-label="${label}"]`); await wait(2500); };
const shot = async f => { await p.evaluate(() => { const set = (el, v) => { const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); };
  document.querySelectorAll('input,textarea').forEach(el => { if (/^(JHJAHAH|JASJDJASJDSAD)$/i.test(el.value)) set(el, /JH/i.test(el.value) ? 'IT 101 Introduction to Computing' : 'Introduces computing concepts, algorithms and program design with applications to engineering problems.'); }); }); await p.evaluate(() => window.__scrub()); await wait(150); await p.evaluate(() => window.__scrub()); await p.screenshot({ path: `shots/${f}.png` }); };
const pick = async (idx, text) => { const cbs = await p.$$('[role=combobox]'); await cbs[idx].click(); await wait(500); await clickText('[role=option]', text); await wait(900); };

await nav('Dashboard'); await shot('dashboard');

await nav('Review & Approval'); await shot('review');
await p.click('button[aria-haspopup=dialog]'); await wait(3500); await shot('review-open');
await p.keyboard.press('Escape'); await wait(800);
await nav('Repository'); await shot('repository');
await nav('My Syllabi'); await shot('mysyllabi');
const edits = await p.$$('button'); const ed = []; for (const e of edits) { const t = await e.evaluate(x => x.textContent); if (/Edit/.test(t) && !/Baguhin$/.test('')) ed.push(e); }
await ed[1].click(); await wait(3000); await shot('builder-1');
for (const [lbl, f] of [['Learning Outcomes','builder-2'],['Learning Plan','builder-3'],['Review Syllabus','builder-4']]) { await clickText('.sidebar ~ * button, main button, button', lbl).catch(e => console.log(e.message)); await wait(1800); await shot(f); }
await b.close();
