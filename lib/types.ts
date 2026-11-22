export interface Student {
  id: string;
  admission_number: string;
  full_name: string;
  active: boolean;
  photo_path: string | null;
}
export interface StudentRow extends Student {
  academic_year_id: string;
  class_id: string;
  class_name: string;
  league_id: string | null;
  league_name: string | null;
  progression: string;
}
export interface Named {
  id: string;
  name: string;
  active: boolean;
  description?: string;
  color?: string;
  position?: number;
}
export interface Activity extends Named {
  reward: number;
  reward_enabled: boolean;
}
export interface Year {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: "draft" | "active" | "closed";
}
export interface Enrolment {
  id: string;
  student_id: string;
  academic_year_id: string;
  class_id: string;
  progression: string;
}
export interface Assignment {
  id: string;
  student_id: string;
  academic_year_id: string;
  league_id: string;
}
export interface Transaction {
  id: string;
  student_id: string;
  student_name: string;
  admission_number: string;
  class_name: string;
  academic_year_id: string;
  league_id: string;
  amount: number;
  reason: string;
  source: string;
  created_at: string;
  earned_on: string;
  staff_name: string;
}
export interface Settings {
  id: number;
  name: string;
  timezone: string;
  week_start: number;
  month_start_day: number;
  theme: string;
  logo_path: string | null;
}
export interface Overview {
  settings: Settings;
  today: string;
  week_start: string;
  active_year: string | null;
  students: number;
  weekly_stars: number;
  attendance: number | null;
  recent: Transaction[];
}
export interface Ranking {
  id: string;
  full_name: string;
  admission_number: string;
  stars: number;
  rank: number;
  total_count: number;
}
export interface AttendanceSession {
  id: string;
  attendance_date: string;
  activity_name: string;
  activity_id: string;
  academic_year_id: string;
  selected_classes: { id: string; name: string }[];
  reward_snapshot: number;
  configured_reward?: number | null;
  rewards_enabled?: boolean | null;
  staff_name: string;
  institution_name: string;
  original_remarks: string;
  submitted_at: string;
  status: string;
}
export interface AttendanceRecord {
  id: string;
  student_id: string;
  full_name: string;
  admission_number: string;
  class_name: string;
  present: boolean;
  stars: number;
}
export interface Period {
  id: string;
  academic_year_id: string;
  category: string;
  name: string;
  start_date: string;
  end_date: string;
  academic_month: string;
  finalized_at: string | null;
}
export interface Winner {
  id: string;
  period_id: string;
  league_id: string;
  student_id: string;
  student_name: string;
  league_name: string;
  stars: number;
}
