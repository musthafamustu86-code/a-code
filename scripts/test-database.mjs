import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(
  `create role supabase_auth_admin;create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;`,
);
for (const migration of readdirSync("supabase/migrations")
  .filter((file) => file.endsWith(".sql"))
  .sort()) {
  // The hosted pg_cron extension is unavailable in PGlite.
  if (!migration.endsWith("_schedule_recognition.sql"))
    await db.exec(readFileSync("supabase/migrations/" + migration, "utf8"));
}
const staff = "00000000-0000-0000-0000-000000000001";
await db.exec(
  `insert into auth.users values('${staff}');insert into public.staff_profiles values('${staff}','Fictional staff',true);select set_config('request.jwt.claim.sub','${staff}',false);`,
);
let checks = 0;
const claims = { sub: staff, amr: [{ method: "password" }] };
for (const method of [
  "password",
  "token_refresh",
  "otp",
  "recovery",
  "magiclink",
  "totp",
]) {
  const result = (
    await db.query("select public.staff_password_session($1) as r", [
      { authentication_method: method, claims },
    ])
  ).rows[0].r;
  if (["password", "token_refresh"].includes(method))
    assert.deepEqual(result.claims, claims);
  else assert.equal(result.error.http_code, 403);
  checks++;
}
assert.equal(
  (await db.query("select public.owner_managed_auth_email('{}') r")).rows[0].r
    .error.http_code,
  403,
);
checks++;
async function cmd(action, p = {}) {
  return (
    await db.query("select public.command($1,$2::jsonb) result", [
      action,
      JSON.stringify(p),
    ])
  ).rows[0].result;
}
async function rejects(action, p, pattern) {
  await assert.rejects(() => cmd(action, p), pattern);
  checks++;
}
const uuid = () => crypto.randomUUID();
await db.exec("set role authenticated");
await assert.rejects(
  () =>
    db.exec(
      `insert into public.students(full_name,admission_number) values('Attack','X')`,
    ),
  /permission denied/,
);
checks++;
const today = (
  await db.query(
    "select to_char(now() at time zone 'Asia/Kolkata','YYYY-MM-DD') today",
  )
).rows[0].today;
const year = (
  await cmd("year.create", {
    name: "Fictional test year",
    start_date: today.slice(0, 4) + "-01-01",
    end_date: today.slice(0, 4) + "-12-31",
  })
).id;
const league = (await cmd("league.save", { name: "Test League", active: true }))
  .id;
const classes = (
  await db.query("select * from public.classes order by position")
).rows;
const s1 = (
  await cmd("student.save", {
    full_name: "Fictional Student A",
    admission_number: "TEST-001",
    class_id: classes[0].id,
    league_id: league,
    academic_year_id: year,
  })
).id;
const s2 = (
  await cmd("student.save", {
    full_name: "Fictional Student B",
    admission_number: "TEST-002",
    class_id: classes[0].id,
    league_id: league,
    academic_year_id: year,
  })
).id;
const s3 = (
  await cmd("student.save", {
    full_name: "Fictional Student C",
    admission_number: "TEST-003",
    class_id: classes[1].id,
    league_id: league,
    academic_year_id: year,
  })
).id;
await rejects(
  "student.save",
  {
    full_name: "Duplicate",
    admission_number: "TEST-001",
    class_id: classes[0].id,
    academic_year_id: year,
  },
  /unique/,
);
await rejects(
  "students.import",
  {
    academic_year_id: year,
    rows: [
      {
        full_name: "Rollback fixture",
        admission_number: "ROLLBACK",
        class_id: classes[0].id,
        league_id: league,
      },
      {
        full_name: "Duplicate fixture",
        admission_number: "TEST-001",
        class_id: classes[0].id,
        league_id: league,
      },
    ],
  },
  /unique/,
);
assert.equal(
  (
    await db.query(
      "select * from public.students where admission_number='ROLLBACK'",
    )
  ).rows.length,
  0,
);
checks++;

