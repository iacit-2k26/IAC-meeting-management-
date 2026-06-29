import { NextResponse } from "next/server";
import { createMeeting, listMeetings } from "@/lib/repository";

export async function GET() {
  try {
    const meetings = await listMeetings();
    return NextResponse.json({ data: meetings });
  } catch (error) {
    console.error("Error in GET /api/meetings:", error);
    return NextResponse.json({ error: error.message || "Unable to list meetings." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    console.log("Creating meeting with payload:", body);
    const meeting = await createMeeting(body);
    console.log("Meeting created successfully:", meeting);
    return NextResponse.json({ data: meeting }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/meetings:", error);
    return NextResponse.json({ error: error.message || "Unable to create meeting." }, { status: 400 });
  }
}
