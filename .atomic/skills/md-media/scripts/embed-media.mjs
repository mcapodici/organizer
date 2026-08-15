#!/usr/bin/env node
// Embed media inline in a tree of <area>/<slug>/finding.md files and deep-link
// the sibling INDEX.md. Idempotent: the embed lives between HTML markers and is
// rewritten (not duplicated) on every run.
//
//   node embed-media.mjs [rootDir]     # rootDir defaults to "audit"
//
// For each finding folder it appends an "## Evidence" section embedding every
// image (![]()) and clip (<video controls>), grouped Issue / Improved / Other
// by filename prefix. In <root>/INDEX.md it rewrites folder links `](x/y/)` to
// `](x/y/finding.md)`.

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.argv[2] ?? "audit";
const START = "<!-- media-embed:start -->";
const END = "<!-- media-embed:end -->";
const MEDIA_RE = /\.(png|jpe?g|gif|webp|svg|webm|mp4)$/i;
const VIDEO_RE = /\.(webm|mp4)$/i;
const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg)$/i;

function findingDirs(root) {
  const out = [];
  for (const area of readdirSync(root, { withFileTypes: true })) {
    if (!area.isDirectory()) continue;
    const areaPath = join(root, area.name);
    for (const d of readdirSync(areaPath, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const p = join(areaPath, d.name);
      if (existsSync(join(p, "finding.md"))) out.push(p);
    }
  }
  return out;
}

function bucket(name) {
  const n = name.toLowerCase();
  if (n.startsWith("improved")) return "Improved";
  if (n.startsWith("issue")) return "Issue";
  return "Other";
}

function embedBlock(files) {
  const groups = { Issue: [], Improved: [], Other: [] };
  for (const f of [...files].sort()) groups[bucket(f)].push(f);
  const lines = [START, "", "## Evidence", ""];
  for (const g of ["Issue", "Improved", "Other"]) {
    if (!groups[g].length) continue;
    lines.push(`### ${g}`, "");
    for (const f of groups[g]) {
      if (VIDEO_RE.test(f)) {
        lines.push(`<video controls preload="metadata" width="720" src="./${f}"></video>`, "");
      } else if (IMAGE_RE.test(f)) {
        lines.push(`![${f}](./${f})`, "");
      }
    }
  }
  lines.push(END, "");
  return lines.join("\n");
}

let embedded = 0;
let mediaCount = 0;
for (const dir of findingDirs(ROOT)) {
  const files = readdirSync(dir).filter((f) => MEDIA_RE.test(f));
  if (!files.length) continue;
  mediaCount += files.length;
  const mdPath = join(dir, "finding.md");
  let md = readFileSync(mdPath, "utf8");
  const s = md.indexOf(START);
  const e = md.indexOf(END);
  if (s !== -1 && e !== -1) {
    md = (md.slice(0, s) + md.slice(e + END.length)).replace(/\s+$/, "") + "\n";
  }
  md = md.replace(/\s+$/, "") + "\n\n" + embedBlock(files);
  writeFileSync(mdPath, md);
  embedded += 1;
}
console.log(`embedded media into ${embedded} finding.md file(s) (${mediaCount} media files)`);

const idxPath = join(ROOT, "INDEX.md");
if (existsSync(idxPath)) {
  let idx = readFileSync(idxPath, "utf8");
  const before = (idx.match(/\]\([^)]+\/\)/g) || []).length;
  idx = idx.replace(/\]\(([^)]+\/)\)/g, "]($1finding.md)");
  writeFileSync(idxPath, idx);
  console.log(`INDEX.md: rewrote ${before} folder link(s) to deep-link finding.md`);
} else {
  console.log(`INDEX.md: none at ${idxPath} (skipped)`);
}
