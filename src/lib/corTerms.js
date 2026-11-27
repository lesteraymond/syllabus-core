// The Terms and Conditions a student agrees to when registering with their Certificate of Registration (COR), under Philippine law: the Data Privacy
// Act of 2012 (RA 10173) and its Implementing Rules, the Electronic Commerce Act of 2000 (RA 8792) and the Cybercrime Prevention Act of 2012 (RA 10175).
// Every statement here describes what the system really does (routes/students.js, lib/corClaude.js, lib/corCleanup.js, lib/accountActivity.js);
// change the text when the behavior changes, and then the version in shared/corTerms.cjs.
// Each text is [English, Tagalog]. DPO_CONTACT: the College's Data Protection Officer contact, to be filled in by the College (empty: named by title only).
import shared from '../../shared/corTerms.cjs';

export const TERMS_VERSION = shared.TERMS_VERSION;
export const DPO_CONTACT = '';

const dpo = DPO_CONTACT
  ? [`the College's Data Protection Officer (${DPO_CONTACT})`, `ang Data Protection Officer ng Kolehiyo (${DPO_CONTACT})`]
  : ["the College's Data Protection Officer", 'ang Data Protection Officer ng Kolehiyo'];

export const TERMS_TITLE = ['Terms and Conditions for Student Registration', 'Mga Tuntunin at Kundisyon sa Pagpaparehistro ng Mag-aaral'];
export const TERMS_INTRO = [
  'Please read these terms before you upload your Certificate of Registration (COR). By checking the box on the registration form you agree to them.',
  'Pakibasa ang mga tuntuning ito bago i-upload ang iyong Certificate of Registration (COR). Sa pag-check ng kahon sa form ng pagpaparehistro, sumasang-ayon ka sa mga ito.',
];

