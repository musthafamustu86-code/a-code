"use client";
import { useEffect, useRef, useState } from "react";
import { Pin } from "lucide-react";
import { allPages, command, queryString, useData } from "@/lib/client";
import type { StudentRow } from "@/lib/types";
import type { WorkspaceData } from "./workspace";
import { Button, ErrorNotice, Field, Modal, Panel, SearchBox } from "./ui";
export function Register({ data }: { data: WorkspaceData }) {
  const [activity, setActivity] = useState(""),
    [date, setDate] = useState(data.overview!.today),
    [classes, setClasses] = useState<string[]>([]),
    [roster, setRoster] = useState<StudentRow[] | null>(null),
    [absent, setAbsent] = useState<Set<string>>(new Set()),
    [search, setSearch] = useState(""),
    [remarks, setRemarks] = useState(""),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [request, setRequest] = useState("");
  const pins = useData<{ activity_id: string; position: number }[]>(
    "table=pinned_forms",
    [],
  );
  const pinned = (id: string) =>
    pins.data.find((p) => p.activity_id === id)?.position ?? 9;
  const activities = data.activities
    .filter((a) => a.active)
    .sort(
      (a, b) => pinned(a.id) - pinned(b.id) || a.name.localeCompare(b.name),
    );
  const pinnedForms = activities.filter((a) => pinned(a.id) < 9);
  const form = activities.find((a) => a.id === activity),
    stars = form?.reward_enabled ? form.reward : 0,
    present = (roster?.length || 0) - absent.size;
  // Saved class assignment of the chosen form, used to preselect the classes.
  const assignment = useData<{ class_id: string }[]>(
    activity ? `table=activity_classes&activity_id=${activity}` : null,
    [],
  );
  const applied = useRef("");
  useEffect(() => {
    if (!activity || assignment.loading || applied.current === activity) return;
    applied.current = activity;
    setClasses(assignment.data.map((row) => row.class_id));
    setRoster(null);
  }, [activity, assignment.loading, assignment.data]);
  function reset() {
    setRoster(null);
    setNotice("");
    setError("");
  }
  async function load() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const pages = await Promise.all(
        classes.map((class_id) =>
          allPages<StudentRow>(
            queryString({
              table: "student_directory",
              class_id,
              active: "true",
              academic_year_id: data.overview?.active_year,
            }),
          ),
        ),
      );
      setRoster(
        pages
          .flat()
          .filter((r) => !["graduated", "left"].includes(r.progression))
          .sort((a, b) => a.full_name.localeCompare(b.full_name)),
      );
      setAbsent(new Set());
      setRequest(crypto.randomUUID());
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!roster) return;
    setBusy(true);
    try {
      await command("attendance.submit", {
        activity_id: activity,
        date,
        classes,
        remarks,
        expected_reward: stars,
        request_id: request,
        records: roster.map((s) => ({
          student_id: s.id,
          present: !absent.has(s.id),
        })),
      });
      setNotice(
        "Attendance submitted. The locked register is available in Attendance records.",
      );
      setRoster(null);
      setRemarks("");
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      setConfirm(false);
      setBusy(false);
    }
  }
  return (
    <Panel>
      <div className="form">
        <fieldset disabled={busy}>
          {pinnedForms.length ? (
            <div className="pinrow">
              <span className="text-xs text-[var(--soft)]">Pinned forms</span>
              {pinnedForms.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={"chip" + (activity === a.id ? " active" : "")}
                  onClick={() => {
                    setActivity(a.id);
                    reset();
                  }}
                >
                  <Pin size={12} />
                  {a.name}
                </button>
              ))}
            </div>
          ) : null}
          <Field label="Attendance form">
            <select
              value={activity}
              onChange={(e) => {
                setActivity(e.target.value);
                reset();
              }}
            >
              <option value="">Select activity</option>
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {pinned(a.id) < 9 ? "★ " : ""}
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          {assignment.data.length ? (
            <p className="text-xs text-[var(--soft)]">
              This form is assigned to {assignment.data.length}{" "}
              {assignment.data.length === 1 ? "class" : "classes"}, already
              selected below. Adjust the classes if this session is different.
            </p>
          ) : null}
          <Field label="Session date">
            <input
              type="date"
              value={date}
              max={data.overview!.today}
              onChange={(e) => {
                setDate(e.target.value);
                reset();
              }}
            />
          </Field>
          <fieldset className="classchips">
            <legend>Classes</legend>
            {data.classes
              .filter((c) => c.active)
              .map((c) => (
                <label key={c.id}>
                  <input
                    type="checkbox"
                    checked={classes.includes(c.id)}
                    onChange={(e) => {
                      setClasses(
                        e.target.checked
                          ? [...classes, c.id]
                          : classes.filter((id) => id !== c.id),
                      );
                      reset();
                    }}
                  />
                  {c.name}
                </label>
              ))}
          </fieldset>
          <Button
            disabled={
              !form || !classes.length || !date || !data.overview?.active_year
            }
            onClick={load}
          >
            Load students
          </Button>
        </fieldset>
        {!data.overview?.active_year && (
          <p>Confirm an academic year to start taking attendance.</p>
        )}
        <ErrorNotice message={error || pins.error} />
        {notice && <p role="status">{notice}</p>}
        {roster && (
          <>
            <h2>Attendance register</h2>
            <SearchBox value={search} onChange={setSearch} />
            <div className="controls">
              <Button variant="outline" onClick={() => setAbsent(new Set())}>
                Mark all present
              </Button>
              <Button
                variant="outline"
                onClick={() => setAbsent(new Set(roster.map((s) => s.id)))}
              >
                Mark all absent
              </Button>
            </div>
            {roster
              .filter((s) =>
                (s.full_name + " " + s.admission_number)
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((s) => (
                <label className="ledgerrow" key={s.id}>
                  <div>
                    <b>{s.full_name}</b>
                    <small>
                      {s.admission_number} · {s.class_name}
                    </small>
                  </div>
                  <input
                    type="checkbox"
                    checked={!absent.has(s.id)}
                    onChange={(e) => {
                      const next = new Set(absent);
                      if (e.target.checked) next.delete(s.id);
                      else next.add(s.id);
                      setAbsent(next);
                    }}
                  />
                  {absent.has(s.id) ? "Absent" : "Present"}
                </label>
              ))}
            <Field label="Staff remarks">
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </Field>
            <p>
              {present} present · {absent.size} absent · {present * stars} stars
            </p>
            <Button disabled={!roster.length} onClick={() => setConfirm(true)}>
              Review submission
            </Button>
          </>
        )}
        {confirm && (
          <Modal
            title="Confirm attendance"
            onClose={() => {
              if (!busy) setConfirm(false);
            }}
          >
            <div className="form">
              <p>
                {form?.name} · {date}
              </p>
              <p>
                Submit {roster?.length} marks and award {stars} stars to each of{" "}
                {present} present students? Attendance marks will be locked.
              </p>
              <Button disabled={busy} onClick={submit}>
                {busy ? "Submitting…" : "Confirm and submit"}
              </Button>
            </div>
          </Modal>
        )}
      </div>
    </Panel>
  );
}
