import { notFound } from "next/navigation";
import { destinations } from "@/lib/navigation";
import { Workspace } from "@/components/star/workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const path = "/" + (await params).section;
  if (!destinations.some((d) => d.path === path)) notFound();
  return <Workspace section={path} />;
}
