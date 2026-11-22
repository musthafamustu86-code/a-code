"use client";
import { useState } from "react";
import Link from "next/link";
import { Admission } from "./admission";
import {
  ArrowUpRight,
  Download,
  Images,
  Plus,
  Upload,
  UserRound,
  UsersRound,
} from "lucide-react";
import { command, dateLabel, queryString, useData } from "@/lib/client";
import { parseCSV } from "@/lib/csv";
import { BulkPhotos, StudentAvatar } from "./photos";
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
  const [classId, setClass] = useState("");
  const [league, setLeague] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState<"add" | "import" | "photos" | null>(null);
  const [selected, setSelected] = useState<StudentRow | null>(null);
  const [year, setYear] = useState("");
  const yearId = year || data.overview?.active_year || data.years[0]?.id;
  const {
    data: students,
    error,
    loading,
  } = useData<StudentRow[]>(
    yearId
      ? queryString({
          table: "student_directory",
          academic_year_id: yearId,
          search,
          class_id: classId,
          league_id: league,
          active: status,
          offset: page * 100,
        })
      : null,
    [],
  );
  function filter(fn: () => void) {
    fn();
    setPage(0);
  }
  const filtered = Boolean(search || classId || league || status);
  function clearFilters() {
    setSearch("");
    setClass("");
    setLeague("");
    setStatus("");
    setPage(0);
  }
  return (
    <>
      <ErrorNotice message={error} />
      <Panel className="directory-panel">
        <div className="record-head">
          <h2>Enrolment register</h2>
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
          <select
            aria-label="Class filter"
            value={classId}
            onChange={(event) => filter(() => setClass(event.target.value))}
          >
            <option value="">All classes</option>
            {data.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="League filter"
            value={league}
            onChange={(event) => filter(() => setLeague(event.target.value))}
          >
            <option value="">All leagues</option>
            {data.leagues.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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
                : filtered
                  ? "No matching students"
                  : "No students in this register"
            }
            action={
              filtered ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : !loading && !yearId ? (
                <Link className="record-link" href="/academic-years">
                  Manage academic years <ArrowUpRight size={14} />
                </Link>
              ) : null
            }
          >
            {loading
              ? "Retrieving the enrolment register."
              : filtered
                ? "Try another name, admission number or filter."
                : yearId
                  ? "Add a student or import a CSV to populate this academic year."
                  : "Create an academic year before registering or importing students."}
          </Empty>
        )}
        <Pager page={page} onChange={setPage} count={students.length} />
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
        <ImportStudents
          data={data}
          year={yearId || ""}
          onClose={() => setModal(null)}
        />
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
  year,
  onClose,
}: {
  data: WorkspaceData;
  year: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<string[][]>([]);
  const [error, setError] = useState("");
  return (
    <Modal title="Import students from CSV" onClose={onClose}>
      <Form
        submit={`Import ${rows.length} students`}
        onSubmit={async (f) => {
          if (!rows.length) throw new Error("Select a CSV first.");
          const mapped = rows.map((r, i) => {
            if (r.length !== 3)
              throw new Error(`Row ${i + 2}: expected exactly three columns.`);
            const c = data.classes.find(
              (c) => c.name.toLowerCase() === r[2]?.trim().toLowerCase(),
            );
            if (!r[0]?.trim() || !r[1]?.trim() || !c)
              throw new Error(
                `Row ${i + 2}: admission number, name, and an existing class are required.`,
              );
            return {
              admission_number: r[0].trim(),
              full_name: r[1].trim(),
              class_id: c.id,
              league_id: f.get("league_id"),
            };
          });
          await command("students.import", {
            academic_year_id: f.get("academic_year_id"),
            rows: mapped,
          });
          onClose();
        }}
      >
        <div className="notice">
          Columns, in order: admission_number, full_name, class. A header row is
          optional. Up to 500 students per atomic import. Duplicate admissions
          reject the entire batch.
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
                if (body.length > 500)
                  throw new Error("Split imports into batches of at most 500.");
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
        <Field label="Academic year">
          <select name="academic_year_id" required defaultValue={year}>
            {data.years
              .filter((y) => y.status !== "closed")
              .map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Assign league to imported students">
          <select name="league_id" required>
            <option value="">Choose a league</option>
            {data.leagues
              .filter((l) => l.active)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </select>
        </Field>
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
  const [period, setPeriod] = useState("year");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [message, setMessage] = useState("");
  return (
    <Modal title="Student profile" onClose={onClose}>
      <div className="details-content">
        <div className="profile-heading">
          <StudentAvatar student={student} />
          <div>
            <h2>{student.full_name}</h2>
            <p>
              #{student.admission_number} · {student.class_name} ·{" "}
              {student.league_name || "League unassigned"}
            </p>
          </div>
        </div>
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
