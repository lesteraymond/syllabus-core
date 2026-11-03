'use strict';
// Bind a proposal to the exact field and stable row identities it evaluated.
function bindSuggestions(content, suggestions) {
  return suggestions.map(suggestion => {
    const parts = suggestion.path.replace(/\[(\d+)\]/g, '.$1').split('.');
    const originalValue = parts.reduce((value, key) => value?.[key], content);
    const match = suggestion.path.match(/^(clos|plan)\[(\d+)\](?:\.ilos\[(\d+)\])?/);
    const targetIds = {};
    if (match) {
      const row = content[match[1]]?.[Number(match[2])];
      if (row?.id !== undefined) targetIds.row = row.id;
      if (match[3] !== undefined && row?.ilos?.[Number(match[3])]?.id !== undefined) targetIds.ilo = row.ilos[Number(match[3])].id;
    }
    return { ...suggestion, originalValue: originalValue === undefined ? null : structuredClone(originalValue), ...(originalValue === undefined ? { originalMissing: true } : {}), targetIds };
  });
}
module.exports = { bindSuggestions };
