"use client";
import { useState } from "react";
import Link from "next/link";
import { Admission } from "./admission";
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  GraduationCap,
  Images,
  Plus,
  Shield,
  Upload,
  UserRound,
  UsersRound,
} from "lucide-react";
import { command, dateLabel, queryString, useData } from "@/lib/client";
import { csvCell, parseCSV } from "@/lib/csv";
import { BulkPhotos, StudentAvatar } from "./photos";
import {
  StudentCard,
  type SessionLite,
  type StudentAttendanceRow,
} from "./student-card";
import type {
  Assignment,
  Enrolment,
  Period,
  StudentRow,
  Transaction,
} from "@/lib/types";
import type { WorkspaceData } from "./workspace";
import {
  Button,
  DownloadLink,
  Empty,
  ErrorNotice,
  Field,
  Form,
  Modal,
  Pager,
  Panel,
  SearchBox,
  Tag,
} from "./ui";
export function Students({ data }: { data: WorkspaceData }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState<"add" | "import" | "photos" | null>(null);
  const [selected, setSelected] = useState<StudentRow | null>(null);
  const [year, setYear] = useState("");
  const [group, setGroup] = useState<"class" | "league">("class");
  const [open, setOpen] = useState<{
    group: "class" | "league";
    id: string;
  } | null>(null);
  const yearId = year || data.overview?.active_year || data.years[0]?.id;
  // The year's whole register is fetched once so every class and league card
  // can show how many students it holds.
  const { data: directory } = useData<StudentRow[]>(
    yearId ? `all:table=student_directory&academic_year_id=${yearId}` : null,
    [],
  );
  const counts = new Map<string, number>();
  for (const student of directory) {
    const key = group === "class" ? student.class_id : student.league_id || "";
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const cards = (group === "class"
    ? data.classes.filter((item) => item.active || counts.has(item.id))
    : data.leagues.filter((item) => item.active || counts.has(item.id))
  ).map((item) => ({
    id: item.id,
    name: item.name,
    count: counts.get(item.id) ?? 0,
  }));
  const roster = open !== null || Boolean(search);
  const {
    data: students,
    error,
    loading,
  } = useData<StudentRow[]>(
    yearId && roster
      ? queryString({
          table: "student_directory",
          academic_year_id: yearId,
          search,
          active: status,
          class_id: open && open.group === "class" ? open.id : null,
          league_id: open && open.group === "league" ? open.id : null,
          offset: page * 100,
        })
      : null,
    [],
  );
  const heading = open
    ? (open.group === "class" ? data.classes : data.leagues).find(
        (item) => item.id === open.id,
      )?.name || "All students"
    : group === "class"
      ? "Classes"
      : "Leagues";
  function filter(fn: () => void) {
    fn();
    setPage(0);
  }
  function browse(next: "class" | "league") {
    setGroup(next);
    setOpen(null);
    setPage(0);
  }
  function openGroup(id: string) {
    setOpen({ group, id });
    setPage(0);
  }
  return (
    <>
      <ErrorNotice message={error} />
      <Panel className="directory-panel">
        <div className="record-head">
          <h2>{heading}</h2>
          <div className="record-actions">
            <Button variant="outline" onClick={() => setModal("photos")}>
              <Images />
              Bulk photos
            </Button>
            <Button variant="outline" onClick={() => setModal("import")}>
              <Upload />
              Import CSV
            </Button>
            <Button onClick={() => setModal("add")}>
              <Plus />
              Add student
            </Button>
          </div>
        </div>
        <div className="record-tabs">
          <div className="tabs" role="tablist" aria-label="Group students">
            <button
              role="tab"
              aria-selected={group === "class"}
              className={group === "class" ? "active" : ""}
              onClick={() => browse("class")}
            >
              By class
            </button>
            <button
              role="tab"
              aria-selected={group === "league"}
              className={group === "league" ? "active" : ""}
              onClick={() => browse("league")}
            >
              By league
            </button>
          </div>
        </div>
        <div className="record-filters">
          <SearchBox
            value={search}
            onChange={(value) => filter(() => setSearch(value))}
          />
          <select
            aria-label="Academic year"
            value={yearId || ""}
            onChange={(event) => filter(() => setYear(event.target.value))}
          >
            {!data.years.length && <option value="">Academic year</option>}
            {data.years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
          {open ? (
            <Button
              variant="outline"
              onClick={() => {
                setOpen(null);
                setPage(0);
              }}
            >
              <ArrowLeft />
              All {group === "class" ? "classes" : "leagues"}
            </Button>
          ) : null}
          <select
            aria-label="Status filter"
            value={status}
            onChange={(event) => filter(() => setStatus(event.target.value))}
          >
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        {roster ? (
          <>
            <div className="table-wrap">
              <table aria-label="Student enrolments">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Admission number</th>
                    <th>Class</th>
                    <th>League</th>
                    <th>Status</th>
                    <th>Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="student-cell">
                          <StudentAvatar student={s} />
                          <strong>{s.full_name}</strong>
                        </div>
                      </td>
                      <td className="record-id">{s.admission_number}</td>
                      <td>{s.class_name}</td>
                      <td>{s.league_name || "Unassigned"}</td>
                      <td>
                        <Tag tone={s.active ? "green" : "gray"}>
                          {s.active ? "Active" : "Inactive"}
                        </Tag>
                      </td>
                      <td>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelected(s)}
                        >
                          <UserRound />
                          View profile
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!students.length && (
              <Empty
                icon={UsersRound}
                title={
                  loading
                    ? "Loading students…"
                    : search
                      ? "No matching students"
                      : yearId
                        ? "No students here yet"
                        : "No academic year selected"
                }
                action={
                  loading ? null : search ? (
                    <Button variant="outline" onClick={() => setSearch("")}>
                      Clear search
                    </Button>
                  ) : open ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setOpen(null);
                        setPage(0);
                      }}
                    >
                      All {group === "class" ? "classes" : "leagues"}
                    </Button>
                  ) : !yearId ? (
                    <Link className="record-link" href="/academic-years">
                      Manage academic years <ArrowUpRight size={14} />
                    </Link>
                  ) : null
                }
              >
                {loading
                  ? "Retrieving the enrolment register."
                  : search
                    ? "Try another name or admission number."
                    : open
                      ? "No student is enrolled here for this academic year."
                      : yearId
                        ? "Add a student or import a CSV to populate this academic year."
                        : "Create an academic year before registering or importing students."}
              </Empty>
            )}
            <Pager page={page} onChange={setPage} count={students.length} />
          </>
        ) : cards.length ? (
          <div className="group-grid">
            <button
              className="group-card"
              onClick={() => openGroup("")}
              aria-label={`All students, ${directory.length} students`}
            >
              <span className="group-icon">
                <UsersRound size={17} />
              </span>
              <span className="group-text">
                <strong>All students</strong>
                <small>
                  {directory.length}{" "}
                  {directory.length === 1 ? "student" : "students"}
                </small>
              </span>
              <ArrowUpRight className="group-go" size={15} />
            </button>
            {cards.map((item) => (
              <button
                key={item.id}
                className="group-card"
                onClick={() => openGroup(item.id)}
                aria-label={`${item.name}, ${item.count} students`}
              >
                <span className="group-icon">
                  {group === "class" ? (
                    <GraduationCap size={17} />
                  ) : (
                    <Shield size={17} />
                  )}
                </span>
                <span className="group-text">
                  <strong>{item.name}</strong>
                  <small>
                    {item.count} {item.count === 1 ? "student" : "students"}
                  </small>
                </span>
                <ArrowUpRight className="group-go" size={15} />
              </button>
            ))}
          </div>
        ) : (
          <Empty
            icon={group === "class" ? GraduationCap : Shield}
            title={group === "class" ? "No classes yet" : "No leagues yet"}
          >
            {group === "class"
              ? "Set up classes to group the register by class."
              : "Set up leagues to browse students league-wise."}
          </Empty>
        )}
      </Panel>
      {modal === "add" ? (
        <Admission
          data={data}
          year={yearId || ""}
          onClose={() => setModal(null)}
        />
      ) : null}
      {modal === "photos" ? (
        <BulkPhotos year={yearId || ""} onClose={() => setModal(null)} />
      ) : null}
      {modal === "import" ? (
        <ImportStudents data={data} onClose={() => setModal(null)} />
      ) : null}
      {selected ? (
        <StudentProfile
          student={selected}
          data={data}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}
function ImportStudents({
  data,
  onClose,
}: {
  data: WorkspaceData;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<string[][]>([]);
  const [error, setError] = useState("");
  const importYear =
    data.years.find((y) => y.status === "active") ??
    data.years.find((y) => y.status === "draft");
  const { data: classLeagues } = useData<
    { class_id: string; league_id: string }[]
  >(
    importYear ? `table=class_leagues&academic_year_id=${importYear.id}` : null,
    [],
  );
  const leagueFor = (classId: string) =>
    classLeagues.find((m) => m.class_id === classId)?.league_id ?? "";
  const sample = [
    ["admission_number", "full_name", "class"],
    ...[...data.classes]
      .filter((c) => c.active)
      .slice(0, 3)
      .map((c, i) => [
        `SAMPLE-${String(i + 1).padStart(3, "0")}`,
        `Sample student ${i + 1}`,
        c.name,
      ]),
  ];
  function downloadSample() {
    const csv =
      sample.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "students-import-sample.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  return (
    <Modal title="Import students from CSV" onClose={onClose}>
      <Form
        submit={`Import ${rows.length} students`}
        disabled={!importYear}
        onSubmit={async () => {
          if (!rows.length) throw new Error("Select a CSV first.");
          const mapped = rows.map((r, i) => {
            if (r.length !== 3)
              throw new Error(`Row ${i + 2}: expected exactly three columns.`);
            const c = data.classes.find(
              (c) => c.name.toLowerCase() === r[2]?.trim().toLowerCase(),
            );
            if (!r[0]?.trim() || !r[1]?.trim())
              throw new Error(
                `Row ${i + 2}: an admission number and a full name are required.`,
              );
            if (!c)
              throw new Error(
                `Row ${i + 2}: there is no class named "${r[2]?.trim()}". Use one of: ${data.classes
                  .filter((k) => k.active)
                  .map((k) => k.name)
                  .join(", ")}.`,
              );
            return {
              admission_number: r[0].trim(),
              full_name: r[1].trim(),
              class_id: c.id,
              league_id: leagueFor(c.id),
            };
          });
          if (!importYear) throw new Error("Start an academic year first.");
          await command("students.import", {
            academic_year_id: importYear.id,
            rows: mapped,
          });
          onClose();
        }}
      >
        <div className="notice">
          Columns, in order: admission_number, full_name, class. A header row is
          optional. Duplicate admissions roll back the full import.
        </div>
        <div className="record-actions">
          <Button type="button" variant="outline" onClick={downloadSample}>
            <Download />
            Download sample CSV
          </Button>
          <p className="section-description">
            Edit the sample, then select the file above.
          </p>
        </div>
        <Field label="CSV file">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              try {
                const file = e.target.files?.[0];
                if (!file) return;
                const parsed = parseCSV(await file.text());
                if (parsed[0]?.length !== 3)
                  throw new Error("Expected exactly three columns.");
                const header = parsed[0].map((c) =>
                  c.toLowerCase().replace(/[ _-]/g, ""),
                );
                const body =
                  header.join(",") === "admissionnumber,fullname,class"
                    ? parsed.slice(1)
                    : parsed;
                setRows(body);
                setError("");
              } catch (e) {
                setRows([]);
                setError(e instanceof Error ? e.message : "Invalid CSV");
              }
            }}
          />
        </Field>
        <ErrorNotice message={error} />
        {importYear ? (
          <>
            <div className="notice">
              <span>
                Students are enrolled into {importYear.name} automatically, and
                each one joins the league given to its class in{" "}
                <Link href="/leagues">Leagues</Link>. No league or year
                selection is needed here.
              </span>
            </div>
            {classLeagues.length ? null : (
              <div className="notice">
                <span>
                  No class has a league yet, so these students import without
                  one until you assign classes to a league.
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="notice">
            <span>
              No open academic year yet, so there is nothing to import into.{" "}
              <Link href="/academic-years">Start an academic year</Link>, then
              come back and import.
            </span>
          </div>
        )}
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Admission</th>
                  <th>Name</th>
                  <th>Class</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="section-description">
              Previewing {Math.min(rows.length, 5)} of {rows.length} records.
            </p>
          </div>
        ) : null}
      </Form>
    </Modal>
  );
}
function StudentProfile({
  student,
  data,
  onClose,
}: {
  student: StudentRow;
  data: WorkspaceData;
  onClose: () => void;
}) {
  const { data: assignments } = useData<Assignment[]>(
    `table=league_assignments&student_id=${student.id}`,
    [],
  );
  const { data: academicMonths } = useData<Period[]>(
    "table=recognition_periods&category=month&academic_year_id=" +
      (data.overview?.active_year || student.academic_year_id),
    [],
  );
  const { data: enrolments } = useData<Enrolment[]>(
    `table=enrolments&student_id=${student.id}`,
    [],
  );
  const { data: transactions } = useData<Transaction[]>(
    `table=star_transactions&student_id=${student.id}`,
    [],
  );
  const { data: attendance } = useData<StudentAttendanceRow[]>(
    `all:table=attendance_records&student_id=${student.id}`,
    [],
  );
  const { data: sessions } = useData<SessionLite[]>(
    "all:table=attendance_sessions",
    [],
  );
  const [period, setPeriod] = useState("year");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [message, setMessage] = useState("");
  return (
    <Modal title="Student profile" onClose={onClose} wide>
      <div className="details-content">
        <StudentCard
          student={student}
          academy={data.overview?.settings.name || "Sincere Academy"}
          yearName={
            data.years.find((y) => y.id === student.academic_year_id)?.name
          }
          transactions={transactions}
          records={attendance}
          sessions={sessions}
        />
        <Form
          onSubmit={async (f) => {
            await command("student.save", {
              id: student.id,
              admission_number: student.admission_number,
              full_name: f.get("full_name"),
              active: f.get("active") === "on",
            });
            setMessage("Student updated.");
          }}
        >
          <Field label="Full name">
            <input name="full_name" required defaultValue={student.full_name} />
          </Field>
          <label className="check-label">
            <input
              name="active"
              type="checkbox"
              defaultChecked={student.active}
            />
            Active student
          </label>
        </Form>
        {message ? (
          <div role="status" className="notice">
            {message}
          </div>
        ) : null}
        <h3>Academic-year history</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th>Class</th>
                <th>League</th>
                <th>Progression</th>
              </tr>
            </thead>
            <tbody>
              {enrolments.map((e) => (
                <tr key={e.id}>
                  <td>
                    {data.years.find((y) => y.id === e.academic_year_id)
                      ?.name || e.academic_year_id}
                  </td>
                  <td>{data.classes.find((c) => c.id === e.class_id)?.name}</td>
                  <td>
                    {data.leagues.find(
                      (l) =>
                        l.id ===
                        assignments.find(
                          (a) => a.academic_year_id === e.academic_year_id,
                        )?.league_id,
                    )?.name || "Unassigned"}
                  </td>
                  <td>{e.progression}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="mt-6 mb-3">Download star history</h3>
        <div className="toolbar">
          <select
            value={period}
            aria-label="Star history period"
            onChange={(e) => {
              setPeriod(e.target.value);
              setStart("");
              setEnd("");
            }}
          >
            <option value="all">All time</option>
            <option value="year">Current academic year</option>
            <option value="month">Specific academic month</option>
            <option value="custom">Custom dates</option>
          </select>
          {period === "month" ? (
            <select
              aria-label="Academic month"
              defaultValue=""
              onChange={(e) => {
                const month = academicMonths.find(
                  (p) => p.id === e.target.value,
                );
                setStart(month?.start_date || "");
                setEnd(month?.end_date || "");
              }}
            >
              <option value="">Choose academic month</option>
              {academicMonths.map((p) => (
                <option key={p.id} value={p.id}>
                  {dateLabel(p.start_date)} - {dateLabel(p.end_date)}
                </option>
              ))}
            </select>
          ) : null}
          {period === "custom" ? (
            <>
              <input
                aria-label="Start date"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
              <input
                aria-label="End date"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </>
          ) : null}
          <DownloadLink
            validate={() =>
              (period === "month" || period === "custom") &&
              (!start || !end || start > end)
                ? "Choose a valid date range."
                : null
            }
            href={`/api/export?${queryString({ type: "student", format: "pdf", student: student.id, year: period === "year" ? data.overview?.active_year || student.academic_year_id : null, start: period === "custom" || period === "month" ? start : null, end: period === "custom" || period === "month" ? end : null })}`}
          >
            <Download size={14} />
            Download PDF
          </DownloadLink>
        </div>
        <h3 className="mb-3">Recent star transactions</h3>
        {transactions.length ? (
          <div className="timeline">
            {transactions.slice(0, 10).map((t) => (
              <div className="timeline-item" key={t.id}>
                <h3>
                  +{t.amount} stars · {t.reason}
                </h3>
                <p>
                  {dateLabel(t.earned_on)} · {t.staff_name}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="No star awards yet">
            Awards recorded for this student will appear here.
          </Empty>
        )}
        <PhotoUpload student={student} />
      </div>
    </Modal>
  );
}
function PhotoUpload({ student }: { student: StudentRow }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-4">
      <Field label="Optional student photo">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            try {
              const form = new FormData();
              form.set("student_id", student.id);
              form.set("file", file);
              const response = await fetch("/api/photos", {
                method: "POST",
                body: form,
              });
              const body = await response.json();
              if (!response.ok) throw new Error(body.error);
              setError("Photo saved.");
              window.dispatchEvent(new Event("star-refresh"));
            } catch (e) {
              setError(e instanceof Error ? e.message : "Photo upload failed");
            } finally {
              setBusy(false);
            }
          }}
        />
      </Field>
      {error ? (
        <p className="section-description mt-3" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
