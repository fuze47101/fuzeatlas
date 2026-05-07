# Automated Ticket Triage & Fix Loop

Two-stage pipeline. Stage 1 lives in Atlas, Stage 2 lives in GitHub Actions.
This doc explains how the pieces fit so a future maintainer doesn't have to
reverse-engineer it from cron files.

## Stage 1 — Pull + summarize (Atlas, daily cron)

**Where:** `src/app/api/cron/feedback-digest/route.ts`
**Schedule:** Vercel cron `30 13 * * *` (06:30 MST). Registered in `vercel.json`.

What it does each morning:

- Reads every `FeedbackReport` whose `status` is `NEW`, `TRIAGED`, `ACCEPTED`,
  or `IN_PROGRESS`.
- Groups by status, decorates with reporter, age, portal, page URL.
- Emails Andrew (and andrew@fuze47.com) the digest with deep-links straight to
  each ticket in `/admin/feedback?focus=<id>`.
- If there are zero open tickets, the subject line is "Inbox zero" so Andrew
  doesn't have to open the email to know.

This is the human-in-the-loop half. No code changes happen from this cron.

## Stage 2 — Claude fixes tickets (GitHub Actions, optional)

The "Claude fixes them" loop runs OUTSIDE Atlas, because:

1. The Atlas server should never run unattended `git push` — wrong trust
   boundary, wrong infra, wrong code path.
2. Vercel's serverless runtime can't checkout, edit, commit, and PR a repo
   in 15-second function windows.
3. GitHub Actions has the right primitives: scheduled triggers, repo write
   access via `GITHUB_TOKEN`, and Anthropic's published `claude-code-action`.

### Recommended setup (claude-code-action on a schedule)

`.github/workflows/auto-triage.yml`:

```yaml
name: Daily ticket auto-triage
on:
  schedule:
    - cron: "0 14 * * *" # 07:00 MST, 30 min after the digest cron
  workflow_dispatch: {}

jobs:
  triage:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            You are running daily ticket triage for FUZE Atlas.

            1. Curl the open tickets:
               curl -H "Authorization: Bearer $CRON_SECRET" \
                 https://fuzeatlas.com/api/cron/feedback-digest > /tmp/tickets.json
               (the cron route happens to return the structured data alongside
               the email; alternatively call /api/admin/feedback with an admin
               session cookie — preferred)

            2. For each open ticket whose category is BROKEN_LINK, ERROR, or
               PROBLEM and whose description points at a specific file path or
               page, attempt a one-shot fix:
                 - Read the relevant file(s)
                 - Make the change
                 - Run `npm run lint && npx tsc --noEmit`
                 - Open a PR titled "fix: <ticket title> (#<id>)" with the
                   ticket description in the PR body

            3. Skip SUGGESTION / MISSING / CONFUSING — those need design
               judgment. Comment on those tickets via the API saying you saw
               them but punted to a human.

            4. Cap at 5 PRs per run. Quality > volume.

            Read CLAUDE.md before you start — it has critical brand voice
            rules and Next.js 15 gotchas.
        env:
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
```

Two GitHub secrets to add:
- `ANTHROPIC_API_KEY` — your Anthropic console API key.
- `CRON_SECRET` — the same one Vercel has, so the action can call our
  endpoints.

### Why claude-code-action vs the raw Agent SDK

| Dimension                | claude-code-action          | Self-hosted Agent SDK runner |
| ------------------------ | --------------------------- | ---------------------------- |
| Infra                    | None — GitHub-hosted runner | EC2/Render/Fly + cron daemon |
| Setup time               | ~10 min                     | ~half a day                  |
| Repo access              | Native via GITHUB_TOKEN     | Need to wire SSH keys        |
| PR-opening               | Built in                    | Build yourself               |
| Cost                     | Anthropic API + GH minutes  | Anthropic API + infra        |
| Iteration speed          | Edit yaml, push             | Redeploy runner              |

**Use claude-code-action.** The only reason to self-host is if FUZE has
audit/compliance requirements that ban code leaving Anthropic-issued
infrastructure — and we don't.

### What about Cowork (this session)?

Cowork is for interactive work — Andrew driving, Claude executing. The
unattended "fix tickets in your sleep" mode needs the GitHub Actions
setup above. Cowork could call `claude-code` locally to do a one-off
batch, but the schedule needs an external trigger.

## Sketching the failure modes

- **Resend hiccup at 13:30 UTC** → digest cron returns 500, error-fallback
  email fires from the catch block. Same pattern as `daily-digest`.
- **Claude opens a bad PR** → the PR sits there unmerged. No production risk
  because nothing auto-merges. Worst case is noise.
- **Claude stops mid-ticket and consumes API credits** → the action has its
  own usage cap; set `max_turns` if needed. Worst case is one wasted run.
- **Ticket tagged FIXED by Claude but not actually fixed** → the next
  digest will surface it again under whatever status the human re-opens it
  to. Human review on PRs catches most of this.

## Adding more crons

The pattern lives in `src/app/api/cron/feedback-digest/route.ts`:
1. Bearer auth via `CRON_SECRET`
2. Try/catch with fallback email on failure
3. Return JSON with the operation's outcome counts

Register in `vercel.json` and ensure the path starts with `/api/cron`
(middleware exempts that prefix).
