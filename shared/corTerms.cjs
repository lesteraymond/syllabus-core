'use strict';
// The version of the student registration Terms and Conditions (src/lib/corTerms.js holds the text). The registration form sends the version the
// student read and agreed to; the server refuses any other (routes/students.js) and records the accepted version on the new account
// (account_activity 'terms_accept'), as proof of consent under RA 10173. Change it whenever the text changes in substance.
const TERMS_VERSION = '2026-11-24';
module.exports = { TERMS_VERSION };
