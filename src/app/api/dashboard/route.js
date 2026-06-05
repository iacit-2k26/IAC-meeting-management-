import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/repository";

export async function GET() {
  const dashboardData = await getDashboardData();
  return NextResponse.json({ data: dashboardData });
}
