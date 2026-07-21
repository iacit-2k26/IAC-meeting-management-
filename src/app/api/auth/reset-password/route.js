import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { sendPasswordResetEmail } from "@/lib/mailer";
import { ObjectId } from "mongodb";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

async function createResetToken(userId, email) {
  return await new SignJWT({ uid: userId, email, type: "password_reset" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

async function verifyResetToken(token) {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.type !== "password_reset") return null;
    return payload;
  } catch (error) {
    return null;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const db = await getDatabase();
    const user = await db.collection("users").findOne({ email: email.toLowerCase() });

    if (!user) {
      // Don't reveal that the email doesn't exist for security
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const originHeader = request.headers.get("origin");
    const hostHeader = request.headers.get("host");
    const protoHeader = request.headers.get("x-forwarded-proto") || "http";
    const appBaseUrl = (originHeader || (hostHeader ? `${protoHeader}://${hostHeader}` : null) || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");

    const resetToken = await createResetToken(user._id.toString(), user.email);
    const resetLink = `${appBaseUrl}/reset-password?token=${resetToken}`;

    await sendPasswordResetEmail(user.email, resetLink);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Password reset request error:", error);
    return NextResponse.json({ error: "Failed to process password reset request" }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const payload = await verifyResetToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid or expired token", code: "auth/reset-token-invalid" }, { status: 400 });
    }

    const db = await getDatabase();
    const user = await db.collection("users").findOne({ _id: new ObjectId(payload.uid) });
    
    if (!user) {
      return NextResponse.json({ error: "Invalid or expired token", code: "auth/reset-token-invalid" }, { status: 400 });
    }

    return NextResponse.json({ valid: true }, { status: 200 });
  } catch (error) {
    console.error("Token validation error:", error);
    return NextResponse.json({ error: "Invalid or expired token", code: "auth/reset-token-invalid" }, { status: 400 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters", code: "auth/weak-password" }, { status: 400 });
    }

    const payload = await verifyResetToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid or expired token", code: "auth/reset-token-invalid" }, { status: 400 });
    }

    const db = await getDatabase();
    const user = await db.collection("users").findOne({ _id: new ObjectId(payload.uid) });
    
    if (!user) {
      return NextResponse.json({ error: "Invalid or expired token", code: "auth/reset-token-invalid" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.collection("users").updateOne(
      { _id: user._id },
      { $set: { password: hashedPassword, updatedAt: new Date() } }
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
