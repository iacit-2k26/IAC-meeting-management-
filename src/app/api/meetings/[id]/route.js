import { NextResponse } from "next/server";
import { deleteMeeting, getMeeting, updateMeeting } from "@/lib/repository";

export async function GET(_, { params }) {
  try {
    const { id } = await params;
    const meeting = await getMeeting(id);

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
    }

    return NextResponse.json({ data: meeting });
  } catch (error) {
    console.error(`Error in GET /api/meetings/${params?.id}:`, error);
    return NextResponse.json({ error: error.message || "Unable to get meeting." }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    console.log(`Updating meeting ${id} with payload:`, body);
    const meeting = await updateMeeting(id, body);
    console.log(`Meeting ${id} updated successfully:`, meeting);
    return NextResponse.json({ data: meeting });
  } catch (error) {
    console.error(`Error in PUT /api/meetings/${params?.id}:`, error);
    return NextResponse.json({ error: error.message || "Unable to update meeting." }, { status: 400 });
  }
}

export async function DELETE(_, { params }) {
  try {
    const { id } = await params;
    console.log(`Deleting meeting ${id}`);
    await deleteMeeting(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Error in DELETE /api/meetings/${params?.id}:`, error);
    return NextResponse.json({ error: error.message || "Unable to delete meeting." }, { status: 400 });
  }
}
