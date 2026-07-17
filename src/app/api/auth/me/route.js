import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { getDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET(request) {
  const token = request.cookies.get("auth_session")?.value;
  
  if (!token) {
    return NextResponse.json({ user: null });
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.json({ user: null });
  }

  try {
    const db = await getDatabase();
    const user = await db.collection("users").findOne({ _id: new ObjectId(payload.uid) });

    if (!user || user.status === "pending") {
      return NextResponse.json({ user: null });
    }

    // Update lastSeen immediately on session check
    await db.collection("users").updateOne(
      { _id: user._id },
      { $set: { lastSeen: new Date(), isOnline: true } }
    );

    return NextResponse.json({ 
      user: {
        uid: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status || "active"
      }
    });
  } catch (error) {
    console.error("Session fetch error:", error);
    return NextResponse.json({ user: null });
  }
}
