'use client';

import { Suspense } from 'react';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { TEAMS, GOLD, BG, CARD, BORDER } from '../../src/MultiScreens';
import { useGame } from '../GameContext';

export default function TeamSelectPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#11141c" }} />}>
      <TeamSelectContent />
    </Suspense>
  );
}

function TeamSelectContent() {
  const { startSingleAuction, auctionMode } = useGame();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') || (auctionMode || 'MEGA').toUpperCase();
  const [hov, setHov] = useState(null);

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: 'var(--font-ui)', padding: "clamp(20px,4vh,38px) clamp(16px,3vw,32px)" }}>
      <style>{`.ts-title{font-size:clamp(26px,4vw,46px)!important}.ts-grid{grid-template-columns:repeat(5,1fr)!important}@media(max-width:1000px){.ts-grid{grid-template-columns:repeat(3,1fr)!important}}@media(max-width:600px){.ts-grid{grid-template-columns:repeat(2,1fr)!important}}`}</style>
      <div style={{ textAlign: "center", marginBottom: 38 }}>
        <div className="ts-title" style={{ fontFamily: 'var(--font-display)', fontSize: 46, letterSpacing: 0, color: GOLD }}>Choose your franchise</div>
        <div style={{ color: "#7a8296", fontSize: 13, letterSpacing: 0, marginTop: 6 }}>{mode === "MINI" ? "Mini auction, 200 players" : "Mega auction, 500+ players"}</div>
      </div>
      <div className="ts-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, maxWidth: 880, margin: "0 auto" }}>
        {TEAMS.map(t => (
          <div key={t.id} onClick={() => startSingleAuction(t.id)} onMouseEnter={() => setHov(t.id)} onMouseLeave={() => setHov(null)}
            style={{ background: hov === t.id ? `${t.color}14` : CARD, border: `1px solid ${hov === t.id ? t.color : BORDER}`, borderRadius: 12, padding: "22px 16px", cursor: "pointer", textAlign: "center", transition: 'background-color .15s, border-color .15s, color .15s, opacity .15s', boxShadow: hov === t.id ? `0 0 0 transparent` : "none", transform: hov === t.id ? "translateY(-4px)" : "none" }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, color: t.color, letterSpacing: 0, lineHeight: 1 }}>{t.short}</div>
            <div style={{ fontSize: 12, color: hov === t.id ? "#a3a9b8" : "#7a8296", marginTop: 7, lineHeight: 1.4, fontWeight: 500 }}>{t.name}</div>
            <div style={{ marginTop: 14, fontSize: 12, color: `${t.color}88`, fontWeight: 600, letterSpacing: 0 }}>₹120 Cr purse</div>
          </div>
        ))}
      </div>
    </div>
  );
}