const largeImport = Array.from({ length: 501 }, (_, index) => ({
  full_name: "Fictional bulk student",
  admission_number: index === 500 ? "TEST-001" : "BULK-" + index,
  class_id: classes[0].id,
  league_id: league,
}));
await rejects(
  "students.import",
  { academic_year_id: year, rows: largeImport },
  /unique/,
);
assert.equal(
  (
    await db.query(
      "select count(*)::int as total from public.students where admission_number like 'BULK-%'",
    )
  ).rows[0].total,
  0,
);
checks++;
await cmd("year.confirm", { id: year });
await rejects(
  "enrolment.save",
  {
    academic_year_id: year,
    student_id: s1,
    class_id: classes[1].id,
    league_id: league,
    progression: "promoted",
  },
  /draft/,
);
const activity = (
  await cmd("activity.save", {
    name: "Test Attendance",
    reward: 2,
    reward_enabled: true,
    active: true,
  })
).id;
const attendance = {
  activity_id: activity,
  date: today,
  classes: [classes[0].id],
  records: [
    { student_id: s1, present: true },
    { student_id: s2, present: false },
  ],
  remarks: "Original remark",
  request_id: uuid(),
};
const session = (await cmd("attendance.submit", attendance)).id;
checks++;
assert.deepEqual(
  (
    await db.query(
      "select configured_reward,rewards_enabled from public.attendance_sessions where id=$1",
      [session],
    )
  ).rows[0],
  { configured_reward: 2, rewards_enabled: true },
);
checks++;
await assert.rejects(
  () => db.query("select private.finalize_due_periods(null)"),
  /permission denied/,
);
checks++;
assert.equal(
  (
    await db.query(
      "select original_remarks from public.attendance_sessions where id=$1",
      [session],
    )
  ).rows[0].original_remarks,
  "Original remark",
);
checks++;
let ledger = (await db.query("select * from public.star_transactions")).rows;
assert.equal(ledger.length, 1);
assert.equal(ledger[0].amount, 2);
checks++;
assert.equal(
  (
    await db.query("select public.attendance_search($1::jsonb) r", [
      JSON.stringify({ class: classes[0].id, student: "TEST-001", staff }),
    ])
  ).rows[0].r.length,
  1,
);
checks++;
assert.equal(
  (
    await db.query("select public.attendance_search($1::jsonb) r", [
      JSON.stringify({ class: classes[1].id }),
    ])
  ).rows[0].r.length,
  0,
);
checks++;
assert.equal(
  (
    await db.query("select public.attendance_search($1::jsonb) r", [
      JSON.stringify({ student: "TEST-003" }),
    ])
  ).rows[0].r.length,
  0,
);
checks++;
await rejects(
  "attendance.submit",
  { ...attendance, request_id: uuid() },
  /unique/,
);
await assert.rejects(
  () =>
    db.query(
      "update public.attendance_records set present=true where session_id=$1",
      [session],
    ),
  /permission denied/,
);
checks++;
await rejects(
  "attendance.submit",
  { ...attendance, date: today, classes: [classes[1].id], request_id: uuid() },
  /roster/,
);
await rejects(
  "attendance.submit",
  { ...attendance, expected_reward: 5, request_id: uuid() },
  /reward changed/,
);
await cmd("remark.save", { session_id: session, content: "Updated remark" });
assert.equal(
  (await db.query("select * from public.remark_history")).rows.length,
  1,
);
checks++;
await rejects(
  "stars.award",
  { students: [s1], amount: -1, reason: "Bad", request_id: uuid() },
  /1.*5/,
);
await rejects(
  "stars.award",
  { students: [s1], amount: 6, reason: "Bad", request_id: uuid() },
  /1.*5/,
);
await rejects(
  "stars.award",
  { students: [s1], amount: 1, reason: " ", request_id: uuid() },
  /reason/,
);
const award = {
  students: [s1, s2],
  amount: 3,
  reason: "Test effort",
  request_id: uuid(),
};
await cmd("stars.award", award);
await rejects("stars.award", award, /unique/);
await cmd("stars.award", {
  students: [s2],
  amount: 2,
  reason: "Second valid award today",
  request_id: uuid(),
});
await cmd("stars.award", {
  students: [s3],
  amount: 1,
  reason: "Participation",
  request_id: uuid(),
});
const ranks = (
  await db.query("select public.rankings($1,$2,null,null) as r", [year, league])
).rows[0].r;
assert.deepEqual(
  ranks.map((r) => Number(r.rank)),
  [1, 1, 3],
);
assert.deepEqual(
  ranks.map((r) => Number(r.stars)),
  [5, 5, 1],
);
checks++;
const ascending = (
  await db.query("select public.rankings($1,$2,null,null,'',0,false) r", [
    year,
    league,
  ])
).rows[0].r;
assert.equal(Number(ascending[0].stars), 1);
checks++;
const overview = (await db.query("select public.overview() as r")).rows[0].r;
assert.equal(Number(overview.attendance), 50);
checks++;
const report = async (yearId, start, end) =>
  (
    await db.query("select public.reporting_summary($1, $2, $3) as report", [
      yearId,
      start,
      end,
    ])
  ).rows[0].report;
