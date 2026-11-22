import { parseCSV, csvCell } from "../lib/csv.ts";
import assert from "node:assert/strict";
assert.deepEqual(
  parseCSV(
    '\uFEFFadmission_number,full_name,class\r\n1001,"Fictional, Student",6\r\n1002,"A ""quoted"" name",7',
  ),
  [
    ["admission_number", "full_name", "class"],
    ["1001", "Fictional, Student", "6"],
    ["1002", 'A "quoted" name', "7"],
  ],
);
assert.deepEqual(parseCSV('1001,"First\nSecond",6'), [
  ["1001", "First\nSecond", "6"],
]);
assert.throws(() => parseCSV('1001,"Broken,6'), /unclosed/);
assert.equal(csvCell(' =HYPERLINK("attack")'), '"\' =HYPERLINK(""attack"")"');
console.log(
  "PASS: CSV parsing, quoted fields, embedded newlines, BOM, and formula-injection escaping",
);
