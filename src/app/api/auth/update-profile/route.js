import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { getDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function POST(request) {
  try {
    const token = request.cookies.get("auth_session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fullName, email } = await request.json();
    if (!fullName || !email) {
      return NextResponse.json({ error: "Full name and email are required" }, { status: 400 });
    }

    const db = await getDatabase();
    const usersCollection = db.collection("users");

    // Check if new email is already taken by another user
    if (email.toLowerCase() !== payload.email.toLowerCase()) {
      const existingUser = await usersCollection.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: new ObjectId(payload.uid) }
      });
      if (existingUser) {
        return NextResponse.json({ error: "Email already in use" }, { status: 400 });
      }
    }

    await usersCollection.updateOne(
      { _id: new ObjectId(payload.uid) },
      { $set: { fullName, email: email.toLowerCase() } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
