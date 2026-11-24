"use client";
import Link from "next/link";
import { useState } from "react";
import { CalendarDays, ClipboardList, Pin } from "lucide-react";
import { command, useData } from "@/lib/client";
import { buttonVariants } from "@/components/ui/button";
import type { WorkspaceData } from "./workspace";
import { Empty, ErrorNotice, Panel } from "./ui";

// Each staff member can pin this many attendance forms for quick access.
const PIN_LIMIT = 5;

export function Register({ data }: { data: WorkspaceData }) {
  const [pinError, setPinError] = useState("");
  const pins = useData<{ activity_id: string; position: number }[]>(
    "table=pinned_forms",
    [],
  );
  const classLinks = useData<{ activity_id: string; class_id: string }[]>(
    "all:table=activity_classes",
    [],
  );
  const leagueLinks = useData<{ activity_id: string; league_id: string }[]>(
    "all:table=activity_leagues",
    [],
  );
  const studentLinks = useData<{ activity_id: string; student_id: string }[]>(
    "all:table=activity_students",
    [],
  );
  const pinned = (id: string) =>
    pins.data.find((p) => p.activity_id === id)?.position ?? PIN_LIMIT + 1;
  const activities = data.activities
    .filter((a) => a.active)
    .sort(
      (a, b) => pinned(a.id) - pinned(b.id) || a.name.localeCompare(b.name),
    );
  const pinnedForms = activities.filter((a) => pinned(a.id) <= PIN_LIMIT);
  const targets = (id: string) => {
    const leagues = data.leagues
      .filter((l) => leagueLinks.data.some((r) => r.activity_id === id && r.league_id === l.id))
      .map((l) => l.name);
    const classes = classLinks.data.filter((r) => r.activity_id === id).length;
    const students = studentLinks.data.filter(
      (r) => r.activity_id === id,
    ).length;
    return [
      leagues.length
        ? `${leagues.join(", ")} (${leagues.length === 1 ? "league" : "leagues"})`
        : "",
      classes ? `${classes} ${classes === 1 ? "class" : "classes"}` : "",
      students ? `${students} ${students === 1 ? "student" : "students"}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  };
  async function togglePin(id: string) {
    setPinError("");
    try {
      await command("pin.toggle", { activity_id: id });
    } catch (e) {
      setPinError(e instanceof Error ? e.message : "Could not update the pin.");
    }
  }
  return (
    <Panel>
      <div className="form">
        <p className="text-xs text-[var(--soft)]">
          Open a form to choose the session date and time, then mark attendance.
        </p>
        <fieldset className="formpick">
          <legend>
            Attendance forms
            {activities.length ? (
              <span className="formpick-count">
                {activities.length} available · {pinnedForms.length}/
                {PIN_LIMIT} pinned
              </span>
            ) : null}
          </legend>
          {activities.length ? (
            <div className="formpick-grid">
              {activities.map((a) => {
                const isPinned = pinned(a.id) <= PIN_LIMIT;
                const assigned = targets(a.id);
                return (
                  <div key={a.id} className="formpick-card">
                    <div className="formpick-name">
                      <span>
                        <ClipboardList size={15} />
                        {a.name}
                      </span>
                      <small>
                        {a.reward_enabled
                          ? `${a.reward} ${a.reward === 1 ? "star" : "stars"} per present student`
                          : "Star rewards off"}
                      </small>
                      <small className="formpick-targets">
                        {assigned ||
                          "No saved assignment — choose classes on the attendance page."}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="formpick-pin"
                      aria-pressed={isPinned}
                      aria-label={`${isPinned ? "Unpin" : "Pin"} ${a.name}`}
                      title={
                        isPinned
                          ? "Unpin this form"
                          : pinnedForms.length >= PIN_LIMIT
                            ? `Unpin a form first — ${PIN_LIMIT} pins are already in use.`
                            : `Pin this form (up to ${PIN_LIMIT})`
                      }
                      disabled={!isPinned && pinnedForms.length >= PIN_LIMIT}
                      onClick={() => void togglePin(a.id)}
                    >
                      <Pin size={14} />
                    </button>
                    <div className="formpick-actions">
                      <Link
                        className={buttonVariants({ size: "sm" })}
                        href={`/take-attendance/${a.id}`}
                      >
                        <CalendarDays size={14} />
                        Take attendance
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty icon={ClipboardList} title="No attendance forms yet">
              Create one in{" "}
              <Link className="underline" href="/attendance-forms">
                Attendance forms
              </Link>{" "}
              and it will appear here.
            </Empty>
          )}
        </fieldset>
        {!data.overview?.active_year && (
          <p>Confirm an academic year to start taking attendance.</p>
        )}
        <ErrorNotice
          message={
            pinError ||
            pins.error ||
            classLinks.error ||
            leagueLinks.error ||
            studentLinks.error
          }
        />
      </div>
    </Panel>
  );
}
