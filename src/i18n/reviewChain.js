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
  'reviewChain.error.checkFirst': 'Check this syllabus in the AI Checker before you clear your review, or choose to review it without an AI check.',
  'reviewChain.error.checkFirstDecide': 'Check this syllabus in the AI Checker before you decide on it, or choose to review it without an AI check.',
  'reviewChain.error.aiChoiceNotSetUp': 'Reviewing without an AI check is not set up on this server yet. Ask an administrator to run npm run migrate-review-ai-choice.',
  'reviewChain.error.aiRequired': 'The institution requires a completed AI check before a syllabus is reviewed. Check it in the AI Checker.',

  // Checking with AI or reviewing without it (each reviewer chooses for themselves, per version).
  'aiChoice.withoutAi': 'Review without AI check',
  'aiChoice.confirm': 'Review {code} without an AI check? It goes to Review & Approval for you now, and the choice is recorded in its activity. You can still check it with AI later. The coded checks at approval still apply.',
  'aiChoice.confirmButton': 'Yes, review without AI',
  'aiChoice.cancel': 'Cancel',
  'aiChoice.done': '{code} is ready for your review in Review & Approval, without an AI check.',
  'aiChoice.chosenNote': 'You chose to review this version without an AI check. You can still check it with AI.',
  'aiChoice.panelNote': 'You chose to review this version without an AI check. Read it carefully; you can still check it in the AI Checker.',
  'aiChoice.requiredNote': 'The institution requires an AI check, so every submission is checked with AI first.',
  'reviewChain.approverQueueNote': 'Syllabi appear here for you once the dean, the Asst. VPAA and the LIC Director have all cleared them. You are notified when one is ready.',
  'reviewChain.error.notReadyForApprover': 'This syllabus reaches the VPAA once the dean, the Asst. VPAA and the LIC Director have cleared it.',
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
  'reviewChain.error.checkFirst': 'Suriin muna ang silabus na ito sa AI Checker bago mo tapusin ang iyong pagsusuri, o piliing suriin ito nang walang AI check.',
  'reviewChain.error.checkFirstDecide': 'Suriin muna ang silabus na ito sa AI Checker bago ka magpasya, o piliing suriin ito nang walang AI check.',
  'reviewChain.error.aiChoiceNotSetUp': 'Hindi pa naka-set up sa server na ito ang pagsusuri nang walang AI check. Hilingin sa administrator na patakbuhin ang npm run migrate-review-ai-choice.',
  'reviewChain.error.aiRequired': 'Hinihingi ng institusyon ang kumpletong AI check bago suriin ang isang silabus. Suriin ito sa AI Checker.',

  'aiChoice.withoutAi': 'Suriin nang walang AI check',
  'aiChoice.confirm': 'Suriin ang {code} nang walang AI check? Mapupunta ito sa Review & Approval para sa iyo ngayon, at itatala ang pagpiling ito sa aktibidad nito. Maaari mo pa rin itong suriin gamit ang AI mamaya. Nalalapat pa rin ang mga coded check sa pag-apruba.',
  'aiChoice.confirmButton': 'Oo, suriin nang walang AI',
  'aiChoice.cancel': 'Kanselahin',
  'aiChoice.done': 'Handa na ang {code} para sa iyong pagsusuri sa Review & Approval, nang walang AI check.',
  'aiChoice.chosenNote': 'Pinili mong suriin ang bersiyong ito nang walang AI check. Maaari mo pa rin itong suriin gamit ang AI.',
  'aiChoice.panelNote': 'Pinili mong suriin ang bersiyong ito nang walang AI check. Basahin itong mabuti; maaari mo pa rin itong suriin sa AI Checker.',
  'aiChoice.requiredNote': 'Hinihingi ng institusyon ang AI check, kaya sinusuri muna gamit ang AI ang bawat isinumite.',
  'reviewChain.approverQueueNote': 'Lilitaw dito ang mga silabus para sa iyo kapag natapos na itong suriin ng dekano, ng Asst. VPAA at ng LIC Director. Aabisuhan ka kapag handa na ang isa.',
  'reviewChain.error.notReadyForApprover': 'Makararating ang silabus na ito sa VPAA kapag natapos na itong suriin ng dekano, ng Asst. VPAA at ng LIC Director.',
  'reviewChain.error.ownSyllabus': 'Hindi mo matatapos ang yugto ng pagsusuri sa sarili mong silabus.',
  'reviewChain.error.notWaiting': 'Hindi naghihintay ng pagsusuri ang silabus na ito.',
  'reviewChain.error.ownApproval': 'Ipadala ang sarili mong silabus para sa pagsusuri mula sa AI Checker. Aaprubahan ito ng VPAA kapag natapos na ito ng dekano, ng Asst. VPAA at ng LIC Director.',
};
