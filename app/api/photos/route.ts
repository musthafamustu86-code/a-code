import {
  ApiError,
  checkOrigin,
  configuration,
  failure,
  session,
  supabase,
} from "@/lib/server/supabase";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { token } = await session();
    const config = configuration()!;
    const form = await request.formData();
    const file = form.get("file");
    const branding = form.get("branding") === "true";
    const studentId = String(form.get("student_id"));
    if ((!branding && !uuid.test(studentId)) || !(file instanceof File))
      throw new ApiError("A student and photo are required.");
    if (file.size > 5 * 1024 * 1024)
      throw new ApiError("Photos must be no larger than 5 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const ext =
      bytes[0] === 0xff && bytes[1] === 0xd8
        ? "jpg"
        : bytes[0] === 0x89 &&
            bytes[1] === 0x50 &&
            bytes[2] === 0x4e &&
            bytes[3] === 0x47
          ? "png"
          : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
              String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
            ? "webp"
            : null;
    if (!ext) throw new ApiError("Choose a valid JPEG, PNG, or WebP photo.");
    const students = branding
      ? []
      : await supabase(
          `/rest/v1/students?id=eq.${studentId}&select=id`,
          {},
          token,
        );
    if (!branding && !students.length)
      throw new ApiError("Student not found.", 404);
    const path = `${branding ? "branding" : studentId}/${crypto.randomUUID()}.${ext}`;
    const upload = await fetch(
      `${config.url}/storage/v1/object/student-photos/${path}`,
      {
        method: "POST",
        headers: {
          apikey: config.key,
          Authorization: `Bearer ${token}`,
          "Content-Type": ext === "jpg" ? "image/jpeg" : `image/${ext}`,
        },
        body: bytes,
      },
    );
    if (!upload.ok)
      throw new ApiError("Photo upload failed. Check storage permissions.");
    await supabase(
      "/rest/v1/rpc/command",
      {
        method: "POST",
        body: JSON.stringify({
          p_action: branding ? "branding.save" : "photo.save",
          p: { student_id: studentId, path },
        }),
      },
      token,
    );
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
export async function GET(request: Request) {
  try {
    const { token } = await session();
    const config = configuration()!;
    const params = new URL(request.url).searchParams;
    const branding = params.get("branding") === "true";
    const id = params.get("student_id") || "";
    if (!branding && !uuid.test(id)) throw new ApiError("Invalid student.");
    const rows = await supabase(
      branding
        ? "/rest/v1/institution_settings?id=eq.1&select=logo_path"
        : `/rest/v1/students?id=eq.${id}&select=photo_path`,
      {},
      token,
    );
    const path = branding ? rows[0]?.logo_path : rows[0]?.photo_path;
    if (!path) throw new ApiError("No photo.", 404);
    const response = await fetch(
      `${config.url}/storage/v1/object/authenticated/student-photos/${path}`,
      {
        headers: { apikey: config.key, Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );
    if (!response.ok) throw new ApiError("Photo not available.", 404);
    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
