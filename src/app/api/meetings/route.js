import { NextResponse } from "next/server";
import { createMeeting, listMeetings } from "@/lib/repository";

export async function GET() {
  const meetings = await listMeetings();
  return NextResponse.json({ data: meetings });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const meeting = await createMeeting(body);
    return NextResponse.json({ data: meeting }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unable to create meeting." }, { status: 400 });
  }
}
