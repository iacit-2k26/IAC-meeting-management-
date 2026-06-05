import { NextResponse } from "next/server";
import { deleteMeeting, getMeeting, updateMeeting } from "@/lib/repository";

export async function GET(_, { params }) {
  const { id } = await params;
  const meeting = await getMeeting(id);

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  }

  return NextResponse.json({ data: meeting });
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const meeting = await updateMeeting(id, body);
    return NextResponse.json({ data: meeting });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unable to update meeting." }, { status: 400 });
  }
}

export async function DELETE(_, { params }) {
  try {
    const { id } = await params;
    await deleteMeeting(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unable to delete meeting." }, { status: 400 });
  }
}
