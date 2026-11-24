"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Download, Star, Trophy, Award } from "lucide-react";
import { command, dateLabel, queryString, useData } from "@/lib/client";
import type { Period, Ranking, Winner } from "@/lib/types";
import {
  AcademicCalendarPicker,
  useAcademicCalendar,
} from "./academic-calendar";
import type { WorkspaceData } from "./workspace";
import {
  AnimatedNumber,
  Button,
  DownloadLink,
  Empty,
  ErrorNotice,
  Field,
  Pager,
  Panel,
  SearchBox,
  Tag,
} from "./ui";
export function Leaderboard({ data }: { data: WorkspaceData }) {
  const calendar = useAcademicCalendar(data.years, data.overview, true);
  const [search, setSearch] = useState("");
  const [reverse, setReverse] = useState(false);
  return (
    <>
      <AcademicCalendarPicker calendar={calendar} />
      <div className="toolbar">
        <SearchBox value={search} onChange={setSearch} />
        <select
          aria-label="Ranking order"
          value={reverse ? "asc" : "desc"}
          onChange={(event) => setReverse(event.target.value === "asc")}
        >
          <option value="desc">Highest stars first</option>
          <option value="asc">Lowest stars first</option>
        </select>
      </div>
      <StudentRankings
        calendar={calendar}
        search={search}
        reverse={reverse}
        leagues={data.leagues}
      />
    </>
  );
}

