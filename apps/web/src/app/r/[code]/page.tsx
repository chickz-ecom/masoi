import type { Metadata } from 'next';
import { RoomPage } from '@/components/game/RoomPage';

export const metadata: Metadata = { title: 'Phòng chơi', robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RoomPage code={code.toUpperCase()} />;
}
