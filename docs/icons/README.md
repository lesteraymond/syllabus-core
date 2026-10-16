# Dashboard icon sources

Original SVG files for the five custom dashboard icons. **The app does not read these files.** The live versions are drawn in
`src/components/customIcons.jsx` (fixed colors replaced with `currentColor`, fixed sizes removed, stroke weights matched), and
registered in the `ICONS` list in `src/components/ui.jsx`.

| File | Icon name in the code | Used for |
|---|---|---|
| `Program.svg` | `program` | Programs card |
| `Subject.svg` | `subject` | Subjects card |
| `UnderReview.svg` | `underReview` | Under Review card |
| `Approved.svg` | `approved` | Approved card |
| `Revise.svg` | `revise` | For Revision card |

To change an icon, edit its path in `customIcons.jsx` (replacing the file here changes nothing on screen).

These files came from SVG Repo (see the comment inside each file). Each icon there carries its own license, so check that it allows use
in this project.
