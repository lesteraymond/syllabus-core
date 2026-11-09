// The builder's step order and the administrator's "Strict format validation" switch, as plain logic (tested in stepGate.test.js; the hook that reads
// the switch is src/lib/adminPolicy.js).

// What applies until the switches are known, or if they cannot be read: the strict step order, and AI checking taken as on. A slow or missing answer
// never unlocks more than the administrator chose. The server enforces what matters either way (a complete form on submit, no AI request when off).
export const POLICY_UNKNOWN = Object.freeze({ strictValidation: true, aiChecking: true, emailNotifications: true, loaded: false });

// Whether the builder makes this person complete its steps in order: faculty editing their syllabus, while "Strict format validation" is on.
// The administrator is never held to the order, and a read-only syllabus is never gated.
export const stepsGated = ({ editable, role, strict }) => !!editable && role === 'faculty' && strict !== false;
