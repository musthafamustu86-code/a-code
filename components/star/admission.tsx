"use client";
import { useState } from "react";
import { command } from "@/lib/client";
import { Field, Form, Modal } from "./ui";
import type { WorkspaceData } from "./workspace";

export function Admission({
  data,
  year,
  onClose,
}: {
  data: WorkspaceData;
  year: string;
  onClose: () => void;
}) {
  const [registered, setRegistered] = useState("");
  return (
    <Modal title="Register student" onClose={onClose}>
      <Form
        submit={registered ? "Finish photo upload" : "Register student"}
        onSubmit={async (fields) => {
          const photo = fields.get("photo");
          if (photo instanceof File && photo.size > 5 * 1024 * 1024)
            throw Error("Choose a photograph smaller than 5 MB.");
          let id = registered;
          if (!id) {
            const result = await command(
              "student.save",
              Object.fromEntries(
                [
                  "full_name",
                  "admission_number",
                  "class_id",
                  "league_id",
                  "academic_year_id",
                ].map((k) => [k, fields.get(k)]),
              ),
            );
            id = result.id;
            setRegistered(id);
          }
          if (photo instanceof File && photo.size) {
            const form = new FormData();
            form.set("student_id", id);
            form.set("file", photo);
            const response = await fetch("/api/photos", {
              method: "POST",
              body: form,
            });
            if (!response.ok)
              throw Error(
                "Student registered. " +
                  (await response.json()).error +
                  " You can retry the photo here.",
              );
          }
          onClose();
        }}
      >
        <fieldset disabled={!!registered}>
          <Field label="Full name">
            <input name="full_name" required maxLength={200} />
          </Field>
          <Field label="Permanent admission number">
            <input name="admission_number" required maxLength={80} />
          </Field>
          <Field label="Academic year">
            <select name="academic_year_id" required defaultValue={year}>
              {data.years
                .filter((y) => y.status !== "closed")
                .map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Class">
            <select name="class_id" required>
              {data.classes
                .filter((c) => c.active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="League">
            <select name="league_id" required>
              <option value="">Select league</option>
              {data.leagues
                .filter((l) => l.active)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </select>
          </Field>
        </fieldset>
        <Field label="Photograph (optional)">
          <input
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
          />
        </Field>
      </Form>
    </Modal>
  );
}
