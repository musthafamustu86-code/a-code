import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function LaunchPage() {
  return (
    <main className="academy-launch">
      <div className="launch-content">
        <Image
          src="/brand/sincere-logo.jpeg"
          width={1280}
          height={720}
          alt="Sincere Academy"
          preload
          unoptimized
          className="launch-logo"
        />
        <h1>Star System</h1>
        <Link className="launch-enter" href="/dashboard" prefetch={false}>
          Enter staff workspace <ArrowRight size={18} />
        </Link>
      </div>
    </main>
  );
}
