'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Menu, X } from 'lucide-react';
import CircularGallery from './components/CircularGallery';
import Stack from './components/Stack';
import BrandLink from './components/BrandLink';
import ALL_PLAYERS from './data/Players.json';
import { getBackendUrl } from './lib/backendUrl';
import './landing.css';

const TEAMS = [
  { id: 'CSK', name: 'Chennai Super Kings', short: 'CSK', logo: '/assets/CSK.png' },
  { id: 'MI', name: 'Mumbai Indians', short: 'MI', logo: '/assets/MI.png' },
  { id: 'RCB', name: 'Royal Challengers Bengaluru', short: 'RCB', logo: '/assets/RCB.png' },
  { id: 'KKR', name: 'Kolkata Knight Riders', short: 'KKR', logo: '/assets/KKR.png' },
  { id: 'SRH', name: 'Sunrisers Hyderabad', short: 'SRH', logo: '/assets/SRH.png' },
  { id: 'DC', name: 'Delhi Capitals', short: 'DC', logo: '/assets/DC.png' },
  { id: 'PBKS', name: 'Punjab Kings', short: 'PBKS', logo: '/assets/PBKS.png' },
  { id: 'RR', name: 'Rajasthan Royals', short: 'RR', logo: '/assets/RR.png' },
  { id: 'GT', name: 'Gujarat Titans', short: 'GT', logo: '/assets/GT.png' },
  { id: 'LSG', name: 'Lucknow Super Giants', short: 'LSG', logo: '/assets/LSG.png' },
];

const NAV_LINKS = [
  { label: 'Auction', href: '/room' },
  { label: 'Teams', href: '/teams' },
  { label: 'Players', href: '/players' },
  { label: 'How to play', href: '/how-to-play' },
  { label: 'Schedule', href: '/schedule' },
  { label: 'Support', href: '/support' },
];

const ROLE_LABEL = {
  batsman: 'Batter',
  bowler: 'Bowler',
  all_rounder: 'All-rounder',
  wicket_keeper: 'Wicketkeeper',
};

const TEAM_LOOKUP = Object.fromEntries(TEAMS.map((team) => [team.id, team]));
const PLAYER_LOOKUP = Object.fromEntries(ALL_PLAYERS.map((player) => [player.name, player]));

function formatBasePrice(lakhs) {
  if (!Number.isFinite(lakhs)) return '—';
  return lakhs >= 100 ? `₹${(lakhs / 100).toFixed(2)} Cr` : `₹${lakhs} L`;
}

function getDateKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getMatchState(match, nowMs) {
  const openMs = new Date(match.auctionOpensAt).getTime();
  const startMs = new Date(match.startAt).getTime();
  const endMs = new Date(match.endAt).getTime();

  if (nowMs >= endMs) return 'completed';
  if (nowMs >= startMs) return 'locked';
  if (nowMs >= openMs) return 'open';
  return 'scheduled';
}

function isPlayableMatch(match, nowMs) {
  if (match.isRivalsPlayable === false) return false;
  const state = getMatchState(match, nowMs);
  return state === 'scheduled' || state === 'open';
}

function formatCountdown(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return 'Live';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function formatMatchMeta(startAt) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(startAt));
}

const FACTS = ['520+ players in the pool', '10 franchises per room', 'Live bidding', 'Purse tracker', 'Free to play'];

const MARQUEE_NAMES = [
  'MS Dhoni', 'Virat Kohli', 'Rohit Sharma', 'Yashasvi Jaiswal',
  'Shreyas Iyer', 'Rishabh Pant', 'Sanju Samson', 'Axar Patel',
  'Ishan Kishan', 'Jasprit Bumrah',
];

function getGalleryImage(name, playerRecord) {
  const upperName = String(name || '').toUpperCase();
  if (playerRecord?.photo_url) return playerRecord.photo_url;
  if (upperName.includes('BOULT')) return '/assets/Boult.avif';
  return '/assets/Kohli.avif';
}