export const TERMS_SECTIONS = [
  {
    title: ['1. Agreement', '1. Kasunduan'],
    body: [
      ['These terms apply to students who register for the Syllabus Management System of the College of Information Technology and Engineering (the "College"). Your agreement, given by checking the box, is a valid electronic consent under the Electronic Commerce Act of 2000 (RA 8792) and is freely given, specific and informed as the Data Privacy Act of 2012 (RA 10173) requires.',
        'Saklaw ng mga tuntuning ito ang mga mag-aaral na nagpaparehistro sa Syllabus Management System ng College of Information Technology and Engineering (ang "Kolehiyo"). Ang iyong pagsang-ayon sa pag-check ng kahon ay isang balidong elektronikong pahintulot sa ilalim ng Electronic Commerce Act of 2000 (RA 8792), at malaya, tiyak at may sapat na kaalaman ayon sa hinihingi ng Data Privacy Act of 2012 (RA 10173).'],
    ],
  },
  {
    title: ['2. Who may register', '2. Sino ang maaaring magparehistro'],
    body: [
      ['Only students currently enrolled for the active school year in one of these programs of the College may register: Bachelor of Science in Information Technology (BSIT, including its specializations), Bachelor of Science in Computer Engineering (BSCPE) and Bachelor of Science in Industrial Engineering (BSIE). The COR you upload must be your own, genuine and current.',
        'Tanging mga mag-aaral na kasalukuyang naka-enroll sa aktibong taong-panuruan sa isa sa mga programang ito ng Kolehiyo ang maaaring magparehistro: Bachelor of Science in Information Technology (BSIT, kabilang ang mga espesyalisasyon nito), Bachelor of Science in Computer Engineering (BSCPE) at Bachelor of Science in Industrial Engineering (BSIE). Ang COR na iu-upload mo ay dapat sa iyo, tunay at kasalukuyan.'],
      ['Uploading another person\'s COR, or an altered or fake one, is not allowed. It may lead to the account being removed, to disciplinary action under the College\'s rules, and to liability under Philippine law, including the Cybercrime Prevention Act of 2012 (RA 10175) and the Revised Penal Code on falsification.',
        'Hindi pinapayagan ang pag-upload ng COR ng ibang tao, o ng binago o pekeng COR. Maaari itong magresulta sa pag-alis ng account, sa aksyong pandisiplina ayon sa mga patakaran ng Kolehiyo, at sa pananagutan sa ilalim ng batas ng Pilipinas, kabilang ang Cybercrime Prevention Act of 2012 (RA 10175) at ang Revised Penal Code tungkol sa falsification.'],
      ['If you are below 18 years old, register only with the knowledge and agreement of your parent or guardian.',
        'Kung ikaw ay wala pang 18 taong gulang, magparehistro lamang nang may kaalaman at pagsang-ayon ng iyong magulang o tagapag-alaga.'],
    ],
  },
  {
    title: ['3. Personal information we collect', '3. Personal na impormasyong kinokolekta'],
    body: [
      ['The photo of your COR.', 'Ang larawan ng iyong COR.'],
      ['From the COR: your student ID number, full name, program, year level, section, school year and term, and the codes and titles of your enrolled subjects. Your student ID becomes your username.',
        'Mula sa COR: ang iyong student ID number, buong pangalan, programa, year level, seksyon, taong-panuruan at termino, at ang mga code at pamagat ng mga asignaturang naka-enroll ka. Ang iyong student ID ang magiging username mo.'],
      ['The password you choose. It is stored only as a one-way hash; nobody, including the College, can read it.',
        'Ang password na pipiliin mo. Iniimbak lamang ito bilang one-way hash; walang sinuman, kabilang ang Kolehiyo, ang makakabasa nito.'],
      ['A record of your account activity (such as signing in and out, with the network address and browser used), kept for security.',
        'Talaan ng aktibidad ng iyong account (gaya ng pag-sign in at pag-sign out, kasama ang network address at browser na ginamit), na itinatago para sa seguridad.'],
    ],
  },
  {
    title: ['4. Why we use it', '4. Bakit namin ito ginagamit'],
    body: [
      ['Only to verify that you are enrolled in BSIT, BSCPE or BSIE for the active school year, to create your student account, to show you the approved syllabi and mark the subjects you are enrolled in, and to keep the system secure. The basis is your consent (Section 12(a) of RA 10173).',
        'Para lamang patunayan na ikaw ay naka-enroll sa BSIT, BSCPE o BSIE sa aktibong taong-panuruan, para likhain ang iyong student account, para ipakita sa iyo ang mga aprubadong syllabus at markahan ang mga asignaturang naka-enroll ka, at para panatilihing ligtas ang sistema. Ang batayan ay ang iyong pahintulot (Seksyon 12(a) ng RA 10173).'],
      ['Your information is not sold, not used for advertising, and not used for any other purpose without your further consent or a basis allowed by law.',
        'Hindi ipinagbibili ang iyong impormasyon, hindi ginagamit sa advertising, at hindi ginagamit sa ibang layunin nang walang karagdagang pahintulot mo o batayang pinahihintulutan ng batas.'],
    ],
  },
  {
    title: ['5. Reading your COR with AI', '5. Pagbasa ng iyong COR gamit ang AI'],
    body: [
      ['To read the details, your COR photo is sent to Claude, an artificial intelligence service of Anthropic, a company outside the Philippines. It is sent over an encrypted connection and used only to read your COR. Under the provider\'s commercial terms, the photo is not used to train its AI models.',
        'Para mabasa ang mga detalye, ipinapadala ang larawan ng iyong COR sa Claude, isang serbisyong artificial intelligence ng Anthropic, isang kumpanyang nasa labas ng Pilipinas. Ipinapadala ito sa isang naka-encrypt na koneksyon at ginagamit lamang para basahin ang iyong COR. Ayon sa commercial terms ng provider, hindi ginagamit ang larawan sa pagsasanay ng mga AI model nito.'],
      ['The College remains responsible for your information when it is processed by this provider (Section 21 of RA 10173). What the AI reads is shown to you before your account is created; you confirm it or take the photo again. If the COR cannot be read clearly, no account is created.',
        'Nananatiling responsable ang Kolehiyo sa iyong impormasyon habang pinoproseso ito ng provider na ito (Seksyon 21 ng RA 10173). Ipinapakita sa iyo ang nabasa ng AI bago likhain ang iyong account; kukumpirmahin mo ito o kukuha ka ulit ng larawan. Kung hindi malinaw na mabasa ang COR, walang account na lilikhain.'],
    ],
  },
  {
    title: ['6. How long we keep it', '6. Gaano katagal namin ito itinatago'],
    body: [
      ['The COR photo is kept privately on the College\'s server only while you register. It is deleted when your account is created, when the COR cannot be read clearly, or automatically within about one hour if you do not finish.',
        'Pribadong itinatago ang larawan ng COR sa server ng Kolehiyo habang nagpaparehistro ka lamang. Binubura ito kapag nalikha na ang iyong account, kapag hindi malinaw na mabasa ang COR, o awtomatiko sa loob ng humigit-kumulang isang oras kung hindi mo natapos.'],
      ['The details read from it and your account are kept while your account is active and as long as the College\'s records retention rules require, then deleted or anonymized. Other students cannot see them; only authorized College personnel who manage accounts can.',
        'Ang mga detalyeng nabasa mula rito at ang iyong account ay itinatago habang aktibo ang iyong account at hangga\'t hinihingi ng mga patakaran ng Kolehiyo sa pagtatago ng rekord, saka buburahin o gagawing anonymous. Hindi ito makikita ng ibang mag-aaral; tanging mga awtorisadong tauhan ng Kolehiyo na namamahala ng mga account ang makakakita.'],
    ],
  },
  {
    title: ['7. How we protect it', '7. Paano namin ito pinoprotektahan'],
    body: [
      ['The College applies organizational, physical and technical security measures as RA 10173 and its Implementing Rules require: private storage, hashed passwords, encrypted connections and access limited to authorized personnel. If a personal data breach occurs, the College will notify the National Privacy Commission and the affected students as the law requires.',
        'Nagpapatupad ang Kolehiyo ng mga pang-organisasyon, pisikal at teknikal na hakbang sa seguridad ayon sa hinihingi ng RA 10173 at ng Implementing Rules nito: pribadong imbakan, naka-hash na password, naka-encrypt na koneksyon at access na limitado sa mga awtorisadong tauhan. Kung magkaroon ng personal data breach, aabisuhan ng Kolehiyo ang National Privacy Commission at ang mga apektadong mag-aaral ayon sa hinihingi ng batas.'],
    ],
  },
  {
    title: ['8. Your rights as a data subject', '8. Ang iyong mga karapatan bilang data subject'],
    body: [
      ['Under RA 10173 you have the right to be informed, to object, to access your information, to have it corrected, to have it erased or blocked, to data portability, and to be indemnified for damages. You may also file a complaint with the National Privacy Commission (privacy.gov.ph).',
        'Sa ilalim ng RA 10173, may karapatan kang malaman, tumutol, ma-access ang iyong impormasyon, ipaitama ito, ipabura o ipa-block ito, sa data portability, at mabayaran sa pinsala. Maaari ka ring magsampa ng reklamo sa National Privacy Commission (privacy.gov.ph).'],
      ['You may withdraw your consent at any time. The account depends on the verified enrollment, so withdrawing means the account is closed and its information deleted, subject to the College\'s records retention rules. Withdrawal does not affect what was lawfully done before it.',
        'Maaari mong bawiin ang iyong pahintulot anumang oras. Nakasalalay ang account sa napatunayang enrollment, kaya ang pagbawi ay nangangahulugang isasara ang account at buburahin ang impormasyon nito, alinsunod sa mga patakaran ng Kolehiyo sa pagtatago ng rekord. Hindi naaapektuhan ng pagbawi ang mga nagawa nang naaayon sa batas bago ito.'],
    ],
  },
  {
    title: ['9. Using your account', '9. Paggamit ng iyong account'],
    body: [
      ['Keep your password secret and do not share your account. Student access is read-only: the approved syllabi are College documents for your own studies; do not alter, sell or publish them.',
        'Panatilihing lihim ang iyong password at huwag ibahagi ang iyong account. Read-only ang access ng mag-aaral: ang mga aprubadong syllabus ay mga dokumento ng Kolehiyo para sa iyong sariling pag-aaral; huwag itong baguhin, ibenta o ilathala.'],
    ],
  },
  {
    title: ['10. Changes and questions', '10. Mga pagbabago at katanungan'],
    body: [
      ['If these terms change, the new version is shown at registration with its date. For questions, or to exercise your rights, contact {dpo}. These terms are governed by the laws of the Republic of the Philippines.',
        'Kung magbago ang mga tuntuning ito, ipapakita ang bagong bersyon sa pagpaparehistro kasama ang petsa nito. Para sa mga katanungan, o para gamitin ang iyong mga karapatan, makipag-ugnayan sa {dpo}. Ang mga tuntuning ito ay sakop ng mga batas ng Republika ng Pilipinas.'],
    ],
  },
];

// The terms in one language: 'tl' gives Tagalog, anything else English. -> { title, intro, version, sections: [{ title, body: [text] }] }
export function termsIn(language) {
  const i = language === 'tl' ? 1 : 0;
  const fill = (text) => text.replace('{dpo}', dpo[i]);
  return {
    title: TERMS_TITLE[i],
    intro: TERMS_INTRO[i],
    version: TERMS_VERSION,
    sections: TERMS_SECTIONS.map((s) => ({ title: s.title[i], body: s.body.map((b) => fill(b[i])) })),
  };
}
