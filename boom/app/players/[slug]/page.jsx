import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import JsonLd from '../../components/JsonLd';
import players from '../../data/Players.json';
import { breadcrumbSchema, createMetadata, slugify } from '../../lib/seo';

function findPlayer(slug) {
  return players.find((player) => slugify(player.name) === slug);
}

function roleLabel(role) {
  return String(role || 'player').replace(/_/g, ' ');
}

export function generateStaticParams() {
  return players.slice(0, 250).map((player) => ({ slug: slugify(player.name) }));
}

export async function generateMetadata({ params }) {
  const routeParams = await params;
  const player = findPlayer(routeParams.slug);
  if (!player) return {};

  return createMetadata({
    title: `${player.name} IPL Auction Profile - Base Price, Role and Team`,
    description: `${player.name} IPL auction profile with role, country, base price, team code, stats, and fantasy auction research for IPL Auction Simulator.`,
    path: `/players/${slugify(player.name)}`,
    keywords: [`${player.name} IPL auction`, `${player.name} base price`, `${player.name} IPL profile`],
  });
}

export default async function PlayerPage({ params }) {
  const routeParams = await params;
  const player = findPlayer(routeParams.slug);
  if (!player) notFound();

  const stats = player.stats || {};
  const imageUrl = player.image_url || player.photo_url || '/assets/favicon.png';

  return (
    <main style={{ minHeight: '100vh', background: '#0b0d14', color: '#fff', padding: '84px 24px', fontFamily: 'var(--font-ui)' }}>
      <JsonLd data={breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Players', path: '/players' }, { name: player.name, path: `/players/${slugify(player.name)}` }])} />
      <section style={{ maxWidth: 980, margin: '0 auto' }}>
        <Link href="/players" style={{ color: '#E8B84B', textDecoration: 'none', fontWeight: 600 }}>All IPL players</Link>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 30, alignItems: 'center', marginTop: 24 }}>
          <div style={{ width: 220, height: 260, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, background: 'rgba(12,16,24,0.86)', overflow: 'hidden', position: 'relative' }}>
            <Image src={imageUrl} alt={`${player.name} IPL auction player profile`} fill sizes="220px" style={{ objectFit: 'cover' }} unoptimized />
          </div>
          <div>
            <p style={{ color: '#E8B84B', letterSpacing: 0, fontWeight: 600 }}>IPL Auction Player Profile</p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(3rem, 8vw, 6rem)', lineHeight: 0.9, margin: '8px 0', letterSpacing: 0 }}>{player.name}</h1>
            <p style={{ color: '#c9cdd6', fontSize: '1.1rem', lineHeight: 1.65 }}>
              Research {player.name} before your mock IPL auction, fantasy IPL draft, or live bidding room.
            </p>
          </div>
        </div>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, margin: '34px 0' }}>
          {[
            ['Role', roleLabel(player.role)],
            ['Country', player.country],
            ['Base Price', `₹${player.base_price || 0} lakh`],
            ['IPL Team', player.ipl_team_code || 'Auction pool'],
          ].map(([label, value]) => (
            <article key={label} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 18, background: 'rgba(12,16,24,0.86)' }}>
              <h2 style={{ color: '#a3a9b8', fontSize: 13, letterSpacing: 0 }}>{label}</h2>
              <p style={{ marginTop: 8, fontSize: '1.1rem', fontWeight: 600, textTransform: label === 'Role' ? 'capitalize' : 'none' }}>{value}</p>
            </article>
          ))}
        </section>

        <section style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 22, background: 'rgba(12,16,24,0.86)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', letterSpacing: 0, fontSize: '2.4rem' }}>Auction research notes</h2>
          <p style={{ color: '#c9cdd6', lineHeight: 1.7 }}>
            {player.name} is listed as a {roleLabel(player.role)} from {player.country}. In an IPL auction simulator,
            compare the base price with squad needs, remaining purse, and role scarcity before bidding aggressively.
          </p>
          <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 18 }}>
            {[
              ['Matches', stats.matches],
              ['Runs', stats.runs],
              ['Strike Rate', stats.sr],
              ['Wickets', stats.wickets],
            ].map(([label, value]) => (
              <div key={label} style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12 }}>
                <dt style={{ color: '#a3a9b8', fontSize: 12, letterSpacing: 0 }}>{label}</dt>
                <dd style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>{value ?? '-'}</dd>
              </div>
            ))}
          </dl>
        </section>

        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 34 }}>
          <Link href="/room?action=create" style={{ background: '#E8B84B', color: '#000', padding: '12px 16px', textDecoration: 'none', fontWeight: 600 }}>Start mock auction</Link>
          <Link href="/ipl-player-list" style={{ border: '1px solid rgba(232,184,75,0.45)', color: '#E8B84B', padding: '12px 16px', textDecoration: 'none', fontWeight: 600 }}>IPL Player List</Link>
        </nav>
      </section>
    </main>
  );
}
