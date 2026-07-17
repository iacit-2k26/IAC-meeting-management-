import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { verifyToken } from "@/lib/jwt";

import { sendAccountActivatedEmail } from "@/lib/mailer";

async function requireAuth(request) {
  const token = request.cookies.get("auth_session")?.value;
  if (!token) return null;
  return await verifyToken(token);
}

export async function PUT(request, { params }) {
  const payload = await requireAuth(request);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();
    const db = await getDatabase();
    const col = db.collection("users");

    const user = await col.findOne({ _id: new ObjectId(id) });
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

    const updates = {};
    if (body.fullName) updates.fullName = body.fullName;
    if (body.email) updates.email = body.email.toLowerCase();
    if (body.employeeId) updates.employeeId = body.employeeId;
    if (body.role) updates.role = body.role;
    if (body.status) updates.status = body.status;
    if (body.password) updates.password = await bcrypt.hash(body.password, 10);

    const oldStatus = user.status || "active";
    const newStatus = updates.status || oldStatus;

    await col.updateOne({ _id: new ObjectId(id) }, { $set: updates });

    // Send account activation email if status changes from pending to active
    if (oldStatus === "pending" && newStatus === "active") {
      try {
        await sendAccountActivatedEmail(user.email, user.fullName);
      } catch (mailErr) {
        console.error("Failed to send activation email:", mailErr);
      }
    }

    return NextResponse.json({ data: { uid: id, ...updates } });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to update user." }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  const payload = await requireAuth(request);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const db = await getDatabase();
    const result = await db.collection("users").deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) return NextResponse.json({ error: "User not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to delete user." }, { status: 400 });
  }
}
