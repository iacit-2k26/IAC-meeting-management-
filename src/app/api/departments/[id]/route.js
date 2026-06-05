import { NextResponse } from "next/server";
import { deleteDepartment, getDepartment, updateDepartment } from "@/lib/repository";

export async function GET(_, { params }) {
  const { id } = await params;
  const department = await getDepartment(id);

  if (!department) {
    return NextResponse.json({ error: "Department not found." }, { status: 404 });
  }

  return NextResponse.json({ data: department });
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const department = await updateDepartment(id, body);
    return NextResponse.json({ data: department });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unable to update department." }, { status: 400 });
  }
}

export async function DELETE(_, { params }) {
  try {
    const { id } = await params;
    await deleteDepartment(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unable to delete department." }, { status: 400 });
  }
}
