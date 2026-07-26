The repo gate is failing on your work on branch `{{SOURCE_BRANCH}}` for issue #{{ISSUE_NUMBER}}.

## Command that failed

```
{{FAILED_COMMAND}}
```

## Output (tail)

```
{{FAILURE_OUTPUT}}
```

## Your job

Diagnose the real cause and fix it, then commit the fix.

Fix the underlying problem, not the symptom. Specifically, do **not**:

- delete, skip, or `.only`/`.skip` a failing test to make it pass
- weaken an assertion so it no longer checks the behaviour it was written for
- add `any`, `@ts-ignore`, or `eslint-disable` to silence an error you could actually fix
- edit `scripts/check.sh`, `eslint.config.js`, or the tsconfig files to lower the bar

If a test is failing because the test itself is wrong — it encodes behaviour the approved plan deliberately changed — then updating that test is the correct fix. Say so explicitly in your final message so a human can check that judgement.

Re-run the gate until it is green:

```
npm run check
```

Note: `npm run lint` is already failing on `main` for reasons unrelated to your change (~21 pre-existing errors). Do not try to fix those, and do not treat repo-wide lint as part of this gate — only `npm run check` must pass.

If you genuinely cannot get it green, stop and explain precisely what is failing, what you tried, and what you believe the cause is. A clear account of the blockage is far more useful than a green gate obtained by disabling a check.

When the gate passes and your fix is committed, emit `<promise>COMPLETE</promise>`.
