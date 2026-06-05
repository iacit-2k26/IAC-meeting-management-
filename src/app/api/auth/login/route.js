import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import bcrypt from "bcryptjs";
import { createToken } from "@/lib/jwt";

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const db = await getDatabase();
    const user = await db.collection("users").findOne({ email: email.toLowerCase() });

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const userData = {
      uid: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };

    const token = await createToken({ uid: userData.uid, email: userData.email, role: userData.role });
    const response = NextResponse.json({ user: userData });
    
    response.cookies.set("auth_session", token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 401 });
  }
}
