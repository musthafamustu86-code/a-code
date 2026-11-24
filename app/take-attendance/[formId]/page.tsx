import { notFound } from "next/navigation";
import { Workspace } from "@/components/star/workspace";

export default async function Page({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      formId,
    )
  )
    notFound();
  return <Workspace section="/take-attendance" sheet={{ id: formId }} />;
}
