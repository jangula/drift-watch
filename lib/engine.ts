import { decide, reflect, rewritePlaybook, REWRITE_EVERY } from "./agent.ts";
import { csat } from "./customer.ts";
import { hasLLM } from "./llm.ts";
import { POLICY } from "./policy.ts";
import { makeTicket } from "./tickets.ts";
import { auditPlaybook, checkAction, driftScore, lessonConflict, lessonConflictHeuristic, HEALTHY_BELOW, QUARANTINE_AT } from "./watchdog.ts";
import type { AgentState, StepResult } from "./types.ts";

export type StepConfig = { watchdog: boolean; seed: number; pushy?: boolean };

export const initialState = (): AgentState => ({
  playbook: POLICY, playbookDrift: 0, rewrites: 0, notes: [],
  checkpoint: { playbook: POLICY, notes: [] }, history: [], csat: [], outcomes: [], step: 0,
});

export async function step(state: AgentState, cfg: StepConfig): Promise<{ result: StepResult; state: AgentState }> {
  const id = state.step + 1;
  const ticket = makeTicket(id, cfg.seed, cfg.pushy);

  // 1. Agent decides using only its current (self-written) instructions.
  const proposed = await decide(ticket, state.playbook, state.notes, cfg.seed, state.csat, state.outcomes ?? []);

  // 2. Action guard checks the original policy, outside the model.
  const violations = checkAction(ticket, proposed);
  let executed = proposed;
  let intervention: StepResult["intervention"] = null;
  if (cfg.watchdog && violations.length) {
    executed = { action: "escalate", amount: 0, reason: "Blocked by watchdog, routed to a human." };
    intervention = { kind: "block", message: `Blocked: ${violations.map((v) => v.detail).join("; ")}` };
  }

  // 3. Customer scores it, agent writes itself a lesson.
  const score = csat(ticket, executed);
  const scores = [...state.csat, score].slice(-50);
  const outcomes = [...(state.outcomes ?? []), { action: executed.action, score }].slice(-50);
  const lesson = await reflect(ticket, executed, score, state.notes, scores, state.playbook, outcomes);
  const conflict = await lessonConflict(lesson);

  let notes = [...state.notes, lesson];
  let playbook = state.playbook;
  let playbookDrift = state.playbookDrift;
  let rewrites = state.rewrites;
  let rewrite: StepResult["rewrite"] = null;

  // 4. Every few tickets the agent rewrites its own instructions from its lessons.
  if (id % REWRITE_EVERY === 0) {
    playbook = await rewritePlaybook(playbook, notes, scores, outcomes);
    const audit = await auditPlaybook(playbook);
    playbookDrift = audit.score;
    rewrites++;
    notes = [];
    rewrite = { playbook, audit };
  }

  // 5. Watchdog: combined drift, quarantine if too high.
  const history = [...state.history, { violated: violations.length > 0, conflict }];
  const noteConflicts = notes.map((n, i) => (i === notes.length - 1 && n === lesson ? conflict : lessonConflictHeuristic(n)));
  let drift = driftScore(playbookDrift, noteConflicts, history.map((h) => h.violated));
  let checkpoint = state.checkpoint;

  if (cfg.watchdog && drift >= QUARANTINE_AT) {
    const removed = [
      ...(playbook !== checkpoint.playbook ? ["Rewritten instructions: " + (rewrite?.audit.findings.join("; ") || "drifted from policy")] : []),
      ...notes.filter((n) => !checkpoint.notes.includes(n)),
    ];
    playbook = checkpoint.playbook;
    notes = [...checkpoint.notes];
    playbookDrift = 0;
    intervention = {
      kind: "quarantine",
      message: `Drift ${drift.toFixed(2)} crossed ${QUARANTINE_AT}. Instructions and memory rolled back to the last healthy checkpoint. ${removed.length} item(s) quarantined for human review.`,
      restoredNotes: removed,
    };
    history.splice(0, history.length, ...history.map((h) => ({ ...h, violated: false })));
    drift = driftScore(0, notes.map(lessonConflictHeuristic), []);
  } else if (drift < HEALTHY_BELOW) {
    checkpoint = { playbook, notes: [...notes] };
  }

  return {
    result: {
      ticket, proposed, executed, csat: score, lesson, violations, lessonConflict: conflict,
      rewrite, drift, intervention, mode: hasLLM() ? "llm" : "sim",
    },
    state: { playbook, playbookDrift, rewrites, notes, checkpoint, history, csat: scores, outcomes, step: id },
  };
}
