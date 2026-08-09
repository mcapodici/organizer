/**
 * checked-change — ralph with a deterministic repo-check gate.
 *
 * ralph's review loop is model-judged: a reviewer decides it ran the right
 * commands and that they passed. This workflow wraps it so the branch must also
 * survive real command execution — `npm run check` by default — with a bounded
 * repair loop that feeds actual stderr back to a fix stage and reruns.
 *
 * Graph (acyclic; each repair round mints new nodes):
 *   select-feature-branch (tool)
 *     -> workflow:ralph            implement + multi-model review loop
 *     -> check-1 (tool)            npm run check, real exit code
 *        [fail] -> repair-checks-1 (stage) -> check-2 (tool) -> ...
 *     -> require-clean-tree (tool)
 *     -> push-branch (tool) -> create-pr (tool)   [when create_pr]
 */
import { keepContext, workflow } from "@bastani/workflows";
import ralph from "@bastani/workflows/builtin/ralph";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type } from "typebox";

interface CommandResult {
  readonly argv: readonly string[];
  readonly exitCode: number;
  readonly output: string;
}

class CommandFailure extends Error {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;

  constructor(message: string, exitCode: number, output: string) {
    super(message);
    this.name = "CommandFailure";
    this.exitCode = exitCode;
    this.stdout = "";
    this.stderr = output;
  }
}

/** Run one command, streaming stdout+stderr into a single ordered buffer. */
async function runCommand(
  argv: readonly string[],
  cwd: string,
  signal?: AbortSignal,
): Promise<CommandResult> {
  return await new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(argv[0] as string, [...argv.slice(1)], {
      cwd,
      signal,
      env: { ...process.env, CI: "1", FORCE_COLOR: "0" },
    });
    let output = "";
    const append = (chunk: Buffer): void => {
      output += chunk.toString();
    };
    child.stdout?.on("data", append);
    child.stderr?.on("data", append);
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ argv, exitCode: code ?? 1, output });
    });
  });
}

/** Last `limit` characters, so a prompt carries the failure rather than the build log. */
function tail(text: string, limit = 6000): string {
  return text.length <= limit ? text : `…(truncated)…\n${text.slice(-limit)}`;
}

