"use client";

import Link from "next/link";
import { useId, useState, useSyncExternalStore } from "react";
import { CalendarDays, ChevronDown, ChevronUp } from "lucide-react";
import { queryString, useData } from "@/lib/client";
import type { Overview, Period, Transaction, Year } from "@/lib/types";
import styles from "./calendar.module.css";

type Kind = "week" | "month" | "quarter" | "year" | "custom" | "all";
type DateRange = { start: string; end: string };
type Preferences = {
  yearId?: string;
  kind?: Kind;
  choices?: Partial<Record<Kind, string | DateRange>>;
};

export interface ReportingSummary {
  students: number;
  stars: number;
  attendance: number | null;
  recent: Transaction[];
}

const kinds: Record<Kind, string> = {
  week: "Week",
  month: "Month",
  quarter: "Quarter",
  year: "Year",
  custom: "Custom dates",
  all: "All time",
};
const storageKey = "star-reporting-calendar-v1";
let memory = "";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot() {
  try {
    return window.sessionStorage.getItem(storageKey) ?? memory;
  } catch {
    return memory;
  }
}

function preferences(saved: string): Preferences {
  try {
    const value = JSON.parse(saved);
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function save(value: Preferences) {
  memory = JSON.stringify(value);
  try {
    window.sessionStorage.setItem(storageKey, memory);
  } catch {
    /* Memory still supports navigation. */
  }
  listeners.forEach((listener) => listener());
}

const shortDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
function formatRange(range: DateRange) {
  return shortDate.formatRange(
    new Date(range.start + "T12:00:00Z"),
    new Date(range.end + "T12:00:00Z"),
  );
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function dateError(start: string, end: string, year?: Year) {
  if (!validDate(start) || !validDate(end))
    return "Choose a start date and an end date.";
  if (start > end) return "The end date must be on or after the start date.";
  if (year && (start < year.start_date || end > year.end_date))
    return "Both dates must fall within the selected academic year.";
  return "";
}

export function useAcademicCalendar(
  years: Year[],
  overview: Overview | null,
  extended = false,
) {
  const saved = preferences(
    useSyncExternalStore(subscribe, snapshot, () => ""),
  );
  const confirmed = years.filter((item) => item.status !== "draft");
  const year =
    confirmed.find((item) => item.id === saved.yearId) ??
    confirmed.find((item) => item.status === "active") ??
    confirmed[0];
  const availableKinds: Kind[] = extended
    ? ["week", "month", "quarter", "year", "custom", "all"]
    : ["week", "month", "year"];
  const kind: Kind =
    saved.kind && availableKinds.includes(saved.kind) ? saved.kind : "week";
  const {
    data: periods,
    loading,
    error,
  } = useData<Period[]>(
    year && kind !== "all" && kind !== "year" && kind !== "custom"
      ? "all:" +
          queryString({
            table: "recognition_periods",
            academic_year_id: year.id,
            category: kind,
          })
      : null,
    [],
  );
  const choice = saved.yearId === year?.id ? saved.choices?.[kind] : undefined;
  const today = overview?.today ?? "";
  const current = periods.find(
    (item) => item.start_date <= today && item.end_date >= today,
  );
  const nearest =
    current ??
    periods.filter((item) => item.end_date < today).at(-1) ??
    periods[0];
  const selected =
    typeof choice === "string"
      ? (periods.find((item) => item.id === choice) ?? nearest)
      : nearest;
  const custom =
    year &&
    choice &&
    typeof choice === "object" &&
    !dateError(choice.start, choice.end, kind === "custom" ? undefined : year)
      ? choice
      : null;
  let range: DateRange | null = null;
  if (year && kind !== "all") {
    if (custom) range = custom;
    else if (kind === "year" || kind === "custom")
      range = { start: year.start_date, end: year.end_date };
    else if (selected)
      range = { start: selected.start_date, end: selected.end_date };
  }
  function setChoice(value?: string | DateRange) {
    const choices = saved.yearId === year?.id ? saved.choices : {};
    save({ yearId: year?.id, kind, choices: { ...choices, [kind]: value } });
  }
  const rangeLabel =
    kind === "all"
      ? "All academic years"
      : range
        ? formatRange(range)
        : loading
          ? "Loading dates…"
          : "Choose dates";
  return {
    confirmed,
    year,
    kind,
    periods,
    availableKinds,
    range,
    rangeLabel,
    custom,
    today,
    selected,
    current,
    loading,
    error,
    isCurrentWeek:
      kind === "week" && !custom && !!current && selected?.id === current.id,
    filterKey: [year?.id, kind, range?.start, range?.end].join("/"),
    summaryQuery:
      year && range
        ? queryString({ rpc: "reporting_summary", year: year.id, ...range })
        : null,
    setYear: (id: string) => save({ yearId: id, kind }),
    setKind: (value: Kind) =>
      save({
        yearId: year?.id,
        kind: value,
        choices: saved.yearId === year?.id ? saved.choices : {},
      }),
    setChoice,
  };
}

type Calendar = ReturnType<typeof useAcademicCalendar>;

function DateEditor({
  calendar,
  year,
  close,
}: {
  calendar: Calendar;
  year: Year;
  close: () => void;
}) {
  const { range, periods, selected, custom, kind, current } = calendar;
  const [start, setStart] = useState(range?.start ?? year.start_date);
  const [end, setEnd] = useState(range?.end ?? year.end_date);
  const [error, setError] = useState("");
  const datesId = useId();
  function apply(value?: string | DateRange) {
    calendar.setChoice(value);
    close();
  }
  return (
    <div className={styles.editor}>
      {periods.length > 0 && (
        <div className={styles.preset}>
          <label>
            Scheduled {kind}
            <select
              value={custom ? "" : (selected?.id ?? "")}
              onChange={(event) => apply(event.target.value)}
            >
              {custom && (
                <option value="" disabled>
                  Custom dates selected
                </option>
              )}
              {periods.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatRange({ start: item.start_date, end: item.end_date })}
                  {item.id === current?.id ? " (current)" : ""}
                </option>
              ))}
            </select>
          </label>
          {kind === "week" && (
            <label>
              Week containing
              <input
                type="date"
                min={year.start_date}
                max={year.end_date}
                onChange={(event) => {
                  const day = event.target.value;
                  const match = periods.find(
                    (item) => item.start_date <= day && item.end_date >= day,
                  );
                  if (match) apply(match.id);
                  else if (day)
                    setError(
                      "There is no scheduled week for that date. Choose custom dates below.",
                    );
                }}
              />
            </label>
          )}
        </div>
      )}
      <form
        className={styles.dates}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const message = dateError(
            start,
            end,
            kind === "custom" ? undefined : year,
          );
          if (message) setError(message);
          else apply({ start, end });
        }}
      >
        <label>
          Start date
          <input
            type="date"
            value={start}
            required
            min={kind === "custom" ? undefined : year.start_date}
            max={kind === "custom" ? undefined : year.end_date}
            aria-describedby={error ? datesId : undefined}
            onChange={(event) => {
              setStart(event.target.value);
              setError("");
            }}
          />
        </label>
        <label>
          End date
          <input
            type="date"
            value={end}
            required
            min={start || year.start_date}
            max={kind === "custom" ? undefined : year.end_date}
            aria-describedby={error ? datesId : undefined}
            onChange={(event) => {
              setEnd(event.target.value);
              setError("");
            }}
          />
        </label>
        <button type="submit" className={styles.apply}>
          Apply dates
        </button>
        {(current || custom) && (
          <button
            type="button"
            className={styles.reset}
            onClick={() => apply()}
          >
            {current ? "Use current " + kind : "Reset dates"}
          </button>
        )}
      </form>
      {error && (
        <p id={datesId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function AcademicCalendarPicker({ calendar }: { calendar: Calendar }) {
  const [expanded, setExpanded] = useState(false);
  const editorId = useId();
  const { year, kind } = calendar;
  return (
    <section
      className={styles.calendar}
      aria-label="Reporting period"
      onKeyDown={(event) => {
        if (event.key === "Escape" && expanded) {
          setExpanded(false);
          document.getElementById(editorId + "-trigger")?.focus();
        }
      }}
    >
      <div className={styles.bar}>
        <div className={styles.year}>
          <CalendarDays size={19} aria-hidden="true" />
          <label>
            Academic year
            <select
              aria-label="Academic year"
              value={kind === "all" ? "all" : (year?.id ?? "")}
              disabled={!year || kind === "all"}
              onChange={(event) => {
                calendar.setYear(event.target.value);
                setExpanded(false);
              }}
            >
              {!year && <option value="">No confirmed year</option>}
              {kind === "all" && (
                <option value="all">All academic years</option>
              )}
              {calendar.confirmed.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div
          className={styles.periods}
          role="group"
          aria-label="Reporting frequency"
        >
          {calendar.availableKinds.map((item) => (
            <button
              key={item}
              type="button"
              disabled={!year}
              aria-pressed={kind === item}
              onClick={() => {
                calendar.setKind(item);
                setExpanded(item === "custom");
              }}
            >
              {kinds[item]}
            </button>
          ))}
        </div>
        {year && kind !== "all" && (
          <button
            id={editorId + "-trigger"}
            type="button"
            className={styles.trigger}
            aria-expanded={expanded}
            aria-controls={editorId}
            aria-label={"Choose dates, " + calendar.rangeLabel}
            onClick={() => setExpanded(!expanded)}
          >
            {calendar.rangeLabel}
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        )}
        {!year && (
          <Link href="/academic-years" className={styles.setup}>
            Academic year setup
          </Link>
        )}
      </div>
      {calendar.error && (
        <p role="alert" className={styles.error}>
          {calendar.error}
        </p>
      )}
      <div id={editorId}>
        {expanded && year && kind !== "all" && (
          <DateEditor
            key={calendar.filterKey}
            year={year}
            calendar={calendar}
            close={() => {
              setExpanded(false);
              document.getElementById(editorId + "-trigger")?.focus();
            }}
          />
        )}
      </div>
    </section>
  );
}
