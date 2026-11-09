// The administrator's switches in effect (Settings > AI & Notifications; src/lib/adminPolicy.js, server/lib/adminSettings.js). Every key is in both
// languages (npm run test:localization fails on a missing one). The server's own messages are listed with the server's exact wording, so tr() finds them.
export const adminPolicyEn = {
  // what each switch does, under it on the Settings page
  'policy.strictHelp': 'On: faculty complete builder steps 1–7 in order. Off: they open any step. A complete form is always needed to submit.',
  'policy.aiHelp': 'On: checks also ask the AI for alignment and recommendations. Off: checks run the format rules only, with no AI request.',
  'policy.emailHelp': 'Email faculty when their syllabus is approved, returned for revision or rejected, and send deadline reminders. In-app notifications are sent either way.',
  'policy.freeSteps': 'Steps 1–7 are open in any order (Strict format validation is off). Every step must still be complete before you submit.',
  'policy.completeBeforeSubmit': 'Complete before submitting:',
  'policy.aiOff': 'AI compliance checking is turned off by the administrator: checks run the format rules only, with no AI recommendations.',
  'policy.server.aiOff': 'AI compliance checking is turned off in Settings (AI & Notifications), so no AI request was sent; the coded format rules ran.',
  'policy.server.aiOffRefusal': 'AI compliance checking is turned off in Settings (AI & Notifications), so this recommendation cannot be checked with AI. You can still apply or edit it yourself.',
};

export const adminPolicyTl = {
  'policy.strictHelp': 'Naka-on: kinukumpleto ng guro ang Hakbang 1–7 nang sunod-sunod. Naka-off: mabubuksan ang anumang hakbang. Laging kailangan ang kumpletong form para mag-submit.',
  'policy.aiHelp': 'Naka-on: humihingi rin ang pagsusuri sa AI ng pagkakahanay at mga mungkahi. Naka-off: mga panuntunan ng format lang, walang kahilingan sa AI.',
  'policy.emailHelp': 'Mag-email sa guro kapag naaprubahan, ibinalik para baguhin, o tinanggihan ang silabus, at magpadala ng paalala sa deadline. Laging may abiso sa app.',
  'policy.freeSteps': 'Bukas ang Hakbang 1–7 sa anumang pagkakasunod (naka-off ang Mahigpit na pagsusuri ng format). Kailangan pa ring kumpleto ang bawat hakbang bago mag-submit.',
  'policy.completeBeforeSubmit': 'Kumpletuhin bago mag-submit:',
  'policy.aiOff': 'Pinatay ng administrator ang AI compliance checking: mga panuntunan ng format lang ang sinusuri, walang mungkahi mula sa AI.',
  'policy.server.aiOff': 'Naka-off ang AI compliance checking sa Settings (AI & Notifications), kaya walang ipinadalang kahilingan sa AI; ang mga naka-code na panuntunan ng format ang tumakbo.',
  'policy.server.aiOffRefusal': 'Naka-off ang AI compliance checking sa Settings (AI & Notifications), kaya hindi masusuri ng AI ang mungkahing ito. Maaari mo pa rin itong ilapat o i-edit nang mag-isa.',
};
