# Issue-driven agent pipeline

Turns GitHub issues into pull requests, with **you approving the plan before any code gets written**.

```
you label an issue          agent:queued
  → agent drafts a plan     agent:planning     → posts a plan comment
  → you review it           agent:needs-review → tick the box, or reply with feedback
  → agent implements        agent:approved / agent:implementing
  → PR opened               agent:done
                            agent:blocked      ← anything went wrong
```

Built on [sandcastle](https://github.com/mattpocock/sandcastle), which handles the worktree/branch lifecycle and agent invocation. The review gate and state machine are in this directory.

---

## One-time setup

You need `gh` authenticated (`gh auth status`), Node 24, and a Claude login. Everything else is already in `devDependencies`.

```bash
npm install
npm run agent:setup      # creates the seven agent:* labels on the repo
```

That's it for the default (host) sandbox — it reuses your existing Claude login. See [Docker](#switching-to-docker) if you want isolation.

## Running it

Run it from the **main checkout**, not from a worktree — sandcastle anchors its own worktrees at the working directory:

```bash
cd ~/source/organizer
npm run agent
```

It polls every 60 seconds and logs each transition. `Ctrl-C` finishes the current step and stops; press again to force quit. Nothing important is held in memory — the labels on the issue are the state, so killing it mid-run is safe (see [Crash recovery](#crash-recovery)).

Useful flags:

```bash
npm run agent -- --once           # one pass, then exit
npm run agent -- --issue 42       # only act on issue #42
npm run agent -- --once --issue 42
```

## Day-to-day use

**1. Ask for work.** Open a GitHub issue describing what you want, then add the `agent:queued` label. Be as vague as you like — the planner is instructed to guess rather than stall, and to tell you what it guessed.

> **Two locks, both required.** This repo is public, so the pipeline will only touch an issue that (a) carries an `agent:*` label — and only write/triage accounts can apply labels — **and** (b) was opened by an allowed author, which defaults to just the `gh` account you're authenticated as.
>
> The author check exists because the label alone makes *labelling* the whole security boundary: mislabel a stranger's issue and their text becomes the planner's instructions. With both locks, doing that by accident is inert — the run is skipped and logged. The active allowlist is printed at startup, and skipped issues are named in the log rather than silently ignored.
>
> To let a collaborator file work too: `AGENT_ISSUE_AUTHORS=mcapodici,someone-else`. Widen this deliberately — anyone on the list can put text in front of an agent that runs with permissions bypassed.

**2. Read the plan.** Within a poll or two, a comment appears with the summary, steps, files it expects to change, assumptions, **the choices it made on anything ambiguous**, a test plan, and risks.

**3. Approve or steer.**

- **Approve** — add the `agent:proceed` label to the issue. The orchestrator notices on its next poll, swaps it for `agent:approved`, and starts implementation. Deliberately a label rather than a checkbox: GitHub lets anyone with mere read access toggle a checkbox in a comment, but only accounts with Triage role or above can add or remove a label — so the trust boundary is enforced by GitHub itself, not by application code.
- **Steer** — just reply in a comment. Any comment you post after the newest plan triggers a revision, and a new plan comment appears (revisions are new comments, so the history stays readable). Repeat as many times as you like.

Only comments from accounts with write access (`OWNER`, `MEMBER`, `COLLABORATOR`) can steer — a stranger commenting on this public repo is logged and ignored.

**4. Implementation.** On approval the agent gets a fresh worktree branched from the latest `origin/main`, implements the approved plan, and must get `npm run check` green. If it fails, it gets up to two fix rounds. Only then does the branch get pushed and a PR opened against `main` with `Closes #<n>`.

If it can't get green, the issue goes to `agent:blocked` with the failure output in a comment and **no PR is opened**.

**5. Review and deploy.** Normal PR review. Deployment is deliberately not automated — run `npm run deploy:preview` yourself when you want to look at it.

## Recovering a blocked issue

Read the comment explaining what happened, then either take it over by hand, or remove `agent:blocked` and add `agent:queued` to start again from planning.

## Crash recovery

If the process dies mid-run, the issue is left in `agent:planning` or `agent:implementing`. On the next startup the orchestrator spots those, comments to say the run was interrupted, and resets the issue to its previous state so it gets retried. It never silently re-runs.

## Configuration

All optional, all environment variables:

| Variable | Default | What it does |
|---|---|---|
| `AGENT_SANDBOX` | `no-sandbox` | `no-sandbox` or `docker` |
| `AGENT_ISSUE_AUTHORS` | the authenticated `gh` user | Comma-separated logins whose issues may enter the pipeline |
| `AGENT_REPO_DIR` | `process.cwd()` | Repo the pipeline operates on |
| `AGENT_BASE_BRANCH` | `origin/main` | Ref every implementation branch forks from |
| `AGENT_POLL_SECONDS` | `60` | Seconds between polls |
| `AGENT_MODEL` | `claude-opus-5` | Passed to `claude --model` |
| `AGENT_PERMISSION_MODE` | `bypassPermissions` | Claude's `--permission-mode` |
| `AGENT_MAX_ITERATIONS` | `5` | Agent iterations per implementation run |
| `AGENT_MAX_FIX_ROUNDS` | `2` | Gate-fix attempts before blocking |

### About `AGENT_PERMISSION_MODE`

`noSandbox()` deliberately does **not** pass `--dangerously-skip-permissions` — sandcastle leaves permissions to the caller. An unattended run therefore needs an explicit mode or the agent blocks forever on its first prompt.

The default `bypassPermissions` matches what `scripts/watch-todo.sh` already does on this machine. Understand the trade: **on the host sandbox, an unattended agent with permissions bypassed can reach your whole filesystem**, not just the worktree — including `~/.claude`, `~/.ssh`, and your other repos. Set `AGENT_PERMISSION_MODE=auto` for AI-mediated per-tool approval, or use Docker.

### Switching to Docker

```bash
claude setup-token                        # mint a subscription-backed token
echo 'CLAUDE_CODE_OAUTH_TOKEN=...' > .sandcastle/.env
npx @ai-hero/sandcastle docker build-image
AGENT_SANDBOX=docker npm run agent
```

The agent then runs in a container with only the worktree bind-mounted. Two things to know:

- Every run pays `npm ci` over a macOS bind mount, and this repo's gate also runs a full VitePress + Vite build. Expect it to be several minutes slower per issue.
- Sandcastle's `docker()` provider has **no port-publishing option**, so a dev server inside the container isn't reachable from your browser. It doesn't affect the gate (`vitest` runs in jsdom, and the builds don't bind ports), but you can't watch the app live in a container run.

## The gate, and why lint isn't in it

Blocking: **`npm run check`** — `scripts/check.sh`, i.e. `vitest run --no-file-parallelism` → `tsc -b` → `vitepress build docs` → `vite build`. All four must pass before a PR is opened.

`npm run lint` is **not** a blocking gate, because it is already failing on `main` — around 21 pre-existing ESLint errors in `src/hooks/useTodoCounts.ts`, `vite.config.ts` and others. Requiring it to pass would block every run forever. Instead, ESLint runs against **only the files the branch changed** and the result is attached to the PR description and the issue comment as advisory. The prompts tell the agent not to go fixing the pre-existing errors, since that would blow well past the approved plan.

If you clean up the repo-wide lint later, move `npm run lint` into `GATE` in `implement.ts` and drop `lintChangedFiles()`.

## Files

| File | Role |
|---|---|
| `main.ts` | Poll loop, state machine, startup reconciliation, `--setup` |
| `config.ts` | Labels, markers, env-var config, sandbox and agent selection |
| `github.ts` | Every `gh` call. All GitHub I/O is host-side |
| `plan.ts` | Planner/reviser runs, plan rendering, approval detection |
| `plan.test.ts` | Unit tests for the pure predicates (runs in `npm run check`) |
| `implement.ts` | Implementation run, gate, fix rounds, push, PR |
| `prompts/*.md` | The four agent prompts |

Runtime artefacts land in `worktrees/`, `logs/` and `patches/` here, all gitignored.

## Two design notes worth knowing

**Agents never get GitHub credentials.** Every `gh` call happens on the host in `github.ts`; issue text and plans reach the agent through sandcastle's `promptArgs`. This also closes an injection hole: sandcastle expands `` !`cmd` `` blocks in prompt *files* by running them, but it marks the file's own blocks before substitution and strips that marker from injected values — so `` !`rm -rf ~` `` in an issue body is inert. Keep untrusted text in `promptArgs`; never concatenate it into a prompt file.

**Every checkbox in agent-written text is flattened to a bullet before posting.** Approval no longer runs through the plan comment at all — it's the `agent:proceed` label — but a plan is still free-form LLM output, and a stray `- [ ] ...` in it would otherwise render as a second, meaningless clickable box. `deCheckbox()` neutralises those. There are tests for exactly this in `plan.test.ts`.
