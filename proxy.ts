import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
export async function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname === "/brand/sincere-logo.jpeg"
  )
    return NextResponse.next();
  let response = NextResponse.next({ request });
  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: { httpOnly: true, sameSite: "lax" },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          for (const v of values) request.cookies.set(v.name, v.value);
          response = NextResponse.next({ request });
          for (const v of values)
            response.cookies.set(v.name, v.value, v.options);
        },
      },
    },
  );
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  const { data, error } = await db
    .from("staff_profiles")
    .select("id")
    .eq("id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (error)
    return new NextResponse(
      "Unable to verify academy membership. Please retry.",
      { status: 503 },
    );
  if (!data)
    return new NextResponse(
      "Active staff membership required. Contact the academy owner.",
      { status: 403 },
    );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: ["/", "/((?!api/|login|_next/|favicon.ico|icon.png).*)"],
};
