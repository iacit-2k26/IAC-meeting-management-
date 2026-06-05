import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { getDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";

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

    const { currentPassword, newPassword } = await request.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const db = await getDatabase();
    const usersCollection = db.collection("users");
    const user = await usersCollection.findOne({ _id: new ObjectId(payload.uid) });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Incorrect current password" }, { status: 401 });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await usersCollection.updateOne(
      { _id: new ObjectId(payload.uid) },
      { $set: { password: hashedNewPassword } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 });
  }
}
