import { redirect } from "next/navigation";
export default async function RetiredTutorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/classrooms/${id}/slides`);
}
