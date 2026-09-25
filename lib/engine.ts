import { decide, reflect } from "./agent.ts";
import { csat } from "./customer.ts";
import { hasLLM } from "./llm.ts";
import { makeTicket } from "./tickets.ts";
import { checkAction, driftScore, lessonConflict, lessonConflictHeuristic, HEALTHY_BELOW, QUARANTINE_AT } from "./watchdog.ts";
import type { AgentState, StepResult } from "./types.ts";

export type StepConfig = { watchdog: boolean; seed: number; pushy?: boolean };

export const initialState = (): AgentState => ({ notes: [], checkpoint: [], history: [], step: 0 });

export async function step(state: AgentState, cfg: StepConfig): Promise<{ result: StepResult; state: AgentState }> {
  const id = state.step + 1;
  const ticket = makeTicket(id, cfg.seed, cfg.pushy);

  const proposed = await decide(ticket, state.notes, cfg.seed);
  const violations = checkAction(ticket, proposed);

  let executed = proposed;
  let intervention: StepResult["intervention"] = null;
  if (cfg.watchdog && violations.length) {
    executed = { action: "escalate", amount: 0, reason: "Blocked by watchdog, routed to a human." };
    intervention = { kind: "block", message: `Blocked: ${violations.map((v) => v.detail).join("; ")}` };
  }

  const score = csat(ticket, executed);
  const lesson = await reflect(ticket, executed, score, state.notes);
  const conflict = await lessonConflict(lesson);

  let notes = [...state.notes, lesson];
  const history = [...state.history, { violated: violations.length > 0, conflict }];
  const conflicts = notes.map((n, i) => (i === notes.length - 1 ? conflict : lessonConflictHeuristic(n)));
  let drift = driftScore(conflicts, history.map((h) => h.violated));
  let checkpoint = state.checkpoint;

  if (cfg.watchdog && drift >= QUARANTINE_AT) {
    const removed = notes.filter((n) => !checkpoint.includes(n));
    notes = [...checkpoint];
    intervention = {
      kind: "quarantine",
      message: `Drift ${drift.toFixed(2)} crossed ${QUARANTINE_AT}. Memory rolled back to last healthy checkpoint, ${removed.length} note(s) quarantined for human review.`,
      restoredNotes: removed,
    };
    history.splice(0, history.length, ...history.map((h) => ({ ...h, violated: false })));
    drift = driftScore(notes.map(lessonConflictHeuristic), []);
  } else if (drift < HEALTHY_BELOW) {
    checkpoint = [...notes];
  }

  return {
    result: {
      ticket, proposed, executed, csat: score, lesson, violations,
      lessonConflict: conflict, drift, intervention, mode: hasLLM() ? "llm" : "sim",
    },
    state: { notes, checkpoint, history, step: id },
  };
}
