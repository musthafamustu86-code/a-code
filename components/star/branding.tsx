"use client";
import { useState } from "react";
import { Field, ErrorNotice } from "./ui";
export function BrandingUpload() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="px-5 pb-6">
      <Field label="Institution logo (optional, JPEG / PNG / WebP, up to 5 MB)">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setError("");
            try {
              const form = new FormData();
              form.set("branding", "true");
              form.set("file", file);
              const response = await fetch("/api/photos", {
                method: "POST",
                body: form,
              });
              const body = await response.json();
              if (!response.ok) throw new Error(body.error);
              setMessage("Institution logo saved.");
              window.dispatchEvent(new Event("star-refresh"));
            } catch (e) {
              setError(e instanceof Error ? e.message : "Logo upload failed");
            } finally {
              setBusy(false);
            }
          }}
        />
      </Field>
      <ErrorNotice message={error} />
      {message ? (
        <p className="text-xs mt-3 text-[var(--green)]" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
