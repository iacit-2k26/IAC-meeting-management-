import { NextResponse } from "next/server";
import { createEmployee, listEmployees } from "@/lib/repository";

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
