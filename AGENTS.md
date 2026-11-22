# AGENTS.md

## Pull requests

- End PR bodies with `<Job> with <model> (<effort>) in <tool> via <host>.`
  Repeat `<job> with <model> (<effort>)` joined by `and` for each model that did a job.
  Example: `Implemented with Claude Opus 5.5 (xhigh) and reviewed with GPT-6 Pro (max) in Claude Code via T3 Code.`
  Effort is the run's reasoning setting. Read it for each model where the run reports it: the host's thread settings (T3 Code: `modelSelection`), launch flags, the environment (`$CLAUDE_EFFORT`), a subagent's definition or a delegate call. Humans are `Human`. Ask for other unknown values.
