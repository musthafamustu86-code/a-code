import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
for (const page of [
  "/",
  "/students",
  "/take-attendance",
  "/attendance-records",
  "/star-rewards",
  "/leaderboard",
  "/leagues",
  "/achievements",
  "/reports",
  "/attendance-forms",
  "/history",
  "/academic-years",
  "/settings",
]) {
  const res = await fetch(base + page, { redirect: "manual" });
  assert.equal(res.status, 307, page);
  assert.equal(new URL(res.headers.get("location"), base).pathname, "/login");
}
const login = await fetch(base + "/login");
assert.equal(login.status, 200);
assert.match(await login.text(), /Staff sign in/);
for (const path of [
  "/api/auth",
  "/api/data?table=students",
  "/api/photos",
  "/api/export",
]) {
  const res = await fetch(base + path);
  assert.equal(res.status, 401, path);
  assert.match((await res.json()).error, /sign in/i);
}
for (const path of ["/api/auth", "/api/data", "/api/photos"]) {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { Origin: "https://example.invalid" },
    body: "{}",
  });
  assert.equal(res.status, 403, path);
}
const res = await fetch(base + "/api/auth", {
  method: "POST",
  headers: { Origin: base, "Content-Type": "application/json" },
  body: JSON.stringify({ email: "invalid", password: "" }),
});
assert.equal(res.status, 400);
console.log(
  "PASS: thirteen route guards, sign-in page, four protected APIs, origin checks and login validation.",
);
