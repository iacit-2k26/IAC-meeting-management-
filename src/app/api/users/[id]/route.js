import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { verifyToken } from "@/lib/jwt";

import { sendAccountActivatedEmail } from "@/lib/mailer";

async function requireAdmin(request) {
  const token = request.cookies.get("auth_session")?.value;
  if (!token) return { error: "Unauthorized", status: 401 };
  const payload = await verifyToken(token);
  if (!payload) return { error: "Unauthorized", status: 401 };
  if (payload.role !== "admin") return { error: "Forbidden: Admin access required", status: 403 };
  return { payload };
}

export async function PUT(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

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
        const originHeader = request.headers.get("origin");
        const hostHeader = request.headers.get("host");
        const protoHeader = request.headers.get("x-forwarded-proto") || "http";
        const appBaseUrl = originHeader || (hostHeader ? `${protoHeader}://${hostHeader}` : null);

        await sendAccountActivatedEmail(user.email, user.fullName, appBaseUrl);
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
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

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
