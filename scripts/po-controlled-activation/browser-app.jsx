// Local test harness only: mounts existing product components with fixtures
// returned by the real service against the isolated synthetic database.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import InfoStep from '../../src/views/builder2/InfoStep';
import ClosStep from '../../src/views/builder2/ClosStep';
import ComplianceCard from '../../src/views/ComplianceCard';
import {createModel,applyCourse} from '../../src/lib/syllabusModel';
import {setLanguage} from '../../src/i18n';
const fixtures=await (await fetch('/fixtures.json')).json();
function App(){
 const [selected,setSelected]=useState(0),[draft,setDraft]=useState(fixtures[0].content),[lang,setLang]=useState('en'),[admin,setAdmin]=useState(false);
 const fixture=fixtures[selected],model=createModel({institution:fixture.content.outcomes,programs:{[fixture.code]:{name:fixture.name,pos:fixture.content.outcomes.pos,egas:fixture.content.outcomes.egas}},year:2026});
 const choose=code=>{const i=fixtures.findIndex(f=>f.code===code);setSelected(i);setDraft(applyCourse({...structuredClone(fixtures[i].content),meta:{...fixtures[i].content.meta,courseId:null}},fixtures[i].course));};
 const apply=fn=>setDraft(current=>fn(structuredClone(current)));
 return <><button data-testid="language" onClick={()=>{const next=lang==='en'?'tl':'en';setLanguage(next);setLang(next);}}>Language</button><button data-testid="role" onClick={()=>setAdmin(a=>!a)}>Review role</button>
 <div data-testid="selected-program">{draft.meta.program}</div>
 <InfoStep d={draft} model={model} apply={apply} programList={fixtures.map(f=>({code:f.code,name:f.name}))} courseList={[fixture.course]} onChooseProgram={choose} onChooseCourse={()=>choose(fixture.code)} />
 <ClosStep d={draft} model={model} apply={apply} />
 <ComplianceCard run={fixture.report} {...(!admin?{onApplyDraft:async()=>true}:{})} />
 </>;
}
createRoot(document.getElementById('root')).render(<App/>);
