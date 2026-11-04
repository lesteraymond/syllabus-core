'use strict';
// resources-3 (kept by resources-4): the draft reviewer reads equipment, supplied data and conditions in context. Saved responses and synthetic drafts only: no network,
// provider key or ledger. These tests exercise a safeguard, not model or faculty accuracy.
const test = require('node:test');
const assert = require('node:assert/strict');
const gemini = require('./gemini');
const { reviewDraft } = require('./answerReview');
const { resourceNotes, RESOURCE_REVIEW_VERSION } = require('./recommendationReview');
const { answerOf } = require('./eval/answerReviews');
const dataset = require('./eval/stage-c-dataset.json');
const recovery = require('../../../docs/ai-eval-stage-e8-c-resource-recovery.json');
const C = { SYLLABUS_CHECK_STAGE_C1: 'on', SYLLABUS_CHECK_STAGE_C2: 'on' };
const pairOf = id => ({ ...dataset.items.find(p => p.id === id), path: 'eval', targetPath: 'eval' });
const sensors = pairOf('af-sensors-passive'), prog = pairOf('af-prog1-single-format');
const withSource = (pair, line) => ({ ...pair, source: `${pair.source}\n${line}` });
const show = ns => ns.map(n => `${n.advisory ? 'advisory' : 'hold'} ${n.code} [${n.evidence}]`);
const notes = (draft, pair = sensors) => show(resourceNotes(draft, pair));
const live = JSON.parse(recovery.requests.find(r => r.n === 25).content).judgements[0];

test('resources-3: the live E.8 Sensors draft is advisory: its bench test is conditional and its fallback uses faculty-provided data', () => {
  assert.equal(RESOURCE_REVIEW_VERSION, 'resources-4', 'resources-4 adds draft-side negation; the resources-3 behaviour pinned in this file is unchanged');
  assert.match(live.draft, /bench components and instrumentation if faculty-confirmed available; otherwise a paper-based design/);
  assert.deepEqual(show(reviewDraft(live, sensors, null, { pairs: [sensors] })), [
    'advisory conditional_resource [bench components]', 'advisory conditional_resource [instrumentation]', 'advisory proposed_resource [given or simulated measured values]']);
});

test('resources-3: replaying the recovery changes only the Sensors warnings; judgments, quotations and the withheld draft are unchanged', () => {
  const before = JSON.stringify(recovery), answers = {};
  for (const request of recovery.requests) {
    const raw = JSON.parse(request.content);
    if (!raw.judgements.length) continue; // request 22, the empty answer that request 23 corrected
    const pairs = raw.judgements.map(j => pairOf(j.id));
    for (const j of gemini.validate(raw, pairs, gemini.contractOf(C, dataset.courses[pairs[0].course]))) answers[j.id] = answerOf(j);
  }
  assert.deepEqual(Object.keys(answers).sort(), Object.keys(recovery.answers[0]).sort());
  for (const [id, saved] of Object.entries(recovery.answers[0])) {
    for (const key of ['label', 'explanation', 'sourceQuote', 'targetQuote', 'evidenceMatching', 'draft', 'recommendation', 'aspects']) assert.deepEqual(answers[id][key], saved[key], `${id}:${key}`);
    assert.deepEqual(answers[id].evidenceMatching, { source: 'exact', target: 'exact' }, id);
    if (id !== 'af-sensors-passive') for (const key of ['draftReview', 'draftWarnings', 'reviewEvidence']) assert.deepEqual(answers[id][key], saved[key], `${id}:${key}`);
  }
  assert.deepEqual(answers['af-prog1-single-format'].draftReview, ['assumes_resource', 'copies_other_relationship'], 'a correctly withheld draft stays withheld');
  assert.equal(answers['af-sensors-passive'].draftReview, undefined, 'a legitimate conditional proposal is not withheld');
  assert.deepEqual(answers['af-sensors-passive'].draftWarnings, ['conditional_resource', 'proposed_resource']);
  assert.equal(JSON.stringify(recovery), before);
});

