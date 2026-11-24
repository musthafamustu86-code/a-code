import {
  ApiError,
  checkOrigin,
  failure,
  session,
  supabase,
} from "@/lib/server/supabase";

const tables = new Set([
  "recognition_directory",
  "student_directory",
  "students",
  "classes",
  "leagues",
  "class_leagues",
  "academic_years",
  "enrolments",
  "league_assignments",
  "activities",
  "activity_classes",
  "activity_leagues",
  "activity_students",
  "pinned_forms",
  "attendance_sessions",
  "attendance_records",
  "attendance_remarks",
  "remark_history",
  "attendance_lifecycle",
  "star_transactions",
  "recognition_periods",
  "recognition_winners",
  "audit_logs",
  "institution_settings",
  "staff_profiles",
]);
export async function GET(request: Request) {
  try {
    const { token } = await session();
    const params = new URL(request.url).searchParams;
    if (params.get("rpc") === "overview")
      return Response.json(
        await supabase(
          "/rest/v1/rpc/overview",
          { method: "POST", body: "{}" },
          token,
        ),
      );
    if (params.get("rpc") === "reporting_summary") {
      const year = params.get("year");
      const start = params.get("start");
      const end = params.get("end");
      if (!year || !start || !end || start > end)
        throw new ApiError("Choose an academic year and a valid date range.");
      return Response.json(
        await supabase(
          "/rest/v1/rpc/reporting_summary",
          {
            method: "POST",
            body: JSON.stringify({ p_year: year, p_start: start, p_end: end }),
          },
          token,
        ),
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (params.get("rpc") === "individual_rankings")
      return Response.json(
        await supabase(
          "/rest/v1/rpc/individual_rankings",
          {
            method: "POST",
            body: JSON.stringify({
              p_year: params.get("year"),
              p_current_week: params.get("period") === "current-week",
              p_limit: params.get("period") === "current-week" ? 5 : 100,
              p_start: params.get("start"),
              p_end: params.get("end"),
              p_search: params.get("search") || "",
              p_offset: Math.max(0, Number(params.get("offset")) || 0),
              p_desc: params.get("direction") !== "asc",
              p_league: params.get("league"),
            }),
          },
          token,
        ),
      );
    if (params.get("rpc") === "attendance_search")
      return Response.json(
        await supabase(
          "/rest/v1/rpc/attendance_search",
          {
            method: "POST",
            body: JSON.stringify({ p: Object.fromEntries(params) }),
          },
          token,
        ),
      );
    if (params.get("rpc") === "star_trend")
      return Response.json(
        await supabase(
          "/rest/v1/rpc/star_trend",
          { method: "POST", body: "{}" },
          token,
        ),
      );
    const table = params.get("table") || "";
    if (!tables.has(table)) throw new ApiError("Unknown resource.");
    const query = new URLSearchParams({
      select: "*",
      limit: "100",
      offset: String(Math.max(0, Number(params.get("offset")) || 0)),
    });
    const sortable: Record<string, string> = {
      classes: "position.asc",
      activities: "name.asc",
      leagues: "name.asc",
      remark_history: "created_at.desc",
      attendance_lifecycle: "created_at.desc",
      recognition_periods: "start_date.asc",
      students: "full_name.asc",
      student_directory: "full_name.asc",
      recognition_directory: "created_at.desc",
      star_transactions: "created_at.desc",
      audit_logs: "created_at.desc",
      attendance_sessions: "submitted_at.desc",
      academic_years: "start_date.desc",
    };
    query.set(
      "order",
      sortable[table] ? sortable[table] + ",id.asc" : "id.asc",
    );
    for (const field of [
      "id",
      "student_id",
      "session_id",
      "period_id",
      "academic_year_id",
      "status",
      "activity_id",
      "staff_id",
      "league_id",
      "class_id",
      "category",
      "active",
    ]) {
      const value = params.get(field);
      if (value) query.set(field, `eq.${value}`);
    }
    const search = params.get("search");
    if (search && (table === "students" || table === "student_directory")) {
      const safe = search.replace(/[^\p{L}\p{N} \-]/gu, "").slice(0, 80);
      query.set(
        "or",
        `(full_name.ilike.*${safe}*,admission_number.ilike.*${safe}*)`,
      );
    }
    const dateField =
      table === "attendance_sessions"
        ? "attendance_date"
        : table === "star_transactions"
          ? "earned_on"
          : "created_at";
    if (params.get("start"))
      query.append(dateField, `gte.${params.get("start")}`);
    if (params.get("end"))
      query.append(
        dateField,
        `lte.${params.get("end")}${dateField !== "created_at" ? "" : "T23:59:59.999Z"}`,
      );
    return Response.json(
      await supabase(`/rest/v1/${table}?${query}`, {}, token),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { token } = await session();
    const body = await request.text();
    if (body.length > 2_000_000)
      throw new ApiError("Request is too large. Import smaller batches.", 413);
    const { action, payload } = JSON.parse(body);
    if (typeof action !== "string" || !payload || typeof payload !== "object")
      throw new ApiError("Invalid operation.");
    if (action === "league.classes") {
      const { academic_year_id, league_id, class_ids } = payload as Record<
        string,
        unknown
      >;
      if (
        typeof academic_year_id !== "string" ||
        typeof league_id !== "string" ||
        !Array.isArray(class_ids) ||
        class_ids.some((id) => typeof id !== "string")
      )
        throw new ApiError("Invalid league assignment.");
      return Response.json({
        result: await supabase(
          "/rest/v1/rpc/assign_league_classes",
          {
            method: "POST",
            body: JSON.stringify({
              p_year: academic_year_id,
              p_league: league_id,
              p_classes: class_ids,
            }),
          },
          token,
        ),
      });
    }
    if (action === "activity.targets") {
      const { activity_id, class_ids, league_ids, student_ids } =
        payload as Record<string, unknown>;
      const list = (value: unknown) =>
        Array.isArray(value) && value.every((id) => typeof id === "string");
      if (
        typeof activity_id !== "string" ||
        !list(class_ids) ||
        !list(league_ids) ||
        !list(student_ids)
      )
        throw new ApiError("Invalid attendance form assignment.");
      return Response.json({
        result: await supabase(
          "/rest/v1/rpc/assign_activity_targets",
          {
            method: "POST",
            body: JSON.stringify({
              p_activity: activity_id,
              p_classes: class_ids,
              p_leagues: league_ids,
              p_students: student_ids,
            }),
          },
          token,
        ),
      });
    }
    const result = await supabase(
      "/rest/v1/rpc/command",
      {
        method: "POST",
        body: JSON.stringify({ p_action: action, p: payload }),
      },
      token,
    );
    return Response.json({ result });
  } catch (error) {
    return failure(error);
  }
}
