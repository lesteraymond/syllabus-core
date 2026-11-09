# Historical reference impact

Existing records remain unchanged. These are review worksheets, not an executable crosswalk. Original PO numbers, text, versions and reports must retain their original meaning. Proposed number replacements remain null.

| Syllabus | Program | Review needed | Obsolete mappings | Proposed source version |
| --- | --- | --- | --- | --- |
| 43 | BSIT | PO mapping | [] | lcup-po-2026-10-29-BSIT |
| 93 | BSIT | PO mapping | [] | lcup-po-2026-10-29-BSIT |
| 97 | BSIE | PO mapping | [] | lcup-po-2026-10-29-BSIE |
| 99 | BSIT | PO mapping | [{"cloId":"bss99_team","po":10}] | lcup-po-2026-10-29-BSIT |
| 100 | BSIE | PO mapping | [] | lcup-po-2026-10-29-BSIE |
| 101 | BSIE | PO mapping | [] | lcup-po-2026-10-29-BSIE |
| 102 | BSIT | PO mapping | [] | lcup-po-2026-10-29-BSIT |
| 110 | BSIT-CYBERSECURITY | Curriculum selection | [] | BSIT curriculum reference selection |

The PO10 mapping on syllabus 99 is explicitly obsolete under the nine-PO master; no PO10→PO9 conversion is proposed. The Cyber draft with a previous/unknown curriculum selection requires review against an approved BSIT course/year. Full evidence and content hashes: [live-after.json](live-after.json).

During an authorized migration, only sidecar remediation entries are added. Neither syllabus JSON, approvals, historical versions, saved checking reports, catalog CLO tags, institution text nor curriculum rows are rewritten. `assertRecordReview` prevents a text-only PO replacement from pretending that faculty reviewed mappings. Curriculum-only remediation has a separate reference-review code.

A future reviewed faculty-adoption operation is still required to resolve remediation. No automatic queue-resolution writer or invented mapping equivalence is included. Historical Cyber curriculum records remain preserved and cease being an independent authoritative checking source through the controlled inheritance link.
