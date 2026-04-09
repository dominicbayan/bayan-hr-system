import { NextResponse } from "next/server";

import { runSeed } from "@/lib/seed";

export async function GET() {
  try {
    const result = await runSeed();
    return NextResponse.json(result, { status: result.seeded ? 200 : 409 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to seed Firestore.";
    return NextResponse.json({ seeded: false, message }, { status: 500 });
  }
}