const dayReport = await report(year, today, today);
assert.equal(dayReport.students, 3);
assert.equal(dayReport.stars, 11);
assert.equal(dayReport.attendance, 50);
assert.equal(dayReport.recent.length, 5);
assert.ok(dayReport.recent.every((row) => row.earned_on === today));
checks++;
const firstDay = today.slice(0, 4) + "-01-01";
const otherDay = today === firstDay ? today.slice(0, 4) + "-12-31" : firstDay;
assert.deepEqual(await report(year, otherDay, otherDay), {
  students: 3,
  stars: 0,
  attendance: null,
  recent: [],
});
checks++;
await assert.rejects(
  () => report(year, "1900-01-01", today),
  /inside the selected/,
);
checks++;
await assert.rejects(
  () => report(year, "2050-01-01", "2000-01-01"),
  /inside the selected/,
);
checks++;
await cmd("attendance.lifecycle", { id: session, status: "archived" });
await cmd("attendance.lifecycle", { id: session, status: "trash" });
await rejects(
  "attendance.lifecycle",
  { id: session, status: "delete", confirmation: "no" },
  /confirm/,
);
await cmd("attendance.lifecycle", { id: session, status: "active" });
await cmd("attendance.lifecycle", { id: session, status: "trash" });
await cmd("attendance.lifecycle", {
  id: session,
  status: "delete",
  confirmation: "DELETE",
});
assert.equal(
  (await db.query("select * from public.star_transactions")).rows.length,
  5,
);
checks++;
await rejects(
  "attendance.submit",
  { ...attendance, request_id: uuid() },
  /unique/,
);
await rejects(
  "student.save",
  { id: s1, admission_number: "CHANGED", full_name: "Name", active: true },
  /permanent/,
);
for (let i = 0; i < 8; i++) {
  const a = (
    await cmd("activity.save", {
      name: `Pin activity ${i}`,
      reward: 0,
      reward_enabled: false,
      active: true,
    })
  ).id;
  await cmd("pin.toggle", { activity_id: a });
}
await rejects("pin.toggle", { activity_id: activity }, /8 forms/);
await db.exec("reset role");
// Separate fictional closed periods to verify tied awards, monthly eligibility,
// per-league isolation, and weekly rotation without changing any real records.
await db.exec("delete from public.recognition_periods");
const shifted = (days) =>
  new Date(Date.parse(`${today}T12:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
const p1 = uuid(),
  p2 = uuid(),
  pm = uuid();
await db.query(
  `insert into public.recognition_periods(id,academic_year_id,category,name,start_date,end_date,academic_month) values($1,$4,'week','Fictional week one',$5::date,$6::date,$5::date),($2,$4,'week','Fictional week two',$7::date,$8::date,$5::date),($3,$4,'month','Fictional academic month',$5::date,$8::date,$5::date)`,
  [p1, p2, pm, year, shifted(-14), shifted(-8), shifted(-7), shifted(-1)],
);
for (const [sid, amount, earned] of [
  [s1, 4, shifted(-12)],
  [s2, 4, shifted(-12)],
  [s3, 1, shifted(-12)],
  [s1, 5, shifted(-5)],
  [s2, 5, shifted(-5)],
  [s3, 2, shifted(-5)],
]) {
  await db.query(
    `insert into public.star_transactions(student_id,academic_year_id,league_id,class_id,class_name,student_name,admission_number,amount,reason,source,awarded_by,staff_name,earned_on,request_id) select s.id,$2,$3,e.class_id,c.name,s.full_name,s.admission_number,$4,'Fictional recognition fixture','attendance',$5,'Fictional staff',$6::date,gen_random_uuid() from public.students s join public.enrolments e on e.student_id=s.id and e.academic_year_id=$2 join public.classes c on c.id=e.class_id where s.id=$1`,
    [sid, year, league, amount, staff, earned],
  );
}
await db.exec("set role authenticated");
await cmd("recognition.generate");
const winners = (await db.query("select * from public.recognition_winners"))
  .rows;
assert.equal(winners.filter((w) => w.period_id === p1).length, 2);
checks++;
assert.equal(winners.find((w) => w.period_id === p2).student_id, s3);
checks++;
assert.deepEqual(
  winners
    .filter((w) => w.period_id === pm)
    .map((w) => w.student_id)
    .sort(),
  [s1, s2].sort(),
);
checks++;
await cmd("recognition.generate");
assert.equal(
  (await db.query("select * from public.recognition_winners")).rows.length,
  5,
);
checks++;
const historical = (
  await db.query("select public.rankings($1,$2,null,null) as r", [year, league])
).rows[0].r;
const oldPeriods = (await db.query("select * from public.recognition_periods"))
  .rows;
await cmd("settings.save", {
  name: "Fictional Test Academy",
  timezone: "Asia/Kolkata",
  week_start: 4,
  month_start_day: 19,
  theme: "light",
});
assert.deepEqual(
  (await db.query("select * from public.recognition_periods")).rows,
  oldPeriods,
);
checks++;
const nextYear = Number(today.slice(0, 4)) + 1;
const next = (
  await cmd("year.create", {
    name: "Fictional next year",
    start_date: `${nextYear}-01-01`,
    end_date: `${nextYear}-12-31`,
  })
).id;
await assert.rejects(
  () => report(next, `${nextYear}-01-01`, `${nextYear}-01-01`),
  /confirmed academic year/,
);
checks++;
const copied = (
  await db.query(
    "select * from public.league_assignments where academic_year_id=$1",
    [next],
  )
).rows;
assert.equal(copied.length, 3);
assert.ok(copied.every((a) => a.league_id === league));
checks++;
const league2 = (
  await cmd("league.save", { name: "Second Fictional League", active: true })
).id;
await cmd("enrolment.save", {
  student_id: s1,
  academic_year_id: next,
  class_id: classes[1].id,
  league_id: league2,
  progression: "promoted",
});
await cmd("year.confirm", { id: next });
const closedReport = await report(year, today, today);
assert.equal(closedReport.stars, 11);
assert.equal(closedReport.students, 3);
assert.deepEqual(await report(next, `${nextYear}-01-01`, `${nextYear}-12-31`), {
  students: 3,
  stars: 0,
  attendance: null,
  recent: [],
});
checks++;
assert.deepEqual(
  (
    await db.query("select public.rankings($1,$2,null,null) as r", [
      year,
      league,
    ])
  ).rows[0].r,
  historical,
);
checks++;
assert.equal(
  (
    await db.query("select admission_number from public.students where id=$1", [
      s1,
    ])
  ).rows[0].admission_number,
  "TEST-001",
);
checks++;
const months = (
  await db.query(
    "select to_char(start_date,'YYYY-MM-DD') start_date,to_char(end_date,'YYYY-MM-DD') end_date from public.recognition_periods where academic_year_id=$1 and category='month' order by start_date",
    [next],
  )
).rows;
assert.equal(months[0].end_date, `${nextYear}-01-18`);
assert.equal(months[1].start_date, `${nextYear}-01-19`);
assert.equal(months[1].end_date, `${nextYear}-02-18`);
checks++;
await db.exec("reset role");
assert.equal(
  (
    await db.query(
      "select private.month_boundary('2027-02-01',31)::text result",
    )
  ).rows[0].result,
  "2027-02-28",
);
checks++;
const staff2 = "00000000-0000-0000-0000-000000000003";
await db.query("insert into auth.users values($1)", [staff2]);
await db.query(
  "insert into public.staff_profiles values($1,'Fictional second staff',true)",
  [staff2],
);
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [staff2]);
await db.exec("set role authenticated");
assert.equal(
  (await db.query("select * from public.pinned_forms")).rows.length,
  0,
);
await cmd("pin.toggle", { activity_id: activity });
assert.equal(
  (await db.query("select * from public.pinned_forms")).rows.length,
  1,
);
checks++;
await db.exec("reset role");
await assert.rejects(
  () => db.exec(`delete from public.star_transactions`),
  /immutable/,
);
checks++;
await assert.rejects(
  () => db.exec(`update public.audit_logs set action='tampered'`),
  /immutable/,
);
checks++;
const outsider = "00000000-0000-0000-0000-000000000002";
await db.exec(
  `insert into auth.users values('${outsider}');select set_config('request.jwt.claim.sub','${outsider}',false);set role authenticated;`,
);
assert.equal((await db.query("select * from public.students")).rows.length, 0);
checks++;
await assert.rejects(
  () => report(year, today, today),
  /confirmed academic year/,
);
checks++;
await rejects("league.save", { name: "Intruder" }, /Staff access/);
await db.exec("reset role;set role anon");
await assert.rejects(
  () => db.query("select public.command('league.save','{}'::jsonb)"),
  /permission denied/,
);
checks++;
console.log(`PASS: ${checks} PostgreSQL business-rule and RLS checks`);
await db.close();
