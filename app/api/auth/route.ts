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
  const isForm = r.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded") ?? false;
  try {
    checkOrigin(r);
    const fields = isForm ? Object.fromEntries(await r.formData()) : await r.json();
    const email = typeof fields?.email === "string" ? fields.email.trim() : "";
    const password = fields?.password;
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
    if (isForm) return Response.redirect(new URL("/dashboard", r.url), 303);
    return Response.json({ ok: true });
  } catch (e) {
    if (isForm) return Response.redirect(new URL("/login#signin-failed", r.url), 303);
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
