import Link from 'next/link';
import { getBackendUrl } from '../../lib/backendUrl';
import { createMetadata } from '../../lib/seo';

export const dynamic = 'force-dynamic';

async function getRoom(code) {
  try {
    const response = await fetch(`${getBackendUrl()}/api/rooms/${encodeURIComponent(String(code || '').toUpperCase())}`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const routeParams = await params;
  const code = String(routeParams.code || '').toUpperCase();
  const room = await getRoom(code);
  const isIndexable = room && !room.isPrivate;

  return createMetadata({
    title: room?.name ? `${room.name} - Public IPL Auction Room` : 'Public IPL Auction Room',
    description: room?.name
      ? `Join or view ${room.name}, a public IPL auction simulator room with live bidding, purse strategy, and fantasy squad building.`
      : 'Public IPL auction room for live bidding and fantasy squad building.',
    path: `/auction-room/${code.toLowerCase()}`,
    keywords: ['public ipl auction room', 'ipl auction room', 'live ipl auction'],
    index: Boolean(isIndexable),
  });
}

export default async function PublicAuctionRoomPage({ params }) {
  const routeParams = await params;
  const code = String(routeParams.code || '').toUpperCase();
  const room = await getRoom(code);

  if (!room || room.isPrivate) {
    return (
      <main style={{ minHeight: '100vh', background: '#0b0d14', color: '#fff', padding: '100px 24px', fontFamily: 'var(--font-ui)', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '4rem', letterSpacing: 0 }}>Auction room not public</h1>
        <p style={{ color: '#c9cdd6' }}>This room is private, expired, or unavailable for search indexing.</p>
        <Link href="/room?action=browse" style={{ display: 'inline-block', marginTop: 24, background: '#E8B84B', color: '#000', padding: '12px 16px', textDecoration: 'none', fontWeight: 600 }}>Browse live rooms</Link>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: '#0b0d14', color: '#fff', padding: '100px 24px', fontFamily: 'var(--font-ui)' }}>
      <section style={{ maxWidth: 820, margin: '0 auto' }}>
        <p style={{ color: '#E8B84B', letterSpacing: 0, fontWeight: 600 }}>Public IPL Auction Room</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(3rem, 8vw, 6rem)', lineHeight: 0.9, margin: '8px 0', letterSpacing: 0 }}>{room.name || `Room ${code}`}</h1>
        <p style={{ color: '#c9cdd6', fontSize: '1.1rem', lineHeight: 1.65 }}>
          This public IPL auction simulator room is available for live bidding and fantasy squad building.
        </p>
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, margin: '30px 0' }}>
          {[
            ['Room Code', code],
            ['Mode', room.mode || room.auctionMode || 'mega'],
            ['Players', room.playerCount ?? room.players ?? 0],
          ].map(([label, value]) => (
            <div key={label} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 18, background: 'rgba(12,16,24,0.86)' }}>
              <dt style={{ color: '#a3a9b8', fontSize: 12, letterSpacing: 0 }}>{label}</dt>
              <dd style={{ margin: '8px 0 0', fontSize: '1.2rem', fontWeight: 600 }}>{value}</dd>
            </div>
          ))}
        </dl>
        <Link href={`/join/${code}`} style={{ background: '#E8B84B', color: '#000', padding: '12px 16px', textDecoration: 'none', fontWeight: 600 }}>Join auction room</Link>
      </section>
    </main>
  );
}
