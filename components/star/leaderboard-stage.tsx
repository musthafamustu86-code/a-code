"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Star,
  Trophy,
} from "lucide-react";
import { queryString, useData } from "@/lib/client";
import type { Ranking } from "@/lib/types";

const ROTATE_MS = 20000;
const STAR_STEP = 110;
const EMPTY: Ranking[] = [];

export interface BoardLeague {
  id: string;
  name: string;
  active?: boolean;
}

interface StageProps {
  leagues: BoardLeague[];
  params?: Record<string, string | number | null | undefined>;
  limit?: number;
  eyebrow?: string;
  href?: string | null;
  compact?: boolean;
}

/**
 * League leaderboard with the sliding panes, star-by-star counting and
 * rank-one highlight from the academy overview design.
 */
export function LeaderboardStage({
  leagues,
  params,
  limit = 12,
  eyebrow = "INDIVIDUAL LEADERBOARD",
  href = "/leaderboard",
  compact = false,
}: StageProps) {
  const boards = useMemo(
    () => leagues.filter((league) => league.active !== false),
    [leagues],
  );
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);
  const [status, setStatus] = useState("");
  const total = boards.length;
  const current = total ? index % total : 0;
  const report = useCallback((text: string) => setStatus(text), []);

  // A league board rolls over to the next league every 20 seconds.
  useEffect(() => {
    if (!auto || reduced || total < 2) return;
    const timer = window.setInterval(
      () => setIndex((value) => (value + 1) % total),
      ROTATE_MS,
    );
    return () => window.clearInterval(timer);
  }, [auto, reduced, total]);

  const move = (next: number) => {
    if (!total) return;
    setAuto(false);
    setIndex(((next % total) + total) % total);
  };

  const touch = useRef<number | null>(null);

  if (!total)
    return (
      <div className={"lbs" + (compact ? " lbs-compact" : "")}>
        <div className="lbs-hero">
          <div className="lbs-eyebrow">{eyebrow}</div>
          <Trophy className="lbs-trophy" aria-hidden="true" />
          <h2>No league yet</h2>
        </div>
        <p className="lbs-empty">
          Create an active league in Management to start a leaderboard.
        </p>
      </div>
    );

  return (
    <div className={"lbs" + (compact ? " lbs-compact" : "")}>
      <div
        className="lbs-viewport"
        onTouchStart={(event) => {
          touch.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          if (touch.current === null) return;
          const distance = (event.changedTouches[0]?.clientX ?? 0) - touch.current;
          touch.current = null;
          if (Math.abs(distance) > 50) move(current + (distance < 0 ? 1 : -1));
        }}
      >
        <div
          className="lbs-track"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {boards.map((league, position) => (
            <div
              className="lbs-pane"
              key={league.id}
              aria-hidden={position !== current}
            >
              <BoardPane
                league={league}
                position={position}
                total={total}
                params={params}
                limit={limit}
                active={position === current}
                reduced={!!reduced}
                eyebrow={eyebrow}
                href={href}
                onStatus={report}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="lbs-ctl">
        <span className="lbs-status" role="status" aria-live="polite">
          {status || "Loading standings..."}
        </span>
        {total > 1 ? (
          <>
            <button
              type="button"
              onClick={() => move(current - 1)}
              aria-label="Previous league"
            >
              <ChevronLeft size={14} aria-hidden="true" />
            </button>
            <span className="lbs-dots" role="tablist" aria-label="League boards">
              {boards.map((league, position) => (
                <button
                  key={league.id}
                  type="button"
                  role="tab"
                  aria-selected={position === current}
                  aria-label={league.name}
                  onClick={() => move(position)}
                />
              ))}
            </span>
            <button
              type="button"
              onClick={() => move(current + 1)}
              aria-label="Next league"
            >
              <ChevronRight size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setAuto((value) => !value)}
              aria-pressed={auto}
              aria-label={
                auto
                  ? "Pause automatic league rotation"
                  : "Resume automatic league rotation"
              }
            >
              {auto ? (
                <Pause size={13} aria-hidden="true" />
              ) : (
                <Play size={13} aria-hidden="true" />
              )}
              <span>{auto ? "Pause" : "Play"}</span>
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function BoardPane({
  league,
  position,
  total,
  params,
  limit,
  active,
  reduced,
  eyebrow,
  href,
  onStatus,
}: {
  league: BoardLeague;
  position: number;
  total: number;
  params?: Record<string, string | number | null | undefined>;
  limit: number;
  active: boolean;
  reduced: boolean;
  eyebrow: string;
  href: string | null;
  onStatus: (text: string) => void;
}) {
  const query = queryString({
    rpc: "individual_rankings",
    league: league.id,
    limit,
    ...params,
  });
  const { data: rows, error, loading } = useData<Ranking[]>(query, EMPTY);
  const [counts, setCounts] = useState<number[]>([]);
  const [first, setFirst] = useState(false);

  useEffect(() => {
    if (!active) return;
    if (loading) {
      onStatus(`Loading ${league.name}...`);
      return;
    }
    if (error) {
      onStatus(`Could not load ${league.name}`);
      return;
    }
    const stars = rows.map((row) => Math.max(0, Math.round(Number(row.stars))));
    const timers: number[] = [];
    if (!rows.length) {
      timers.push(
        window.setTimeout(() => {
          setCounts([]);
          setFirst(false);
        }, 0),
      );
      onStatus(`No students ranked in ${league.name}`);
      return () => timers.forEach((timer) => window.clearTimeout(timer));
    }
    if (reduced) {
      timers.push(
        window.setTimeout(() => {
          setCounts(stars);
          setFirst(true);
        }, 0),
      );
      onStatus(
        `${league.name} - Rank 1: ${rows[0].full_name} (${stars[0]} stars)`,
      );
      return () => timers.forEach((timer) => window.clearTimeout(timer));
    }
    timers.push(
      window.setTimeout(() => {
        setCounts(rows.map(() => 0));
        setFirst(false);
      }, 0),
    );
    rows.forEach((row, rowIndex) => {
      for (let step = 1; step <= stars[rowIndex]; step += 1) {
        timers.push(
          window.setTimeout(
            () =>
              setCounts((previous) => {
                const next = [...previous];
                next[rowIndex] = step;
                return next;
              }),
            step * STAR_STEP + rowIndex * 12,
          ),
        );
      }
    });
    const end = Math.max(0, ...stars) * STAR_STEP + rows.length * 12 + 320;
    timers.push(
      window.setTimeout(() => {
        setFirst(true);
        onStatus(
          `${league.name} - Rank 1: ${rows[0].full_name} (${stars[0]} stars)`,
        );
      }, end),
    );
    onStatus(`Counting stars - ${league.name}...`);
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [active, error, league.name, loading, onStatus, reduced, rows]);

  return (
    <>
      <div className="lbs-hero">
        <div className="lbs-eyebrow">
          {eyebrow}
          {total > 1 ? ` - ${position + 1} of ${total}` : ""}
        </div>
        <Trophy className="lbs-trophy" aria-hidden="true" />
        <h2>{league.name}</h2>
        {href ? (
          <Link href={href} tabIndex={active ? undefined : -1}>
            Full leaderboard
          </Link>
        ) : null}
      </div>
      <div className="lbs-list">
        {error ? (
          <p className="lbs-empty" role="alert">
            {error}
          </p>
        ) : loading && !rows.length ? (
          <p className="lbs-empty">Loading standings...</p>
        ) : rows.length ? (
          rows.map((row, rowIndex) => (
            <div
              className={
                "lbs-item" +
                (first && rowIndex === 0 ? " lbs-first" : "")
              }
              key={row.id}
            >
              <div className="lbs-rk">{row.rank}</div>
              <div className="lbs-nm">
                <Link
                  href={`/students?student=${row.id}`}
                  tabIndex={active ? undefined : -1}
                >
                  {row.full_name}
                </Link>
                <small>{row.admission_number}</small>
              </div>
              <div className="lbs-star" aria-hidden="true">
                <Star />
                <b
                  key={counts[rowIndex] ?? 0}
                  className={counts[rowIndex] ? "lbs-pop" : undefined}
                >
                  {counts[rowIndex] ?? 0}
                </b>
              </div>
              <span className="sr-only">
                {row.stars} stars, rank {row.rank}
              </span>
            </div>
          ))
        ) : (
          <p className="lbs-empty">No students ranked in this league yet.</p>
        )}
      </div>
    </>
  );
}
