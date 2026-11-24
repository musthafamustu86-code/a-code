"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";

export function Launch() {
  const [take, setTake] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => setTake((value) => value + 1),
      13000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const replay = () => setTake((value) => value + 1);
  return (
    <main className="launch">
      <div
        key={take}
        className="launch-stage"
        title="Click to replay"
        role="img"
        aria-label="Sincere Academy – Star System animated emblem"
        onClick={replay}
      >
        <div className="launch-glow" aria-hidden="true" />
        <div className="launch-sym">
          <div className="launch-hand up">
            <Image
              src="/brand/launch/emblem-top.png"
              width={660}
              height={345}
              alt=""
              priority
              unoptimized
            />
          </div>
          <div className="launch-hand lo">
            <Image
              src="/brand/launch/emblem-bottom.png"
              width={660}
              height={345}
              alt=""
              unoptimized
            />
          </div>
        </div>
        <div className="launch-txt">
          <div className="t">
            <Image
              src="/brand/launch/name-light.png"
              width={1265}
              height={110}
              alt="Sincere Academy"
              priority
              unoptimized
            />
          </div>
        </div>
        <div className="launch-rule" aria-hidden="true" />
        <div className="launch-tag">STAR SYSTEM</div>
      </div>
      <div className="launch-actions">
        <Link className="launch-enter" href="/dashboard" prefetch={false}>
          Enter the staff workspace
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <button type="button" className="launch-replay" onClick={replay}>
          <RotateCcw size={14} aria-hidden="true" />
          Replay
        </button>
      </div>
    </main>
  );
}
