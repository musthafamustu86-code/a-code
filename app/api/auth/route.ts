import {
  ApiError,
  checkOrigin,
  database,
  failure,
  session,
} from "@/lib/server/supabase";
export async function GET() {
  try {
    const { name } = await session();
    return Response.json(
      { name },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(r: Request) {
  try {
    checkOrigin(r);
    const { email, password } = await r.json();
    if (
      typeof email !== "string" ||
      !email.includes("@") ||
      typeof password !== "string" ||
      !password ||
      password.length > 1024
    )
      throw new ApiError("Enter a valid email and password.");
    const db = await database();
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw new ApiError(error.message, error.status || 401);
    try {
      await session();
    } catch (e) {
      await db.auth.signOut({ scope: "local" });
      throw e;
    }
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(r: Request) {
  try {
    checkOrigin(r);
    const db = await database();
    const { error } = await db.auth.signOut({ scope: "local" });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
