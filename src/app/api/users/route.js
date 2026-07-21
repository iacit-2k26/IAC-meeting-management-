import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { verifyToken } from "@/lib/jwt";

async function requireAdmin(request) {
  const token = request.cookies.get("auth_session")?.value;
  if (!token) return { error: "Unauthorized", status: 401 };
  const payload = await verifyToken(token);
  if (!payload) return { error: "Unauthorized", status: 401 };
  if (payload.role !== "admin") return { error: "Forbidden: Admin access required", status: 403 };
  return { payload };
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = await getDatabase();
  const users = await db.collection("users").find({}).sort({ createdAt: -1 }).toArray();

  // Get all employees to map employeeId → departmentId → departmentName
  const employees = await db.collection("employees").find({}).toArray();
  const departments = await db.collection("departments").find({}).toArray();
  const deptMap = Object.fromEntries(departments.map((d) => [d.id, d.name]));
  const empMap = Object.fromEntries(employees.map((e) => [e.employeeId, deptMap[e.departmentId] || null]));

  const sanitized = users.map((u) => {
    const isOnline = u.lastSeen ? (new Date() - new Date(u.lastSeen)) < 75000 : false;
    return {
      uid: u._id.toString(),
      fullName: u.fullName,
      email: u.email,
      employeeId: u.employeeId,
      role: u.role || "user",
      status: u.status || "active",
      department: empMap[u.employeeId] || null,
      lastSeen: u.lastSeen || null,
      isOnline: isOnline,
      createdAt: u.createdAt,
    };
  });

  return NextResponse.json({ data: sanitized });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const { fullName, email, employeeId, password, role } = body;

    if (!fullName || !email || !employeeId || !password) {
      return NextResponse.json({ error: "fullName, email, employeeId and password are required." }, { status: 400 });
    }

    const db = await getDatabase();
    const col = db.collection("users");

    if (await col.findOne({ email: email.toLowerCase() })) {
      return NextResponse.json({ error: "Email already in use." }, { status: 400 });
    }
    if (await col.findOne({ employeeId })) {
      return NextResponse.json({ error: "Employee ID already in use." }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 10);
    const newUser = {
      fullName,
      email: email.toLowerCase(),
      employeeId,
      password: hashed,
      role: role || "user",
      createdAt: new Date(),
      isOnline: false,
      lastSeen: null,
    };

    const result = await col.insertOne(newUser);
    return NextResponse.json({
      data: { uid: result.insertedId.toString(), fullName, email: newUser.email, employeeId, role: newUser.role },
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to create user." }, { status: 400 });
  }
}
