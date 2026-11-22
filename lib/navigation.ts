import {
  LayoutDashboard,
  Users,
  CalendarCheck2,
  Files,
  Sparkles,
  Trophy,
  Shield,
  Award,
  ChartNoAxesCombined,
  ClipboardList,
  History,
  CalendarDays,
  Settings,
} from "lucide-react";
export const navigation = [
  { path: "/", name: "Dashboard", icon: LayoutDashboard, group: "Academy" },
  { path: "/students", name: "Students", icon: Users },
  {
    path: "/take-attendance",
    name: "Take attendance",
    icon: CalendarCheck2,
    group: "Attendance",
  },
  { path: "/attendance-records", name: "Attendance records", icon: Files },
  { path: "/attendance-forms", name: "Attendance forms", icon: ClipboardList },
  {
    path: "/star-rewards",
    name: "Star rewards",
    icon: Sparkles,
    group: "Recognition",
  },
  { path: "/leaderboard", name: "Leaderboard", icon: Trophy },
  { path: "/leagues", name: "Leagues", icon: Shield },
  { path: "/achievements", name: "Achievements", icon: Award },
  {
    path: "/reports",
    name: "Reports",
    icon: ChartNoAxesCombined,
    group: "Administration",
  },
  { path: "/history", name: "History", icon: History },
  { path: "/academic-years", name: "Academic years", icon: CalendarDays },
  { path: "/settings", name: "Settings", icon: Settings },
];

export const destinations = navigation.map((item, index) => ({
  ...item,
  section:
    navigation
      .slice(0, index + 1)
      .reverse()
      .find((entry) => entry.group)?.group ?? "Academy",
}));
