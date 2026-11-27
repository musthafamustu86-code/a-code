"use client";
import Link from "next/link";

import { ArrowUpRight, Star, Users, CalendarCheck } from "lucide-react";
import type { WorkspaceData } from "./workspace";
import { AnimatedNumber } from "./ui";
import { LeaderboardStage } from "./leaderboard-stage";

export function Dashboard({ data }: { data: WorkspaceData }) {
  const overview = data.overview!;
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
        <LeaderboardStage
          leagues={data.leagues}
          params={{ period: "current-week" }}
          limit={5}
          eyebrow="INDIVIDUAL LEADERBOARD · CURRENT WEEK"
          href="/leaderboard"
          compact
        />
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
          <Link href="/star-rewards">Award stars →</Link>
        </section>
      </div>
    </>
  );
}
