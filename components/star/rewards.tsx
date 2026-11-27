"use client";
import { useRef, useState } from "react";
import { BadgeInfo, Star, UsersRound } from "lucide-react";
import {
  allPages,
  command,
  dateLabel,
  queryString,
  useData,
} from "@/lib/client";
import type { StudentRow, Transaction } from "@/lib/types";
import type { WorkspaceData } from "./workspace";
import {
  Button,
  Empty,
  ErrorNotice,
  Field,
  Form,
  Modal,
  Pager,
  Panel,
  SearchBox,
  Tag,
} from "./ui";
export function Rewards({ data }: { data: WorkspaceData }) {
  const [search, setSearch] = useState("");
  const [classId, setClass] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [award, setAward] = useState(false);
  const [error, setError] = useState("");
  const request = useRef("");
  const { data: students } = useData<StudentRow[]>(
    data.overview?.active_year
      ? queryString({
          table: "student_directory",
          academic_year_id: data.overview.active_year,
          search,
          class_id: classId,
          active: "true",
          offset: page * 100,
        })
      : null,
    [],
  );
  const [ledgerPage, setLedgerPage] = useState(0);
  const { data: transactions, error: ledgerError } = useData<Transaction[]>(
    `table=star_transactions&offset=${ledgerPage * 100}`,
    [],
  );
  return (
    <>
      <div className="notice">
        <BadgeInfo size={18} />
        Each selected student receives 1–5 stars. A reason is required for every
        manual award.
      </div>
      <ErrorNotice message={error} />
      <div className="toolbar">
        <SearchBox
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(0);
          }}
        />
        <select
          aria-label="Select class"
          value={classId}
          onChange={(e) => {
            setClass(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All classes</option>
          {data.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              const all = await allPages<StudentRow>(
                queryString({
                  table: "student_directory",
                  academic_year_id: data.overview?.active_year,
                  active: "true",
                  class_id: classId,
                }),
              );
              const ids = all
                .filter(
                  (s) => !["graduated", "left"].includes(s.progression),
                )
                .map((s) => s.id);
              setSelected((prev) => {
                const next = new Set(prev);
                const everyPicked =
                  ids.length > 0 && ids.every((id) => prev.has(id));
                ids.forEach((id) =>
                  everyPicked ? next.delete(id) : next.add(id),
                );
                return next;
              });
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Could not update selection",
              );
            }
          }}
        >
          Select {classId ? "entire class" : "all students"}
        </Button>
        <Button
          disabled={!selected.size}
          onClick={() => {
            request.current = crypto.randomUUID();
            setAward(true);
          }}
        >
          <Star />
          Award to {selected.size} students
        </Button>
      </div>
      <Panel>
        {students.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Student</th>
                  <th>Class</th>
                  <th>League</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${s.full_name}`}
                        checked={selected.has(s.id)}
                        onChange={(e) =>
                          setSelected((prev) => {
                            const n = new Set(prev);
                            if (e.target.checked) n.add(s.id);
                            else n.delete(s.id);
                            return n;
                          })
                        }
                      />
                    </td>
                    <td>
                      <strong>{s.full_name}</strong>
                      <small>#{s.admission_number}</small>
                    </td>
                    <td>{s.class_name}</td>
                    <td>{s.league_name || "Unassigned"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={UsersRound}
            title={
              search || classId
                ? "No matching students"
                : "No eligible students"
            }
          >
            {search || classId
              ? "Try another search or class filter."
              : "Students enrolled in the active academic year appear here."}
          </Empty>
        )}
        <Pager page={page} onChange={setPage} count={students.length} />
      </Panel>
      <div className="page-intro mt-8">
        <div>
          <h2>Award history</h2>
          <p>Manual and attendance awards in date order.</p>
        </div>
      </div>
      <ErrorNotice message={ledgerError} />
      <Panel>
        {transactions.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Stars</th>
                  <th>Reason</th>
                  <th>Source</th>
                  <th>Date</th>
                  <th>Awarded by</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.student_name}</strong>
                      <small>#{t.admission_number}</small>
                    </td>
                    <td>
                      <Tag tone="gold">+{t.amount} ★</Tag>
                    </td>
                    <td>{t.reason}</td>
                    <td>{t.source}</td>
                    <td>{dateLabel(t.earned_on)}</td>
                    <td>{t.staff_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={Star} title="No awards recorded">
            Each star award will appear here with its reason and awarding staff
            member.
          </Empty>
        )}
        <Pager
          page={ledgerPage}
          onChange={setLedgerPage}
          count={transactions.length}
        />
      </Panel>
      {award ? (
        <Modal title="Award stars" onClose={() => setAward(false)}>
          <Form
            submit={`Confirm award to ${selected.size} students`}
            onSubmit={async (f) => {
              await command("stars.award", {
                students: Array.from(selected),
                amount: Number(f.get("amount")),
                reason: f.get("reason"),
                request_id: request.current,
              });
              setSelected(new Set());
              setAward(false);
            }}
          >
            <Field label="Stars for each student">
              <select name="amount" required>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} star{n === 1 ? "" : "s"} per student
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reason (required)">
              <textarea
                name="reason"
                required
                maxLength={1000}
                placeholder="Reason for this award"
              />
            </Field>
            <div className="notice">
              {selected.size} individual awards will be written together. Awards
              cannot be deducted or silently removed.
            </div>
          </Form>
        </Modal>
      ) : null}
    </>
  );
}
