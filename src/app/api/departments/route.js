import { NextResponse } from "next/server";
import { createDepartment, listDepartments } from "@/lib/repository";

export async function GET() {
  const departments = await listDepartments();
  return NextResponse.json({ data: departments });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const department = await createDepartment(body);
    return NextResponse.json({ data: department }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unable to create department." }, { status: 400 });
  }
}