test('resources-3 distinguishes supported, unsupported, conditional and faculty-provided resources and equipment-free alternatives', () => {
  const listed = withSource(sensors, 'Resources: Bench components, a dual-trace oscilloscope and a function generator are available for this lesson.');
  // 1. An existing resource supported by lesson evidence.
  assert.deepEqual(notes('Students build the inverting amplifier with the bench components and measure its gain with the oscilloscope.', listed), []);
  // 2. An unsupported claim that a resource already exists.
  for (const [draft, evidence] of [
    ['Students build and test the inverting amplifier using bench components and instrumentation.', ['bench components', 'instrumentation']],
    ['Students test the amplifier on the available bench equipment.', ['bench equipment']],
    ['Students measure the gain with test instruments in class.', ['test instruments']],
    ['Students power the circuit from a bench power supply and drive it with a signal generator.', ['bench power supply', 'signal generator']],
    ['Students analyse the provided simulated measurement data.', ['simulated measurement data']],
  ]) assert.deepEqual(notes(draft), evidence.map(e => `hold assumes_resource [${e}]`), draft);
  // 3. A conditional proposal: advisory, never a statement of availability.
  for (const [draft, evidence] of [
    ['Students test the amplifier using bench components and instrumentation if faculty-confirmed available.', ['bench components', 'instrumentation']],
    ['Students verify the gain with an oscilloscope (if available).', ['oscilloscope']],
    ['Subject to faculty confirmation, students measure the gain with bench instruments.', ['bench instruments']],
    ['If the faculty confirms that bench equipment is available, students test the amplifier with an oscilloscope and a function generator.', ['bench equipment', 'oscilloscope', 'function generator']],
    ['Where bench instruments are available, students measure the gain with an oscilloscope.', ['bench instruments', 'oscilloscope']],
    ['Students use breadboards, multimeters, and oscilloscopes if available.', ['breadboards', 'multimeters', 'oscilloscopes']],
  ]) assert.deepEqual(notes(draft), evidence.map(e => `advisory conditional_resource [${e}]`), draft);
  // 4. A faculty-created or faculty-provided resource: an advisory proposal.
  for (const [draft, evidence] of [
    ['Students analyse given measured values of the amplifier output and compare them with the design.', 'given measured values'],
    ['The instructor provides a set of measured values for students to analyse.', 'set of measured values'],
    ['The faculty prepares simulated measurement data that students analyse.', 'simulated measurement data'],
    ['Otherwise a paper-based design with analysis of given or simulated measured values.', 'given or simulated measured values'],
  ]) assert.deepEqual(notes(draft), [`advisory proposed_resource [${evidence}]`], draft);
  // 5. An alternative that needs no confirmed equipment.
  for (const draft of ['Students complete a paper-based design of the inverting amplifier and calculate the resistor values for the specified gain.',
    'Students calculate the closed-loop gain for several resistor pairs and justify their choice.']) assert.deepEqual(notes(draft), [], draft);
});

test('resources-3: explicit unavailability is never softened by a condition, a hedge or a list', () => {
  const none = withSource(sensors, 'Resources: No bench components or measurement instruments are available for this course.');
  assert.deepEqual(notes('Students test the amplifier using bench components and instrumentation if faculty-confirmed available.', none), ['hold assumes_resource [bench components]', 'hold assumes_resource [instrumentation]']);
  assert.deepEqual(notes('Students test the amplifier with test instruments if available.', none), ['hold assumes_resource [test instruments]'], 'a family statement covers its members');
  assert.deepEqual(notes('Use multimeters if available.', withSource(sensors, 'Resources: No bench components or digital multimeters are available.')), ['hold assumes_resource [multimeters]'], 'a negation covers its whole list');
  assert.deepEqual(notes('Use bench components if available.', withSource(sensors, 'Resources: Bench components and oscilloscopes are not available.')), ['hold assumes_resource [bench components]']);
  assert.deepEqual(notes('Students test the amplifier in the laboratory if faculty-confirmed available.', withSource(sensors, 'Facilities: No laboratory is available for this course.')), ['hold assumes_resource [laboratory]']);
  assert.deepEqual(notes('Students may consult worksheets.', withSource(prog, 'Resources: Worksheets are unavailable.')), ['hold assumes_resource [worksheets]'], 'a hedge does not soften explicit unavailability');
  assert.deepEqual(notes('Students may consult worksheets.', prog), ['advisory resource_needs_confirmation [worksheets]']);
  // A family statement can rule a member out, never in: here the oscilloscope itself is stated.
  assert.deepEqual(notes('Students measure the gain with the oscilloscope.', withSource(sensors, 'Resources: No bench components are available; an oscilloscope is available for demonstrations.')), []);
});

