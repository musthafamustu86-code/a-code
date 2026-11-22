"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Star, Users, CalendarCheck, Trophy } from "lucide-react";
import { useData } from "@/lib/client";
import type { Ranking } from "@/lib/types";
import type { WorkspaceData } from "./workspace";
import { AnimatedNumber, ErrorNotice } from "./ui";

export function Dashboard({
  data,
  refresh,
}: {
  data: WorkspaceData;
  refresh: () => Promise<void>;
}) {
  const overview = data.overview!;
  const previous = useRef(new Map<string, string[]>());
  const reduced = useReducedMotion();
  const ranks = useData<Ranking[]>(
    "rpc=individual_rankings&period=current-week",
    [],
  );
  const reload = ranks.reload;
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
        void reload();
      }
    }, 12000);
    return () => clearInterval(timer);
  }, [refresh, reload]);
  const leaders = ranks.data.filter((r) => r.rank === 1).map((r) => r.id);
  const [glow, setGlow] = useState<string[]>([]);
  const signature = leaders.join(",");
  useEffect(() => {
    if (ranks.loading || ranks.error) return;
    const current = signature ? signature.split(",") : [],
      old = previous.current.get(overview.week_start);
    const frame = requestAnimationFrame(() =>
      setGlow(old ? current.filter((id) => !old.includes(id)) : []),
    );
    previous.current.set(overview.week_start, current);
    return () => cancelAnimationFrame(frame);
  }, [overview.week_start, ranks.loading, ranks.error, signature]);
  return (
    <>
      <div className="dayline">
        <time>
          {new Intl.DateTimeFormat("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(new Date(overview.today + "T12:00Z"))}
        </time>
        <Link className="primary" href="/take-attendance">
          Take attendance <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="metrics">
        {[
          { label: "Active students", number: overview.students, icon: Users },
          {
            label: "Stars this week",
            number: overview.weekly_stars,
            icon: Star,
          },
          {
            label: "Attendance today",
            number: overview.attendance,
            icon: CalendarCheck,
          },
        ].map((m, i) => (
          <section key={m.label}>
            <m.icon size={20} />
            <h2>{m.label}</h2>
            <strong>
              {m.number === null ? (
                "—"
              ) : (
                <>
                  {i === 2 ? m.number : <AnimatedNumber value={m.number} />}
                  <small>{i === 2 ? "%" : ""}</small>
                </>
              )}
            </strong>
          </section>
        ))}
      </div>
      <div className="boardgrid">
        <section className="standings">
          <div className="leaguehead">
            <Trophy />
            <small>CURRENT WEEK</small>
            <h2>Individual leaderboard</h2>
            <Link href="/leaderboard">Full leaderboard ↗</Link>
          </div>
          <ErrorNotice message={ranks.error} />
          <div className="rows">
            {ranks.data.slice(0, 5).map((r) => (
              <motion.div
                layout={!reduced}
                key={r.id}
                className={"ledgerrow " + (glow.includes(r.id) ? "gold" : "")}
              >
                <span className="rank">{r.rank}</span>
                <div>
                  <b>{r.full_name}</b>
                  <small>{r.admission_number}</small>
                </div>
                <strong>
                  <AnimatedNumber value={r.stars} /> ★
                </strong>
              </motion.div>
            ))}
            {!ranks.data.length && (
              <p>
                {ranks.loading
                  ? "Loading standings…"
                  : "No students ranked this week."}
              </p>
            )}
          </div>
        </section>
        <section className="recent">
          <small className="kicker">RECOGNITION</small>
          <h2>Recent star awards</h2>
          {overview.recent.map((t) => (
            <div className="ledgerrow" key={t.id}>
              <Star size={17} />
              <div>
                <b>{t.student_name}</b>
                <small>{t.reason}</small>
              </div>
              <strong>+{t.amount}</strong>
            </div>
          ))}
          {!overview.recent.length && (
            <p>Awards will appear here when staff record stars.</p>
          )}
          <Link href="/star-rewards">Award stars ↗</Link>
        </section>
      </div>
    </>
  );
}
