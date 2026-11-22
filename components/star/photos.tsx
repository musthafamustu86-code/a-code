"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { allPages, initials } from "@/lib/client";
import type { StudentRow } from "@/lib/types";
import { Button, Empty, ErrorNotice, Field, Modal, Tag } from "./ui";
export function StudentAvatar({
  student,
}: {
  student: Pick<StudentRow, "id" | "full_name" | "photo_path">;
}) {
  return student.photo_path ? (
    <Image
      className="avatar object-cover"
      src={`/api/photos?student_id=${student.id}`}
      alt={`${student.full_name}'s photograph`}
      width={34}
      height={34}
      unoptimized
    />
  ) : (
    <span className="avatar">{initials(student.full_name)}</span>
  );
}
export function BulkPhotos({
  year,
  onClose,
}: {
  year: string;
  onClose: () => void;
}) {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [files, setFiles] = useState<
    { file: File; student_id: string; status: string }[]
  >([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void allPages<StudentRow>(
      `table=student_directory&academic_year_id=${year}`,
    )
      .then((rows) => {
        if (!cancelled) setStudents(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [year]);
  return (
    <Modal title="Bulk student photographs" onClose={() => !busy && onClose()}>
      <div className="details-content">
        <div className="notice">
          Name photographs using permanent admission numbers, for example
          1001.jpg. Review matches before uploading. JPEG, PNG and WebP, up to 5
          MB each. Photos are optional.
        </div>
        <ErrorNotice message={error} />
        <Field label="Choose multiple photos">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={busy}
            onChange={(e) => {
              const list = Array.from(e.target.files || []).map((file) => ({
                file,
                student_id:
                  students.find(
                    (s) =>
                      s.admission_number === file.name.replace(/\.[^.]+$/, ""),
                  )?.id || "",
                status: "",
              }));
              setFiles(list);
            }}
          />
        </Field>
        {files.length ? (
          <>
            <div className="table-wrap mt-5">
              <table>
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Match to student</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f, i) => (
                    <tr key={`${f.file.name}-${i}`}>
                      <td>{f.file.name}</td>
                      <td>
                        <select
                          aria-label={`Match ${f.file.name}`}
                          disabled={busy || f.status === "Uploaded"}
                          value={f.student_id}
                          onChange={(e) =>
                            setFiles((prev) =>
                              prev.map((v, j) =>
                                i === j
                                  ? { ...v, student_id: e.target.value }
                                  : v,
                              ),
                            )
                          }
                        >
                          <option value="">Unmatched — choose student</option>
                          {students.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.admission_number} · {s.full_name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <Tag
                          tone={
                            f.status === "Uploaded"
                              ? "green"
                              : f.student_id
                                ? "purple"
                                : "gray"
                          }
                        >
                          {f.status || (f.student_id ? "Matched" : "Unmatched")}
                        </Tag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-footer">
              <Button
                disabled={
                  busy ||
                  !files.some((f) => f.student_id && f.status !== "Uploaded")
                }
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  for (let i = 0; i < files.length; i++) {
                    const f = files[i];
                    if (!f.student_id || f.status === "Uploaded") continue;
                    try {
                      const form = new FormData();
                      form.set("student_id", f.student_id);
                      form.set("file", f.file);
                      const r = await fetch("/api/photos", {
                        method: "POST",
                        body: form,
                      });
                      const d = await r.json();
                      if (!r.ok) throw new Error(d.error);
                      setFiles((prev) =>
                        prev.map((v, j) =>
                          i === j ? { ...v, status: "Uploaded" } : v,
                        ),
                      );
                    } catch (e) {
                      setFiles((prev) =>
                        prev.map((v, j) =>
                          i === j
                            ? {
                                ...v,
                                status:
                                  e instanceof Error ? e.message : "Failed",
                              }
                            : v,
                        ),
                      );
                    }
                  }
                  setBusy(false);
                  window.dispatchEvent(new Event("star-refresh"));
                }}
              >
                {busy ? "Uploading…" : "Upload matched photos"}
              </Button>
            </div>
          </>
        ) : null}
        <h3 className="mt-6 mb-3">Students without photographs</h3>
        <div className="max-h-48 overflow-auto">
          {students
            .filter(
              (s) =>
                !s.photo_path &&
                !files.some(
                  (f) => f.student_id === s.id && f.status === "Uploaded",
                ),
            )
            .map((s) => (
              <p className="text-xs py-2 text-[var(--soft)]" key={s.id}>
                #{s.admission_number} · {s.full_name}
              </p>
            ))}
        </div>
        {!students.length ? <Empty title="No students in this year" /> : null}
      </div>
    </Modal>
  );
}
