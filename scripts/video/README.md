# Demo video

`record.cjs off|on 25` records a live run of the deployed app with Playwright and writes event
timestamps. `cards.cjs` renders the title and end cards. The final cut speeds up the runs,
adds cards and a macOS `say` voiceover, and comes out at about 82 s.

Run from a folder with `playwright` installed: `npm i playwright && node record.cjs off 25`.
