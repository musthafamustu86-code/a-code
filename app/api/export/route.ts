import { ApiError, failure, session, supabase } from "@/lib/server/supabase";
import { createPDF, type ReportSection } from "@/lib/server/pdf";
import { csvCell } from "@/lib/csv";
import type {
  AttendanceRecord,
  AttendanceSession,
  Named,
  Ranking,
  Student,
  Transaction,
} from "@/lib/types";
async function pages<T>(
  table: string,
  query: URLSearchParams,
  token: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    query.set("limit", "1000");
    query.set("offset", String(offset));
    const page = (await supabase(
      `/rest/v1/${table}?${query}`,
      {},
      token,
    )) as T[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}
function addDates(q: URLSearchParams, field: string, p: URLSearchParams) {
  for (const [name, op] of [
    ["start", "gte"],
    ["end", "lte"],
  ]) {
    const v = p.get(name);
    if (v) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v))
        throw new ApiError("Invalid report date.");
      q.append(field, `${op}.${v}`);
    }
  }
}
export async function GET(request: Request) {
  try {
    const { token } = await session();
    const p = new URL(request.url).searchParams;
    const type = p.get("type") || "transactions";
    const format = p.get("format") || "pdf";
    if (
      ![
        "student",
        "class",
        "league",
        "academic-year",
        "transactions",
        "attendance",
        "leaderboard",
      ].includes(type) ||
      !["pdf", "csv"].includes(format)
    )
      throw new ApiError("Unknown report type.");
    if (p.get("start") && p.get("end") && p.get("start")! > p.get("end")!)
      throw new ApiError("End date must be on or after start date.");
    const settings = await supabase(
      "/rest/v1/institution_settings?select=name&id=eq.1",
      {},
      token,
    );
    if (!settings.length) throw new ApiError("Staff membership required.", 403);
    const sections: ReportSection[] = [];
    let title = "Star transaction report";
    if (type === "leaderboard") {
      if (!p.get("league")) throw new ApiError("Select a league.");
      const start = p.get("start"),
        end = p.get("end");
      for (const value of [start, end])
        if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value))
          throw new ApiError("Invalid report date.");
      const [league] = (await supabase(
        `/rest/v1/leagues?select=name&id=eq.${p.get("league")}`,
        {},
        token,
      )) as Named[];
      if (!league) throw new ApiError("League not found.", 404);
      const rankings: Ranking[] = [];
      for (let offset = 0; ; offset += 100) {
        const page = (await supabase(
          "/rest/v1/rpc/individual_rankings",
          {
            method: "POST",
            body: JSON.stringify({
              p_year: p.get("year") || null,
              p_start: start || null,
              p_end: end || null,
              p_search: "",
              p_offset: offset,
              p_desc: true,
              p_limit: 100,
              p_current_week: false,
              p_league: p.get("league"),
            }),
          },
          token,
        )) as Ranking[];
        rankings.push(...page);
        if (page.length < 100) break;
      }
      const period =
        start && end
          ? `${start} to ${end}`
          : start
            ? `${start} to present`
            : end
              ? `Up to ${end}`
              : "All dates";
      const total = rankings.reduce((n, row) => n + Number(row.stars), 0);
      title = `Leaderboard report: ${league.name}`;
      sections.push({
        title: `${league.name} leaderboard`,
        subtitle: `Period: ${period}\nRanked by total stars`,
        headers: ["Period", "League", "Student", "ID code", "Total stars"],
        rows: rankings.map((row) => [
          period,
          league.name,
          row.full_name,
          row.admission_number,
          String(row.stars),
        ]),
        summary: `${rankings.length} students, ${total} stars in total`,
      });
    } else if (type === "attendance") {
      title = "Attendance report";
      const q = new URLSearchParams({
        select: "*",
        order: "attendance_date.asc",
        id: "not.is.null",
      });
      addDates(q, "attendance_date", p);
      if (p.get("year")) q.set("academic_year_id", `eq.${p.get("year")}`);
      if (p.get("activity")) q.set("activity_id", `eq.${p.get("activity")}`);
      if (p.get("status")) q.set("status", `eq.${p.get("status")}`);
      if (p.get("sessions")) {
        const ids = p.get("sessions")!.split(",");
        if (!ids.every((id) => /^[a-f0-9-]{36}$/i.test(id)))
          throw new ApiError("Invalid session selection.");
        q.set("id", `in.(${ids.join(",")})`);
      }
      const sessions: AttendanceSession[] = [];
      if (p.get("sessions"))
        sessions.push(
          ...(await pages<AttendanceSession>("attendance_sessions", q, token)),
        );
      else
        for (let offset = 0; ; offset += 100) {
          const page = (await supabase(
            "/rest/v1/rpc/attendance_search",
            {
              method: "POST",
              body: JSON.stringify({ p: { ...Object.fromEntries(p), offset } }),
            },
            token,
          )) as AttendanceSession[];
          sessions.push(...page);
          if (page.length < 100) break;
        }
      for (const s of sessions) {
        const [records, remarks] = await Promise.all([
          pages<AttendanceRecord>(
            "attendance_records",
            new URLSearchParams({
              select: "*",
              session_id: `eq.${s.id}`,
              order: "full_name.asc",
            }),
            token,
          ),
          supabase(
            `/rest/v1/attendance_remarks?session_id=eq.${s.id}&select=content`,
            {},
            token,
          ),
        ]);
        sections.push({
          title: `${s.activity_name} | ${s.attendance_date}${s.attendance_time ? ` ${s.attendance_time.slice(0, 5)}` : ""}`,
          subtitle: `Institution: ${s.institution_name}\nSession: ${s.attendance_date}${s.attendance_time ? ` at ${s.attendance_time.slice(0, 5)}` : ""}\nOriginal remarks: ${s.original_remarks || "None"}\nClasses: ${s.selected_classes.map((c) => c.name).join(", ")}\nSubmitted by ${s.staff_name} at ${s.submitted_at}\nStars awarded: ${s.stars_awarded === false ? "No" : "Yes"}\nEffective reward: ${s.reward_snapshot} stars per present student.\n${s.rewards_enabled == null ? "Original enable flag unavailable." : "Configured stars: " + s.configured_reward + " | Rewards " + (s.rewards_enabled ? "enabled" : "disabled")}\nCurrent audited remark: ${remarks[0]?.content || "None"}`,
          headers: ["Admission", "Student", "Class", "Status", "Stars"],
          rows: records.map((r) => [
            r.admission_number,
            r.full_name,
            r.class_name,
            r.present ? "Present" : "Absent",
            String(r.stars),
          ]),
          summary: `${records.length} students | ${records.filter((r) => r.present).length} present | ${records.filter((r) => !r.present).length} absent | ${records.reduce((n, r) => n + r.stars, 0)} stars`,
        });
      }
    } else {
      const q = new URLSearchParams({
        select: "*",
        order: "earned_on.asc,created_at.asc,id.asc",
      });
      addDates(q, "earned_on", p);
      if (p.get("year")) q.set("academic_year_id", `eq.${p.get("year")}`);
      let student: Student | undefined;
      if (type === "student") {
        if (!p.get("student") && !p.get("admission"))
          throw new ApiError("Enter a student admission number.");
        const sQuery = new URLSearchParams({
          select: "*",
          ...(p.get("student")
            ? { id: `eq.${p.get("student")}` }
            : { admission_number: `eq.${p.get("admission")}` }),
        });
        const list = await supabase(`/rest/v1/students?${sQuery}`, {}, token);
        student = list[0];
        if (!student) throw new ApiError("Student not found.", 404);
        q.set("student_id", `eq.${student.id}`);
        title = `Student star history: ${student.full_name}`;
      }
      if (type === "league") {
        if (!p.get("league")) throw new ApiError("Select a league.");
        q.set("league_id", `eq.${p.get("league")}`);
        title = "League star report";
      }
      if (type === "class") {
        if (!p.get("class")) throw new ApiError("Select a class.");
        q.set("class_id", `eq.${p.get("class")}`);
        title = "Class star report";
      }
      if (type === "academic-year") {
        if (!p.get("year")) throw new ApiError("Select an academic year.");
        title = "Academic-year star report";
      }
      const rows = await pages<Transaction>("star_transactions", q, token);
      const leagues = await pages<Named>(
        "leagues",
        new URLSearchParams({ select: "*" }),
        token,
      );
      let subtitle = `Period: ${p.get("start") || "All recorded dates"} to ${p.get("end") || "present"}\nHistorical classes and leagues are taken from each transaction.`;
      if (student) {
        const active = await supabase(
          "/rest/v1/academic_years?status=eq.active&select=id",
          {},
          token,
        );
        const e = active[0]
          ? await supabase(
              `/rest/v1/student_directory?id=eq.${student.id}&academic_year_id=eq.${active[0].id}&select=class_name,league_name`,
              {},
              token,
            )
          : [];
        subtitle = `Admission: ${student.admission_number}\nCurrent class: ${e[0]?.class_name || "No current enrolment"} | Current league: ${e[0]?.league_name || "No current league"}\nApplicable historical leagues are shown per transaction below.\n${subtitle}`;
      }
      sections.push({
        title,
        subtitle,
        headers: [
          "Date",
          "Student / admission",
          "Class / league",
          "Stars / source",
          "Reason",
          "Awarded by",
        ],
        rows: rows.map((t) => [
          t.earned_on,
          `${t.student_name}\n#${t.admission_number}`,
          `${t.class_name}\n${leagues.find((l) => l.id === t.league_id)?.name || "Unassigned"}`,
          `${t.amount} / ${t.source}`,
          t.reason,
          t.staff_name,
        ]),
        summary: `Total: ${rows.reduce((n, t) => n + t.amount, 0)} stars | Attendance: ${rows.filter((t) => t.source === "attendance").reduce((n, t) => n + t.amount, 0)} | Manual: ${rows.filter((t) => t.source === "manual").reduce((n, t) => n + t.amount, 0)}`,
      });
    }
    if (!sections.length)
      sections.push({
        title: "No matching records",
        headers: ["Result"],
        rows: [],
      });
    if (format === "csv") {
      const text =
        "\uFEFF" +
        sections
          .map((s) =>
            [
              csvCell(s.title),
              csvCell(s.subtitle || ""),
              s.headers.map(csvCell).join(","),
              ...s.rows.map((r) => r.map(csvCell).join(",")),
              csvCell(s.summary || ""),
            ].join("\r\n"),
          )
          .join("\r\n\r\n");
      return new Response(text, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="star-system-${type}.csv"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    const pdf = await createPDF(settings[0].name, title, sections);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="star-system-${type}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
