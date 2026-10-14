// The institution's email domain. Google sign-in only lets these addresses in, and an administrator can only register users with one.
// Read when it is used (not when the file loads), so ALLOWED_EMAIL_DOMAIN in server/.env is honoured and tests can change it.
const domain = () => String(process.env.ALLOWED_EMAIL_DOMAIN || 'email.lcup.edu.ph').trim().toLowerCase().replace(/^@/, '');

// "name@email.lcup.edu.ph" yes; "name@gmail.com" no; "name@evil.email.lcup.edu.ph" no (the @ must come right before the domain).
const isSchoolEmail = (email) => String(email == null ? '' : email).trim().toLowerCase().endsWith('@' + domain());

module.exports = { domain, isSchoolEmail };