const GALLERY_ITEMS = MARQUEE_NAMES.map((name) => {
  const nUpper = name.toUpperCase();
  const p = ALL_PLAYERS.find((pl) => {
    const pUpper = pl.name.toUpperCase();
    return pUpper === nUpper || pUpper.includes(nUpper.split(' ')[1] || nUpper);
  });
  return {
    image: getGalleryImage(name, p),
    text: name,
    alt: `${p?.name || name} player card in IPL Auction Online`,
  };
});

const HOW_STEPS = [
  { num: '01', title: 'Create or join a room', body: 'Host a private game and share the room code with friends, or jump into a public room. No account needed, just a franchise name.' },
  { num: '02', title: 'Bid for your squad', body: 'Every player opens at a base price. Watch your rivals, decide when to hold back and when to go all in. Your purse is limited, so spend it carefully.' },
  { num: '03', title: 'Win the auction', body: 'The franchise with the best balanced squad wins. A lineup full of stars only works if you kept the budget to back it.' },
];

const PLAYER_REVIEWS = [
  { name: 'Aarav Nair', city: 'Bengaluru', text: 'We opened it for one quick auction and ended up playing three rooms back to back. The purse pressure feels very real.' },
  { name: 'Meera Iyer', city: 'Chennai', text: 'Fast and oddly addictive. The room code flow made it easy for our whole WhatsApp group to jump in.' },
  { name: 'Kabir Shah', city: 'Mumbai', text: 'I lost because I overpaid for two stars, and somehow that made it more fun.' },
  { name: 'Ananya Rao', city: 'Hyderabad', text: 'Feels like a proper draft night without anyone maintaining a spreadsheet. My cousins understood it in two minutes.' },
  { name: 'Rohan Kulkarni', city: 'Pune', text: 'The live bidding gets genuinely tense. One value pick at the end changed our entire leaderboard.' },
  { name: 'Ishita Banerjee', city: 'Kolkata', text: 'Best part is how quick it starts. No login, no setup lecture, just a room code and chaos.' },
  { name: 'Devansh Patel', city: 'Ahmedabad', text: 'Rivals mode is perfect for two people. Short, sharp and easy to replay after a close loss.' },
  { name: 'Sanya Menon', city: 'Kochi', text: 'It rewards patience. I saved money for bowlers and finally beat the friend who only chases big names.' },
];

const FEATURES = [
  ['Live rooms', 'Create private or public IPL auction rooms with real-time bidding and room codes.'],
  ['Mock auction strategy', 'Practice when to bid, when to save, and how to build a balanced squad.'],
  ['Purse management', 'Track remaining budget while competing for marquee players and value picks.'],
  ['Player pool', 'Browse IPL players, roles, base prices, teams and auction-ready player cards.'],
  ['Team building', 'Compare franchises, squad roles and final auction results after bidding ends.'],
  ['Free online play', 'Start an IPL auction game in the browser on desktop or mobile.'],
];

const HERO_STACK_PLAYERS = [
  { name: 'KL Rahul', tag: 'Batting anchor' },
  { name: 'MS Dhoni', tag: 'Finisher' },
  { name: 'Rohit Sharma', tag: 'Captain' },
  { name: 'Jasprit Bumrah', tag: 'Death overs' },
  { name: 'Virat Kohli', tag: 'Opener' },
];

