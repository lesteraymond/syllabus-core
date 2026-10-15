// Fails CI for missing keys or new hardcoded interface strings. Values and document content are intentionally excluded.
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseSync } from 'rolldown/utils';
import { dictionaries } from '../src/i18n/index.js';
const root = path.resolve(import.meta.dirname, '..');
const walk = async dir => (await Promise.all((await fs.readdir(dir, { withFileTypes: true })).map(e => e.isDirectory() ? walk(path.join(dir, e.name)) : path.join(dir, e.name)))).flat();
const labels = new Set(['label', 'title', 'subtitle', 'placeholder', 'aria-label', 'alt', 'text', 'confirmLabel', 'cancelLabel', 'emptyText', 'note', 'action', 'centerBottom', 'scope', 'saveLabel']);
const problems = [];
let keyUses = 0;
const sourceMessages = new Set(Object.values(dictionaries.en).map(value => value.trim()));
const add = (file, node, text, code) => {
  if (/[A-Za-z]{2}/.test(text) && !/^[\w.-]+\.(pdf|xlsx|docx|txt)/.test(text.trim())) problems.push(path.relative(root, file) + ':' + code.slice(0, node.start).split('\n').length + ': ' + text);
};
for (const file of (await walk(path.join(root, 'src'))).filter(p => p.endsWith('.jsx') && !p.endsWith('FormPaper.jsx'))) {
  const code = await fs.readFile(file, 'utf8');
  const { program, errors } = parseSync(file, code);
  if (errors.length) throw new Error(file + ': ' + JSON.stringify(errors));
  const display = n => {
    if (!n) return;
    if (n.type === 'ParenthesizedExpression') return display(n.expression);
    if (n.type === 'Literal' && typeof n.value === 'string') add(file,n,n.value,code);
    else if (n.type === 'ConditionalExpression') { display(n.consequent); display(n.alternate); }
    else if (n.type === 'LogicalExpression') { if (n.operator !== '&&') display(n.left); display(n.right); }
    else if (n.type === 'BinaryExpression' && n.operator === '+') { display(n.left); display(n.right); }
    else if (n.type === 'TemplateLiteral') { for (const q of n.quasis) add(file,q,q.value.cooked,code); }
  };
  const visit = (n, parent) => {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'JSXText') add(file,n,n.value.trim(),code);
    if (n.type === 'JSXAttribute' && labels.has(n.name.name)) {
      if (n.name.name === 'scope' && ['th', 'td'].includes(parent?.name?.name)) return;
      // Policy text is prefilled syllabus content, not interface copy.
      if (n.name.name === 'text' && parent?.name?.name === 'Policy') return;
      if (n.value?.type === 'Literal') add(file,n.value,n.value.value,code);
      else if (n.value?.type === 'JSXExpressionContainer') display(n.value.expression);
    }
    if (n.type === 'JSXExpressionContainer' && parent?.type !== 'JSXAttribute') display(n.expression);
    if (n.type === 'CallExpression' && ['translateUI','t'].includes(n.callee.name) && n.arguments[0]?.type === 'Literal') {
      keyUses++;
      const key=n.arguments[0].value;
      if (!dictionaries.en[key] || !dictionaries.tl[key]) problems.push(path.relative(root,file) + ': missing translation ' + key);
    }
    if (n.type === 'CallExpression' && n.callee.name === 'tr' && n.arguments[0]?.type === 'Literal' && typeof n.arguments[0].value === 'string' && !sourceMessages.has(n.arguments[0].value.trim())) problems.push(path.relative(root,file) + ': missing source message ' + n.arguments[0].value);
    for (const value of Object.values(n)) {
      if (Array.isArray(value)) value.forEach(child => visit(child,n));
      else if (value?.type) visit(value,n);
    }
  };
  visit(program);
}
for (const key of Object.keys(dictionaries.en)) if (!dictionaries.tl[key]?.trim()) problems.push('Missing Tagalog: '+key);
if (problems.length) { console.error(problems.join('\n')); process.exitCode=1; }
else console.log('Localization audit passed: '+Object.keys(dictionaries.en).length+' bilingual keys; '+keyUses+' interface key references; no hardcoded display strings.');
