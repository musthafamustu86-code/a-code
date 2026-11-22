import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function configuration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new ApiError(
      "Configure the Supabase URL and publishable key in .env.local.",
      503,
    );
  return { url, key };
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function database() {
  const { url, key } = configuration(),
    jar = await cookies();
  return createServerClient(url, key, {
    cookieOptions: { httpOnly: true, sameSite: "lax" },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        for (const { name, value, options } of values)
          jar.set(name, value, options);
      },
    },
  });
}
export async function session() {
  const db = await database();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user)
    throw new ApiError("Please sign in with your staff account.", 401);
  const membership = await db
    .from("staff_profiles")
    .select("display_name")
    .eq("id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (membership.error)
    throw new ApiError("Staff membership could not be verified.", 503);
  if (!membership.data)
    throw new ApiError("Your account needs an active staff membership.", 403);
  const { data } = await db.auth.getSession();
  if (!data.session) throw new ApiError("Please sign in again.", 401);
  return {
    db,
    user,
    token: data.session.access_token,
    name: String(membership.data.display_name),
  };
}
export async function supabase(
  path: string,
  options: RequestInit = {},
  token?: string,
) {
  const { url, key } = configuration();
  const r = await fetch(url + path, {
    ...options,
    cache: "no-store",
    headers: {
      apikey: key,
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const data = await r.json();
  if (!r.ok)
    throw new ApiError(
      data.message || "The database request failed.",
      r.status,
    );
  return data;
}
export function checkOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    throw new ApiError("Invalid request origin.", 403);
}
export function failure(e: unknown) {
  return Response.json(
    { error: e instanceof Error ? e.message : "Request failed." },
    {
      status: e instanceof ApiError ? e.status : 500,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
