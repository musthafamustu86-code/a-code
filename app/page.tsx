import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function LaunchPage() {
  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <main className="gate">
      <div className="gate-aurora" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div className="gate-brand">
        <div className="gate-crest">
          <Image
            className="gate-lockup"
            src="/brand/sincere-academy.webp"
            width={1400}
            height={554}
            alt="Sincere Academy"
            preload
            unoptimized
          />
          <i className="gate-ribbon" aria-hidden="true" />
        </div>
        <p className="gate-date">{today}</p>
      </div>

      <div className="gate-side">
        <p className="gate-label">
          <i aria-hidden="true" />
          Staff workspace
        </p>
        <p className="gate-lines">
          <span>Attendance is recorded.</span>
          <span>Stars are earned.</span>
          <span>Leaders are recognised.</span>
        </p>
        <div className="gate-actions">
          <Link className="gate-enter" href="/dashboard" prefetch={false}>
            Enter the staff workspace
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <p className="gate-note">
            Accounts are issued by the academy owner.
          </p>
        </div>
      </div>
    </main>
  );
}
