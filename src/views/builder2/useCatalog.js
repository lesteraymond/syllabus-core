import { useCallback, useEffect, useMemo, useState } from 'react';
import { outcomes, courses } from '../../lib/api';
import { createModel } from '../../lib/syllabusModel';
import { CURRENT_SCHOOL_YEAR } from '../../lib/schoolYear';

// Live drafts read only their selected subject's setup; locked syllabi keep their submitted snapshot.
export function useCatalog(programCode, { snapshot = null, live = false, courseId = null } = {}) {
  const [programList,setProgramList]=useState([]);
  const [subject,setSubject]=useState(null);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState('');
  const [version,setVersion]=useState(0);
  const refresh=useCallback(()=>setVersion(v=>v+1),[]);
  useEffect(()=>{
    let active=true;
    outcomes.programs().then(rows=>{if(active){setProgramList(rows);setLoaded(true);setError('');}}).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[version]);
  useEffect(()=>{
    if(!courseId || snapshot){setSubject(null);return;}
    let active=true;
    courses.get(courseId).then(row=>{if(active){setSubject(row);setError('');}}).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[courseId,version,snapshot]);
  useEffect(()=>{
    if(!live)return;
    const visible=()=>{if(document.visibilityState==='visible')refresh();};
    document.addEventListener('visibilitychange',visible);window.addEventListener('focus',visible);
    return()=>{document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',visible);};
  },[live,refresh]);
  const chosen=subject?.id===courseId ? subject : null;
  const model=useMemo(()=>{
    if(!loaded && !snapshot)return null;
    let institution={vision:'',mission:{lead:'',items:[]},egas:[]};
    const programs={};
    if(snapshot?.institution){institution=snapshot.institution;if(snapshot.program)programs[snapshot.program.code]=snapshot.program;}
    else if(chosen){
      institution={vision:chosen.standards.vision,mission:chosen.standards.mission,egas:chosen.standards.egas};
      const own={name:chosen.program.name,egas:chosen.standards.egas,pos:chosen.standards.pos};
      programs[chosen.program.code]=own;
      if(programCode)programs[programCode]=own;
    }
    return createModel({institution,programs,year:CURRENT_SCHOOL_YEAR.startYear});
  },[loaded,snapshot,chosen,programCode]);
  return {model,programList,resolvedProgramCode:chosen?.program.code,loading:!model&&!error,error,refresh,version};
}
