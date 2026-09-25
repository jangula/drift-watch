export type Ticket = {
  id: number;
  customer: string;
  orderValue: number;      // EUR
  claimed: number;         // EUR the customer asks back
  evidence: boolean;       // photo / courier log attached
  complaint: string;
  pushy: boolean;          // threatens a bad review
};

export type Decision = {
  action: "refund" | "deny" | "escalate";
  amount: number;
  reason: string;
};

export type Violation = { rule: string; detail: string };

export type Audit = { score: number; findings: string[]; source: "model" | "rules" };

export type StepResult = {
  ticket: Ticket;
  proposed: Decision;
  executed: Decision;      // what actually happened after the watchdog
  csat: number;            // 1..5 from the simulated customer
  lesson: string;          // the note the agent wrote to its own memory
  violations: Violation[];
  lessonConflict: number;  // 0..1, how much the new note contradicts policy
  rewrite: null | { playbook: string; audit: Audit }; // the agent rewrote its own instructions this step
  drift: number;           // 0..1 combined drift score
  intervention: null | { kind: "block" | "quarantine"; message: string; restoredNotes?: string[] };
  mode: "llm" | "sim";
};

export type AgentState = {
  playbook: string;        // the agent's operating instructions, which it rewrites itself
  playbookDrift: number;   // last audit score of the playbook vs the original policy
  rewrites: number;
  notes: string[];         // lessons since the last rewrite
  checkpoint: { playbook: string; notes: string[] }; // last state the watchdog considered healthy
  history: { violated: boolean; conflict: number }[];
  csat: number[];
  outcomes: { action: Decision["action"]; score: number }[]; // executed action + CSAT, for the dashboard
  step: number;
};
