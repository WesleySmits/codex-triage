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

The policy test uses these twelve cases. It has **zero false Archive classifications against these labels** (3 Archive, 3 Keep, 6 Review). This does not measure Jev classification quality. A real sample still needs owner-reviewed labels before any accuracy claim or threshold relaxation.

## Bounded v2 Jev comparison

A bounded local review first used the private v1 cache and the opening/latest Codex text. With owner permission, the same nine selected tasks were then tested against Jev v2. The table contains only abstracted evidence and advice; no task text, ID, or model input is committed. The case-to-task mapping and numeric signals remain in ignored local `.data/`. Labels are provisional agent judgments, **not owner-reviewed ground truth**. Old v1 advice shows where broad relevance kept finished runs open.

| Case | Abstracted evidence                                         | Old v1  | Initial v2 | After fix               | Provisional label |
| ---- | ----------------------------------------------------------- | ------- | ---------- | ----------------------- | ----------------- |
| S1   | Requested document was delivered                            | Archive | Review     | Review                  | Archive           |
| S2   | Recurring run finished and reported its result              | Archive | Archive    | Not retested            | Archive           |
| S3   | Daily run finished; a stock warning remains for future work | Keep    | Review     | Review                  | Archive           |
| S4   | Reminder was delivered; the external case remains open      | Keep    | Keep       | Review                  | Archive           |
| S5   | Scanner waits for the user's login handoff                  | Keep    | Keep       | Not retested            | Keep              |
| S6   | Requested background automation is still unconfigured       | Keep    | Keep       | Not retested            | Keep              |
| S7   | No opening or latest message was available                  | Review  | Keep       | Review by evidence gate | Review            |
| S8   | Another task also lacked usable messages                    | Review  | Review     | Not retested            | Review            |
| S9   | Publishing failed and the task is pinned                    | Keep    | Review     | Not retested            | Review            |

The first nine v2 calls had **0 false Archive suggestions against provisional labels** and four disagreements: S1 and S3 returned Review for provisional Archive, S4 returned Keep for provisional Archive, and S7 returned Keep for provisional Review. Three remaining authorized calls retested S1, S3, and S4 after clarifying that a delivered reminder or run result closes that request even if a separate case or warning remains. They returned Review, Review, and Review. No threshold was relaxed. S7 exposed a deterministic defect: a title without task messages was sent to Jev. The evidence gate now returns Review before any model call for that case, covered by a focused test. S8 also had no usable messages, so the same gate applies there.

These 12 calls are a small diagnostic sample, not a calibrated accuracy estimate. The prompt changed between the initial and retest calls, and only three cases were retested. The remaining Review outcomes for S1, S3, and S4 are conservative disagreements against labels that Wesley has not reviewed. Do not broaden Archive behavior or relax the thresholds from this sample.

## Cache compatibility

Version `codex-triage-v2` invalidates v1 judgments. The existing ignored `analysis-v1.json` file remains readable: v1 signals use `stillRelevant` and `outdated`, while v2 uses `obsolete`. Old entries appear as stale and are not cache hits. A new explicit analysis replaces an entry for the same task without migrating or discarding other entries.
