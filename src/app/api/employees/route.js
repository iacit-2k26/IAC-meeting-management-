import { NextResponse } from "next/server";
import { createEmployee, listEmployees, deleteEmployees } from "@/lib/repository";

export async function GET() {
  const employees = await listEmployees();
  return NextResponse.json({ data: employees });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const employee = await createEmployee(body);
    return NextResponse.json({ data: employee }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unable to create employee." }, { status: 400 });
  }
}

export async function DELETE(request) {
  try {
    const body = await request.json();
    const { employeeIds } = body;
    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json({ error: "employeeIds must be a non-empty array." }, { status: 400 });
    }
    const result = await deleteEmployees(employeeIds);
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Bulk delete error:", error);
    return NextResponse.json({ error: error.message || "Unable to delete employees." }, { status: 400 });
  }
}
