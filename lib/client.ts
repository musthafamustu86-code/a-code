"use client";
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export const WorkspaceConnection = createContext(true);
export function useWorkspaceConnected() {
  return useContext(WorkspaceConnection);
}

const pending = new Map<string, Promise<unknown>>();
// Data survives section switches so a remounted page can render immediately
// while a background request refreshes it.
const cache = new Map<string, unknown>();
const fetchedAt = new Map<string, number>();
const FRESH_MS = 15_000;
export function invalidateData() {
  for (const key of cache.keys()) fetchedAt.set(key, 0);
}
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const dedupe = !options?.method && url.startsWith("/api/data?");
  if (dedupe && pending.has(url)) return pending.get(url) as Promise<T>;
  const operation = (async () => {
    const response = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The operation failed.");
    return data as T;
  })();
  if (dedupe) {
    pending.set(url, operation);
    operation.then(
      () => pending.delete(url),
      () => pending.delete(url),
    );
  }
  return operation;
}
export async function command(action: string, payload: object) {
  const data = await api<{ result: { id: string } }>("/api/data", {
    method: "POST",
    body: JSON.stringify({ action, payload }),
  });
  invalidateData();
  window.dispatchEvent(new Event("star-refresh"));
  return data.result;
}
export function useData<T>(requestedQuery: string | null, fallback: T) {
  const query = useWorkspaceConnected() ? requestedQuery : null;
  const [result, setResult] = useState<{
    key: string | null;
    data?: T;
    error?: string;
  }>(() => {
    const cached = query ? cache.get(query) : undefined;
    return cached === undefined
      ? { key: null }
      : { key: query, data: cached as T };
  });
  const generation = useRef(0);
  const reload = useCallback(async () => {
    if (!query) return;
    const current = ++generation.current;
    try {
      const data = (await (query.startsWith("all:")
        ? allPages(query.slice(4))
        : api<T>(`/api/data?${query}`))) as T;
      if (current === generation.current) {
        cache.set(query, data);
        fetchedAt.set(query, Date.now());
        setResult({ key: query, data });
      }
    } catch (e) {
      if (current !== generation.current) return;
      const cached = cache.get(query);
      if (cached !== undefined) {
        setResult({ key: query, data: cached as T });
        return;
      }
      setResult({
        key: query,
        error: e instanceof Error ? e.message : "Could not load records.",
      });
    }
  }, [query]);
  useEffect(() => {
    // A timer instead of requestAnimationFrame: rAF never fires in a hidden or
    // background tab, which left the workspace stuck on its loading state.
    const fresh =
      !!query &&
      cache.has(query) &&
      Date.now() - (fetchedAt.get(query) ?? 0) < FRESH_MS;
    const timer = fresh ? undefined : setTimeout(() => void reload(), 0);
    const invalidate = () => {
      generation.current++;
    };
    window.addEventListener("star-refresh", reload);
    return () => {
      if (timer) clearTimeout(timer);
      invalidate();
      window.removeEventListener("star-refresh", reload);
    };
  }, [query, reload]);
  return {
    data: result.key === query ? (result.data ?? fallback) : fallback,
    error: result.key === query ? result.error || "" : "",
    loading: !!query && result.key !== query,
    reload,
  };
}
export async function allPages<T>(query: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await api<T[]>(`/api/data?${query}&offset=${offset}`);
    rows.push(...page);
    if (page.length < 100) break;
  }
  return rows;
}
export const dateLabel = (date: string) =>
  new Date(date.length === 10 ? `${date}T12:00:00Z` : date).toLocaleDateString(
    "en-IN",
    { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" },
  );
export const dateTimeLabel = (date: string, timezone = "Asia/Kolkata") =>
  new Date(date).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
export const timeLabel = (time?: string | null) =>
  time
    ? new Date(`1970-01-01T${time}Z`).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      })
    : "";
export const initials = (name: string) =>
  name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
export const queryString = (
  values: Record<string, string | number | null | undefined>,
) =>
  new URLSearchParams(
    Object.entries(values)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => [k, String(v)]),
  ).toString();
