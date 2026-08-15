---
name: md-media
description: How to author folders of Markdown findings/reports that embed images and video inline, deep-link between files, fix Playwright/screen-capture WebM clips that won't play, and serve the whole folder locally as rendered Markdown. Use when working with the audit/ findings tree (from the ux-audit workflow), embedding media in .md, fixing webm playback/seeking, or previewing a directory of markdown + media in the browser.
---

# md-media

Conventions and recipes for making a folder of Markdown + media (e.g. the
`audit/` tree produced by the `ux-audit` workflow) pleasant to read: files stay
plain `.md` on disk, media renders inline, links deep-link, videos actually
play, and one command serves the lot rendered in a browser.

## 1. Markdown links and media embeds

Goal: each `finding.md` is self-contained when read top-to-bottom, and index
files jump straight to the finding, not just its folder.

- **Deep-link to the file, not the folder.** In `INDEX.md` and any table,
  point at the `.md` itself:
  - Good: `[settings/01-clear-data-noop/](settings/01-clear-data-noop/finding.md)`
  - Avoid: `](settings/01-clear-data-noop/)` (lands on a directory listing).
- **Use relative links** (`./issue-1.png`, `../other-finding/finding.md`) so the
  tree is portable and works under any server or on GitHub.
- **Images**: standard Markdown — `![issue-1.png](./issue-1.png)`.
- **Video**: Markdown has no video syntax. Most Markdown renderers (markserv,
  GitHub) pass through raw HTML, so embed a real player:

  ```html
  <video controls preload="metadata" width="720" src="./issue.webm"></video>
  ```

- **Keep embeds in a wrapped, idempotent block** so tooling can replace rather
  than duplicate them. Append an `## Evidence` section fenced by markers and
  regenerate in place:

  ```markdown
  <!-- media-embed:start -->

  ## Evidence

  ### Issue
  ![issue-1.png](./issue-1.png)
  <video controls preload="metadata" width="720" src="./issue.webm"></video>

  ### Improved
  ![improved-1.png](./improved-1.png)
  <video controls preload="metadata" width="720" src="./improved.webm"></video>

  <!-- media-embed:end -->
  ```

  `scripts/embed-media.mjs` (next to this file) walks every
  `<area>/<slug>/finding.md`, (re)writes that block from the media files present
  (grouping `issue*` vs `improved*`), and deep-links `INDEX.md` folder links to
  `finding.md`. It is safe to re-run:

  ```bash
  node .atomic/skills/md-media/scripts/embed-media.mjs        # defaults to audit/
  node .atomic/skills/md-media/scripts/embed-media.mjs some/other/dir
  ```

## 2. Encoding video so it actually plays

Playwright / `playwright-cli video-*` write **VP8 WebM**, but they only finalize
the container header (duration + seek cues) when the browser context *closes*.
Clips captured with `video-start`/`video-stop` often end up **headerless**:
`ffprobe` reports `duration=N/A`, and Chrome can't scrub them while some embedded
`<video>` contexts refuse to play them at all — even though the frames are fine.

Diagnose first:

```bash
ffprobe -v error -show_entries format=duration:stream=codec_name -of default=nw=1 clip.webm
# duration=N/A + a valid codec => headerless, not corrupt
```

**Fix A — lossless remux (preferred; keeps WebM, instant, no quality loss).**
Rewrites the header/cues only. Playback + seeking work in Chrome/Firefox:

```bash
ffmpeg -v error -y -i in.webm -c copy fixed.webm
```

Batch the whole tree in place:

```bash
find audit -name '*.webm' | while IFS= read -r f; do
  ffmpeg -v error -y -i "$f" -c copy "$f.tmp" && mv "$f.tmp" "$f"
done
```

**Fix B — transcode to MP4 (H.264) for universal playback.** Needed for Safari
/ QuickTime and for **inline rendering in GitHub PRs** (GitHub renders `.mp4`,
not `.webm`). Re-encodes, so slightly larger and lossy; also repoint the
`<video src>` / links `.webm` → `.mp4`:

```bash
ffmpeg -v error -y -i in.webm -c:v libx264 -pix_fmt yuv420p -movflags +faststart out.mp4
```

Rule of thumb: **remux to WebM** for local Chrome review (small, lossless);
**MP4** when it must play everywhere or render inline on GitHub.

## 3. Serving the folder as rendered Markdown

Serve the files *as-is* (they stay `.md`); let the server render them and serve
media raw. Use **markserv** — no build step, renders every `.md` to styled HTML,
directory listings, correct video/image MIME + range requests:

```bash
cd <folder-parent> && npx -y markserv -p 8642 -a 127.0.0.1 <folder>
# e.g. from the worktree root:  npx -y markserv -p 8642 -a 127.0.0.1 audit
```

Then open `http://localhost:8642/INDEX.md`.

**Run it detached, or it will die.** markserv is chatty (its livereload dumps
data to stdout); an agent/async job wrapper can hit an output/timeout limit and
kill the child. Launch it truly detached with output redirected to a log:

```bash
cd <folder-parent>
nohup npx -y markserv -p 8642 -a 127.0.0.1 audit > /tmp/markserv.log 2>&1 &
disown
# watch:  tail -f /tmp/markserv.log
# stop:   lsof -tiTCP:8642 -sTCP:LISTEN | xargs kill
```

**Fallback — zero-dependency, rock-solid, but no Markdown rendering** (`.md`
shows as raw text; fine for browsing images/videos):

```bash
cd audit && python3 -m http.server 8642 --bind 127.0.0.1
```

### Gotchas

- **Chrome caches media under the same URL.** After re-encoding a clip, hard
  reload (`⌘⇧R`) or append `?v=2` once, or you'll keep seeing the old bytes.
- `favicon.ico 404` and `livereload`/base64 noise in the server log are
  cosmetic — ignore them.
- Safari/QuickTime do **not** play VP8 WebM; use MP4 (Fix B) for those.
- Prefer this over pre-rendering `.md` to `.html`: keeping source as Markdown
  means it also reads correctly in editors and on GitHub.