/* A player lot as it appears on the auction floor */
function LotCard({ player, lot }) {
  const record = PLAYER_LOOKUP[player.name];
  const photoUrl = record?.photo_url || record?.image_url || '/assets/Kohli.avif';
  const team = TEAM_LOOKUP[record?.ipl_team_code];

  return (
    <div className="l-lot">
      <div className="l-lot-top">
        <span className="l-lot-num">Lot {String(lot).padStart(2, '0')}</span>
        <span className="l-lot-tag">{player.tag}</span>
      </div>
      <div className="l-lot-photo">
        <img src={photoUrl} alt={`${player.name} IPL player headshot`} loading="eager" />
      </div>
      <div className="l-lot-info">
        <div className="l-lot-name">{player.name}</div>
        <div className="l-lot-meta">
          <span>{ROLE_LABEL[record?.role] || 'Player'}</span>
          <span aria-hidden="true">·</span>
          <span>{team?.short || record?.ipl_team_code || 'IPL'}</span>
        </div>
        <div className="l-lot-price">
          <span className="l-lot-price-label">Base price</span>
          <span className="l-lot-price-val">{formatBasePrice(record?.base_price)}</span>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [rivalsMatches, setRivalsMatches] = useState([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [menuOpen, setMenuOpen] = useState(false);
  const heroStackCards = useMemo(
    () => HERO_STACK_PLAYERS.map((player, i) => (
      <LotCard key={player.name} player={player} lot={HERO_STACK_PLAYERS.length - i} />
    )),
    []
  );

  const hasRivals = rivalsMatches.length > 0;
  useEffect(() => {
    // the countdown is the only thing that needs a 1s clock
    if (!hasRivals) return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasRivals]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${getBackendUrl()}/api/rivals/matches`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setRivalsMatches(data?.matches || []);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const todayKey = getDateKey(new Date(nowMs));
  const todayRivals = useMemo(
    () => rivalsMatches.filter((match) => match.date === todayKey).sort((a, b) => new Date(a.startAt) - new Date(b.startAt)),
    [rivalsMatches, todayKey]
  );
  const featuredRival = useMemo(() => {
    const nextPlayableToday = todayRivals.find((match) => isPlayableMatch(match, nowMs));
    if (nextPlayableToday) return nextPlayableToday;
    return rivalsMatches.find((match) => isPlayableMatch(match, nowMs)) || null;
  }, [todayRivals, rivalsMatches, nowMs]);
  const rivalsHref = featuredRival ? `/room?action=rivals&matchKey=${encodeURIComponent(featuredRival.key)}` : '/room?action=browse';

  let rival = null;
  if (featuredRival) {
    const state = getMatchState(featuredRival, nowMs);
    rival = {
      home: TEAM_LOOKUP[featuredRival.homeTeam],
      away: TEAM_LOOKUP[featuredRival.awayTeam],
      state,
      timerLabel: state === 'locked' ? 'Match live' : state === 'open' ? 'Auction locks in' : 'Match starts in',
      countdown: state === 'locked' ? 'Live' : formatCountdown(new Date(featuredRival.startAt).getTime() - nowMs),
      meta: formatMatchMeta(featuredRival.startAt),
    };
  }

  return (
    <div className="landing-root">
      <nav className="l-nav">
        <BrandLink compact className="l-nav-logo" />

        <div className="l-nav-links">
          {NAV_LINKS.map((link) => (
            <Link key={link.label} href={link.href} className="l-nav-link">{link.label}</Link>
          ))}
        </div>

        <div className="l-nav-actions">
          <Link href="/room?action=browse" className="l-nav-text">Live rooms</Link>
          <button className="ui-btn ui-btn-primary ui-btn-sm" onClick={() => router.push('/room?action=create')}>Create room</button>
          <button
            className="l-nav-menu ui-btn ui-btn-ghost ui-btn-sm"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={18} strokeWidth={1.5} /> : <Menu size={18} strokeWidth={1.5} />}
          </button>
        </div>

        {menuOpen && (
          <div className="l-nav-sheet">
            {NAV_LINKS.map((link) => (
              <Link key={link.label} href={link.href} className="l-nav-sheet-link" onClick={() => setMenuOpen(false)}>{link.label}</Link>
            ))}
            <Link href="/room?action=browse" className="l-nav-sheet-link" onClick={() => setMenuOpen(false)}>Live rooms</Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="l-hero">
        <div className="l-hero-left">
          <span className="ui-eyebrow">IPL auction simulator</span>
          <h1 className="l-hero-h1">The IPL auction, played live with your friends</h1>
          <p className="l-hero-subtext">
            Take a franchise, share a room code and spend a ₹120 Cr purse on real players.
            Ten teams per room, live bidding, no account needed.
          </p>

          <div className="l-ctas">
            <button className="ui-btn ui-btn-primary l-cta" onClick={() => router.push('/room?action=create')}>Create a room</button>
            <button className="ui-btn l-cta" onClick={() => router.push('/room?action=join-code')}>
              Join with a code
              <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>

          <dl className="l-stats">
            <div><dt>Franchises</dt><dd className="ui-figure">10</dd></div>
            <div><dt>Purse each</dt><dd className="ui-figure">₹120 Cr</dd></div>
            <div><dt>Players</dt><dd className="ui-figure">520+</dd></div>
          </dl>
        </div>

        <div className="l-hero-right">
          <div className="l-hero-stack-frame">
            <Stack
              randomRotation={false}
              sensitivity={180}
              sendToBackOnClick
              autoplay={false}
              pauseOnHover={false}
              mobileClickOnly
              cards={heroStackCards}
            />
          </div>
          <p className="l-hero-stack-caption">Tap the stack to see the next lot</p>
        </div>
      </section>

      {/* Rivals */}
      <section className="l-rivals">
        <div className="l-rivals-inner">
          <div className="l-rivals-head">
            <div>
              <span className="ui-eyebrow">Daily mode</span>
              <h2 className="l-h2">Today in Rivals</h2>
            </div>
          </div>

          {rival ? (
            <div className="l-rival-card">
              <div className="l-rival-teams">
                <div className="l-rival-meta">
                  <span>{rival.meta} IST</span>
                  <span aria-hidden="true">·</span>
                  <span>{featuredRival.isHighProfile ? 'Highlight clash' : featuredRival.venue}</span>
                </div>
                <div className="l-rival-row">
                  <div className="l-rival-team">
                    <Image src={rival.home?.logo || '/assets/CSK.png'} alt={`${rival.home?.name || 'Home team'} logo`} width={48} height={48} />
                    <div>
                      <div className="l-rival-short">{rival.home?.short}</div>
                      <div className="l-rival-name">{rival.home?.name}</div>
                    </div>
                  </div>
                  <span className="l-rival-vs">vs</span>
                  <div className="l-rival-team l-rival-team-away">
                    <div>
                      <div className="l-rival-short">{rival.away?.short}</div>
                      <div className="l-rival-name">{rival.away?.name}</div>
                    </div>
                    <Image src={rival.away?.logo || '/assets/MI.png'} alt={`${rival.away?.name || 'Away team'} logo`} width={48} height={48} />
                  </div>
                </div>
              </div>
              <div className="l-rival-side">
                <span className="l-rival-timer-label">{rival.timerLabel}</span>
                <span className={`l-rival-timer ui-figure${rival.state === 'locked' ? ' is-live' : ''}`}>{rival.countdown}</span>
                <button className="ui-btn ui-btn-primary" onClick={() => router.push(rivalsHref)}>Play this match</button>
              </div>
            </div>
          ) : (
            <div className="l-rival-card l-rival-empty">
              <p>Rivals is a two-player auction built around each day&apos;s IPL match. Find an online rival or create a private duel room.</p>
              <button className="ui-btn ui-btn-primary" onClick={() => router.push('/room?action=browse')}>Find a rival</button>
            </div>
          )}
        </div>
      </section>

      {/* Facts strip */}
      <div className="l-facts">
        {FACTS.map((fact) => <span key={fact}>{fact}</span>)}
      </div>

      {/* Marquee players */}
      <section className="l-players">
        <div className="l-section-head">
          <span className="ui-eyebrow">Marquee players</span>
          <h2 className="l-h2">The names everyone will bid on</h2>
        </div>
        <div className="l-desktop-marquee">
          <CircularGallery
            items={GALLERY_ITEMS}
            bend={1}
            textColor="#eef0f5"
            borderRadius={0.04}
            font="500 30px var(--font-display)"
          />
        </div>
        <div className="l-mobile-marquee">
          {GALLERY_ITEMS.map((item) => (
            <figure key={item.text} className="l-mobile-player">
              <img src={item.image} alt={item.alt} loading="lazy" />
              <figcaption>{item.text}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="l-how">
        <div className="l-section-head">
          <span className="ui-eyebrow">How it works</span>
          <h2 className="l-h2">A full IPL auction in minutes</h2>
          <p>Use it for fantasy league practice, a draft night with friends, or a mock auction before the real mega auction.</p>
        </div>
        <ol className="l-how-grid">
          {HOW_STEPS.map(({ num, title, body }) => (
            <li key={num} className="l-step">
              <span className="l-step-num">{num}</span>
              <h3 className="l-step-title">{title}</h3>
              <p className="l-step-body">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Reviews */}
      <section className="l-reviews">
        <div className="l-section-head">
          <span className="ui-eyebrow">Player reviews</span>
          <h2 className="l-h2">What people say after an auction</h2>
        </div>
        <div className="l-review-row" aria-label="Player reviews">
          {PLAYER_REVIEWS.map((review) => (
            <article className="l-review-card" key={review.name}>
              <p className="l-review-text">{review.text}</p>
              <div className="l-review-who">
                <span className="l-review-avatar" aria-hidden="true">{review.name.split(' ').map((part) => part[0]).join('')}</span>
                <span>
                  <span className="l-review-name">{review.name}</span>
                  <span className="l-review-city">{review.city}</span>
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Why */}
      <section className="l-seo-section">
        <div className="l-section-head">
          <span className="ui-eyebrow">Why use this simulator</span>
          <h2 className="l-h2">Built for auction practice, strategy and game nights</h2>
          <p>
            Test bidding plans before a fantasy league, learn purse management, and play an IPL auction online
            with friends without spreadsheets or manual timers.
          </p>
        </div>
        <div className="l-feature-grid">
          {FEATURES.map(([title, body]) => (
            <article key={title} className="l-feature">
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Teams */}
      <section className="l-teams">
        <p className="l-teams-label">This season&apos;s franchises</p>
        <div className="l-teams-grid">
          {TEAMS.map((t) => (
            <Link key={t.id} href={`/teams?team=${encodeURIComponent(t.id)}`} className="l-team-badge" title={t.name} aria-label={t.name}>
              <Image src={t.logo} alt={`${t.name} team logo`} width={64} height={64} />
            </Link>
          ))}
        </div>
      </section>

      <footer className="l-footer">
        <div className="l-footer-inner">
          <div className="l-footer-top">
            <div className="l-footer-brand">
              <BrandLink className="l-footer-logo" />
              <p className="l-footer-tagline">The free online IPL auction game</p>
            </div>
            <div className="l-footer-links">
              {[
                { label: 'How to play', href: '/how-to-play' },
                { label: 'Players', href: '/players' },
                { label: 'Teams', href: '/teams' },
                { label: 'Support', href: '/support' },
                { label: 'IPL auction simulator', href: '/ipl-auction-simulator' },
                { label: 'Mock IPL auction', href: '/mock-ipl-auction' },
                { label: 'Live rooms', href: '/room?action=browse' },
              ].map((link) => (
                <Link key={link.label} href={link.href} className="l-footer-link">{link.label}</Link>
              ))}
            </div>
          </div>
          <div className="l-footer-bottom">
            <p>© 2026 iplauction.fun · Free to play</p>
            <p>
              A fan-made simulator, not affiliated with the BCCI, IPL or any franchise. Player data from{' '}
              <a href="https://www.iplt20.com" target="_blank" rel="noreferrer">iplt20.com</a> and{' '}
              <a href="https://cricapi.com" target="_blank" rel="noreferrer">CricAPI</a>.
            </p>
            <p>
              <a target="_blank" rel="noreferrer" href="https://icons8.com/icon/OLf3WK9ioebI/auction">Auction hammer</a> icon by{' '}
              <a target="_blank" rel="noreferrer" href="https://icons8.com">Icons8</a> ·{' '}
              <a target="_blank" rel="noreferrer" href="https://www.flaticon.com/free-icons/chai-tea" title="chai-tea icons">Chai icon by Fatima Qureshi, Flaticon</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
