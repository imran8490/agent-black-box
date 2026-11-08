import { NextResponse } from "next/server";
import { cfg } from "@/lib/config";
import { runScenario } from "@/lib/run";
import type { ScenarioName } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!cfg().demoRunEnabled) {
    return NextResponse.json(
      { error: "Running scenarios from the UI is disabled. Set DEMO_RUN_ENABLED=true in .env.local." },
      { status: 403 },
    );
  }

  let body: { scenario?: string; guard?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.scenario !== "normal" && body.scenario !== "attack") {
    return NextResponse.json({ error: 'scenario must be "normal" or "attack".' }, { status: 400 });
  }

  try {
    const result = await runScenario(body.scenario as ScenarioName, {
      guard: body.guard !== false,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
