'use strict';
// The JSON schemas Anthropic's structured outputs (output_config.format) accept, checked before a request is sent: a schema the API would refuse
// (HTTP 400) is refused here with every reason, and nothing is sent. From Anthropic's structured-outputs documentation, read 2026-10-27:
//   - keywords: type (object, array, string, integer, number, boolean, null, or a list of them), properties, required, additionalProperties, items,
//     enum (strings, numbers, booleans and null), const, anyOf, allOf (without $ref), $ref to the schema's own $defs or definitions, default, format,
//     pattern, minItems, title and description. Nothing else: no minimum, maximum, multipleOf, minLength, maxLength, maxItems, uniqueItems, ...;
//   - every object sets additionalProperties: false, and minItems is 0 or 1;
//   - formats date-time, time, date, duration, email, hostname, uri, ipv4, ipv6 and uuid;
//   - a pattern has no backreference, lookahead or lookbehind, \b or \B, and no {n,m} count over a "large range" (Anthropic names no number: this
//     checker refuses a count over 100);
//   - no recursive $ref, and across the schema at most 24 optional properties (left out of required) and 16 union types (anyOf or a list of types).
// Two rules are this checker's own: every name in required is one of the object's properties, and no enum holds two values that differ only in
// capitalisation (Anthropic advises against that, because the capitalisation of an answer is not guaranteed; see caseOnlyEnumMismatches).
// The schema decides nothing about what an answer must contain: verifyAnswer still checks every answer.
const TYPES = new Set(['object', 'array', 'string', 'integer', 'number', 'boolean', 'null']);
const KEYWORDS = new Set(['type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'const', 'anyOf', 'allOf', '$ref', '$defs', 'definitions', 'default', 'format', 'pattern', 'minItems', 'title', 'description']);
const FORMATS = new Set(['date-time', 'time', 'date', 'duration', 'email', 'hostname', 'uri', 'ipv4', 'ipv6', 'uuid']);
const MAX_OPTIONAL = 24, MAX_UNIONS = 16, MAX_COUNT = 100;
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
const scalar = value => value === null || ['string', 'number', 'boolean'].includes(typeof value);
// What a $ref names: '#' (the whole schema), '#/$defs/name' or '#/definitions/name'. null for anything else (an external or a deeper reference).
function referenced(root, ref) {
  if (ref === '#') return root;
  const match = /^#\/(\$defs|definitions)\/([^/]+)$/.exec(String(ref));
  return match && plain(root[match[1]]) && Object.hasOwn(root[match[1]], match[2]) ? root[match[1]][match[2]] : null;
}
// Why a pattern would be refused, or '' when it would not. An escaped character is read as one; within a character class too, so \b there (a
// backspace) is refused as well: cautious, and no schema of this checker has a pattern.
function patternProblem(pattern) {
  if (typeof pattern !== 'string') return 'is not a string';
  try { new RegExp(pattern); } catch { return 'is not a valid regular expression'; }
  for (let i = 0; i < pattern.length; i += 1) {
    const at = pattern[i], next = pattern[i + 1] || '';
    if (at === '\\') {
      if (/[1-9]/.test(next) || (next === 'k' && pattern[i + 2] === '<')) return 'uses a backreference';
      if (next === 'b' || next === 'B') return 'uses a word boundary (\\b or \\B)';
      i += 1;
    } else if (at === '(' && next === '?' && (/[=!]/.test(pattern[i + 2] || '') || (pattern[i + 2] === '<' && /[=!]/.test(pattern[i + 3] || '')))) {
      return 'uses a lookahead or lookbehind';
    } else if (at === '{') {
      const count = /^\{(\d+)(?:,(\d*))?\}/.exec(pattern.slice(i));
      if (count && [count[1], count[2]].some(n => n && Number(n) > MAX_COUNT)) return `repeats more than ${MAX_COUNT} times`;
    }
  }
  return '';
}
// Every reason Anthropic's structured outputs would refuse `schema`, each naming where it is ($ is the top, $.judgements[] the items of that array).
// [] when the schema can be sent.
function schemaProblems(schema) {
  const problems = [], chain = ['#'], used = new Set(); // chain: the references being expanded, the whole schema ('#') first
  let optional = 0, unions = 0;
  const visit = (node, at) => {
    if (!plain(node)) { problems.push(`${at} is not a schema`); return; }
    for (const key of Object.keys(node)) if (!KEYWORDS.has(key)) problems.push(`${at}: ${key} is not supported`);
    if (node !== schema && ('$defs' in node || 'definitions' in node)) problems.push(`${at}: $defs and definitions belong at the top of the schema`);
    if ('$ref' in node) {
      const ref = node.$ref, resolved = referenced(schema, ref);
      if (!resolved) problems.push(`${at}: $ref ${JSON.stringify(ref)} does not name this schema's own $defs or definitions`);
      else if (chain.includes(ref)) problems.push(`${at}: $ref ${ref} is recursive`);
      else { used.add(ref); chain.push(ref); visit(resolved, ref); chain.pop(); }
    }
    const types = Array.isArray(node.type) ? node.type : node.type === undefined ? [] : [node.type];
    for (const type of types) if (!TYPES.has(type)) problems.push(`${at}: type ${JSON.stringify(type)} is not supported`);
    if (Array.isArray(node.type) || 'anyOf' in node) unions += 1;
    if (types.includes('object') || 'properties' in node || 'required' in node || 'additionalProperties' in node) {
      if (node.additionalProperties !== false) problems.push(`${at}: an object must set additionalProperties: false`);
      const properties = node.properties === undefined ? {} : node.properties, required = node.required === undefined ? [] : node.required;
      if (!plain(properties)) problems.push(`${at}: properties is not an object`);
      else if (!Array.isArray(required) || !required.every(name => typeof name === 'string')) problems.push(`${at}: required is not a list of names`);
      else {
        for (const name of required) if (!Object.hasOwn(properties, name)) problems.push(`${at}: required names ${name}, which is not one of its properties`);
        optional += Object.keys(properties).filter(name => !required.includes(name)).length;
      }
      if (plain(properties)) for (const [name, child] of Object.entries(properties)) visit(child, `${at}.${name}`);
    }
    if ('items' in node) { if (plain(node.items)) visit(node.items, `${at}[]`); else problems.push(`${at}: items must be one schema`); }
    if ('minItems' in node && node.minItems !== 0 && node.minItems !== 1) problems.push(`${at}: minItems ${JSON.stringify(node.minItems)} is not supported (only 0 or 1)`);
    if ('enum' in node) {
      if (!Array.isArray(node.enum) || !node.enum.length || !node.enum.every(scalar)) problems.push(`${at}: enum must list strings, numbers, booleans or null`);
      else {
        const lower = node.enum.filter(value => typeof value === 'string').map(value => value.toLowerCase());
        if (new Set(lower).size !== lower.length) problems.push(`${at}: enum has values that differ only in capitalisation`);
      }
    }
    if ('const' in node && !scalar(node.const)) problems.push(`${at}: const must be a string, number, boolean or null`);
    if ('format' in node && !FORMATS.has(node.format)) problems.push(`${at}: format ${JSON.stringify(node.format)} is not supported`);
    if ('pattern' in node) { const why = patternProblem(node.pattern); if (why) problems.push(`${at}: pattern ${why}`); }
    for (const key of ['anyOf', 'allOf']) {
      if (!(key in node)) continue;
      if (!Array.isArray(node[key]) || !node[key].length) { problems.push(`${at}: ${key} must be a list of schemas`); continue; }
      node[key].forEach((child, i) => {
        if (key === 'allOf' && plain(child) && '$ref' in child) problems.push(`${at}.allOf[${i}]: allOf with $ref is not supported`);
        visit(child, `${at}.${key}[${i}]`);
      });
    }
  };
  visit(schema, '$');
  // A definition no $ref uses is sent all the same, so it is checked too.
  for (const key of ['$defs', 'definitions']) {
    if (!plain(schema) || schema[key] === undefined) continue;
    if (!plain(schema[key])) { problems.push(`$: ${key} is not an object`); continue; }
    for (const name of Object.keys(schema[key])) {
      const ref = `#/${key}/${name}`;
      if (!used.has(ref)) { chain.push(ref); visit(schema[key][name], ref); chain.pop(); }
    }
  }
  if (optional > MAX_OPTIONAL) problems.push(`$: ${optional} optional properties (at most ${MAX_OPTIONAL})`);
  if (unions > MAX_UNIONS) problems.push(`$: ${unions} union types (at most ${MAX_UNIONS})`);
  return problems;
}
// Where an answer differs from its schema only in the capitalisation of an enum or const value ('Missionary spirit' for 'Missionary Spirit').
// Anthropic does not guarantee that capitalisation. Such a value is refused, or recorded as an invalid stage field, exactly as before (verifyAnswer
// stays strict); this only finds them, so an evaluation can tell a capitalisation slip from a wrong answer. [{ path, given, expected }], with path
// the keys and indexes that lead to the value.
function caseOnlyEnumMismatches(value, schema) {
  const found = [];
  const walk = (node, data, path, depth) => {
    if (!plain(node) || depth > 64) return;
    if (typeof node.$ref === 'string') { const resolved = referenced(schema, node.$ref); if (resolved && resolved !== node) walk(resolved, data, path, depth + 1); }
    const allowed = Array.isArray(node.enum) ? node.enum : 'const' in node ? [node.const] : null;
    if (allowed && typeof data === 'string' && !allowed.includes(data)) {
      const expected = allowed.find(option => typeof option === 'string' && option.toLowerCase() === data.toLowerCase());
      if (expected !== undefined) found.push({ path, given: data, expected });
    }
    if (plain(data) && plain(node.properties)) for (const [key, child] of Object.entries(node.properties)) if (Object.hasOwn(data, key)) walk(child, data[key], [...path, key], depth + 1);
    if (Array.isArray(data) && plain(node.items)) data.forEach((item, i) => walk(node.items, item, [...path, i], depth + 1));
    for (const key of ['anyOf', 'allOf']) if (Array.isArray(node[key])) for (const child of node[key]) walk(child, data, path, depth + 1);
  };
  walk(schema, value, [], 0);
  const seen = new Set();
  return found.filter(({ path }) => { const key = JSON.stringify(path); return seen.has(key) ? false : seen.add(key); });
}
module.exports = { schemaProblems, caseOnlyEnumMismatches, patternProblem, MAX_OPTIONAL, MAX_UNIONS, MAX_COUNT };