test('resources-3: a condition covers only the resources it governs, and conditional lesson evidence is not availability', () => {
  assert.deepEqual(notes('Students test the amplifier in the laboratory using bench components and instrumentation if faculty-confirmed available.'),
    ['hold assumes_resource [laboratory]', 'advisory conditional_resource [bench components]', 'advisory conditional_resource [instrumentation]'], 'a condition after a list belongs to that list');
  assert.deepEqual(notes('Use the laboratory, and oscilloscopes if available.'), ['hold assumes_resource [laboratory]', 'advisory conditional_resource [oscilloscopes]'], '", and" starts a new clause');
  assert.deepEqual(notes('Students use breadboards, oscilloscopes if available.'), ['hold assumes_resource [breadboards]', 'advisory conditional_resource [oscilloscopes]'], 'a bare comma is not a list');
  assert.deepEqual(notes('If an oscilloscope is available, use it, then use a multimeter.'), ['advisory conditional_resource [oscilloscope]', 'hold assumes_resource [multimeter]'], 'one conditional tool cannot establish another');
  assert.deepEqual(notes('Students measure the gain with an oscilloscope if they finish the design early.'), ['hold assumes_resource [oscilloscope]'], 'a condition about something else');
  assert.deepEqual(notes('Students verify the gain using the laboratory instrumentation if available.'), ['advisory conditional_resource [laboratory]', 'advisory conditional_resource [laboratory instrumentation]']);
  assert.deepEqual(notes('Students test the amplifier with bench instruments.', { ...sensors, target: 'Students test circuits with bench instruments if available.' }), ['hold assumes_resource [bench instruments]']);
});

test('resources-3 reads context, not a word list: the same nouns as a topic or a modifier are not resources', () => {
  for (const [draft, pair] of [
    ['Students design an instrumentation amplifier with a gain of 100 and calculate the resistor values.', sensors],
    ['The lecture explains instrumentation and measurement errors.', sensors],
    ['Lecture on instrumentation and measurement.', sensors],
    ['Students work with instrumentation concepts.', sensors],
    ['With the design complete, students discuss instrumentation.', sensors],
    ['Students explain how the power supply voltage limits the output swing.', sensors],
    ['Students design a DC power supply.', sensors],
    ['Students discuss why simulated and measured results can differ.', sensors],
    ['Students record the measured gain and compare it with the design values.', sensors],
    ['Students benchmark two versions of the program.', prog],
    ['Students take part in a simulated code review with classmates.', prog],
    ['Students perform with musical instruments.', prog],
  ]) assert.deepEqual(notes(draft, pair), [], draft);
  assert.deepEqual(notes('Students measure the gain using instrumentation.'), ['hold assumes_resource [instrumentation]'], 'the same noun as the means of the activity');
  assert.deepEqual(notes('Students measure the gain using instrumentation.', withSource(sensors, 'Equipment: Measurement instruments are available for this lesson.')), []);
  assert.deepEqual(notes('Students measure the gain using instrumentation.', withSource(sensors, 'Resources: Assessment instruments are provided.')), ['hold assumes_resource [instrumentation]'], 'assessment instruments are not equipment');
});

test('resources-3: data for analysis is a proposal, an ambiguity or an assumption according to how the draft introduces it', () => {
  assert.deepEqual(notes('Students analyse the given data set.'), ['advisory proposed_resource [given data]']);
  assert.deepEqual(notes('Students analyse simulated measured values of the amplifier gain.'), ['advisory resource_needs_confirmation [simulated measured values]']);
  assert.deepEqual(notes('Students use simulated data to check the design.'), ['hold assumes_resource [simulated data]']);
  assert.deepEqual(notes('Students analyse given measured values of the amplifier output.', { ...sensors, target: 'Students analyse given measured values of an amplifier.' }), [], 'the lesson already plans the data');
});

test('resources-4: draft negation covers the resource list it governs, in prefix and postfix form, for equipment and materials', () => {
  for (const [draft, pair] of [
    ['Do not use breadboards or oscilloscopes.', sensors],
    ['Students complete the analysis without breadboards, multimeters, or oscilloscopes.', sensors],
    ['Students complete the analysis without breadboards, multimeters and oscilloscopes.', sensors],
    ['Neither breadboards nor oscilloscopes are used in this lesson.', sensors],
    ['Instead of using an oscilloscope or a function generator, students calculate the gain on paper.', sensors],
    ['Avoid using bench components or instrumentation.', sensors],
    ['Students do not need breadboards, multimeters, or oscilloscopes for this task.', sensors],
    ['Breadboards and oscilloscopes are not needed.', sensors],
    ['Bench components, multimeters, and oscilloscopes are not used.', sensors],
    ['Without asking students to use breadboards or oscilloscopes, have them derive the gain equation.', sensors],
    ['Do not use syntax notes or starter files.', prog],
    ['Syntax notes and starter files are not provided.', prog],
    ['Students write the program without syntax notes, handouts, or starter code.', prog],
  ]) assert.deepEqual(notes(draft, pair), [], draft);
});

