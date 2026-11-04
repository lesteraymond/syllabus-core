# Faculty adjudication package, Version 2

**Status: a draft for the developer's review, not yet sent. No faculty judgment is recorded in it, and nothing in it is approved by the institution.**

**Do not send this folder as a whole.** Each person receives only their own bundle:

| Folder | For | When |
|---|---|---|
| `1-part-a-for-reviewers/` | Case reviewers: the Part A guide, the references, and their own course folder | First |
| `2-part-b-for-reviewers/` | Case reviewers: the Part B guide and their own course folder | Only after the reviewer has returned Part A |
| `3-policy-panel/` | The policy panel and the approving offices | As the procedure in the folder sets out |
| `coordinator-restricted/` | The review coordinator only | Never sent |

Each distributed document is a Word form (.docx) to fill in and a PDF to print. The response sheets are CSV files.

## Rebuilding and checking
- `node scripts/export-align1-adjudication-v2.cjs` rebuilds the package (add `--pdf` to re-create the PDFs with Microsoft Word).
- `node scripts/verify-align1-adjudication-v2.cjs` checks it offline.

Version 1 is kept unchanged in `docs/faculty-review/align-1-dev-adjudication/`.
