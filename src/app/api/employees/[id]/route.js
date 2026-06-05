import { NextResponse } from "next/server";
import { deleteEmployee, getEmployee, updateEmployee } from "@/lib/repository";

export async function GET(_, { params }) {
  const { id } = await params;
  const employee = await getEmployee(id);

  if (!employee) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  return NextResponse.json({ data: employee });
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const employee = await updateEmployee(id, body);
    return NextResponse.json({ data: employee });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unable to update employee." }, { status: 400 });
  }
}

export async function DELETE(_, { params }) {
  try {
    const { id } = await params;
    await deleteEmployee(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unable to delete employee." }, { status: 400 });
  }
}
