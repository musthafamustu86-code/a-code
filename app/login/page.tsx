"use client";
import Image from "next/image";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [show, setShow] = useState(false);

  return (
    <main className="signin">
      <section className="signin-brand">
        <Image
          className="signin-lockup"
          src="/brand/sincere-academy.webp"
          width={1400}
          height={554}
          alt="Sincere Academy"
          preload
          unoptimized
        />
        <div className="signin-statement">
          <p>
            Attendance, stars and recognition, held in one place for every
            classroom.
          </p>
          <span>Star System</span>
        </div>
      </section>

      <section className="signin-panel">
        <form
          className="signin-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const body = Object.fromEntries(new FormData(e.currentTarget));
              const r = await fetch("/api/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              });
              if (!r.ok) throw Error((await r.json()).error);
              location.replace("/dashboard");
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Unable to sign in.",
              );
              setBusy(false);
            }
          }}
        >
          <h1>Staff sign in</h1>
          <p className="signin-lede">
            Use the account the academy owner issued to you.
          </p>

          <label className="signin-field">
            <span className="signin-label">Email address</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              placeholder=" "
            />
            <i aria-hidden="true" />
          </label>

          <label className="signin-field">
            <span className="signin-label">Password</span>
            <span className="signin-password">
              <input
                name="password"
                type={show ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder=" "
              />
              <button
                type="button"
                className="signin-eye"
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
            <i aria-hidden="true" />
          </label>

          {error ? (
            <p role="alert" className="signin-error">
              {error}
            </p>
          ) : null}

          <button className="signin-submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
            <ArrowRight size={17} aria-hidden="true" />
          </button>

          <p className="signin-help">Accounts are created by the academy owner.</p>
        </form>
      </section>
    </main>
  );
}
