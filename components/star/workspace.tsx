"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useState } from "react";
import { motion, MotionConfig } from "motion/react";
import { Menu, X, Orbit, LogOut, Moon, Sun } from "lucide-react";
import { api, useData } from "@/lib/client";
import { destinations } from "@/lib/navigation";
import type { Activity, Named, Overview, Year } from "@/lib/types";
const Students = dynamic(() =>
  import("./students").then((module) => module.Students),
);
const Register = dynamic(() =>
  import("./register").then((module) => module.Register),
);
const AttendanceRecords = dynamic(() =>
  import("./records").then((module) => module.AttendanceRecords),
);
const Rewards = dynamic(() =>
  import("./rewards").then((module) => module.Rewards),
);
const Achievements = dynamic(() =>
  import("./competition").then((module) => module.Achievements),
);
const Leaderboard = dynamic(() =>
  import("./competition").then((module) => module.Leaderboard),
);
const Reports = dynamic(() =>
  import("./competition").then((module) => module.Reports),
);
const AcademicYears = dynamic(() =>
  import("./management").then((module) => module.AcademicYears),
);
const Management = dynamic(() =>
  import("./management").then((module) => module.Management),
);
const SettingsPage = dynamic(() =>
  import("./management").then((module) => module.SettingsPage),
);
const HistoryPage = dynamic(() =>
  import("./management").then((module) => module.HistoryPage),
);
import { Dashboard } from "./overview";
import { ErrorNotice } from "./ui";
export interface WorkspaceData {
  activities: Activity[];
  years: Year[];
  classes: Named[];
  leagues: Named[];
  overview: Overview | null;
}
export function Workspace({ section }: { section: string }) {
  const activities = useData<Activity[]>("all:table=activities", []),
    years = useData<Year[]>("all:table=academic_years", []),
    classes = useData<Named[]>("all:table=classes", []),
    leagues = useData<Named[]>("all:table=leagues", []),
    overview = useData<Overview | null>("rpc=overview", null);
  const data = {
    activities: activities.data,
    years: years.data,
    classes: classes.data,
    leagues: leagues.data,
    overview: overview.data,
  };
  const [open, setOpen] = useState(false),
    [override, setOverride] = useState(""),
    [error, setError] = useState("");
  const theme = override || data.overview?.settings.theme || "light";
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  const active = destinations.find((d) => d.path === section)!;
  let body;
  switch (section) {
    case "/dashboard":
      body = <Dashboard data={data} refresh={overview.reload} />;
      break;
    case "/students":
      body = <Students data={data} />;
      break;
    case "/take-attendance":
      body = <Register data={data} />;
      break;
    case "/attendance-records":
      body = <AttendanceRecords data={data} />;
      break;
    case "/star-rewards":
      body = <Rewards data={data} />;
      break;
    case "/achievements":
      body = <Achievements data={data} />;
      break;
    case "/leaderboard":
      body = <Leaderboard data={data} />;
      break;
    case "/reports":
      body = <Reports data={data} />;
      break;
    case "/academic-years":
      body = <AcademicYears data={data} />;
      break;
    case "/history":
      body = (
        <HistoryPage timezone={data.overview?.settings.timezone || "UTC"} />
      );
      break;
    case "/settings":
      body = <SettingsPage data={data} />;
      break;
    default:
      body = (
        <Management
          data={data}
          kind={section === "/leagues" ? "league" : "activity"}
        />
      );
  }
  const failed =
    error ||
    [activities, years, classes, leagues, overview].find((r) => r.error)?.error;
  return (
    <MotionConfig reducedMotion="user">
      <div className="station">
        <aside className={open ? "station-nav visible" : "station-nav"}>
          <div className="wordmark">
            {data.overview?.settings.logo_path ? (
              <Image
                unoptimized
                width={30}
                height={30}
                src="/api/photos?branding=true"
                alt="Academy logo"
              />
            ) : (
              <Orbit />
            )}{" "}
            STAR SYSTEM
            <button
              aria-label="Close navigation"
              onClick={() => setOpen(false)}
            >
              <X />
            </button>
          </div>
          <nav>
            {destinations.map((d) => (
              <div key={d.path}>
                {d.group && <small>{d.group}</small>}
                <Link
                  href={d.path}
                  aria-current={d.path === section ? "page" : undefined}
                >
                  <d.icon size={16} />
                  {d.name}
                </Link>
              </div>
            ))}
          </nav>
        </aside>
        <main className="station-main">
          <header>
            <button
              className="mobile-menu"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu />
            </button>
            <span>{data.overview?.settings.name || "Sincere Academy"}</span>
            <button
              aria-label="Change theme"
              onClick={() => setOverride(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              aria-label="Sign out"
              onClick={async () => {
                try {
                  await api("/api/auth", { method: "DELETE" });
                  location.replace("/login");
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              <LogOut size={17} />
            </button>
          </header>
          <motion.div
            className="station-page"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            <small className="kicker">{active.section}</small>
            <h1>{section === "/dashboard" ? "Academy overview" : active.name}</h1>
            <ErrorNotice message={failed} />
            {data.overview
              ? body
              : !failed && <p role="status">Loading academy records…</p>}
          </motion.div>
        </main>
      </div>
    </MotionConfig>
  );
}
