import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import bcrypt from "bcryptjs";
import { createToken } from "@/lib/jwt";

export async function POST(request) {
  try {
    const data = await request.json();
    const { email, password, fullName, employeeId } = data;

    if (!email || !password || !fullName || !employeeId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = await getDatabase();
    const usersCollection = db.collection("users");

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json({ error: "Email already in use", code: "auth/email-already-in-use" }, { status: 400 });
    }

    // Check if employee ID exists
    const existingEmp = await usersCollection.findOne({ employeeId });
    if (existingEmp) {
      return NextResponse.json({ error: "Employee ID already in use", code: "auth/employee-id-already-in-use" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      fullName,
      email: email.toLowerCase(),
      employeeId,
      password: hashedPassword,
      role: "user",
      createdAt: new Date(),
    };

    const result = await usersCollection.insertOne(newUser);
    
    const user = {
      uid: result.insertedId.toString(),
      email: newUser.email,
      fullName: newUser.fullName,
      role: newUser.role,
    };

    // Auto-login after signup
    const token = await createToken({ uid: user.uid, email: user.email, role: user.role });
    const response = NextResponse.json({ user });
    
    response.cookies.set("auth_session", token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    return response;
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Signup failed" }, { status: 400 });
  }
}
