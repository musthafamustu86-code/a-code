import { notFound } from "next/navigation";
import { destinations } from "@/lib/navigation";
import { Workspace } from "@/components/star/workspace";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ student?: string | string[] }>;
}) {
  const path = "/" + (await params).section;
  if (!destinations.some((d) => d.path === path)) notFound();
  const student = (await searchParams).student;
  return (
    <Workspace
      section={path}
      student={typeof student === "string" ? student : undefined}
    />
  );
}
