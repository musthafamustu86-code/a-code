"use client";
import { Check, Star, TrendingUp, CalendarCheck, X } from "lucide-react";
import { dateLabel, timeLabel } from "@/lib/client";
import type { StudentRow, Transaction } from "@/lib/types";
import { StudentAvatar } from "./photos";

export interface StudentAttendanceRow {
  id: string;
  session_id: string;
  present: boolean;
  stars: number;
}

export interface SessionLite {
  id: string;
  attendance_date: string;
  attendance_time?: string | null;
  activity_name: string;
  status?: string;
}

function cumulativeStars(transactions: Transaction[]) {
  const byDate = new Map<string, number>();
  [...transactions]
    .sort((a, b) => (a.earned_on < b.earned_on ? -1 : 1))
    .forEach((t) =>
      byDate.set(
        t.earned_on,
        (byDate.get(t.earned_on) || 0) + Number(t.amount),
      ),
    );
  let running = 0;
  return [...byDate.entries()].map(([date, amount]) => {
    running += amount;
    return { date, total: running };
  });
}

export function StudentCard({
  student,
  academy,
  yearName,
  transactions,
  records,
  sessions,
}: {
  student: StudentRow;
  academy: string;
  yearName?: string;
  transactions: Transaction[];
  records: StudentAttendanceRow[];
  sessions: SessionLite[];
}) {
  const totalStars = transactions.reduce(
    (sum, t) => sum + Number(t.amount),
    0,
  );
  const byId = new Map(sessions.map((session) => [session.id, session]));
  const attended = records
    .map((record) => ({ ...record, session: byId.get(record.session_id) }))
    .filter(
      (record): record is StudentAttendanceRow & { session: SessionLite } =>
        !!record.session && record.session.status !== "trash",
    )
    .sort((a, b) =>
      a.session.attendance_date < b.session.attendance_date ? -1 : 1,
    );
  const present = attended.filter((record) => record.present).length;
  const absent = attended.length - present;
  const percentage = attended.length
    ? Math.round((present / attended.length) * 1000) / 10
    : null;
  const points = cumulativeStars(transactions);
  return (
    <>
      <section className="student-card">
        <div className="student-card-photo">
          <StudentAvatar student={student} />
        </div>
        <div className="student-card-body">
          <small className="student-card-academy">{academy}</small>
          <h2>{student.full_name}</h2>
          <p className="student-card-meta">
            #{student.admission_number} · {student.class_name}
            {student.league_name ? ` · ${student.league_name}` : ""}
            {yearName ? ` · ${yearName}` : ""}
          </p>
          <div className="student-card-stats">
            <div>
              <strong>{totalStars}</strong>
              <span>Stars earned</span>
            </div>
            <div>
              <strong>{percentage === null ? "—" : `${percentage}%`}</strong>
              <span>Attendance</span>
            </div>
            <div>
              <strong>
                {present}/{attended.length}
              </strong>
              <span>Sessions present</span>
            </div>
          </div>
        </div>
        <span className="student-card-tag">
          {student.active ? "Student ID" : "Inactive student"}
        </span>
        <span className="student-card-stripe" aria-hidden="true" />
      </section>

      <div className="student-insights">
        <section className="insight">
          <header>
            <h3>
              <TrendingUp size={15} aria-hidden="true" />
              Star progress
            </h3>
            <span>{totalStars} total</span>
          </header>
          <StarProgress points={points} />
        </section>
        <section className="insight">
          <header>
            <h3>
              <CalendarCheck size={15} aria-hidden="true" />
              Attendance
            </h3>
            <span>
              {present} present · {absent} absent
            </span>
          </header>
          <div className="attendance-summary">
            <AttendanceRing present={present} absent={absent} />
            <div className="attendance-legend">
              <span>
                <i className="legend-dot present" aria-hidden="true" />
                Present {present}
              </span>
              <span>
                <i className="legend-dot absent" aria-hidden="true" />
                Absent {absent}
              </span>
              <span className="attendance-total">
                {attended.length} session{attended.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          {attended.length ? (
            <div
              className="attendance-flow"
              role="img"
              aria-label="Attendance flow for every conducted session"
            >
              {attended.map((record) => (
                <span
                  key={record.id}
                  className={"flow-dot " + (record.present ? "present" : "absent")}
                  title={`${dateLabel(record.session.attendance_date)} · ${record.session.activity_name} · ${record.present ? "Present" : "Absent"}`}
                />
              ))}
            </div>
          ) : null}
        </section>
      </div>

      <section className="attendance-history">
        <header>
          <h3>Attendance record</h3>
          <span>Every conducted session</span>
        </header>
        {attended.length ? (
          <div className="attendance-list">
            {[...attended].reverse().map((record) => (
              <div className="attendance-row" key={record.id}>
                <span
                  className={
                    "attendance-mark " +
                    (record.present ? "present" : "absent")
                  }
                  aria-hidden="true"
                >
                  {record.present ? <Check size={12} /> : <X size={12} />}
                </span>
                <div>
                  <b>{record.session.activity_name}</b>
                  <small>
                    {dateLabel(record.session.attendance_date)}
                    {record.session.attendance_time
                      ? ` · ${timeLabel(record.session.attendance_time)}`
                      : ""}
                  </small>
                </div>
                <span className="attendance-state">
                  {record.present ? "Present" : "Absent"}
                  {record.stars ? (
                    <em>
                      <Star size={11} aria-hidden="true" />+{record.stars}
                    </em>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="insight-empty">
            No attendance has been submitted for this student yet.
          </p>
        )}
      </section>
    </>
  );
}

function StarProgress({ points }: { points: { date: string; total: number }[] }) {
  if (!points.length)
    return <p className="insight-empty">No stars recorded yet.</p>;
  const width = 320;
  const height = 108;
  const pad = 8;
  const max = Math.max(1, ...points.map((point) => point.total));
  const span = width - pad * 2;
  const x = (index: number) =>
    points.length === 1 ? width / 2 : pad + (index / (points.length - 1)) * span;
  const y = (value: number) => height - pad - (value / max) * (height - pad * 2);
  const line = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point.total).toFixed(1)}`,
    )
    .join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${height - pad} L${x(0).toFixed(1)},${height - pad} Z`;
  const last = points[points.length - 1];
  return (
    <svg
      className="star-progress"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Star progress: ${points.length} award days, ${last.total} stars in total`}
    >
      <defs>
        <linearGradient id="star-progress-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2f7a5f" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#2f7a5f" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line
        x1={pad}
        y1={height - pad}
        x2={width - pad}
        y2={height - pad}
        className="star-progress-base"
      />
      {points.length > 1 ? <path d={area} fill="url(#star-progress-fill)" /> : null}
      <path d={line} className="star-progress-line" />
      <circle cx={x(points.length - 1)} cy={y(last.total)} r="3.6" className="star-progress-dot" />
      <text
        x={x(points.length - 1)}
        y={Math.max(10, y(last.total) - 9)}
        textAnchor="end"
        className="star-progress-label"
      >
        {last.total}
      </text>
    </svg>
  );
}

function AttendanceRing({
  present,
  absent,
}: {
  present: number;
  absent: number;
}) {
  const total = present + absent;
  const ratio = total ? present / total : 0;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg
      className="attendance-ring"
      viewBox="0 0 100 100"
      role="img"
      aria-label={
        total
          ? `${Math.round(ratio * 100)} percent attendance across ${total} sessions`
          : "No attendance recorded"
      }
    >
      <circle cx="50" cy="50" r={radius} className="ring-track" />
      <circle
        cx="50"
        cy="50"
        r={radius}
        className="ring-value"
        strokeDasharray={`${circumference * ratio} ${circumference}`}
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="55" textAnchor="middle" className="ring-label">
        {total ? `${Math.round(ratio * 100)}%` : "—"}
      </text>
    </svg>
  );
}