test('resources-4: double negatives and descriptive modifiers still require the resource', () => {
  for (const [draft, pair, expected] of [
    ['Students cannot complete the test without an oscilloscope.', sensors, ['hold assumes_resource [oscilloscope]']],
    ['Students cannot complete the test without breadboards or oscilloscopes.', sensors, ['hold assumes_resource [breadboards]', 'hold assumes_resource [oscilloscopes]']],
    ['Do not let students work without an oscilloscope.', sensors, ['hold assumes_resource [oscilloscope]']],
    ['Students cannot complete the exercise without syntax notes.', prog, ['hold assumes_resource [syntax notes]']],
    ['Students measure the gain with an oscilloscope not used before.', sensors, ['hold assumes_resource [oscilloscope]']],
  ]) assert.deepEqual(notes(draft, pair), expected, draft);
});

test('resources-4: negation scope does not cross clause boundaries, bare commas or positive resource dependencies', () => {
  for (const [draft, pair, expected] of [
    ['Do not use breadboards or oscilloscopes, but use a multimeter.', sensors, ['hold assumes_resource [multimeter]']],
    ['Do not use breadboards or oscilloscopes; students test the circuit with a multimeter.', sensors, ['hold assumes_resource [multimeter]']],
    ['Students work without breadboards and use an oscilloscope.', sensors, ['hold assumes_resource [oscilloscope]']],
    ['Breadboards and multimeters are not needed, but students use an oscilloscope.', sensors, ['hold assumes_resource [oscilloscope]']],
    ['Students use an oscilloscope without a function generator.', sensors, ['hold assumes_resource [oscilloscope]']],
    ['Students use an oscilloscope, not a multimeter.', sensors, ['hold assumes_resource [oscilloscope]']],
    ['Do not use breadboards, oscilloscopes.', sensors, ['hold assumes_resource [oscilloscopes]']],
    ['Do not use syntax notes, and use the supplied handout.', prog, ['hold assumes_resource [handout]']],
    ['Students do not use breadboards, and use multimeters if available.', sensors, ['advisory conditional_resource [multimeters]']],
  ]) assert.deepEqual(notes(draft, pair), expected, draft);
});

test('resources-4: cross-relationship contamination and all saved Stage C responses preserve academic judgments and withholding', () => {
  const sibling = { ...prog, id: 'sibling-lesson', target: 'Students use syntax notes and starter files that are available for this lesson.' };
  assert.deepEqual(
    show(reviewDraft({ draft: 'Do not use breadboards or oscilloscopes; use the syntax notes and starter files that are available for this lesson.' }, prog, null, { pairs: [prog, sibling] })),
    ['hold assumes_resource [syntax notes]', 'hold assumes_resource [starter files]', 'hold copies_other_relationship [syntax notes and starter files that are available for this lesson]'],
    'negating unrelated equipment does not excuse unsupported sibling resources or cross-relationship copying',
  );
  const files = ['canary-resume', 'r8-regression', 'r8-remaining', 'resource-recovery'].map(name => [name, require(`../../../docs/ai-eval-stage-e8-c-${name}.json`)]);
  let drafts = 0;
  const withheld = [];
  for (const [name, result] of files) {
    const before = JSON.stringify(result);
    for (const request of result.requests) {
      const raw = JSON.parse(request.content);
      if (!raw.judgements.length) continue;
      const pairs = raw.judgements.map(j => pairOf(j.id));
      for (const j of gemini.validate(raw, pairs, gemini.contractOf(C, dataset.courses[pairs[0].course]))) {
        const saved = result.answers[0][j.id], replayed = answerOf(j);
        for (const key of ['label', 'explanation', 'sourceQuote', 'targetQuote', 'evidenceMatching', 'draft', 'recommendation', 'aspects']) {
          assert.deepEqual(replayed[key], saved[key], `${name}:${j.id}:${key}`);
        }
        if (j.draft) drafts++;
        if (replayed.draftReview?.length) withheld.push(`${name}:${j.id}`);
      }
    }
    assert.equal(JSON.stringify(result), before, `${name} is not mutated`);
  }
  assert.equal(drafts, 18);
  assert.deepEqual(withheld, [
    'canary-resume:af-prog1-irrelevant', 'canary-resume:af-prog1-conceptual-lecture-ok', 'canary-resume:af-sensors-passive',
    'r8-regression:af-prog1-irrelevant', 'r8-regression:af-sensors-passive',
    'r8-remaining:af-prog1-passive', 'r8-remaining:af-prog1-single-format',
    'resource-recovery:af-prog1-single-format',
  ]);
});
