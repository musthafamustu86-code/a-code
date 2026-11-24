"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarDays, ClipboardList, Star } from "lucide-react";
import {
  allPages,
  command,
  dateLabel,
  queryString,
  timeLabel,
  useData,
} from "@/lib/client";
import { buttonVariants } from "@/components/ui/button";
import type { StudentRow } from "@/lib/types";
import type { WorkspaceData } from "./workspace";
import {
  Button,
  Empty,
  ErrorNotice,
  Field,
  Modal,
  Panel,
  SearchBox,
} from "./ui";

function currentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function AttendanceSheet({
  data,
  id,
}: {
  data: WorkspaceData;
  id: string;
}) {
  const form = data.activities.find((a) => a.id === id);
  const [date, setDate] = useState(data.overview?.today ?? "");
  const [time, setTime] = useState(currentTime);
  const assignment = useData<{ class_id: string }[]>(
    `all:table=activity_classes&activity_id=${id}`,
    [],
  );
  const [classes, setClasses] = useState<string[] | null>(null);
  const [roster, setRoster] = useState<StudentRow[] | null>(null);
  const [absent, setAbsent] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [remarks, setRemarks] = useState("");
  const [confirm, setConfirm] = useState<"stars" | "marks" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{
    award: boolean;
    students: number;
    present: number;
    stars: number;
  } | null>(null);
  const started = useRef(false);
  const request = useRef("");
  const chosen = classes ?? assignment.data.map((row) => row.class_id);
  const stars = form?.reward_enabled ? form.reward : 0;
  const present = (roster?.length ?? 0) - absent.size;

  const load = useCallback(
    async (ids: string[]) => {
      setBusy(true);
      setError("");
      setDone(null);
      try {
        const pages = await Promise.all(
          ids.map((class_id) =>
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
        request.current = crypto.randomUUID();
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    },
    [data.overview?.active_year],
  );

  const assigned = assignment.data.map((row) => row.class_id).join(",");
  useEffect(() => {
    if (assignment.loading || !form) return;
    // Deferred so the roster request never sets state synchronously in the effect.
    const timer = setTimeout(() => {
      if (started.current) return;
      started.current = true;
      if (assigned) void load(assigned.split(","));
    }, 0);
    return () => clearTimeout(timer);
  }, [assignment.loading, assigned, form, load]);

  async function submit(award: boolean) {
    if (!roster || !form) return;
    if (!date || !time) {
      setError("Choose the session date and time.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await command("attendance.submit", {
        activity_id: id,
        date,
        time,
        classes: chosen,
        remarks,
        expected_reward: award ? stars : 0,
        award_stars: award,
        request_id: request.current,
        records: roster.map((s) => ({
          student_id: s.id,
          present: !absent.has(s.id),
        })),
      });
      setDone({
        award,
        students: roster.length,
        present,
        stars: award ? present * stars : 0,
      });
      setRoster(null);
      setRemarks("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not submit the attendance.",
      );
    } finally {
      setConfirm(null);
      setBusy(false);
    }
  }

  if (!form) {
    return (
      <Panel>
        <Empty icon={ClipboardList} title="Attendance form not found">
          This form may have been removed. Return to{" "}
          <Link className="underline" href="/take-attendance">
            Take attendance
          </Link>{" "}
          and choose another form.
        </Empty>
      </Panel>
    );
  }

  return (
    <Panel>
      <div className="form">
        <div className="panel-heading">
          <div>
            <h2>{form.name}</h2>
            <p className="text-xs text-[var(--soft)]">
              {date && time
                ? `${dateLabel(date)} at ${timeLabel(time)}`
                : "Choose the session date and time"}{" "}
              ·{" "}
              {form.reward_enabled
                ? `${stars} ${stars === 1 ? "star" : "stars"} per present student`
                : "Star rewards off"}
            </p>
          </div>
          <Link
            className={buttonVariants({ variant: "outline", size: "sm" })}
            href="/take-attendance"
          >
            <ArrowLeft size={14} />
            All forms
          </Link>
        </div>
        {form.description ? <p>{form.description}</p> : null}
        <div className="form-row">
          <Field label="Session date">
            <input
              type="date"
              value={date}
              max={data.overview?.today}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Session time">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </Field>
        </div>
        <ErrorNotice message={error || assignment.error} />
        {done ? (
          <div className="notice" role="status">
            <CalendarDays size={16} />
            <span>
              Attendance submitted for {done.students} students · {done.present}{" "}
              present ·{" "}
              {done.award
                ? `${done.stars} stars awarded`
                : "no stars awarded"}.{" "}
              <Link className="underline" href="/attendance-records">
                View attendance records
              </Link>
            </span>
          </div>
        ) : null}
        <fieldset className="classchips">
          <legend>Classes</legend>
          {data.classes
            .filter((c) => c.active)
            .map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={chosen.includes(c.id)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...chosen, c.id]
                      : chosen.filter((classId) => classId !== c.id);
                    setClasses(next);
                    setRoster(null);
                    setDone(null);
                  }}
                />
                {c.name}
              </label>
            ))}
        </fieldset>
        <Button
          variant="outline"
          disabled={!chosen.length || busy || !data.overview?.active_year}
          onClick={() => void load(chosen)}
        >
          {roster ? "Reload students" : "Load students"}
        </Button>
        {assignment.loading || (busy && !roster) ? (
          <p role="status">Loading attendance…</p>
        ) : null}
        {absent.size === 0 && roster ? (
          <p className="text-xs text-[var(--soft)]">
            Everyone is marked present by default. Untick a student to mark them
            absent.
          </p>
        ) : null}
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
              {present} present · {absent.size} absent ·{" "}
              {present * stars} stars
            </p>
            <div className="controls">
              <Button
                disabled={busy || !roster.length || !date || !time}
                onClick={() => setConfirm("stars")}
              >
                <Star size={15} />
                Submit attendance &amp; stars
              </Button>
              <Button
                variant="outline"
                disabled={busy || !roster.length || !date || !time}
                onClick={() => setConfirm("marks")}
              >
                Submit attendance
              </Button>
            </div>
          </>
        )}
        {confirm ? (
          <Modal
            title={
              confirm === "stars"
                ? "Submit attendance & stars"
                : "Submit attendance"
            }
            onClose={() => {
              if (!busy) setConfirm(null);
            }}
          >
            <div className="form">
              <p>
                {form.name} · {dateLabel(date)} at {timeLabel(time)}
              </p>
              <p>
                {present} present · {absent.size} absent ·{" "}
                {confirm === "stars"
                  ? `${present * stars} stars will be awarded`
                  : "no stars will be awarded"}
                .
              </p>
              <p>
                Submitted attendance is locked and appears in Attendance
                records.
              </p>
              <Button
                disabled={busy}
                onClick={() => void submit(confirm === "stars")}
              >
                {busy
                  ? "Submitting…"
                  : confirm === "stars"
                    ? "Submit attendance & stars"
                    : "Submit attendance"}
              </Button>
            </div>
          </Modal>
        ) : null}
      </div>
    </Panel>
  );
}
