import { keepContext, workflow } from "@bastani/workflows";
import { Type } from "typebox";

/**
 * repo-review
 *
 * Read-only, multi-angle deep-dive review of this repository (a local-first
 * timeline/journal PWA: React 19 + Vite + TipTap + IndexedDB/OPFS, VitePress
 * docs, Vercel deploy).
 *
 * Fans out research across five clusters (grouped by the files each angle
 * touches, to avoid duplicated reads) covering 13 angles:
 *   A. Security, Privacy, Build/Deploy/Config
 *   B. Usability, Accessibility
 *   C. Data integrity & persistence, Error handling & resilience
 *   D. Performance, Architecture, Dead code, Type safety
 *   E. Testing & quality, Docs accuracy
 * Each branch writes a fragment artifact; a synthesis stage assembles one
 * combined deep-dive document at reviews/REVIEW.md.
 *
 * HARD CONSTRAINT: no code is changed. Branches only read + write their own
 * fragment; synthesis only writes reviews/REVIEW.md.
 */

const FRAG_DIR = "reviews/_fragments";

const FORMAT = keepContext(
  [
    "READ-ONLY REVIEW. DO NOT CHANGE ANY CODE. Do not edit, create, or delete",
    "any file except the single output fragment you are told to write.",
    "",
    "For EVERY finding use this exact deep-dive format:",
    "### [Severity: Critical|High|Medium|Low] <short title>",
    "- Evidence: `path/to/file:line` (quote the relevant snippet)",
    "- Why it matters: <impact>",
    "- Trade-offs / options: <2+ fix directions with pros/cons>",
    "- Suggested direction: <one recommendation>",
    "",
    "Actually open the files and cite real line numbers. For any dead-code or",
    "'unused' claim, show the search/grep that proves non-use before flagging.",
    "Add a brief 'Looks OK' subsection per angle for things checked and fine.",
    "Do NOT emit diffs or patches; describe fixes in prose only.",
    "End the fragment with a 'Top 3 priorities for this fragment' list.",
  ].join("\n"),
);

const REPO_CONTEXT = [
  "Repo: /Users/martincapodici/source/organizer",
  "A local-first timeline/journal PWA. Stack: React 19 + Vite + TipTap rich-text",
  "editor + IndexedDB (idb) and OPFS storage adapters + vite-plugin-pwa. Docs in",
  "VitePress. Deployed to Vercel. Tests: Vitest + Testing Library + fake-indexeddb.",
].join("\n");

interface Cluster {
  name: string;
  fragment: string;
  brief: string;
}