export default workflow({
  name: "checked-change",
  description:
    "Implement a change with ralph, then gate the branch on real repo checks (npm run check) with a bounded repair loop before pushing and opening a PR.",
  inputs: {
    prompt: Type.String({
      description: "Task, issue, or spec to implement. Leave PR creation out of this text.",
    }),
    branch: Type.String({ description: "Feature branch to create or reuse in the worktree." }),
    git_worktree_dir: Type.String({
      description: "Worktree path for this run, e.g. .worktrees/my-feature.",
    }),
    acceptance_criteria: Type.Optional(
      Type.String({ description: "Immutable contract. Defaults to prompt." }),
    ),
    base_branch: Type.String({
      description: "Base for the worktree, the review diff, and the PR.",
      default: "origin/main",
    }),
    pr_base: Type.String({ description: "Branch the PR targets.", default: "main" }),
    checks: Type.Array(Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }), {
      description: "Check commands run in order as a deterministic gate.",
      default: [["npm", "run", "check"]],
      minItems: 1,
    }),
    max_loops: Type.Number({ description: "Maximum ralph review iterations.", default: 6 }),
    max_check_repairs: Type.Number({
      description: "Maximum repair rounds after a failing check gate.",
      default: 3,
    }),
    create_pr: Type.Boolean({ description: "Push the branch and open a PR once green.", default: true }),
  },
  outputs: {
    result: Type.String(),
    checks_passed: Type.Boolean(),
    check_rounds: Type.Number(),
    branch: Type.String(),
    worktree: Type.String(),
    approved: Type.Boolean(),
    pr_url: Type.Optional(Type.String()),
    review_report_path: Type.Optional(Type.String()),
    check_log_path: Type.Optional(Type.String()),
  },
  worktreeFromInputs: { gitWorktreeDir: "git_worktree_dir", baseBranch: "base_branch" },
  run: async (ctx) => {
    const { prompt, branch, base_branch: baseBranch, checks, create_pr: createPr } = ctx.inputs;
    const cwd = ctx.cwd ?? ctx.inputs.git_worktree_dir;
    const criteria = ctx.inputs.acceptance_criteria ?? prompt;
    const maxRepairs = Math.max(0, Math.trunc(ctx.inputs.max_check_repairs));
    const logDir = join(tmpdir(), `checked-change-${ctx.runId ?? "run"}`);

    // 1. Put the worktree on the feature branch. Worktree binding leaves it detached.
    await ctx.tool("select-feature-branch", { branch, base: baseBranch }, async ({ signal }) => {
      const probe = await runCommand(
        ["git", "show-ref", "--verify", "--quiet", `refs/heads/${branch}`],
        cwd,
        signal,
      );
      const argv =
        probe.exitCode === 0
          ? ["git", "switch", branch]
          : ["git", "switch", "-c", branch, baseBranch];
      const switched = await runCommand(argv, cwd, signal);
      if (switched.exitCode !== 0) {
        throw new CommandFailure(`${argv.join(" ")} failed`, switched.exitCode, switched.output);
      }
      return branch;
    });

    // 2. Implementation + ralph's own multi-model review loop. No PR here.
    const implementation = await ctx.workflow(ralph, {
      inputs: {
        prompt,
        acceptance_criteria: criteria,
        max_loops: Math.trunc(ctx.inputs.max_loops),
        base_branch: baseBranch,
        git_worktree_dir: cwd,
        create_pr: false,
      },
      stageName: "implement and review",
    });
    const approved = implementation.outputs.approved === true;

    // 3. Deterministic gate. Each round is a distinct tool node, so the graph stays acyclic.
    let passed = false;
    let rounds = 0;
    let lastLogPath: string | undefined;

    for (let round = 1; round <= maxRepairs + 1; round += 1) {
      rounds = round;
      const logPath = join(logDir, `check-${round}.log`);

      const gate = await ctx.tool(
        `check-${round}`,
        { round, checks },
        async ({ signal }) => {
          await mkdir(logDir, { recursive: true });
          let log = "";
          for (const argv of checks) {
            const run = await runCommand(argv, cwd, signal);
            log += `$ ${argv.join(" ")}\n${run.output}\n`;
            if (run.exitCode !== 0) {
              await writeFile(logPath, log, "utf8");
              throw new CommandFailure(
                `${argv.join(" ")} exited ${run.exitCode}`,
                run.exitCode,
                log,
              );
            }
          }
          await writeFile(logPath, log, "utf8");
          return `all ${checks.length} check command(s) passed`;
        },
        { failureMode: "return" },
      );

      lastLogPath = logPath;
      if (gate.ok) {
        passed = true;
        break;
      }

      if (round === maxRepairs + 1) {
        throw new Error(
          `check gate still failing after ${maxRepairs} repair round(s): ${gate.error.message}. Log: ${logPath}`,
        );
      }

      await ctx.task(`repair-checks-${round}`, {
        context: "fork",
        reads: [logPath],
        prompt: [
          keepContext(
            [
              `Work only in the checkout at ${cwd}, on branch ${branch}. Do not create another worktree or clone.`,
              "Fix the failing checks. Do not change the feature's contract, relax assertions, delete tests, or skip check steps to make the command exit zero.",
              "Commit every change you make. Do not push and do not create a pull request.",
            ].join("\n"),
          ),
          "",
          `The repository check command failed with exit code ${gate.error.exitCode ?? "unknown"}:`,
          "",
          "```",
          tail(gate.error.stderr ?? gate.error.message),
          "```",
          "",
          `The full log is at ${logPath} — read it if the tail above is not enough.`,
          "Diagnose the real cause, fix it, rerun the failing command yourself to confirm, then commit.",
        ].join("\n"),
      });
    }

    // 4. Nothing may be left uncommitted, or the PR would not contain the fix.
    await ctx.tool("require-clean-tree", { branch }, async ({ signal }) => {
      const status = await runCommand(["git", "status", "--porcelain"], cwd, signal);
      if (status.output.trim() !== "") {
        throw new CommandFailure(
          `uncommitted changes remain in ${cwd}`,
          1,
          status.output,
        );
      }
      const head = await runCommand(["git", "rev-parse", "HEAD"], cwd, signal);
      return head.output.trim();
    });

    let prUrl: string | undefined;
    if (createPr) {
      await ctx.tool("push-branch", { branch }, async ({ signal }) => {
        const push = await runCommand(
          ["git", "push", "--set-upstream", "origin", branch],
          cwd,
          signal,
        );
        if (push.exitCode !== 0) {
          throw new CommandFailure("git push failed", push.exitCode, push.output);
        }
        return branch;
      });

      prUrl = await ctx.tool(
        "create-pr",
        { branch, base: ctx.inputs.pr_base },
        async ({ signal }) => {
          const created = await runCommand(
            [
              "gh",
              "pr",
              "create",
              "--base",
              ctx.inputs.pr_base,
              "--head",
              branch,
              "--fill",
            ],
            cwd,
            signal,
          );
          if (created.exitCode !== 0) {
            throw new CommandFailure("gh pr create failed", created.exitCode, created.output);
          }
          return created.output.trim().split("\n").at(-1) ?? "";
        },
      );
    }

    return {
      result: `${branch}: checks green after ${rounds} round(s)${prUrl ? `, PR ${prUrl}` : ""}`,
      checks_passed: passed,
      check_rounds: rounds,
      branch,
      worktree: cwd,
      approved,
      pr_url: prUrl,
      review_report_path: implementation.outputs.review_report_path,
      check_log_path: lastLogPath,
    };
  },
});
