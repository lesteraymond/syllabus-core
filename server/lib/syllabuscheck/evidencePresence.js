'use strict';
const {hasContent}=require('../../../shared/contentPresence.cjs');
// Factories add labels such as "Week 3 course content:". Those labels are
// context, never evidence that the underlying authored cell is populated.
function hasPairEvidence(pair,content){
 if(!hasContent(pair.source)||!hasContent(pair.target))return false;
 if(['Content-course','Course-CLO','Title-description','CLO-classification'].includes(pair.type)&&content.meta&&!hasContent(content.meta.title))return false;
 if(['Title-description','Description-plan'].includes(pair.type)&&content.description&&!content.description.some(p=>hasContent(p.t)))return false;
 const match=/^row(\d+)-/.exec(pair.id)||/^plan\[(\d+)\]/.exec(pair.path||'');
 const row=match&&content.plan?.[Number(match[1])];if(!row)return true;
 const dependencies={
  'Content-course':['contents'], 'Content-ILO':['contents'],
  'Content-activity':['contents','activities'], 'Content-assessment':['contents','tasks'],
  'Activity-assessment':['activities','tasks'], 'ILO-activity':['activities'],
  'ILO-content':['contents'], 'Module-value':['contents','values'],
  'Activity-fit':['contents','activities'], 'Value-use':['contents','values'],
  'Week1-introduction':['contents']
 }[pair.type]||[];
 return dependencies.every(field=>hasContent(row[field]));
}
module.exports={hasPairEvidence};
