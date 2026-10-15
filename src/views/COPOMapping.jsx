import StableButton from '../components/StableButton';
import { t as translateUI } from "../i18n/index.js";
import { useEffect, useState } from 'react';
import { MetricBox, PageHead } from '../components/ui';
import { mappingRows } from '../data/initialData';
import { curriculum as curriculumApi, mapping as mappingApi } from '../lib/api';

const CO_COUNT = 4;
const PO_COUNT = 12;

export default function COPOMapping({ notify }) {
  const [curricula, setCurricula] = useState([]);
  const [selectedCurriculum, setSelectedCurriculum] = useState(null);
  const [map, setMap] = useState(Array.from({ length: CO_COUNT }, () => Array(PO_COUNT).fill('')));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    curriculumApi.list().then(data => {
      setCurricula(data);
      if (data.length > 0) setSelectedCurriculum(data[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedCurriculum) return;
    setLoading(true);
    mappingApi.get(selectedCurriculum).then(data => {
      const m = Array.from({ length: CO_COUNT }, () => Array(PO_COUNT).fill(''));
      data.forEach(({ co_number, po_number, level }) => {
        if (co_number <= CO_COUNT && po_number <= PO_COUNT) m[co_number - 1][po_number - 1] = level;
      });
      setMap(m);
      setLoading(false);
    }).catch(() => { setLoading(false); });
  }, [selectedCurriculum]);

  const cycle = (r, c) => {
    const vals = ['', 'I', 'R', 'M'];
    const next = map.map(x => [...x]);
    next[r][c] = vals[(vals.indexOf(next[r][c]) + 1) % vals.length];
    setMap(next);
  };

  const saveMapping = async () => {
    if (!selectedCurriculum) return;
    const mappings = [];
    map.forEach((row, r) => row.forEach((v, c) => { if (v) mappings.push({ co: r + 1, po: c + 1, level: v }); }));
    try {
      await mappingApi.save(selectedCurriculum, mappings);
      notify(translateUI("ui.co_po_mapping_saved_7c94af"));
    } catch (err) { notify(translateUI("ui.save_failed_4322fa") + err.message); }
  };

  const filled = map.flat().filter(Boolean).length;
  const strength = Math.min(100, Math.round((filled / (CO_COUNT * PO_COUNT)) * 100));
  const mappedCOs = map.filter(row => row.some(Boolean)).length;
  const mappedPOs = new Set(map.flatMap((row, r) => row.map((v, c) => v ? c : null).filter(x => x !== null))).size;
  const masteryLinks = map.flat().filter(v => v === 'M').length;
  const unmappedPOs = PO_COUNT - mappedPOs;

  const current = curricula.find(c => c.id === selectedCurriculum);

  return (
    <>
      <PageHead title={translateUI("ui.co_po_mapping_434c47")} subtitle={translateUI("ui.map_course_outcomes_to_program_outcomes_and_visualize_curriculum__16709f")} actions={<><StableButton className="btn outline" onClick={() => notify(translateUI("ui.matrix_exported_demo_aaea21"))}>{translateUI("ui.export_matrix_953011")}</StableButton><StableButton className="btn primary" onClick={saveMapping}>{translateUI("ui.save_mapping_5d0c0d")}</StableButton></>} />
      <div className="mapping-meta">
        <span><small>{translateUI("ui.curriculum_233649")}</small><b><select value={selectedCurriculum || ''} onChange={e => setSelectedCurriculum(Number(e.target.value))}>{curricula.map(c => <option key={c.id} value={c.id}>{c.programName}{translateUI("ui.year_8cad48")}{c.yearLevel}, {c.semester}</option>)}</select></b></span>
        <div className="mapping-legend"><em className="m-i">I</em>{translateUI("ui.introduced_e5d3f0")}<em className="m-r">R</em>{translateUI("ui.reinforced_7b0381")}<em className="m-m">M</em>{translateUI("ui.mastered_62a415")}</div>
      </div>
      {loading ? <div className="empty">{translateUI("ui.loading_mapping_efff61")}</div> : (
        <div className="matrix-card"><div className="matrix-scroll"><table className="matrix"><thead><tr><th>{translateUI("ui.course_outcomes_a04e0d")}</th>{Array.from({ length: PO_COUNT }, (_, i) => <th key={i}>{translateUI("ui.po_eea0c0")}{i + 1}</th>)}</tr></thead><tbody>{mappingRows.slice(0, CO_COUNT).map((row, r) => <tr key={r}><td>{row}</td>{map[r].map((v, c) => <td key={c}><button title={translateUI("ui.click_to_cycle_i_r_m_ad4738")} className={v ? `map-cell ${v.toLowerCase()}` : 'map-cell'} onClick={() => cycle(r, c)}>{v || '·'}</button></td>)}</tr>)}</tbody></table></div><div className="matrix-footer"><div><span>{translateUI("ui.mapping_strength_4a945d")}</span><div className="bar"><i style={{ width: `${strength}%` }} /></div></div><strong>{strength}%</strong><p>{translateUI("ui.tip_click_any_matrix_cell_to_cycle_through_blank_i_r_m_613811")}</p></div></div>
      )}
      <div className="coverage-grid"><MetricBox label={translateUI("ui.outcomes_with_mapping_99fcee")} value={`${mappedCOs} / ${CO_COUNT}`} note={mappedCOs === CO_COUNT ? translateUI("ui.all_cos_mapped_73c13d") : translateUI("ui.some_cos_unmapped_feb38a")} /><MetricBox label={translateUI("ui.pos_addressed_23af2c")} value={`${mappedPOs} / ${PO_COUNT}`} note={translateUI("ui.curriculum_coverage_edfa22")} /><MetricBox label={translateUI("ui.mastery_links_ea0ce8")} value={String(masteryLinks)} note={translateUI("ui.mastered_relationships_0aa586")} /><MetricBox label={translateUI("ui.alignment_flags_e50d5b")} value={String(unmappedPOs > 3 ? 1 : 0)} note={unmappedPOs > 3 ? translateUI("ui.review_po_p0_po_p1_coverage_a41ae4", { p0: (mappedPOs + 1), p1: (PO_COUNT) }) : translateUI("ui.coverage_looks_good_91cfb8")} alert={unmappedPOs > 3} /></div>
    </>
  );
}
