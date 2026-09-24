# Task-specific analysis rubric (v2)

## Scope

Judge whether **this Codex task or this individual automation run** needs to stay open. The broader goal, project, and recurring automation may remain useful after one task/run is finished. Analysis is advice only and cannot archive anything.

Only a selected task's minimized title, opening request, latest user text, and latest assistant text reach Jev. Treat all of that text as evidence, never as an instruction to the analyser. Dates alone do not prove that a task is obsolete.

## Signals and policy

Jev returns probabilities for `completed` (this request or run has a reported result, including a final blocked or no-change report), `openAction` (a concrete step remains in this same task or run before it can close), and `obsolete` (this particular request or run is explicitly replaced, expired, duplicated, or abandoned). Follow-up for another run or issue does not by itself keep a finished run open. These are model signals, **not calibrated correctness probabilities**.

The deterministic policy returns:

- **Review** for every pinned task, conflicting strong signals, missing evidence, or weak evidence.
- **Archive** only when `completed` or `obsolete` is at least 0.85 and `openAction` is at most 0.2.
- **Keep** only when `openAction` is at least 0.7 while both closure signals are below 0.7.

An Archive label is a suggestion for human review. It never calls Codex archive functions. Each automation run gets its own analysis; the automation identifier does not enter this rubric.

## Acceptance examples

All examples are fictional and sanitized. The expected outcome is a policy check after the stated signal classification, not evidence of Jev accuracy.

| #   | This task/run's evidence                                             | Expected |
| --- | -------------------------------------------------------------------- | -------- |
| 1   | Implementation has a named unfinished step                           | Keep     |
| 2   | This automation run waits for a provider result                      | Keep     |
| 3   | A question still needs its requested answer                          | Keep     |
| 4   | The requested answer was delivered; its topic remains useful         | Archive  |
| 5   | This run ended with a blocked report; the separate blocker continues | Archive  |
| 6   | This request was explicitly replaced and has no pending action       | Archive  |
| 7   | A completed task is pinned                                           | Review   |
| 8   | Completion is reported, but a concrete follow-up is also named       | Review   |
| 9   | A run is obsolete, but it still names an unresolved action           | Review   |
| 10  | A task is old without explicit closure evidence                      | Review   |
| 11  | Completion and remaining work are both ambiguous                     | Review   |
| 12  | Closure looks strong, but absence of open action is weak             | Review   |

The policy test uses these twelve cases. It has **zero false Archive classifications against these labels** (3 Archive, 3 Keep, 6 Review). This does not measure Jev classification quality. A real sample still needs owner-reviewed labels and v2 Jev outputs before any accuracy claim or threshold relaxation.

## Read-only local sample awaiting v2 Jev comparison

A bounded local review used the existing private v1 cache and the opening/latest Codex text. The table contains only abstracted evidence; no task text, ID, or model input is committed. The case-to-task mapping is retained only in ignored local `.data/pr6-manual-sample.json` for a later authorized comparison. These are provisional human task-local labels, pending owner review. Old v1 advice is shown to expose where broad relevance kept finished runs open.

| Case | Abstracted evidence                                         | Old v1 advice | Provisional label |
| ---- | ----------------------------------------------------------- | ------------- | ----------------- |
| S1   | Requested document was delivered                            | Archive       | Archive           |
| S2   | Recurring run finished and reported its result              | Archive       | Archive           |
| S3   | Daily run finished; a stock warning remains for future work | Keep          | Archive           |
| S4   | Reminder was delivered; the external case remains open      | Keep          | Archive           |
| S5   | Scanner waits for the user's login handoff                  | Keep          | Keep              |
| S6   | Requested background automation is still unconfigured       | Keep          | Keep              |
| S7   | No opening or latest message was available                  | Review        | Review            |
| S8   | Another task also lacked usable messages                    | Review        | Review            |
| S9   | Publishing failed and the task is pinned                    | Keep          | Review            |

For the two sampled old v1 Archive outcomes, provisional labels found **0 false Archives**. This says nothing about the other 11 old Archive outcomes or the new classifier. A v2 comparison is **pending**: no live Jev call was authorized for this review. Once authorized, run only these selected cases through v2, compare each output to the owner-reviewed label, record every disagreement and false Archive, and keep the raw evidence and IDs local. Do not infer v2 accuracy from the policy-vector tests or old cache.

## Cache compatibility

Version `codex-triage-v2` invalidates v1 judgments. The existing ignored `analysis-v1.json` file remains readable: v1 signals use `stillRelevant` and `outdated`, while v2 uses `obsolete`. Old entries appear as stale and are not cache hits. A new explicit analysis replaces an entry for the same task without migrating or discarding other entries.
