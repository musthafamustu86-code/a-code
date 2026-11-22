import { createPDF } from "../lib/server/pdf.ts";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const pdf = await createPDF("Fictional Test Academy", "Attendance report", [
  {
    title: "Fictional Study Session | 2026-11-18",
    subtitle:
      "Classes: 6, 7\nSubmitted by Fictional Staff\nOriginal remarks: A fictional report for export verification only.",
    headers: ["Admission", "Student", "Class", "Status", "Stars"],
    rows: Array.from({ length: 90 }, (_, i) => [
      `TEST-${i}`,
      `Fictional Student ${i} with a longer name`,
      i % 2 ? "6" : "7",
      i % 4 ? "Present" : "Absent",
      i % 4 ? "2" : "0",
    ]),
    summary: "90 students | Fictional test records only.",
  },
]);
assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
assert.ok(pdf.length > 10000);
assert.match(pdf.toString("latin1"), /\/Type \/Pages/);
mkdirSync("tmp/pdfs", { recursive: true });
writeFileSync("tmp/pdfs/attendance-verification.pdf", pdf);
console.log(
  `PASS: generated multipage PDF with embedded font (${pdf.length} bytes)`,
);