const CLUSTERS: Cluster[] = [
  {
    name: "A-security-privacy-config",
    fragment: `${FRAG_DIR}/A-security-privacy-config.md`,
    brief: [
      "Cover THREE angles, each its own top-level section:",
      "1) SECURITY — supply-chain/dependency risk (package.json, package-lock, run",
      "   `npm audit` if available), XSS via TipTap rich-text/HTML rendering (search",
      "   for dangerouslySetInnerHTML, editor getHTML output, link handling in",
      "   src/components/EntryComposer/linkExtension.ts and EntryCard), secrets",
      "   exposure (is .env.local committed / gitignored? what does it contain?),",
      "   untrusted parsing of imported JSON (src/utils/exportImport.ts), PWA/service",
      "   worker cache risks (vite.config.ts PWA config), CSP & security headers",
      "   (vercel.json).",
      "2) PRIVACY / DATA GOVERNANCE — @vercel/analytics vs the local-first privacy",
      "   promise: what data leaves the device, where analytics mounts, whether it's",
      "   disclosed in docs.",
      "3) BUILD, DEPLOY & CONFIG — Vite/PWA config correctness, vercel.json, the Node",
      "   22/24/26 version matrix (mise.toml, engines), scripts/check.sh & deploy",
      "   scripts, .gitignore/.vercelignore hygiene (are dist/, .pipeline.log,",
      "   .env.local tracked?).",
    ].join("\n"),
  },
  {
    name: "B-usability-a11y",
    fragment: `${FRAG_DIR}/B-usability-a11y.md`,
    brief: [
      "Focus files: everything under src/components/ (EntryCard, EntryComposer,",
      "SearchBox, Settings, TimelineList, TimelineView, Toast, TodoPage, UndoBar),",
      "src/App.tsx, and UI_STANDARDS.md. Cover TWO angles as separate sections:",
      "1) USABILITY / UX — user flows (create/edit entries, todos & due dates,",
      "   search, settings, undo, import/export), empty/loading/error states, mobile",
      "   behavior, consistency with UI_STANDARDS.md; note friction, confusing",
      "   affordances, missing feedback.",
      "2) ACCESSIBILITY (a11y) — semantic HTML, ARIA roles/labels, keyboard nav &",
      "   focus management (modals, undo bar, editor), focus traps, contrast vs",
      "   UI_STANDARDS.md tokens, screen-reader semantics, reduced-motion, alt text.",
    ].join("\n"),
  },
  {
    name: "C-data-error",
    fragment: `${FRAG_DIR}/C-data-error.md`,
    brief: [
      "Focus files: src/storage/ (interface.ts, idbAdapter.ts, opfsAdapter.ts,",
      "merge.ts and tests), src/utils/exportImport.ts, src/utils/todoUndo.ts,",
      "src/context/StorageContext.tsx, src/context/UndoContext.tsx, src/hooks/*.",
      "Cover TWO angles as separate sections:",
      "1) DATA INTEGRITY & PERSISTENCE — merge/conflict logic (correctness, edge",
      "   cases, last-write-wins pitfalls), schema versioning/migrations, import/",
      "   export round-trip fidelity, OPFS vs IDB parity, quota handling, corruption",
      "   scenarios, uuid ID generation, ordering/sorting stability.",
      "2) ERROR HANDLING & RESILIENCE — unhandled promise rejections, storage",
      "   failures & QuotaExceededError, corrupt/partial reads, transaction failures,",
      "   what surfaces to the user vs swallowed errors, retry/rollback.",
    ].join("\n"),
  },
  {
    name: "D-perf-arch-dead-types",
    fragment: `${FRAG_DIR}/D-perf-arch-dead-types.md`,
    brief: [
      "Scan the WHOLE src/ tree plus vite.config.ts, tsconfig*.json,",
      "eslint.config.js. Cover FOUR angles as separate sections:",
      "1) PERFORMANCE — bundle size & heavy deps (TipTap extensions, lucide),",
      "   timeline rendering at scale (is TimelineList/TimelineView virtualized?),",
      "   unnecessary re-renders (context value memoization, missing memo/useCallback),",
      "   IDB query patterns (loading all entries?), PWA cache strategy, attachments.",
      "2) ARCHITECTURE & MAINTAINABILITY — component/state boundaries, context",
      "   layering (StorageContext, UndoContext), storage adapter abstraction,",
      "   coupling, module structure, prop drilling, separation of concerns.",
      "3) DEAD CODE — unused exports, unreferenced files/components, unreachable",
      "   branches, stale scripts/, unused deps, commented-out blocks (prove non-use",
      "   with search).",
      "4) TYPE SAFETY — `any` usage, `as` casts, src/global.d.ts, src/types.ts,",
      "   adapter interface typing, tsconfig strictness flags, non-null assertions.",
    ].join("\n"),
  },
  {
    name: "E-testing-docs",
    fragment: `${FRAG_DIR}/E-testing-docs.md`,
    brief: [
      "Cover TWO angles as separate sections:",
      "1) TESTING & QUALITY — inventory *.test.ts/tsx, identify coverage gaps (which",
      "   components/hooks/utils have NO tests, e.g. SearchBox, Settings, TimelineList,",
      "   TimelineView, Toast, EntryComposer, hooks), brittle tests, the localStorage/",
      "   jsdom trap (src/test-setup.ts, test-setup.test.ts; read AGENTS.md 'The",
      "   localStorage trap'), absence of e2e/Playwright coverage (playwright is a",
      "   devDep — is it used?), flakiness risks, over-mocking.",
      "2) DOCS ACCURACY — does docs/ (index.md, guide/**, tutorials/**, use-cases/**)",
      "   match current src/ behavior? Check drift both ways, README.md and AGENTS.md",
      "   correctness. Do NOT review docs/blog/** (historical).",
    ].join("\n"),
  },
];

