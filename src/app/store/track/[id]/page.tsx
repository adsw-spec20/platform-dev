import { TrackView } from "@/components/store/TrackView";

export default async function TrackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TrackView orderId={id} />;
}
