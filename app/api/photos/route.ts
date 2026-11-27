import sharp from "sharp";
import {
  ApiError,
  checkOrigin,
  configuration,
  failure,
  session,
  supabase,
} from "@/lib/server/supabase";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const imageFormats = new Set(["jpeg", "png", "webp"]);
// Store a portrait at roughly three times the largest on-screen size instead of
// keeping a camera's full 4K frame, so pages do not download several megabytes
// per student while the photo still looks sharp when enlarged.
const MAX_EDGE = 1200;

// Normalise a student photo: fix EXIF rotation, crop to a formal 4:5 portrait,
// lift contrast and save at near-lossless quality with full chroma detail.
async function studentPhoto(bytes: Uint8Array) {
  const probe = await sharp(bytes, { failOn: "none" }).metadata();
  if (!probe.format || !imageFormats.has(probe.format))
    throw new ApiError("Choose a valid JPEG, PNG, or WebP photo.");
  let width = probe.width ?? 0;
  let height = probe.height ?? 0;
  if (!width || !height) throw new ApiError("That photo could not be read.");
  // Rotated phone photos report their stored orientation; swap the axes so the
  // crop is calculated against the upright picture.
  if (probe.orientation && probe.orientation >= 5)
    [width, height] = [height, width];
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));
  // 4:5 is the ratio used by the student ID card. Wider photos lose only side
  // margins; taller photos keep their full frame instead of being upscaled.
  if (width / height > 0.8) width = Math.round(height * 0.8);
  const data = await sharp(bytes, { failOn: "none" })
    .rotate()
    .resize({
      width,
      height,
      fit: "cover",
      position: "top",
      withoutEnlargement: true,
      kernel: "lanczos3",
    })
    .flatten({ background: "#ffffff" })
    .linear(1.06, -6)
    .sharpen({ sigma: 0.7 })
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toBuffer();
  return { data, ext: "jpg", type: "image/jpeg" };
}

// Institution logos keep their transparency and are never cropped.
async function logoImage(bytes: Uint8Array) {
  const probe = await sharp(bytes, { failOn: "none" }).metadata();
  if (!probe.format || !imageFormats.has(probe.format))
    throw new ApiError("Choose a valid JPEG, PNG, or WebP image.");
  const sourceWidth = probe.width ?? 1;
  const sourceHeight = probe.height ?? 1;
  const scale = Math.min(1, 1600 / Math.max(sourceWidth, sourceHeight));
  const base = sharp(bytes, { failOn: "none" })
    .rotate()
    .resize({
      width: Math.max(1, Math.round(sourceWidth * scale)),
      height: Math.max(1, Math.round(sourceHeight * scale)),
      fit: "inside",
      withoutEnlargement: true,
    });
  if (probe.hasAlpha)
    return {
      data: await base.png({ compressionLevel: 9 }).toBuffer(),
      ext: "png",
      type: "image/png",
    };
  return {
    data: await base
      .jpeg({ quality: 95, chromaSubsampling: "4:4:4", mozjpeg: true })
      .toBuffer(),
    ext: "jpg",
    type: "image/jpeg",
  };
}
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
    const image = branding ? await logoImage(bytes) : await studentPhoto(bytes);
    const students = branding
      ? []
      : await supabase(
          `/rest/v1/students?id=eq.${studentId}&select=id`,
          {},
          token,
        );
    if (!branding && !students.length)
      throw new ApiError("Student not found.", 404);
    const path = `${branding ? "branding" : studentId}/${crypto.randomUUID()}.${image.ext}`;
    const upload = await fetch(
      `${config.url}/storage/v1/object/student-photos/${path}`,
      {
        method: "POST",
        headers: {
          apikey: config.key,
          Authorization: `Bearer ${token}`,
          "Content-Type": image.type,
        },
        body: new Uint8Array(image.data),
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