export default workflow({
  name: "repo-review",
  description:
    "Read-only multi-angle deep-dive review (13 angles) of this repo; fans out research and synthesizes one combined reviews/REVIEW.md. Changes no code.",
  autoAttach: true,
  inputs: {
    max_concurrency: Type.Number({
      description: "Max parallel research branches (1-5).",
      default: 5,
      minimum: 1,
      maximum: 5,
    }),
  },
  outputs: {
    review_path: Type.String({ description: "Path to the combined review document." }),
    fragment_count: Type.Number({ description: "Number of research fragments produced." }),
  },
  run: async (ctx) => {
    const concurrency = Math.max(
      1,
      Math.min(5, Number(ctx.inputs.max_concurrency ?? 5)),
    );

    const fragments = await ctx.parallel(
      CLUSTERS.map((cluster) => ({
        name: cluster.name,
        context: "fresh" as const,
        output: cluster.fragment,
        outputMode: "file-only" as const,
        prompt: [
          FORMAT,
          REPO_CONTEXT,
          "",
          `Write your findings to ${cluster.fragment} (this is the ONLY file you may write).`,
          "",
          cluster.brief,
        ].join("\n"),
      })),
      { concurrency },
    );

    const fragmentPaths = CLUSTERS.map((c) => c.fragment);
    const reviewPath = "reviews/REVIEW.md";

    const synthesis = await ctx.task("synthesis", {
      context: "fresh",
      reads: fragmentPaths,
      output: reviewPath,
      prompt: [
        keepContext(
          [
            "READ-ONLY. Do not change any source code. Your ONLY write is the",
            "combined review document; assemble it from the fragment files, do not",
            "re-investigate the codebase from scratch.",
          ].join("\n"),
        ),
        REPO_CONTEXT,
        "",
        "You are assembling a single combined deep-dive review document. The five",
        "research fragments are at these paths — read each one fully:",
        ...fragmentPaths.map((p) => `- ${p}`),
        "",
        "Produce ONE well-structured Markdown document with:",
        "1. A title and 1-paragraph scope note (what was reviewed, that no code was",
        "   changed, and the date).",
        "2. A short 'How to read this' note explaining the severity scale and the",
        "   per-finding format.",
        "3. An 'Executive summary' with a table of the highest-priority findings",
        "   across ALL angles (columns: Priority, Angle, Finding, Severity).",
        "4. One '## <Angle>' section for each of the 13 angles, IN THIS ORDER:",
        "   Security; Usability / UX; Dead code; Accessibility; Data integrity &",
        "   persistence; Performance; Testing & quality; Type safety; Error handling",
        "   & resilience; Architecture & maintainability; Docs accuracy; Build,",
        "   deploy & config; Privacy / data governance. Carry each finding through",
        "   verbatim in its deep-dive format (severity, evidence file:line, why it",
        "   matters, trade-offs/options, suggested direction). Preserve the 'Looks",
        "   OK' notes. Deduplicate findings that appear in more than one fragment,",
        "   keeping the fullest version and cross-referencing.",
        "5. A closing 'Suggested sequencing' section grouping fixes into waves",
        "   (quick wins, correctness/security must-fixes, larger refactors).",
        "",
        `Write the finished document to ${reviewPath}. This is a review only — do`,
        "NOT modify any source files.",
      ].join("\n"),
    });

    return {
      review_path: reviewPath,
      fragment_count: fragments.length,
    };
  },
});
