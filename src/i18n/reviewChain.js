// The review chain: the dean, the Asst. VPAA and the LIC Director each check and clear their own stage, then the VPAA approves.
// Every key is in both languages (npm run test:localization fails on a missing one). Texts that the screens and the server send in English
// and the app looks up with tr() are listed too, with the same wording the server uses (server/routes/reviewChain.js, routes/syllabi.js).
export const reviewChainEn = {
  'reviewChain.cleared': 'Your check is recorded.',
  'reviewChain.subtitleApprover': 'Open a syllabus that the dean, the Asst. VPAA and the LIC Director have cleared. Approve it, return it for revision or reject it.',
  'reviewChain.subtitleReviewer': 'Open a checked submission and read it. Clear your check, or return it for revision. The VPAA approves once all three have cleared it.',
  'reviewChain.restApprover': 'Still with the dean, the Asst. VPAA or the LIC Director: {count}.',
  'reviewChain.restReviewer': 'Cleared by you and waiting for the other reviewers: {count}.',
  'reviewChain.stagesLabel': 'Review stages',
  'reviewChain.open': 'Not yet',
  'reviewChain.waitingFor': 'Still to clear: {stages}.',
  'reviewChain.progress': 'Review: Dean {dean} · Asst. VPAA {asst} · LIC Director {lic}',

  // Role and stage names (looked up by their English text).
  'reviewChain.role.vpaa': 'Vice President for Academic Affairs',
  'reviewChain.role.asst_vpaa': 'Asst. Vice President for Academic Affairs',
  'reviewChain.role.lic_director': 'LIC Director',
  'reviewChain.stage.dean': 'Dean',
  'reviewChain.stage.asst_vpaa': 'Asst. VPAA',
  'reviewChain.permission.review': 'Check and review',
  'reviewChain.permission.approve': 'Review and approve',

  // The panel's buttons.
  'reviewChain.action.clear': 'Clear my check',
  'reviewChain.action.clearConfirm': 'Clear your check of this syllabus? It goes to the VPAA once the dean, the Asst. VPAA and the LIC Director have all cleared it.',

  // What the server says when it refuses.
  'reviewChain.error.reviewersOnly': 'Only reviewers can change a syllabus status',
  'reviewChain.error.vpaaOnly': 'Only the VPAA can approve or reject a syllabus. The dean, the Asst. VPAA and the LIC Director clear their check, or return the syllabus for revision.',
  'reviewChain.error.stagesPending': 'The dean, the Asst. VPAA and the LIC Director must each clear this syllabus before it can be approved.',
  'reviewChain.error.notSetUp': 'The review chain is not set up on this server yet. Ask an administrator to run the database update.',
  'reviewChain.error.checkFirst': 'Check this syllabus in the AI Checker before you clear your review.',
  'reviewChain.error.ownSyllabus': 'You cannot clear a review stage on your own syllabus.',
  'reviewChain.error.notWaiting': 'This syllabus is not waiting for review.',
  'reviewChain.error.ownApproval': 'Send your own syllabus for review from the AI Checker. The VPAA approves it after the dean, the Asst. VPAA and the LIC Director have cleared it.',
};

export const reviewChainTl = {
  'reviewChain.cleared': 'Naitala ang iyong pagsusuri.',
  'reviewChain.subtitleApprover': 'Buksan ang silabus na natapos nang suriin ng dekano, ng Asst. VPAA at ng LIC Director. Aprubahan ito, ibalik para sa rebisyon o tanggihan.',
  'reviewChain.subtitleReviewer': 'Buksan at basahin ang nasuring pagsusumite. Tapusin ang iyong pagsusuri, o ibalik ito para sa rebisyon. Aaprubahan ito ng VPAA kapag natapos na ng tatlo.',
  'reviewChain.restApprover': 'Nasa dekano, Asst. VPAA o LIC Director pa: {count}.',
  'reviewChain.restReviewer': 'Natapos mo na at naghihintay sa ibang tagasuri: {count}.',
  'reviewChain.stagesLabel': 'Mga yugto ng pagsusuri',
  'reviewChain.open': 'Hindi pa',
  'reviewChain.waitingFor': 'Hindi pa natatapos: {stages}.',
  'reviewChain.progress': 'Pagsusuri: Dekano {dean} · Asst. VPAA {asst} · LIC Director {lic}',

  'reviewChain.role.vpaa': 'Pangalawang Pangulo para sa Akademikong Gawain',
  'reviewChain.role.asst_vpaa': 'Katulong na Pangalawang Pangulo para sa Akademikong Gawain',
  'reviewChain.role.lic_director': 'Direktor ng LIC',
  'reviewChain.stage.dean': 'Dekano',
  'reviewChain.stage.asst_vpaa': 'Asst. VPAA',
  'reviewChain.permission.review': 'Suriin at repasuhin',
  'reviewChain.permission.approve': 'Repasuhin at aprubahan',

  'reviewChain.action.clear': 'Tapusin ang aking pagsusuri',
  'reviewChain.action.clearConfirm': 'Tapusin ang iyong pagsusuri sa silabus na ito? Mapupunta ito sa VPAA kapag natapos na ito ng dekano, ng Asst. VPAA at ng LIC Director.',

  'reviewChain.error.reviewersOnly': 'Mga tagasuri lamang ang makapagpapalit ng kalagayan ng silabus',
  'reviewChain.error.vpaaOnly': 'Ang VPAA lamang ang makapag-aaprubang o makatatanggi ng silabus. Tinatapos ng dekano, ng Asst. VPAA at ng LIC Director ang kanilang pagsusuri, o ibinabalik ang silabus para sa rebisyon.',
  'reviewChain.error.stagesPending': 'Kailangang tapusin muna ng dekano, ng Asst. VPAA at ng LIC Director ang pagsusuri ng silabus na ito bago ito maaprubahan.',
  'reviewChain.error.notSetUp': 'Hindi pa naka-set up ang daloy ng pagsusuri sa server na ito. Hilingin sa isang administrator na patakbuhin ang pag-update ng database.',
  'reviewChain.error.checkFirst': 'Suriin muna ang silabus na ito sa AI Checker bago mo tapusin ang iyong pagsusuri.',
  'reviewChain.error.ownSyllabus': 'Hindi mo matatapos ang yugto ng pagsusuri sa sarili mong silabus.',
  'reviewChain.error.notWaiting': 'Hindi naghihintay ng pagsusuri ang silabus na ito.',
  'reviewChain.error.ownApproval': 'Ipadala ang sarili mong silabus para sa pagsusuri mula sa AI Checker. Aaprubahan ito ng VPAA kapag natapos na ito ng dekano, ng Asst. VPAA at ng LIC Director.',
};
