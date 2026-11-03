import policy from '../data/academicPolicyV2.json' with {type:'json'};
export const isAcademicV2Preview = report => report?.evaluationPolicy?.id === policy.id && !!report.academic && !!report.compliance;
export const isAcademicV2 = isAcademicV2Preview;
export const integratedAcademicV2Of = report => report?.hybrid?.academicV2?.mode === 'live-application' ? report.hybrid.academicV2 : null;
export const isIntegratedAcademicV2 = report => !!integratedAcademicV2Of(report);
export const academicPolicyV2 = policy;
