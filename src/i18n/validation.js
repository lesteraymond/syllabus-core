import { tr } from './index.js';
export function validationMessage(field) {
  const validity = field.validity;
  if (validity.valueMissing) return tr('Complete this field.');
  if (validity.typeMismatch && field.type === 'email') return tr('Enter a valid email address.');
  if (validity.patternMismatch) return tr('Use the requested format.');
  if (validity.tooShort) return tr('Use at least ' + field.minLength + ' characters.');
  if (validity.tooLong) return tr('Use no more than ' + field.maxLength + ' characters.');
  if (validity.rangeUnderflow) return tr('Enter a value of at least ' + field.min + '.');
  if (validity.rangeOverflow) return tr('Enter a value no greater than ' + field.max + '.');
  return validity.valid ? '' : tr('Enter a valid value.');
}
export function installLocalizedValidation(target) {
  const invalid = event => {
    const field = event.target;
    if (typeof field.setCustomValidity !== 'function') return;
    field.setCustomValidity('');
    field.setCustomValidity(validationMessage(field));
  };
  const input = event => event.target.setCustomValidity?.('');
  target.addEventListener('invalid', invalid, true);
  target.addEventListener('input', input, true);
  target.addEventListener('change', input, true);
  return () => {
    target.removeEventListener('invalid', invalid, true);
    target.removeEventListener('input', input, true);
    target.removeEventListener('change', input, true);
  };
}
