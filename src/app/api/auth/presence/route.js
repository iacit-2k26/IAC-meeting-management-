import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { getDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function POST(request) {
  const token = request.cookies.get("auth_session")?.value;
  
  if (!token) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.json({ success: false, error: "Invalid session" }, { status: 401 });
  }

  try {
    const db = await getDatabase();
    await db.collection("users").updateOne(
      { _id: new ObjectId(payload.uid) },
      { 
        $set: { 
          lastSeen: new Date(),
          isOnline: true
        } 
      }
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update presence:", error);
    return NextResponse.json({ success: false, error: "Failed to update presence" }, { status: 500 });
  }
}
