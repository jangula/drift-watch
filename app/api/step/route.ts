import { step, initialState, type StepConfig } from "@/lib/engine.ts";
import type { AgentState } from "@/lib/types.ts";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json()) as { state?: AgentState; config: StepConfig };
  try {
    const out = await step(body.state ?? initialState(), body.config);
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
