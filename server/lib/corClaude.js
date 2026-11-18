// Reads a Certificate of Registration (COR) photo with Claude (vision) instead of OCR. Returns the same shape as
// corParser.parseCor, so the registration route and the admin review queue are unchanged.
// Needs ANTHROPIC_API_KEY; the model is ANTHROPIC_MODEL (default claude-haiku-5-5).
const sharp = require('sharp');
const Anthropic = require('@anthropic-ai/sdk');
const { httpError } = require('./http');

const MODEL = () => process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';

const PROMPT = `This is a photo or scan of a student's Certificate of Registration (an "Official Registration Form") from a Philippine university. It may be rotated, skewed, shadowed or partly cropped. Read it and reply with ONE JSON object and nothing else, using exactly these keys (null when a value is not printed or not legible; never guess):
{
  "studentId": "format NN-NNNN-NNN, e.g. 23-3389-455",
  "studentName": "as printed, SURNAME, GIVEN NAMES",
  "program": "the Course/Major text as printed",
  "yearLevel": number 1-6,
  "section": "the section of the first subject row, e.g. BSIT3A",
  "schoolYear": "e.g. 2025-2026",
  "term": "1st Semester, 2nd Semester or Summer",
  "subjects": [{"code": "subject code as printed, e.g. IT-401", "title": "subject title", "section": "section as printed, e.g. BSIT3A"}]
}
List every subject row of the enrolled-subjects table. If the image is not a COR, return all keys null with an empty subjects array.`;

const str = (v) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ') : null);

// Same meaning as corParser: 'yes' = Information Technology, 'maybe' = a program was read but not clearly IT, 'no' = none.
function bsitOf(program, subjects) {
  if (program && /INFORMATION\s+TECHNOLOGY/i.test(program)) return 'yes';
  if (subjects.some((s) => /^BS\s*IT\s*\d[A-Z]?$/i.test(s.section || ''))) return 'yes';
  return program ? 'maybe' : 'no';
}

function normalize(raw) {
  const idMatch = String(raw.studentId || '').match(/(\d{2})\D{0,3}(\d{4})\D{0,3}(\d{3})/);
  const subjects = (Array.isArray(raw.subjects) ? raw.subjects : [])
    .map((s) => ({ code: str(s && s.code) && str(s.code).toUpperCase(), title: str(s && s.title) || '', section: str(s && s.section) && str(s.section).toUpperCase().replace(/\s+/g, '') }))
    .filter((s) => s.code);
  const program = str(raw.program);
  const bsit = bsitOf(program, subjects);
  const year = Number(raw.yearLevel);
  const ay = String(raw.schoolYear || '').match(/(\d{4})\s*[-–—]\s*(\d{4})/);
  const term = String(raw.term || '').match(/1st|first|2nd|second|summer|mid/i);
  return {
    studentId: idMatch ? `${idMatch[1]}-${idMatch[2]}-${idMatch[3]}` : null,
    studentName: str(raw.studentName),
    program: bsit === 'yes' ? 'BACHELOR OF SCIENCE IN INFORMATION TECHNOLOGY' : program,
    bsit,
    yearLevel: Number.isInteger(year) && year >= 1 && year <= 6 ? year : null,
    section: str(raw.section) ? str(raw.section).toUpperCase().replace(/\s+/g, '') : (subjects[0] && subjects[0].section) || null,
    schoolYear: ay ? `${ay[1]}-${ay[2]}` : null,
    term: term ? (/summer|mid/i.test(term[0]) ? 'Summer' : /1st|first/i.test(term[0]) ? '1st Semester' : '2nd Semester') : null,
    printedAt: null,
    subjects,
  };
}

async function scanCor(input) {
  if (!process.env.ANTHROPIC_API_KEY) throw httpError(503, 'COR scanning is not configured. Contact an administrator.');
  const jpeg = await sharp(input).rotate().resize({ width: 1500, height: 1500, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  let message;
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60000, maxRetries: 2 });
    message = await client.messages.create({
      model: MODEL(),
      max_tokens: 1500,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpeg.toString('base64') } },
        { type: 'text', text: PROMPT },
      ] }],
    });
  } catch (err) {
    console.error('COR scan (Claude) failed:', err && err.message);
    throw httpError(502, 'We could not read your COR right now. Try again in a moment.');
  }
  const text = (message.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  const json = text.match(/\{[\s\S]*\}/);
  let raw;
  try { raw = JSON.parse(json ? json[0] : ''); } catch { throw httpError(422, 'We could not read your COR. Retake the photo: full page, flat, in good light.'); }
  return normalize(raw || {});
}

module.exports = { scanCor, normalize };