function StudentRankings({
  calendar,
  search,
  reverse,
  leagues,
}: {
  calendar: ReturnType<typeof useAcademicCalendar>;
  search: string;
  reverse: boolean;
  leagues: WorkspaceData["leagues"];
}) {
  const [pager, setPager] = useState({ key: "", page: 0 });
  const [flash, setFlash] = useState("");
  const leader = useRef("");
  const reduced = useReducedMotion();
  // Empty selection rotates the board through every league, 15 seconds each.
  const [pick, setPick] = useState("");
  const [tick, setTick] = useState(0);
  const boards = leagues.filter((league) => league.active);
  const rotating = !pick && boards.length > 1;
  const league = pick
    ? leagues.find((l) => l.id === pick)
    : boards.length
      ? boards[tick % boards.length]
      : undefined;
  const leagueId = league?.id || "";
  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(() => setTick((t) => t + 1), 15000);
    return () => window.clearInterval(timer);
  }, [rotating, boards.length]);
  const filterKey = JSON.stringify([
    calendar.filterKey,
    search,
    reverse,
    leagueId,
  ]);
  const page = pager.key === filterKey ? pager.page : 0;
  const setPage = (next: number) => setPager({ key: filterKey, page: next });
  const allTime = calendar.kind === "all";
  const query =
    allTime || calendar.range
      ? queryString({
          rpc: "individual_rankings",
          year:
            allTime || calendar.kind === "custom"
              ? undefined
              : calendar.year?.id,
          ...calendar.range,
          search,
          direction: reverse ? "asc" : "desc",
          league: leagueId,
          offset: page * 100,
        })
      : null;
  const { data: rows, error, loading, reload } = useData<Ranking[]>(query, []);
  useEffect(() => {
    const refetch = () => {
      if (!document.hidden) void reload();
    };
    window.addEventListener("focus", refetch);
    document.addEventListener("visibilitychange", refetch);
    return () => {
      window.removeEventListener("focus", refetch);
      document.removeEventListener("visibilitychange", refetch);
    };
  }, [reload]);
  useEffect(() => {
    const first = rows.find((row) => row.rank === 1)?.id || "";
    const changed =
      !!first && !!leader.current && first !== leader.current && !reduced;
    leader.current = first;
    if (!changed) return;
    const frame = requestAnimationFrame(() => setFlash(first));
    return () => cancelAnimationFrame(frame);
  }, [rows, reduced]);
  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(""), 1500);
    return () => window.clearTimeout(timer);
  }, [flash]);
  return (
    <>
      <div className="toolbar">
        <select
          aria-label="Leaderboard league"
          value={pick}
          onChange={(event) => {
            setPick(event.target.value);
            setTick(0);
          }}
        >
          <option value="">
            {rotating || boards.length > 1
              ? "Rotate leagues (every 15 seconds)"
              : "All leagues"}
          </option>
          {boards.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        {boards.length > 1 ? (
          <div className="boarddots" role="tablist" aria-label="League boards">
            {boards.map((l) => (
              <button
                key={l.id}
                role="tab"
                aria-selected={l.id === leagueId}
                aria-label={l.name}
                onClick={() => {
                  setPick(l.id);
                  setTick(0);
                }}
              />
            ))}
          </div>
        ) : null}
        {rotating ? (
          <span className="text-xs text-[var(--soft)]">
            Showing {league?.name} · switches league every 15 seconds
          </span>
        ) : null}
      </div>
      <ErrorNotice message={error} />
      <Panel>
        <div className="panel-heading">
          <h2>
            <Trophy className="gold-text" size={21} />
            Individual leaderboard
          </h2>
          <span className="inline-flex gap-2 items-center">
            <Tag>{league?.name || "All leagues"}</Tag>
            <Tag>Ties share a rank</Tag>
          </span>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Student</th>
                  <th>Admission</th>
                  <th className="record-number">Stars earned</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <motion.tr
                    key={row.id}
                    layout={reduced ? false : "position"}
                    transition={{ duration: 0.22 }}
                    className={flash === row.id ? "rank-flash" : undefined}
                  >
                    <td>
                      {row.rank === 1 ? (
                        <Trophy
                          className="gold-text"
                          size={19}
                          aria-label="First place"
                        />
                      ) : (
                        row.rank
                      )}
                    </td>
                    <td>
                      <strong>{row.full_name}</strong>
                    </td>
                    <td>#{row.admission_number}</td>
                    <td className="record-number">
                      <span className="inline-flex gap-2 items-center gold-text">
                        <Star size={14} fill="currentColor" />
                        <AnimatedNumber value={Number(row.stars)} />
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={Trophy}
            title={
              loading || calendar.loading
                ? "Loading rankings…"
                : "No rankings to show"
            }
          >
            {loading || calendar.loading
              ? "Retrieving student totals."
              : search
                ? "Try another student name or admission number."
                : "Rankings appear for students enrolled in the selected period."}
          </Empty>
        )}
        <Pager page={page} onChange={setPage} count={rows.length} />
      </Panel>
    </>
  );
}
export function Achievements({ data }: { data: WorkspaceData }) {
  const [year, setYear] = useState("");
  const [league, setLeague] = useState("");
  const [category, setCategory] = useState("");
  const [period, setPeriod] = useState("");
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const yearId = year || data.overview?.active_year || data.years[0]?.id;
  const { data: periods } = useData<Period[]>(
    yearId
      ? queryString({
          table: "recognition_periods",
          academic_year_id: yearId,
          category,
        })
      : null,
    [],
  );
  const { data: winners, error: loadError } = useData<Winner[]>(
    queryString({
      table: "recognition_directory",
      academic_year_id: yearId,
      category,
      league_id: league,
      period_id: period,
      offset: page * 100,
    }),
    [],
  );
  useEffect(() => {
    if (data.overview?.active_year)
      void command("recognition.generate", {}).catch((e) =>
        setError(
          e instanceof Error ? e.message : "Recognition could not be finalized",
        ),
      );
  }, [data.overview?.active_year]);
  const filtered = winners;
  return (
    <>
      <div className="toolbar">
        <select
          aria-label="Academic year"
          value={yearId || ""}
          onChange={(e) => {
            setYear(e.target.value);
            setPeriod("");
            setPage(0);
          }}
        >
          {data.years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
            </option>
          ))}
        </select>
        <select
          aria-label="League"
          value={league}
          onChange={(e) => {
            setLeague(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All leagues</option>
          {data.leagues.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Award category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPeriod("");
            setPage(0);
          }}
        >
          <option value="">All awards</option>
          {["week", "month", "quarter", "year"].map((c) => (
            <option key={c} value={c}>
              Star of the {c}
            </option>
          ))}
        </select>
        <select
          aria-label="Recognition period"
          value={period}
          onChange={(e) => {
            setPeriod(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All periods</option>
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button
          className="ml-auto"
          variant="outline"
          onClick={async () => {
            try {
              await command("recognition.generate", {});
              setError("");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Recognition failed");
            }
          }}
        >
          Refresh recognition
        </Button>
      </div>
      <div className="notice">
        Each league celebrates its own winners. Weekly winners rotate within the
        configured academic month. Tied eligible students share the award;
        longer-period awards are calculated independently.
      </div>
      <ErrorNotice message={error || loadError} />
      {filtered.length ? (
        <div className="cards-grid">
          {filtered.map((w) => {
            const p = periods.find((p) => p.id === w.period_id);
            return (
              <Panel key={w.id} className="management-card">
                <span className="stat-icon gold mb-5">
                  <Award size={21} />
                </span>
                <span className="eyebrow">
                  STAR OF THE {p?.category.toUpperCase()}
                </span>
                <h2 className="mt-3">{w.student_name}</h2>
                <p>
                  {w.league_name}
                  <br />
                  {p
                    ? `${dateLabel(p.start_date)} – ${dateLabel(p.end_date)}`
                    : ""}
                </p>
                <Tag tone="gold">{w.stars} stars earned</Tag>
              </Panel>
            );
          })}
        </div>
      ) : (
        <Panel>
          <Empty icon={Award} title="No awards for this period">
            Recognition is calculated after the academic period closes. Choose
            another period to review earlier winners.
          </Empty>
        </Panel>
      )}
      <Pager page={page} onChange={setPage} count={winners.length} />
    </>
  );
}
export function Reports({ data }: { data: WorkspaceData }) {
  const { data: trend } = useData<{ date: string; stars: number }[]>(
    "rpc=star_trend",
    [],
  );
  const [type, setType] = useState("transactions");
  const [year, setYear] = useState("");
  const [league, setLeague] = useState("");
  const [classId, setClass] = useState("");
  const [student, setStudent] = useState("");
  const [activity, setActivity] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const params = queryString({
    type,
    year,
    league: type === "league" ? league : null,
    class: type === "class" ? classId : null,
    admission: type === "student" ? student : null,
    activity: type === "attendance" ? activity : null,
    start,
    end,
  });
  return (
    <div className="split-panel reports-layout">
      <Panel className="setup-steps report-trend">
        <h2>Stars awarded</h2>
        <p>Daily totals for the last seven academy days.</p>
        {trend.length ? (
          <div
            className="trend-chart"
            role="img"
            aria-label={trend
              .map((t) => `${t.date}: ${t.stars} stars`)
              .join("; ")}
          >
            {trend.map((t) => (
              <div key={t.date} className="trend-column">
                <span>{t.stars}</span>
                <div
                  style={{
                    height: `${Math.max(3, (Number(t.stars) / Math.max(1, ...trend.map((v) => Number(v.stars)))) * 100)}px`,
                  }}
                />
                <small>
                  {dateLabel(t.date).split(" ").slice(0, 2).join(" ")}
                </small>
              </div>
            ))}
          </div>
        ) : (
          <Empty icon={Star} title="No trend data available" />
        )}
      </Panel>
      <Panel>
        <div className="panel-heading">
          <h2>Report settings</h2>
          <Download className="purple-text" size={20} />
        </div>
        <div className="form">
          <Field label="Report type">
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="transactions">
                Star transactions / custom date range
              </option>
              <option value="student">Individual student</option>
              <option value="class">Class-wise report</option>
              <option value="league">League report</option>
              <option value="attendance">Attendance activity</option>
              <option value="academic-year">Academic-year report</option>
            </select>
          </Field>
          <Field label="Academic year">
            <select value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">All academic years</option>
              {data.years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </Field>
          {type === "student" ? (
            <Field label="Permanent admission number">
              <input
                required
                value={student}
                onChange={(e) => setStudent(e.target.value)}
                placeholder="Enter admission number"
              />
            </Field>
          ) : null}
          {type === "class" ? (
            <Field label="Class">
              <select
                value={classId}
                onChange={(e) => setClass(e.target.value)}
              >
                <option value="">Choose class</option>
                {data.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          {type === "league" ? (
            <Field label="League">
              <select
                value={league}
                onChange={(e) => setLeague(e.target.value)}
              >
                <option value="">Choose league</option>
                {data.leagues.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          {type === "attendance" ? (
            <Field label="Attendance activity">
              <select
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
              >
                <option value="">All activities</option>
                {data.activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <div className="form-row">
            <Field label="From date (optional)">
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </Field>
            <Field label="Until date (optional)">
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </Field>
          </div>
          <div className="notice">
            Use CSV for spreadsheets or PDF for a printable report.
          </div>
          <div className="form-footer gap-3">
            <DownloadLink
              className="primary-link report-secondary"
              validate={() =>
                type === "student" && !student
                  ? "Enter an admission number."
                  : type === "class" && !classId
                    ? "Choose a class."
                    : type === "league" && !league
                      ? "Choose a league."
                      : type === "academic-year" && !year
                        ? "Choose an academic year."
                        : start && end && start > end
                          ? "End date must follow start date."
                          : null
              }
              href={`/api/export?${params}&format=csv`}
            >
              <Download size={14} />
              Export CSV
            </DownloadLink>
            <DownloadLink
              className="primary-link"
              validate={() =>
                type === "student" && !student
                  ? "Enter an admission number."
                  : type === "class" && !classId
                    ? "Choose a class."
                    : type === "league" && !league
                      ? "Choose a league."
                      : type === "academic-year" && !year
                        ? "Choose an academic year."
                        : start && end && start > end
                          ? "End date must follow start date."
                          : null
              }
              href={`/api/export?${params}&format=pdf`}
            >
              <Download size={14} />
              Download PDF
            </DownloadLink>
          </div>
        </div>
      </Panel>
    </div>
  );
}
