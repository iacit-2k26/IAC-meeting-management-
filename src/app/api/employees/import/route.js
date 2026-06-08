import { NextResponse } from "next/server";
import { createEmployee } from "@/lib/repository";

export async function POST(request) {
  try {
    const body = await request.json();
    const { employees } = body;

    if (!Array.isArray(employees) || employees.length === 0) {
      return NextResponse.json({ error: "No employee records provided." }, { status: 400 });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < employees.length; i++) {
      const row = employees[i];
      try {
        const employee = await createEmployee(row);
        results.push({ index: i, success: true, employee });
      } catch (err) {
        errors.push({ index: i, row, error: err.message });
      }
    }

    return NextResponse.json({
      data: {
        imported: results.length,
        failed: errors.length,
        errors,
        employees: results.map((r) => r.employee),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Import failed." }, { status: 400 });
  }
}
