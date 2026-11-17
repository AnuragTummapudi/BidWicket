import Link from 'next/link';
import BrandLink from './components/BrandLink';

export const metadata = {
  title: '404 | IPL Auction Online',
  description: 'The page you requested was not found. Head back into IPL Auction Online and jump into a room.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="ui-card" style={{ width: 'min(560px, 100%)', padding: '40px 32px', textAlign: 'center' }}>
        <div className="ui-figure" style={{ fontSize: 64, color: 'var(--gold)' }}>404</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(28px, 4vw, 40px)', lineHeight: 1.1, margin: '16px 0 0' }}>
          This page didn&apos;t make the final XI
        </h1>
        <p style={{ margin: '12px auto 0', maxWidth: '28rem', color: 'var(--text-2)', lineHeight: 1.6 }}>
          The page you asked for isn&apos;t here anymore, but the auction is still running.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 32 }}>
          <Link href="/" className="ui-btn ui-btn-primary">Go home</Link>
          <Link href="/room?action=browse" className="ui-btn">Browse rooms</Link>
        </div>
        <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
          <BrandLink compact />
        </div>
      </div>
    </main>
  );
}
