"use client";
import { useState } from "react";
import {
  Archive,
  Download,
  LockKeyhole,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  command,
  dateLabel,
  dateTimeLabel,
  queryString,
  useData,
} from "@/lib/client";
import type { AttendanceRecord, AttendanceSession } from "@/lib/types";
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
export function AttendanceRecords({ data }: { data: WorkspaceData }) {
  const [status, setStatus] = useState("active");
  const [activity, setActivity] = useState("");
  const [classId, setClass] = useState("");
  const [staff, setStaff] = useState("");
  const [student, setStudent] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AttendanceSession | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const {
    data: sessions,
    error: loadError,
    loading,
  } = useData<AttendanceSession[]>(
    queryString({
      rpc: "attendance_search",
      status,
      activity,
      class: classId,
      staff,
      student,
      search,
      start,
      end,
      offset: page * 100,
    }),
    [],
  );
  const filtered = sessions;
  const { data: staffProfiles } = useData<
    { id: string; display_name: string }[]
  >("all:table=staff_profiles", []);
  return (
    <>
      <div className="toolbar">
        <div className="tabs">
          {["active", "archived", "trash"].map((s) => (
            <button
              key={s}
              className={status === s ? "active" : ""}
              onClick={() => {
                setStatus(s);
                setPage(0);
                setChecked(new Set());
              }}
            >
              {s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <select
          aria-label="Activity filter"
          value={activity}
          onChange={(e) => {
            setActivity(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All activities</option>
          {data.activities.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <input
          className="max-w-40"
          aria-label="From date"
          type="date"
          value={start}
          onChange={(e) => {
            setStart(e.target.value);
            setPage(0);
          }}
        />
        <input
          className="max-w-40"
          aria-label="Until date"
          type="date"
          value={end}
          onChange={(e) => {
            setEnd(e.target.value);
            setPage(0);
          }}
        />
        <select
          aria-label="Class filter"
          value={classId}
          onChange={(e) => {
            setClass(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All classes</option>
          {data.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Submitting staff"
          value={staff}
          onChange={(e) => {
            setStaff(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All staff</option>
          {staffProfiles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.display_name}
            </option>
          ))}
        </select>
        <input
          className="max-w-48"
          aria-label="Student admission or name"
          placeholder="Student admission or name"
          value={student}
          onChange={(e) => {
            setStudent(e.target.value);
            setPage(0);
          }}
        />
        <SearchBox
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(0);
          }}
          placeholder="Search all records"
        />
        <DownloadLink
          className="primary-link"
          href={`/api/export?${queryString({ type: "attendance", format: "pdf", sessions: Array.from(checked).join(","), start, end, status, activity, class: classId, staff, student, search })}`}
        >
          <Download size={14} />
          {checked.size ? "Export selected" : "Export period"} PDF
        </DownloadLink>
      </div>
      <ErrorNotice message={error || loadError} />
      <Panel>
        {filtered.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Activity</th>
                  <th>Date</th>
                  <th>Classes</th>
                  <th>Submitted by</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${s.activity_name} ${s.attendance_date}`}
                        checked={checked.has(s.id)}
                        onChange={(e) =>
                          setChecked((prev) => {
                            const n = new Set(prev);
                            if (e.target.checked) n.add(s.id);
                            else n.delete(s.id);
                            return n;
                          })
                        }
                      />
                    </td>
                    <td>
                      <strong>{s.activity_name}</strong>
                      <small>
                        <LockKeyhole size={10} className="inline mr-1" />
                        Locked snapshot
                      </small>
                    </td>
                    <td>{dateLabel(s.attendance_date)}</td>
                    <td>{s.selected_classes.map((c) => c.name).join(", ")}</td>
                    <td>
                      {s.staff_name}
                      <small>{dateLabel(s.submitted_at)}</small>
                    </td>
                    <td className="actions">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelected(s)}
                      >
                        Details
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={
                          status === "active"
                            ? "Archive session"
                            : "Restore session"
                        }
                        onClick={async () => {
                          try {
                            await command("attendance.lifecycle", {
                              id: s.id,
                              status:
                                status === "active" ? "archived" : "active",
                            });
                          } catch (e) {
                            setError(
                              e instanceof Error ? e.message : "Action failed",
                            );
                          }
                        }}
                      >
                        {status === "active" ? <Archive /> : <RotateCcw />}
                      </Button>
                      {status !== "trash" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Move to trash"
                          onClick={async () => {
                            try {
                              await command("attendance.lifecycle", {
                                id: s.id,
                                status: "trash",
                              });
                            } catch (e) {
                              setError(
                                e instanceof Error
                                  ? e.message
                                  : "Action failed",
                              );
                            }
                          }}
                        >
                          <Trash2 />
                        </Button>
                      ) : (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={async () => {
                            if (
                              window.prompt(
                                "Permanently delete this attendance snapshot? Star transactions and audit history will remain. Type DELETE to confirm.",
                              ) !== "DELETE"
                            )
                              return;
                            try {
                              await command("attendance.lifecycle", {
                                id: s.id,
                                status: "delete",
                                confirmation: "DELETE",
                              });
                            } catch (e) {
                              setError(
                                e instanceof Error
                                  ? e.message
                                  : "Deletion failed",
                              );
                            }
                          }}
                        >
                          Delete forever
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={loading ? "Loading sessions…" : `No ${status} sessions`}
          >
            Attendance records appear automatically after submission. Archived
            and trashed records remain retrievable.
          </Empty>
        )}
        <Pager page={page} onChange={setPage} count={sessions.length} />
      </Panel>
      {selected ? (
        <SessionDetails
          timezone={data.overview?.settings.timezone || "Asia/Kolkata"}
          session={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}
function SessionDetails({
  session,
  onClose,
  timezone,
}: {
  session: AttendanceSession;
  onClose: () => void;
  timezone: string;
}) {
  const { data: staff } = useData<{ id: string; display_name: string }[]>(
    "all:table=staff_profiles",
    [],
  );
  const [page, setPage] = useState(0);
  const { data: records, error } = useData<AttendanceRecord[]>(
    `table=attendance_records&session_id=${session.id}&offset=${page * 100}`,
    [],
  );
  const { data: remarks } = useData<{ id: string; content: string }[]>(
    `table=attendance_remarks&session_id=${session.id}`,
    [],
  );
  const { data: history } = useData<
    {
      id: string;
      old_content: string;
      new_content: string;
      created_at: string;
      staff_id: string;
    }[]
  >(`all:table=remark_history&session_id=${session.id}`, []);
  return (
    <Modal
      title={`${session.activity_name} · ${dateLabel(session.attendance_date)}`}
      onClose={onClose}
    >
      <div className="details-content">
        <div className="notice">
          <LockKeyhole size={17} />
          Original submitted snapshot · {session.staff_name} ·{" "}
          {dateLabel(session.submitted_at)}
        </div>
        <ErrorNotice message={error} />
        <DownloadLink
          className="primary-link mb-4"
          href={`/api/export?type=attendance&format=pdf&sessions=${session.id}`}
        >
          <Download size={14} />
          Download original report
        </DownloadLink>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Status</th>
                <th>Stars</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.full_name}</strong>
                    <small>#{r.admission_number}</small>
                  </td>
                  <td>{r.class_name}</td>
                  <td>
                    <Tag tone={r.present ? "green" : "gray"}>
                      {r.present ? "Present" : "Absent"}
                    </Tag>
                  </td>
                  <td>{r.stars}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} onChange={setPage} count={records.length} />
        <Form
          submit="Update remark"
          onSubmit={async (f) => {
            await command("remark.save", {
              session_id: session.id,
              content: f.get("content"),
            });
          }}
        >
          <Field label="Staff remark (every change is recorded)">
            <textarea
              key={remarks[0]?.content}
              name="content"
              defaultValue={remarks[0]?.content}
              maxLength={5000}
            />
          </Field>
        </Form>
        <h3>Remark history</h3>
        <div className="timeline">
          {history.map((h) => (
            <div className="timeline-item" key={h.id}>
              <h3>
                {dateTimeLabel(h.created_at, timezone)} ·{" "}
                {staff.find((s) => s.id === h.staff_id)?.display_name ||
                  h.staff_id}
              </h3>
              <p>Previous: {h.old_content || "(empty)"}</p>
              <p>Updated: {h.new_content || "(empty)"}</p>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
