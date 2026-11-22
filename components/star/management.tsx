"use client";
import { BrandingUpload } from "./branding";
import { useState } from "react";
import {
  Plus,
  Pin,
  Shield,
  ClipboardList,
  Pencil,
  CalendarDays,
  CheckCheck,
} from "lucide-react";
import { command, dateLabel, dateTimeLabel, useData } from "@/lib/client";
import type { Activity, Named, Period, StudentRow, Year } from "@/lib/types";
import type { WorkspaceData } from "./workspace";
import {
  Button,
  Empty,
  ErrorNotice,
  Field,
  Form,
  Modal,
  Pager,
  Panel,
  Tag,
} from "./ui";
export function Management({
  data,
  kind,
}: {
  data: WorkspaceData;
  kind: "league" | "activity";
}) {
  const [editing, setEditing] = useState<Named | Activity | null>(null);
  const [create, setCreate] = useState(false);
  const [error, setError] = useState("");
  const { data: pins } = useData<{ id: string; activity_id: string }[]>(
    "table=pinned_forms",
    [],
  );
  const items = kind === "league" ? data.leagues : data.activities;
  return (
    <>
      <div className="toolbar">
        <span className="text-xs text-[var(--soft)]">
          {kind === "league"
            ? "League memberships are specific to each academic year."
            : "Your pinned forms appear first when taking attendance. Pin up to 8."}
        </span>
        <Button
          className="ml-auto"
          onClick={() => {
            setEditing(null);
            setCreate(true);
          }}
        >
          <Plus />
          Create {kind === "league" ? "league" : "attendance form"}
        </Button>
      </div>
      <ErrorNotice message={error} />
      {items.length ? (
        <div className="cards-grid">
          {items.map((item) => (
            <Panel key={item.id} className="management-card">
              <h2>
                {kind === "league" ? (
                  <Shield style={{ color: item.color }} size={23} />
                ) : (
                  <ClipboardList className="purple-text" size={23} />
                )}{" "}
                {item.name}
              </h2>
              {item.description && <p>{item.description}</p>}
              {"reward" in item && "reward_enabled" in item ? (
                <Tag tone="gold">
                  {item.reward_enabled
                    ? `${item.reward} stars for attendance`
                    : "Rewards disabled"}
                </Tag>
              ) : (
                <Tag>Academic-year competition</Tag>
              )}
              <div className="card-actions">
                <Tag tone={item.active ? "green" : "gray"}>
                  {item.active ? "Active" : "Archived"}
                </Tag>
                <div>
                  {kind === "activity" ? (
                    <Button
                      size="icon-sm"
                      variant={
                        pins.some((p) => p.activity_id === item.id)
                          ? "secondary"
                          : "ghost"
                      }
                      aria-label={`${pins.some((p) => p.activity_id === item.id) ? "Unpin" : "Pin"} ${item.name}`}
                      onClick={async () => {
                        try {
                          await command("pin.toggle", { activity_id: item.id });
                        } catch (e) {
                          setError(
                            e instanceof Error ? e.message : "Pin failed",
                          );
                        }
                      }}
                    >
                      <Pin />
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(item);
                      setCreate(true);
                    }}
                  >
                    <Pencil />
                    Edit
                  </Button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <Panel>
          <Empty
            icon={kind === "league" ? Shield : ClipboardList}
            title={
              kind === "league" ? "No leagues yet" : "No attendance forms yet"
            }
          >
            Create your first {kind === "league" ? "league" : "attendance form"}{" "}
            to get started.
          </Empty>
        </Panel>
      )}
      {create ? (
        <Modal
          title={`${editing ? "Edit" : "Create"} ${kind === "league" ? "league" : "attendance form"}`}
          onClose={() => setCreate(false)}
        >
          <Form
            onSubmit={async (f) => {
              await command(`${kind}.save`, {
                id: editing?.id,
                name: f.get("name"),
                description: f.get("description"),
                active: f.get("active") === "on",
                color: f.get("color"),
                reward: Number(f.get("reward")),
                reward_enabled: f.get("reward_enabled") === "on",
              });
              setCreate(false);
            }}
          >
            <Field label="Name">
              <input
                name="name"
                required
                defaultValue={editing?.name}
                maxLength={120}
              />
            </Field>
            <Field label="Description">
              <textarea
                name="description"
                defaultValue={editing?.description}
                maxLength={2000}
              />
            </Field>
            {kind === "league" ? (
              <Field label="League colour">
                <input
                  type="color"
                  name="color"
                  defaultValue={editing?.color || "#8464d8"}
                />
              </Field>
            ) : (
              <>
                <Field label="Stars per present student">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    name="reward"
                    defaultValue={
                      editing && "reward" in editing ? editing.reward : 1
                    }
                  />
                </Field>
                <label className="check-label">
                  <input
                    type="checkbox"
                    name="reward_enabled"
                    defaultChecked={
                      editing && "reward_enabled" in editing
                        ? editing.reward_enabled
                        : true
                    }
                  />
                  Enable star rewards
                </label>
              </>
            )}
            <label className="check-label">
              <input
                type="checkbox"
                name="active"
                defaultChecked={editing?.active ?? true}
              />
              Active
            </label>
            <div className="notice">
              Archiving preserves all historical records.{" "}
              {kind === "league"
                ? "Current academic-year memberships remain unchanged."
                : "Previously submitted attendance keeps its original reward configuration."}
            </div>
          </Form>
        </Modal>
      ) : null}
    </>
  );
}
export function AcademicYears({ data }: { data: WorkspaceData }) {
  const [creating, setCreating] = useState(false);
  const [review, setReview] = useState<Year | null>(null);
  const [error, setError] = useState("");
  return (
    <>
      <div className="toolbar">
        <span className="text-xs text-[var(--soft)]">
          Review student progression and league assignments before activating a
          year.
        </span>
        <Button className="ml-auto" onClick={() => setCreating(true)}>
          <Plus />
          Start new academic year
        </Button>
      </div>
      <ErrorNotice message={error} />
      {data.years.length ? (
        <div className="cards-grid">
          {data.years.map((y) => (
            <Panel className="management-card" key={y.id}>
              <h2>
                <CalendarDays className="purple-text" size={22} />
                {y.name}
              </h2>
              <p>
                {dateLabel(y.start_date)} — {dateLabel(y.end_date)}
              </p>
              <Tag
                tone={
                  y.status === "active"
                    ? "green"
                    : y.status === "draft"
                      ? "purple"
                      : "gray"
                }
              >
                {y.status}
              </Tag>
              <div className="card-actions">
                <Button variant="outline" onClick={() => setReview(y)}>
                  {y.status === "draft"
                    ? "Review progression & leagues"
                    : "View enrolments"}
                </Button>
                {y.status === "draft" ? (
                  <Button
                    onClick={async () => {
                      if (
                        !window.confirm(
                          `Activate ${y.name}? Confirm that student progression and league assignments have been reviewed. League changes will lock and the previous year will close.`,
                        )
                      )
                        return;
                      try {
                        await command("year.confirm", { id: y.id });
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : "Could not confirm year",
                        );
                      }
                    }}
                  >
                    <CheckCheck />
                    Confirm
                  </Button>
                ) : null}
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <Panel>
          <Empty icon={CalendarDays} title="No academic years yet">
            Start a draft year to set its dates and review student enrolments.
          </Empty>
        </Panel>
      )}
      {creating ? (
        <Modal
          title="Start a new academic year"
          onClose={() => setCreating(false)}
        >
          <Form
            submit="Create draft year"
            onSubmit={async (f) => {
              await command("year.create", {
                name: f.get("name"),
                start_date: f.get("start_date"),
                end_date: f.get("end_date"),
              });
              setCreating(false);
            }}
          >
            <Field label="Academic year name">
              <input
                name="name"
                required
                placeholder="2026–2027"
                maxLength={80}
              />
            </Field>
            <div className="form-row">
              <Field label="Start date">
                <input name="start_date" type="date" required />
              </Field>
              <Field label="End date">
                <input name="end_date" type="date" required />
              </Field>
            </div>
            <div className="notice">
              Existing students keep their previous class and league in the new
              draft. Review promotion, continuation, graduation, exits, and
              league assignments before confirming. No student is automatically
              promoted.
            </div>
          </Form>
        </Modal>
      ) : null}
      {review ? (
        <YearReview year={review} data={data} onClose={() => setReview(null)} />
      ) : null}
    </>
  );
}
function YearReview({
  year,
  data,
  onClose,
}: {
  year: Year;
  data: WorkspaceData;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const { data: rows, error } = useData<StudentRow[]>(
    `table=student_directory&academic_year_id=${year.id}&offset=${page * 100}`,
    [],
  );
  const [editing, setEditing] = useState<StudentRow | null>(null);
  return (
    <Modal
      title={`${year.name} · ${year.status === "draft" ? "Review assignments" : "Enrolments"}`}
      onClose={onClose}
    >
      <div className="details-content">
        <ErrorNotice message={error} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>League</th>
                <th>Progression</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.full_name}</strong>
                    <small>#{s.admission_number}</small>
                  </td>
                  <td>{s.class_name}</td>
                  <td>{s.league_name || "Unassigned"}</td>
                  <td>{s.progression}</td>
                  <td>
                    {year.status === "draft" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing(s)}
                      >
                        Review
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} onChange={setPage} count={rows.length} />
        {editing ? (
          <ProgressionForm
            key={editing.id}
            student={editing}
            year={year}
            data={data}
            onSaved={() => setEditing(null)}
          />
        ) : null}
        {!rows.length ? (
          <Empty title="No enrolments yet">
            Register students into this draft year from Students.
          </Empty>
        ) : null}
      </div>
    </Modal>
  );
}
function ProgressionForm({
  student,
  year,
  data,
  onSaved,
}: {
  student: StudentRow;
  year: Year;
  data: WorkspaceData;
  onSaved: () => void;
}) {
  const [progression, setProgression] = useState(student.progression);
  const sorted = [...data.classes].sort(
    (a, b) => (a.position || 0) - (b.position || 0),
  );
  const next = sorted[sorted.findIndex((c) => c.id === student.class_id) + 1];
  const [classId, setClass] = useState(student.class_id);
  return (
    <Form
      submit="Save student review"
      onSubmit={async (f) => {
        await command("enrolment.save", {
          student_id: student.id,
          academic_year_id: year.id,
          class_id: classId,
          league_id: f.get("league_id"),
          progression,
        });
        onSaved();
      }}
    >
      <h3>Review {student.full_name}</h3>
      <Field label="Progression">
        <select
          value={progression}
          onChange={(e) => setProgression(e.target.value)}
        >
          {["continuing", "promoted", "graduated", "left", "new admission"].map(
            (p) => (
              <option key={p}>{p}</option>
            ),
          )}
        </select>
      </Field>
      {progression === "promoted" && next ? (
        <div className="notice">
          Suggested next class: {next.name}
          <Button variant="outline" size="sm" onClick={() => setClass(next.id)}>
            Accept suggestion
          </Button>
        </div>
      ) : null}
      <Field label="Class (keep the current class or choose another)">
        <select value={classId} onChange={(e) => setClass(e.target.value)}>
          {data.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="League for this academic year">
        <select name="league_id" defaultValue={student.league_id || ""}>
          <option value="">Unassigned</option>
          {data.leagues
            .filter((l) => l.active || l.id === student.league_id)
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
        </select>
      </Field>
    </Form>
  );
}
export function SettingsPage({ data }: { data: WorkspaceData }) {
  const [message, setMessage] = useState("");
  const [newClass, setNewClass] = useState(false);
  const [classDraft,setClassDraft]=useState<Named|null>(null);
  const settings = data.overview?.settings;
  const [periodPage, setPeriodPage] = useState(0);
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
  const { data: periods } = useData<Period[]>(
    data.overview?.active_year
      ? `table=recognition_periods&academic_year_id=${data.overview.active_year}&offset=${periodPage * 100}`
      : null,
    [],
  );
  return (
    <>
      <div className="split-panel settings-layout">

        <Panel>
          <div className="panel-heading">
            <h2>Institution & academic calendar</h2>
            <Tag tone={settings ? "green" : "gray"}>
              {settings ? "Connected" : "Not connected"}
            </Tag>
          </div>
          <Form
            key={settings?.name}
            onSubmit={async (f) => {
              await command("settings.save", {
                name: f.get("name"),
                timezone: f.get("timezone"),
                week_start: Number(f.get("week_start")),
                month_start_day: Number(f.get("month_start_day")),
                theme: f.get("theme"),
              });
              setMessage(
                "Settings saved. Existing materialized recognition periods retain their dates; review future periods below.",
              );
            }}
          >
            <Field label="Institution name">
              <input
                name="name"
                required
                defaultValue={settings?.name || "Sincere Academy"}
              />
            </Field>
            <Field label="Institution time zone (IANA)">
              <input
                name="timezone"
                required
                defaultValue={settings?.timezone || "Asia/Kolkata"}
                placeholder="Asia/Kolkata"
              />
            </Field>
            <div className="form-row">
              <Field label="First day of the week">
                <select
                  name="week_start"
                  defaultValue={settings?.week_start ?? 1}
                >
                  {[
                    "Sunday",
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                  ].map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Academic month begins on day">
                <input
                  name="month_start_day"
                  type="number"
                  min="1"
                  max="31"
                  required
                  defaultValue={settings?.month_start_day ?? 1}
                />
              </Field>
            </div>
            <Field label="Institution default theme">
              <select name="theme" defaultValue={settings?.theme || "light"}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </Field>
            <div className="notice">
              For an October 19 – November 18 academic month, choose day 19.
              Quarters begin at the academic year’s start in three-month
              intervals. Review individual boundaries below before their period
              closes.
            </div>
            {message ? (
              <div role="status" className="notice">
                {message}
              </div>
            ) : null}
          </Form>
          <BrandingUpload />
        </Panel>
      </div>
      <Panel className="mt-6">
        <div className="panel-heading">
          <h2>Classes</h2>
          <Button variant="outline" onClick={() => {setClassDraft(null);setNewClass(true)}}>
            <Plus />
            Add class
          </Button>
        </div>
        <div className="flex flex-wrap gap-3 p-5 pt-0">
          {!data.classes.length && (
            <span className="record-hint">No classes configured.</span>
          )}
          {data.classes.map((c) => (
            <Button variant="outline" key={c.id} onClick={()=>{setClassDraft(c);setNewClass(true)}}>{c.name}{!c.active && " · inactive"}</Button>
          ))}
        </div>
      </Panel>
      <Panel className="mt-6">
        <div className="panel-heading">
          <h2>Academic recognition boundaries</h2>
          <Tag>Academic calendar</Tag>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Category</th>
                <th>Starts</th>
                <th>Ends</th>
                <th>Academic month</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.category}</td>
                  <td>{dateLabel(p.start_date)}</td>
                  <td>{dateLabel(p.end_date)}</td>
                  <td>{dateLabel(p.academic_month)}</td>
                  <td>
                    {!p.finalized_at &&
                    p.end_date >= (data.overview?.today || "") ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingPeriod(p)}
                      >
                        Adjust
                      </Button>
                    ) : (
                      <Tag tone="gray">Closed</Tag>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!periods.length && (
          <Empty icon={CalendarDays} title="No academic periods">
            Confirm an academic year to generate its reporting periods.
          </Empty>
        )}
        <Pager
          page={periodPage}
          onChange={setPeriodPage}
          count={periods.length}
        />
      </Panel>
      {newClass ? (
        <Modal title={classDraft?"Edit class":"Create class"} onClose={() => setNewClass(false)}>
          <Form
            onSubmit={async (f) => {
              await command("class.save", {
                id:classDraft?.id, name: f.get("name"),
                position: Number(f.get("position")),
                active: f.get("active")==="on",
              });
              setNewClass(false);
            }}
          >
            <Field label="Class name">
              <input name="name" required defaultValue={classDraft?.name}/>
            </Field>
            <Field label="Progression order">
              <input
                name="position"
                type="number"
                required
                defaultValue={classDraft?.position??(data.classes.length + 1)}
              />
            </Field>
          <label className="check-label"><input type="checkbox" name="active" defaultChecked={classDraft?.active??true}/> Active class</label></Form>
        </Modal>
      ) : null}
      {editingPeriod ? (
        <Modal
          title="Adjust academic period"
          onClose={() => setEditingPeriod(null)}
        >
          <Form
            onSubmit={async (f) => {
              await command("period.save", {
                id: editingPeriod.id,
                ...Object.fromEntries(f),
              });
              setEditingPeriod(null);
            }}
          >
            <Field label="Period name">
              <input name="name" required defaultValue={editingPeriod.name} />
            </Field>
            <Field label="Start date">
              <input
                name="start_date"
                type="date"
                required
                defaultValue={editingPeriod.start_date}
              />
            </Field>
            <Field label="End date">
              <input
                name="end_date"
                type="date"
                required
                defaultValue={editingPeriod.end_date}
              />
            </Field>
            <Field label="Academic-month anchor (weekly winner rotation)">
              <input
                name="academic_month"
                type="date"
                required
                defaultValue={editingPeriod.academic_month}
              />
            </Field>
          </Form>
        </Modal>
      ) : null}
    </>
  );
}
export function HistoryPage({ timezone }: { timezone: string }) {
  const [page, setPage] = useState(0);
  const { data: logs, error } = useData<
    {
      id: string;
      action: string;
      staff_name: string;
      created_at: string;
      related_id: string;
      before_data: object;
      after_data: object;
    }[]
  >(`table=audit_logs&offset=${page * 100}`, []);
  return (
    <>
      <ErrorNotice message={error} />
      <Panel>
        <div className="panel-heading">
          <h2>Protected audit trail</h2>
          <Tag>Append only</Tag>
        </div>
        {logs.length ? (
          <div className="timeline">
            {logs.map((l) => (
              <div className="timeline-item" key={l.id}>
                <h3>{l.action}</h3>
                <p>
                  {l.staff_name} · {dateTimeLabel(l.created_at, timezone)} ·{" "}
                  {l.related_id || "Institution operation"}
                </p>
                <details>
                  <summary className="text-xs mt-3 cursor-pointer text-[var(--purple)]">
                    View recorded details
                  </summary>
                  {l.before_data ? (
                    <pre>Before: {JSON.stringify(l.before_data, null, 2)}</pre>
                  ) : null}
                  <pre>After: {JSON.stringify(l.after_data, null, 2)}</pre>
                </details>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="No staff activity recorded">
            Changes to academy records appear here with their date, author and
            details.
          </Empty>
        )}
        <Pager page={page} onChange={setPage} count={logs.length} />
      </Panel>
    </>
  );
}
