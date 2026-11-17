'use client';

import { useState, useEffect, useRef, Suspense, useCallback, useMemo, memo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowUp, Check, MessageSquare, X } from 'lucide-react';
import { useGame } from '../GameContext';
import AppDialog from '../components/AppDialog';
import BrandLink from '../components/BrandLink';
import { getBackendUrl } from '../lib/backendUrl';

const GOLD  = '#E8B84B';
const CYAN  = '#a3a9b8';
const GREEN = '#4cc38a';
const BG    = '#0b0d14';
const CARD  = '#11141c';
const BORDER = '#1f2430';
const DEFAULT_PURSE = 120;
const EXTENDED_PURSE = 150;

const TEAMS = [
  { id:'CSK',  name:'Chennai Super Kings',        short:'CSK',  color:'#F9CA24' },
  { id:'MI',   name:'Mumbai Indians',              short:'MI',   color:'#4FC3F7' },
  { id:'RCB',  name:'Royal Challengers Bengaluru', short:'RCB',  color:'#FF5252' },
  { id:'KKR',  name:'Kolkata Knight Riders',       short:'KKR',  color:'#CE93D8' },
  { id:'SRH',  name:'Sunrisers Hyderabad',         short:'SRH',  color:'#FF8A65' },
  { id:'DC',   name:'Delhi Capitals',              short:'DC',   color:'#64B5F6' },
  { id:'PBKS', name:'Punjab Kings',                short:'PBKS', color:'#EF9A9A' },
  { id:'RR',   name:'Rajasthan Royals',            short:'RR',   color:'#F48FB1' },
  { id:'GT',   name:'Gujarat Titans',              short:'GT',   color:'#4DD0E1' },
  { id:'LSG',  name:'Lucknow Super Giants',        short:'LSG',  color:'#81D4FA' },
];

const TEAM_LOGOS = Object.fromEntries(TEAMS.map((team) => [team.id, `/assets/${team.id}.png`]));

const MODE_OPTIONS = [
  {
    id: 'mega',
    accentColor: GOLD,
    title: 'Mega',
    eyebrow: null,
    sub: '500+ players',
  },
  {
    id: 'mini',
    accentColor: GREEN,
    title: 'Mini',
    eyebrow: null,
    sub: '200 players',
  },
];

function getPhaseFromAction(action) {
  if (action === 'lobby') return 'lobby';
  if (action === 'rivals') return 'rivals';
  if (action === 'rivals-searching') return 'rivals-searching';
  if (action === 'rivals-found') return 'rivals-found';
  if (action === 'create') return 'create-form';
  if (action === 'join' || action === 'join-code') return 'join-code';
  if (action === 'browse') return 'join';
  return 'home';
}

function getDateKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getRivalsMatchState(match, nowMs) {
  const openMs = new Date(match.auctionOpensAt).getTime();
  const startMs = new Date(match.startAt).getTime();
  const endMs = new Date(match.endAt).getTime();

  if (nowMs >= endMs) return 'completed';
  if (nowMs >= startMs) return 'locked';
  if (nowMs >= openMs) return 'open';
  return 'scheduled';
}

function isPlayableRivalsMatch(match, nowMs) {
  if (match.isRivalsPlayable === false) return false;
  const state = getRivalsMatchState(match, nowMs);
  return state === 'scheduled' || state === 'open';
}

function formatCountdown(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return 'LIVE';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  return `${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

function formatRivalsMeta(startAt) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(startAt));
}

const MATCHMAKING_LINES = [
  'Finding a stronger opponent...',
  'Scanning live Rivals queues...',
  'Checking who is ready to duel...',
  'Matching you with a sharp bidder...',
  'Looking for a worthy auction rival...',
  'Almost there...',
  'Locking the match lobby...',
  'Warming up the auction room...',
  'Preparing both franchises...',
  'One great rival is all we need...',
];

// ── Global styles ───────────────────────────────────────────────────────────
const globalStyles = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; background: ${BG}; }

  @keyframes fadeUp    { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
  @keyframes slideIn   { from{opacity:0;transform:translateX(-20px)} to{opacity:1;transform:none} }
  @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
  @keyframes shimmer   { 0%{background-position:-200% center} 100%{background-position:200% center} }
  @keyframes floatOrb  { 0%{transform:translateY(0)rotate(0);opacity:0} 20%{opacity:.12} 80%{opacity:.12} 100%{transform:translateY(-800px)rotate(360deg);opacity:0} }
  @keyframes scrollMq  { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
  @keyframes logoBob   { 0%, 100% { transform: translateY(0px) scale(1); } 50% { transform: translateY(-6px) scale(1.03); } }
  @keyframes pulse     { 0%,100%{opacity:1} 50%{opacity:.4} }
  @keyframes rivalsSweep { 0%{transform:translateX(0)} 100%{transform:translateX(18px)} }
  @keyframes rivalsVsPop { 0%{transform:scale(.7);opacity:0} 60%{transform:scale(1.08);opacity:1} 100%{transform:scale(1);opacity:1} }
  @keyframes rivalsLeftIn { 0%{opacity:0;transform:translateX(-120px) scale(.88)} 100%{opacity:1;transform:translateX(0) scale(1)} }
  @keyframes rivalsRightIn { 0%{opacity:0;transform:translateX(120px) scale(.88)} 100%{opacity:1;transform:translateX(0) scale(1)} }

  .rp-particles { display:none; position:fixed; top:0;left:0;right:0;bottom:0; overflow:hidden; pointer-events:none; z-index:0; }
  .particle { position:absolute; border-radius:50%; background:radial-gradient(circle at 30% 30%,rgba(255,255,255,.8),rgba(232,184,75,.4) 40%,rgba(0,0,0,0) 80%); opacity:0; animation:floatOrb linear infinite; }
  .p1{left:10%;width:12px;height:12px;animation-duration:15s}
  .p2{left:30%;width:8px;height:8px;animation-duration:22s;animation-delay:3s;filter:hue-rotate(180deg)}
  .p3{left:50%;width:16px;height:16px;animation-duration:18s;animation-delay:7s}
  .p4{left:70%;width:10px;height:10px;animation-duration:26s;animation-delay:1s}
  .p5{left:85%;width:14px;height:14px;animation-duration:20s;animation-delay:5s;filter:hue-rotate(180deg)}

  .rp-nav {
    position:fixed; top:0;left:0;right:0; z-index:100;
    display:flex; align-items:center; justify-content:space-between;
    padding:14px 24px; border-bottom:1px solid #1a1e28;
    background:${BG}ee; backdrop-filter:blur(10px);
  }
  .rp-brand { font-family:var(--font-display); font-size:1.1rem; letter-spacing:0; color:#7a8296; }
  .rp-brand span { color:${GOLD}; }
  .rp-back { background:none; border:1px solid #242936; color:#7a8296; font-family:var(--font-display); font-weight:600; font-size:12px; letter-spacing:0; padding:7px 14px; cursor:pointer; transition:color .2s,border-color .2s; border-radius:4px; }
  .rp-back:hover { color:#fff; border-color:#555; }

  .rp-eyebrow {
    font-family:var(--font-ui); font-weight:500; font-size:14px; letter-spacing:0; display:block; margin-bottom:12px;
    color:${GOLD};
  }
  .rp-h1 { font-family:var(--font-display); font-weight:500; font-size:clamp(2.5rem,6vw,4rem); letter-spacing:-.02em; line-height:1.02; color:var(--text-1); }
  .rp-h1 span { color:inherit; }
  .rp-live-counter { display:inline-flex; align-items:center; gap:8px; font-size:14px; color:var(--text-2); margin:16px 0 24px; }
  .rp-live-dot { width:6px; height:6px; border-radius:50%; background:var(--good); box-shadow:0 0 0 transparent; }
  .rivals-screen {
    min-height:100vh;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:88px 24px 48px;
    position:relative;
    z-index:5;
  }
  .rivals-shell {
    width:100%;
    max-width:900px;
    animation:fadeUp .35s ease both;
  }
  .rivals-found-shell {
    width:100%;
    max-width:1100px;
    display:grid;
    gap:26px;
    justify-items:center;
    text-align:center;
  }
  .rivals-found-arena {
    width:100%;
    display:grid;
    grid-template-columns:minmax(0, 1fr) auto minmax(0, 1fr);
    gap:18px;
    align-items:center;
  }
  .rivals-team-entry {
    padding:22px 18px;
    border-radius:22px;
    border:1px solid #242936;
    background:var(--ink-2);
    display:flex;
    align-items:center;
    gap:14px;
    justify-content:center;
    min-height:160px;
  }
  .rivals-team-entry.left { animation:rivalsLeftIn .8s cubic-bezier(.16,1,.3,1) both; }
  .rivals-team-entry.right { animation:rivalsRightIn .8s cubic-bezier(.16,1,.3,1) both; }
  .rivals-vs-burst {
    width:126px;
    height:126px;
    border-radius:999px;
    border:1px solid rgba(232,184,75,0.4);
    display:flex;
    align-items:center;
    justify-content:center;
    background:var(--ink-3);
    animation:rivalsVsPop .9s ease .25s both;
  }
  .rivals-search-card {
    border:1px solid var(--line);
    border-radius:18px;
    padding:28px 24px;
    background:var(--ink-2);
  }
  .rivals-search-line {
    min-height:32px;
    color:#fff;
    font-family:var(--font-display);
    font-size:clamp(28px, 5vw, 42px);
    letter-spacing:0;
  }
  .rivals-search-progress {
    width:100%;
    height:10px;
    border-radius:999px;
    background:#242936;
    overflow:hidden;
    border:1px solid #1f2937;
  }
  .rivals-search-progress > span {
    display:block;
    height:100%;
    border-radius:999px;
    background:${GOLD};
    animation:rivalsSweep 1.2s ease-in-out infinite alternate; /* live search progress */
  }
  @media (max-width: 768px) {
    .rivals-screen { padding:82px 16px 28px; }
    .rivals-found-arena { grid-template-columns:1fr; }
    .rivals-vs-burst { width:92px; height:92px; margin:0 auto; }
    .rivals-team-entry { min-height:auto; }
  }

  /* ── Choice cards (home screen) ── */
  .rp-choices { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; width:100%; }
  @media(max-width:768px){ .rp-choices{grid-template-columns:1fr 1fr} }
  @media(max-width:560px){ .rp-choices{grid-template-columns:1fr} }
  .rp-choice { padding:24px 20px; border:1px solid #1a1e28; cursor:pointer; background:#0b0d14; transition:background-color .15s, border-color .15s, color .15s, opacity .15s cubic-bezier(.22,1,.36,1); position:relative; overflow:hidden; border-radius:10px; }
  .rp-choice.create-card:hover {  border-color:${GOLD}; box-shadow:0 12px 32px rgba(232,184,75,.18); }
  .rp-choice.join-card:hover   {  border-color:${CYAN}; box-shadow:0 12px 32px rgba(163,169,184,.18); }
  .rp-choice.browse-card:hover {  border-color:#a3a9b8;  }
  .rp-choice-label { font-size:13px; font-weight:500; margin-bottom:12px; }
  .rp-choice-title { font-family:var(--font-display); font-weight:500; font-size:28px; line-height:1.1; color:var(--text-1); margin-bottom:8px; }
  .rp-choice-desc  { font-size:14px; color:var(--text-2); line-height:1.5; }

  /* ── Form elements ── */
  .rp-label { font-size:13px; font-weight:500; color:var(--text-2); margin-bottom:8px; margin-top:24px; display:block; }
  .rp-input { width:100%; height:48px; padding:0 16px; background:#11141c; border-radius:6px; border:1px solid #1a1e28; color:var(--text-1); font-family:var(--font-ui); font-size:16px; letter-spacing:0; outline:none; transition:border-color .2s,box-shadow .2s; }
  .rp-input:focus { border-color:${GOLD}; box-shadow:0 0 0 1px ${GOLD} inset; }
  .rp-input::placeholder { color:#7a8296; }
  .rp-input.code-input { height:56px; letter-spacing:0.12em; font-family:var(--font-display); font-weight:500; font-size:28px; text-align:center; }
  .rp-input.code-input:focus { border-color:${GOLD}; box-shadow:0 0 0 1px ${GOLD} inset; }

  /* ── Toggle cards (tactile selection) ── */
  .rp-toggle-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:6px; }
  @media(max-width:480px) { .rp-toggle-grid { grid-template-columns:1fr; } }
  .rp-toggle-card {
    padding:16px 14px; border-radius:8px; cursor:pointer; border:1px solid #1a1e28;
    background:#11141c; transition:background-color .15s, border-color .15s, color .15s, opacity .15s; position:relative; overflow:hidden;
    border-left:3px solid transparent;
    display:flex; flex-direction:column; gap:4px;
  }
  .rp-toggle-card:hover { border-color:#333; background:#1a1e28; }
  .rp-toggle-card.selected-gold { border-color:${GOLD}; border-left-color:${GOLD}; background:rgba(232,184,75,.07); }
  .rp-toggle-card.selected-cyan { border-color:${GOLD}; border-left-color:${GOLD}; background:rgba(232,184,75,.07); }
  .rp-toggle-card-title { font-family:var(--font-display); font-size:1.1rem; letter-spacing:0; color:#fff; }
  .rp-toggle-card-sub   { font-family:var(--font-ui); font-size:12px; letter-spacing:0; color:#7a8296; }
  .rp-toggle-check { position:absolute; top:8px; right:10px; width:16px; height:16px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; transition:background-color .15s, border-color .15s, color .15s, opacity .15s; }
  .rp-toggle-card.mode-card {
    min-height: 104px;
    padding: 12px 14px;
    gap: 6px;
    border-radius: 10px;
    border: 1px solid #242936;
    border-left-width: 1px;
  }
  .rp-toggle-card.mode-card::before {
    content: '';
    position: absolute;
    inset: 0;
    display: none;
    transition: opacity .18s ease;
    pointer-events: none;
  }
  .rp-toggle-card.mode-card:hover {
    
    border-color: #3a3a3a;
  }
  .rp-toggle-card.mode-card:hover::before,
  .rp-toggle-card.mode-card.selected-gold::before,
  .rp-toggle-card.mode-card.selected-cyan::before {
    opacity: 1;
  }
  .rp-toggle-card.mode-card.selected-gold {
    background: rgba(232,184,75,0.08);
  }
  .rp-toggle-card.mode-card.selected-cyan {
    background: rgba(232,184,75,0.08);
  }
  .rp-toggle-card.mode-card .rp-toggle-check {
    top: 10px;
    right: 10px;
  }
  .rp-toggle-mode-header {
    display:block;
    position:relative;
    z-index:1;
    margin-bottom:2px;
  }
  .rp-toggle-mode-eyebrow {
    font-family:var(--font-ui);
    font-size:12px;
    letter-spacing:0;
    
    color:#8892a6;
    line-height:1.5;
    margin-bottom:4px;
  }
  .rp-toggle-card.mode-card .rp-toggle-card-title {
    font-size: 1.45rem;
    line-height: 1.05;
    letter-spacing:0;
    max-width: 160px;
  }
  .rp-toggle-card.mode-card .rp-toggle-card-sub {
    font-size:12px;
    letter-spacing: .8px;
    line-height: 1.25;
    color: #c9cdd6;
    position: relative;
    z-index: 1;
  }
  @media(max-width:600px) {
    .rp-toggle-card.mode-card {
      min-height: 96px;
      padding: 11px 12px;
    }
    .rp-toggle-card.mode-card .rp-toggle-card-title {
      font-size: 1.3rem;
      max-width: 140px;
    }
    .rp-toggle-card.mode-card .rp-toggle-card-sub {
      font-size:12px;
    }
  }

  /* ── Buttons ── */
  .rp-btn { width:100%; height:48px; padding:0 20px; background:${GOLD}; border:none; border-radius:10px; font-family:var(--font-ui); font-weight:500; font-size:16px; letter-spacing:0; color:var(--gold-ink); cursor:pointer; margin-top:24px; transition:transform .2s,box-shadow .2s; display:flex; align-items:center; justify-content:center; gap:10px; }
  .rp-btn:hover    {   }
  .rp-btn:active   { transform:none; }
  .rp-btn:disabled { opacity:.35; pointer-events:none; }
  .rp-btn.cyan-btn { background:var(--ink-3); color:var(--text-1); border:1px solid var(--line-strong); }
  .rp-btn.cyan-btn:hover {  }

  .rp-error { font-family:var(--font-ui); font-size:12px; color:#ef4444; margin-top:10px; padding:10px; background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.3); border-radius:4px; letter-spacing:0; }
  .rp-hr { height:1px; background:#1a1e28; margin:20px 0; }

  /* ── Room list items ── */
  .rp-room-item { display:flex; justify-content:space-between; align-items:center; padding:14px 16px; background:${CARD}; border:1px solid #1a1e28; margin-bottom:8px; border-radius:8px; transition:border-color .2s; }
  .rp-room-item:hover { border-color:#333; }
  .rp-room-join-btn    { padding:8px 16px; background:rgba(163,169,184,.08); border:1px solid rgba(163,169,184,.3); color:${CYAN}; font-family:var(--font-display); font-weight:600; font-size:12px; letter-spacing:0; cursor:pointer; transition:background-color .15s, border-color .15s, color .15s, opacity .15s; border-radius:4px; }
  .rp-room-join-btn:hover { background:${CYAN}; color:#000; }
  .rp-room-rejoin-btn  { padding:8px 16px; background:rgba(232,184,75,.08); border:1px solid rgba(232,184,75,.3); color:${GOLD}; font-family:var(--font-display); font-weight:600; font-size:12px; letter-spacing:0; cursor:pointer; transition:background-color .15s, border-color .15s, color .15s, opacity .15s; border-radius:4px; }
  .rp-room-rejoin-btn:hover { background:${GOLD}; color:#000; }

  /* ── BROWSE ROOMS (mobile-native) ── */
  .rb-shell {
    min-height: 100vh; background: #0b0d14;
    display: flex; flex-direction: column;
    font-family:var(--font-display);
  }
  .rb-header {
    position: sticky; top: 0;
    background: #0b0d14; border-bottom: 1px solid #1a1e28;
    z-index: 20; padding: 16px 24px 0;
  }
  .rb-header-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .rb-back-btn { background: none; border: none; color: #c9cdd6; font-size: 20px; cursor: pointer; padding: 0 4px; flex-shrink: 0; line-height:1; }
  .rb-title-block { flex: 1; }
  .rb-title { font-family:var(--font-display); font-size: 22px; color: #fff; letter-spacing:0; line-height: 1; }
  .rb-subtitle { font-size: 12px; color: #7a8296; margin-top: 1px; }
  .rb-icon-btn { background: none; border: 1px solid #1a1e28; color: #7a8296; border-radius: 8px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 14px; flex-shrink: 0; transition:background-color .15s, border-color .15s, color .15s, opacity .15s; }
  .rb-icon-btn:hover { border-color: #444; color: #c9cdd6; }
  .rb-create-btn { background: ${GOLD}; border: none; border-radius: 8px; color: #000; font-family:var(--font-display); font-size: 14px; letter-spacing:0; padding: 8px 14px; cursor: pointer; display: flex; align-items: center; gap: 5px; flex-shrink: 0; transition: filter .2s; white-space:nowrap; }
  .rb-create-btn:hover { filter: brightness(1.1); }

  .rb-sport-pills { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
  .rb-sport-pills::-webkit-scrollbar { display: none; }
  .rb-sport-pill { padding: 5px 14px; border-radius: 20px; font-size: 13px; font-weight:600; cursor: pointer; transition:background-color .15s, border-color .15s, color .15s, opacity .15s; letter-spacing: .5px; white-space: nowrap; border: 1px solid transparent; }
  .rb-sport-pill.active { background: ${GOLD}; color: #000; }
  .rb-sport-pill:not(.active) { background: #1a1e28; color: #7a8296; }
  .rb-sport-pill:not(.active):hover { border-color: #333; color: #c9cdd6; }

  .rb-tabs { display: flex; gap: 10px; margin: 0 0 12px; }
  .rb-tab {
    flex: 1; padding: 14px 12px; text-align: center; font-size: 12px; font-weight:600; letter-spacing: .5px;
    cursor: pointer; transition:background-color .15s, border-color .15s, color .15s, opacity .15s; display: flex; align-items: center; justify-content: center; gap: 6px;
    background: #1a1e28; border: 1px solid #242936; border-bottom: 2px solid transparent; color: #7a8296;
    border-radius: 12px 12px 0 0; appearance: none; -webkit-appearance: none; box-shadow: none;
  }
  .rb-tab.active { color: var(--text-1); border-bottom-color: ${GOLD}; background: var(--ink-3); }
  .rb-tab.live-tab.active { border-bottom-color: var(--bad); background: var(--ink-3); }
  .rb-tab:not(.active) { color: #7a8296; }
  .rb-tab-count { background: #242936; color: #7a8296; font-size:12px; padding: 1px 6px; border-radius: 10px; }
  .rb-tab.active .rb-tab-count { background: ${GOLD}22; color: ${GOLD}; }
  .rb-tab.active.live-tab .rb-tab-count { background: #ef444422; color: #ef4444; }

  .rb-name-box { padding: 24px 32px; }
  .rb-name-label { font-size:12px; letter-spacing:0; color: #7a8296;  margin-bottom: 6px; display: block; }
  .rb-name-input { width: 100%; padding: 12px 14px; background: #1a1e28; border: 1px solid #1a1e28; border-radius: 10px; color: #fff; font-family:var(--font-display); font-size: 16px; letter-spacing:0; outline: none; transition: border-color .2s; }
  .rb-name-input:focus { border-color: ${GOLD}; }
  .rb-name-input::placeholder { color: #7a8296; }

  .rb-rooms-list { flex: 1; overflow-y: auto; padding: 32px 32px 60px; }

  .rb-room-card {
    background: #1a1e28; border: 1px solid #1a1e28; border-radius: 14px;
    padding: 14px; margin-bottom: 12px; transition: border-color .2s;
  }
  .rb-room-card:hover { border-color: #333; }

  .rb-room-card-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 6px; }
  .rb-status-badge { display: flex; align-items: center; gap: 5px; font-size:12px; font-weight:600; letter-spacing:0; padding: 3px 8px; border-radius: 5px; }
  .rb-status-badge.live { background: #ef444415; color: #ef4444; border: 1px solid #ef444430; }
  .rb-status-badge.waiting { background: #22c55e15; color: #22c55e; border: 1px solid #22c55e30; }
  .rb-status-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .rb-status-dot.live { background: var(--bad); }
  .rb-status-dot.waiting { background: #22c55e; }

  .rb-room-code { font-family:var(--font-ui); font-size:12px; color: #7a8296; letter-spacing:0; }
  .rb-team-count { font-family:var(--font-display); font-size: 20px; color: #fff; line-height: 1; }
  .rb-team-count span { font-size: 13px; color: #7a8296; }
  .rb-team-label { font-size:12px; letter-spacing:0; color: #7a8296;  }

  .rb-room-name { font-family:var(--font-display); font-size: 22px; color: #fff; letter-spacing:0; line-height: 1.1; margin-bottom: 2px; }
  .rb-room-desc { font-size: 12px; color: #7a8296; margin-bottom: 10px; }

  .rb-team-bubbles { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .rb-team-bubble { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family:var(--font-display); font-size:12px; letter-spacing: .5px; flex-shrink: 0; cursor: default; }

  .rb-join-btn {
    width: 100%; padding: 13px; background: ${GOLD}; border: none; border-radius: 10px;
    font-family:var(--font-display); font-size: 16px; letter-spacing:0; color: #000;
    cursor: pointer; transition: filter .18s, transform .12s; display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .rb-join-btn:hover { filter: brightness(1.1);  }
  .rb-join-btn:active { transform: scale(.97); }
  .rb-join-btn:disabled { opacity: .4; cursor: not-allowed; transform: none; }

  .rb-spectate-btn {
    width: 100%; padding: 11px; background: transparent; border: 1px solid #242936; border-radius: 10px;
    font-family:var(--font-display); font-size: 14px; font-weight:600; letter-spacing:0; color: #7a8296;
    cursor: pointer; transition:background-color .15s, border-color .15s, color .15s, opacity .15s; display: flex; align-items: center; justify-content: center; gap: 6px;
  }
  .rb-spectate-btn:hover { border-color: #555; color: #c9cdd6; }

  .rb-empty { text-align: center; padding: 60px 20px; color: #7a8296; font-size: 14px; letter-spacing:0; }

  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }

  /* ── Join row ── */
  .rp-join-row { display:flex; gap:10px; margin-top:5px; align-items:flex-start; }
  .rp-join-row .rp-input { flex:1; min-width:0; }
  .rp-join-row .rp-btn   { width:auto; padding:15px 24px; margin-top:0; font-size:1.4rem; flex-shrink:0; }

  /* ── LOBBY ── 3-column layout ── */
  .lobby-shell {
    min-height:100vh; padding-top:60px; padding-bottom:80px;
    display:grid; grid-template-columns:280px 1fr 260px; gap:0;
    align-items:start; background:${BG};
  }
  @media(max-width:1100px){ .lobby-shell{grid-template-columns:240px 1fr 220px} }
  @media(max-width:900px){  .lobby-shell{grid-template-columns:1fr; padding:60px 14px 88px} }

  .lobby-col { padding:24px; height:100%; }
  .lobby-col-left  { border-right:1px solid #1a1e28; }
  .lobby-col-right { border-left:1px solid #1a1e28; }
  .lobby-col-center { padding:24px 20px; }

  .lobby-section-label { font-family:var(--font-ui); font-size:12px; letter-spacing:0; color:#7a8296;  margin-bottom:12px; }

  /* ── Code block ── */
  .lobby-code-chip { font-family:var(--font-display); font-weight:500; font-size:2.4rem; letter-spacing:0.08em; color:var(--gold); background:var(--ink-3); border:1px solid var(--line-strong); padding:8px 18px; border-radius:8px; cursor:pointer; transition:background .2s,box-shadow .2s; display:inline-block; }
  .lobby-code-chip:hover { background:rgba(163,169,184,.12); }
  .lobby-copy-btn { padding:9px 16px; background:rgba(163,169,184,.1); border:1px solid rgba(163,169,184,.3); border-radius:6px; color:${CYAN}; font-family:var(--font-display); font-weight:600; font-size:12px; letter-spacing:0; cursor:pointer; transition:background-color .15s, border-color .15s, color .15s, opacity .15s; }
  .lobby-copy-btn:hover { background:var(--ink-4); color:var(--text-1); }
  .lobby-wa-btn { padding:9px 16px; background:rgba(37,211,102,.1); border:1px solid rgba(37,211,102,.3); border-radius:6px; color:#25D366; font-family:var(--font-display); font-weight:600; font-size:12px; letter-spacing:0; cursor:pointer; transition:background-color .15s, border-color .15s, color .15s, opacity .15s; text-decoration:none; display:inline-flex; align-items:center; gap:6px; }
  .lobby-wa-btn:hover { background:#25D366; color:#000; }

  /* ── Player list ── */
  .lobby-player-row { display:flex; align-items:center; gap:10px; padding:10px 12px; background:${CARD}; border:1px solid #1a1e28; border-radius:8px; margin-bottom:6px; animation:slideIn .3s ease both; }
  .lobby-player-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
  .lobby-player-badge { font-family:var(--font-display); font-size:.8rem; padding:2px 6px; border-radius:3px; letter-spacing:0; }

  /* ── Franchise grid ── */
  .franchise-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; }
  @media(max-width:900px){ .franchise-grid{ grid-template-columns:repeat(5,1fr) } }
  @media(max-width:560px){ .franchise-grid{ grid-template-columns:repeat(3,1fr) } }

  .franchise-tile {
    border-radius:10px; border:2px solid #1a1e28; cursor:pointer; padding:16px 8px;
    text-align:center; position:relative; overflow:hidden;
    transition:transform .2s, border-color .2s, box-shadow .2s;
    display:flex; flex-direction:column; align-items:center; gap:5px;
  }
  .franchise-tile:not(.ft-taken):hover {  }
  .franchise-tile.ft-mine  { transform:translateY(-4px); }
  .franchise-tile.ft-taken { cursor:not-allowed; opacity:.88; filter:saturate(.72); }
  .franchise-tile .taken-overlay {
    position:absolute; inset:0; background:rgba(8,8,8,.16);
    z-index:2;
  }
  .franchise-logo {
    width:52px;
    height:52px;
    object-fit:contain;
    display:block;
    position:relative;
    z-index:1;
  }

  .franchise-short { font-family:var(--font-display); font-size:1.4rem; letter-spacing:0; }
  .franchise-name  { font-family:var(--font-ui); font-size:12px; line-height:1.3; color:#a3a9b8; }
  .franchise-mine-badge { font-family:var(--font-ui); font-size:12px; letter-spacing:0; font-weight:600; }

  /* ── RIGHT col stats ── */
  .lobby-stat-card { background:${CARD}; border:1px solid #1a1e28; border-radius:10px; padding:16px; margin-bottom:10px; }
  .lobby-stat-val  { font-family:var(--font-display); font-size:1.8rem; letter-spacing:0; line-height:1; }
  .lobby-stat-lbl  { font-family:var(--font-ui); font-size:12px; letter-spacing:0; color:#7a8296; margin-top:3px; }

  /* ── Fixed bottom start bar ── */
  .lobby-bottom-bar {
    position:fixed; bottom:0; left:0; right:0; z-index:50;
    background:${BG}f0; border-top:1px solid #1a1e28; backdrop-filter:blur(12px);
    padding:12px 24px; display:flex; align-items:center; justify-content:center; gap:16px;
  }
  .lobby-start-btn {
    padding:14px 48px; border:none; border-radius:6px; font-family:var(--font-display);
    font-size:1.3rem; letter-spacing:0; cursor:pointer; color:#000; background:${GOLD};
    transition:transform .2s, box-shadow .2s; min-width:240px;
  }
  .lobby-start-btn:hover:not(:disabled) {   }
  .lobby-start-btn:disabled { opacity:.4; cursor:not-allowed; }
  .lobby-waiting { font-family:var(--font-ui); font-size:13px; color:#7a8296; letter-spacing:0; text-align:center; padding:14px 32px; border:1px dashed #242936; border-radius:6px; }

  /* ── LOBBY CHAT ── */
  .lc-panel {
    background: #11141c;
    border: 1px solid #242936;
    border-radius: 14px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 240px;
    max-height: 320px;
    margin-top: 16px;
  }
  .lc-header {
    padding: 8px 13px;
    border-bottom: 1px solid #242936;
    display: flex;
    align-items: center;
    gap: 7px;
    flex-shrink: 0;
  }
  .lc-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--good);
  }
  .lc-title {
    font-family:var(--font-ui);
    font-size:12px; letter-spacing:0; color: ${CYAN}; 
  }
  .lc-messages {
    flex: 1; overflow-y: auto; padding: 10px 12px;
    display: flex; flex-direction: column; gap: 7px;
    overscroll-behavior: contain;
  }
  .lc-messages::-webkit-scrollbar { width: 3px; }
  .lc-messages::-webkit-scrollbar-track { background: transparent; }
  .lc-messages::-webkit-scrollbar-thumb { background: #1f2430; border-radius: 2px; }
  .lc-msg { display: flex; flex-direction: column; animation: fadeUp .2s ease both; }
  .lc-sender { font-size:12px; font-weight:600; letter-spacing: .3px; margin-bottom: 2px; }
  .lc-bubble {
    max-width: 88%; padding: 5px 9px;
    border-radius: 10px 10px 10px 3px;
    font-size: 12px; color: #c9cdd6; line-height: 1.4;
    word-break: break-word;
    background: #242936; border: 1px solid #222a36;
  }
  .lc-bubble.own {
    align-self: flex-end;
    border-radius: 10px 10px 3px 10px;
    background: ${CYAN}14; border-color: ${CYAN}30; color: #c9cdd6;
  }
  .lc-empty {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    color: #374151; gap: 6px; padding: 20px; text-align: center;
  }
  .lc-input-row {
    display: flex; gap: 6px; padding: 8px 10px;
    border-top: 1px solid #242936; flex-shrink: 0;
  }
  .lc-input {
    flex: 1; background: #1a1e28; border: 1px solid #1e2433;
    color: #c9cdd6; padding: 7px 11px; border-radius: 9px;
    font-size: 12px; outline: none; min-width: 0; font-family: inherit;
  }
  .lc-input::placeholder { color: #374151; }
  .lc-send {
    background: ${GOLD}; color: var(--gold-ink); border: none;
    min-width: 34px; border-radius: 9px;
    font-weight:600; cursor: pointer; font-size: 15px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: opacity .15s;
  }
  .lc-send:disabled { opacity: .3; cursor: not-allowed; }

  /* Mobile chat FAB + drawer */
  .lc-fab {
    position: fixed; right: 16px;
    bottom: calc(74px + env(safe-area-inset-bottom, 0px));
    width: 48px; height: 48px; border-radius: 50%;
    background: var(--ink-3);
    color: var(--text-1); border: none;
    box-shadow: 0 6px 20px rgba(0,0,0,.4);
    font-size: 20px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    z-index: 120; transition: transform .2s;
  }
  .lc-fab:active { transform: scale(.88); }
  .lc-drawer-bg {
    position: fixed; inset: 0; background: rgba(0,0,0,.52);
    z-index: 130; backdrop-filter: blur(3px);
  }
  .lc-drawer {
    position: fixed; left: 0; right: 0;
    bottom: calc(72px + env(safe-area-inset-bottom, 0px));
    height: 58vh; z-index: 140;
    background: #1a1e28; border: 1px solid #242936;
    border-radius: 20px 20px 0 0;
    display: flex; flex-direction: column;
    box-shadow: 0 -12px 48px rgba(0,0,0,.6);
    animation: slideUp .26s cubic-bezier(.16,1,.3,1) both;
  }
  @keyframes slideUp {
    from { transform: translateY(100%); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  .lc-drawer-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 13px 16px 10px; border-bottom: 1px solid #242936; flex-shrink: 0;
  }
  .lc-drawer-title {
    font-family:var(--font-display);
    font-size: 17px; letter-spacing:0; color: ${CYAN};
  }
  .lc-drawer-close {
    background: none; border: none; color: #7a8296;
    font-size: 20px; cursor: pointer; line-height: 1; padding: 2px 6px;
  }
  /* Desktop: show panel, hide FAB/drawer. Mobile: hide panel, show FAB */
  @media (min-width: 901px) { .lc-fab { display: none !important; } }
  @media (max-width: 900px)  { .lc-panel { display: none !important; } }

  /* ── Marquee ── */
  .rp-marquee-container { position:fixed; bottom:0; left:0; width:100%; overflow:hidden; background:var(--ink-0); border-top:1px solid #1a1e28; z-index:10; padding:8px 0; }
  .rp-marquee-track { display:flex; align-items:center; white-space:nowrap; width:max-content; justify-content:center; margin:0 auto; }
  .rp-marquee-item { width:54px; height:54px; margin:0 20px; display:flex; align-items:center; justify-content:center; border-radius:12px; background:var(--ink-2); border:1px solid var(--line); }
  .rp-marquee-logo { width:36px; height:36px; object-fit:contain; }

  .rb-room-grid {
    display:grid;
    grid-template-columns:repeat(3, minmax(0, 1fr));
    gap:18px;
    align-items:stretch;
  }

  @media (max-width: 1180px) {
    .rb-room-grid { grid-template-columns:repeat(2, minmax(0, 1fr)); }
  }

  @media (max-width: 760px) {
    .rb-room-grid { grid-template-columns:1fr; }
    .rp-marquee-item { width:46px; height:46px; margin:0 14px; }
    .rp-marquee-logo { width:30px; height:30px; }
  }

  .create-room-summary-grid {
    display:grid;
    grid-template-columns:repeat(3, minmax(0, 1fr));
    gap:10px;
    margin-top:20px;
  }
  .create-room-summary-card {
    border:1px solid #1e2632;
    border-radius:14px;
    padding:12px 12px 10px;
    background:#1a1e28;
    min-width:0;
  }
  .create-room-summary-label {
    color:#7a8296;
    font-size:12px;
    letter-spacing:0;
    
  }
  .create-room-summary-value {
    color:#F8FAFC;
    font-family:var(--font-display);
    font-size:22px;
    letter-spacing:0;
    margin-top:6px;
    line-height:1;
    overflow-wrap:anywhere;
  }
  .rb-header-actions {
    display:flex;
    gap:10px;
    align-items:center;
    flex-wrap:wrap;
    justify-content:flex-end;
  }
  .rb-card-topline {
    display:flex;
    align-items:center;
    gap:8px;
    margin-bottom:6px;
    flex-wrap:wrap;
  }
  .rb-room-footer {
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    margin-top:auto;
  }
  .rb-room-meta {
    font-size:12px;
    color:#7a8296;
    letter-spacing:0;
    min-width:0;
    overflow-wrap:anywhere;
  }
  .rb-room-actions {
    display:flex;
    gap:8px;
    flex-shrink:0;
  }

  @media (max-width: 860px) {
    .create-room-summary-grid {
      grid-template-columns:repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .create-room-summary-grid {
      grid-template-columns:1fr;
    }
    .create-room-summary-value {
      font-size:20px;
      line-height:1.05;
    }
    .rb-header {
      padding:14px 14px 0;
    }
    .rb-header-row {
      align-items:flex-start;
      flex-wrap:wrap;
    }
    .rb-title-block {
      min-width:0;
      width:100%;
      order:2;
    }
    .rb-header-actions {
      width:100%;
      justify-content:space-between;
      order:3;
    }
    .rb-tabs {
      gap:8px;
      overflow-x:auto;
      padding-bottom:4px;
      scrollbar-width:none;
    }
    .rb-tabs::-webkit-scrollbar {
      display:none;
    }
    .rb-tab {
      flex:0 0 auto;
      min-width:150px;
      padding:12px 14px;
    }
    .rb-name-box {
      padding:18px 14px 12px;
    }
    .rb-rooms-list {
      padding:24px 14px 44px;
    }
    .rb-room-card {
      padding:18px;
    }
    .rb-room-card-header {
      gap:14px;
      flex-direction:column;
    }
    .rb-room-footer {
      flex-direction:column;
      align-items:stretch;
    }
    .rb-room-actions {
      width:100%;
      flex-direction:column;
    }
    .rb-room-actions .rb-join-btn {
      width:100% !important;
    }
  }

  @media(max-width:600px){
    .rp-h1 { font-size:3rem; }
    .lobby-section-label { font-size:12px; }
    .franchise-grid { gap:6px; }
    .franchise-tile { padding:12px 4px; }
    .franchise-short { font-size:1.1rem; }
    .lobby-bottom-bar { padding:10px 14px; }
    .lobby-start-btn { padding:12px 20px; min-width:0; font-size:1.1rem; width:100%; }
    .lobby-waiting { padding:12px 14px; font-size:12px; width:100%; }
  }
`;

// ─── Check icon ─────────────────────────────────────────────────────────────
function CheckIcon({ color = GOLD }) {
  return (
    <div style={{ width:16, height:16, borderRadius:'50%', background:`${color}25`, border:`1px solid ${color}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize: 12 }}>
      <Check size={10} strokeWidth={2} />
    </div>
  );
}

// ─── Toggle Card ────────────────────────────────────────────────────────────
function ToggleCard({ selected, onSelect, accentColor = GOLD, title, sub, icon, eyebrow, modeId }) {
  const cls = selected ? (accentColor === GOLD ? 'rp-toggle-card selected-gold' : 'rp-toggle-card selected-cyan') : 'rp-toggle-card';
  const isModeCard = !!modeId;

  return (
    <div className={`${cls}${isModeCard ? ' mode-card' : ''}`} onClick={onSelect}>
      {!isModeCard && (
        <div className="rp-toggle-check">
          {selected && <CheckIcon color={accentColor} />}
        </div>
      )}

      {isModeCard ? (
        <>
          <div className="rp-toggle-mode-header">
            <div>
              {eyebrow && <div className="rp-toggle-mode-eyebrow">{eyebrow}</div>}
              <div className="rp-toggle-card-title" style={{ color: selected ? accentColor : '#f2f4f8' }}>{title}</div>
            </div>
          </div>
          <div className="rp-toggle-card-sub">{sub}</div>
        </>
      ) : (
        <>
          {icon && <div style={{ marginBottom: 6, opacity: selected ? 1 : 0.4, transition: 'opacity 0.2s', color: selected ? accentColor : '#7a8296' }}>{icon}</div>}
          <div className="rp-toggle-card-title" style={{ color: selected ? accentColor : '#a3a9b8' }}>{title}</div>
          <div className="rp-toggle-card-sub">{sub}</div>
        </>
      )}
    </div>
  );
}

// ─── BrowseRooms ─────────────────────────────────────────────────────────────
const TEAM_COLORS = {
  CSK:'#F9CA24', MI:'#4FC3F7', RCB:'#FF5252', KKR:'#CE93D8',
  SRH:'#FF8A65', DC:'#64B5F6', PBKS:'#EF9A9A', RR:'#F48FB1',
  GT:'#4DD0E1', LSG:'#81D4FA',
};
const ALL_TEAM_IDS = ['MI','CSK','RCB','KKR','DC','PBKS','RR','SRH','GT','LSG'];

function getPrivateActivityEstimate(publicRooms, publicPlayers) {
  const roomsBase = Math.max(3, publicRooms * 2 + (publicPlayers > 0 ? 2 : 4));
  const playerBase = Math.max(12, publicPlayers * 2 + publicRooms * 3 + 6);
  return {
    rooms: roomsBase,
    players: playerBase,
  };
}

// ─── Lobby Chat Box ──────────────────────────────────────────────────────────
const TEAM_CLRS = {
  CSK:'#F9CA24',MI:'#4FC3F7',RCB:'#FF5252',KKR:'#CE93D8',SRH:'#FF8A65',
  DC:'#64B5F6',PBKS:'#EF9A9A',RR:'#F48FB1',GT:'#4DD0E1',LSG:'#81D4FA',
};
const LobbyChatBox = memo(function LobbyChatBox({ chatLog, emit, roomCode, myName, isSpectator }) {
  const [msg, setMsg] = useState('');
  const endRef = useRef(null);
  const listRef = useRef(null);
  const shouldStickRef = useRef(true);

  const visible = useMemo(
    () => (chatLog || []).filter(m => m?.type === 'text' || m?.type === 'gif').slice(-80),
    [chatLog]
  );

  const handleScroll = useCallback(() => {
    const node = listRef.current;
    if (!node) return;
    const remaining = node.scrollHeight - node.scrollTop - node.clientHeight;
    shouldStickRef.current = remaining < 48;
  }, []);

  useEffect(() => {
    const node = listRef.current;
    if (!node || !shouldStickRef.current) return;
    node.scrollTop = node.scrollHeight;
  }, [visible.length]);

  const send = useCallback((e) => {
    e.preventDefault();
    if (!msg.trim() || !roomCode) return;
    emit('send-chat', { text: msg.trim(), isGif: false });
    setMsg('');
  }, [msg, roomCode, emit]);

  return (
    <>
      <div className="lc-header">
        <span className="lc-dot" />
        <span className="lc-title">Lobby chat</span>
      </div>
      <div className="lc-messages" ref={listRef} onScroll={handleScroll}>
        {visible.length === 0 ? (
          <div className="lc-empty">
            <MessageSquare size={20} strokeWidth={1.5} />
            <span style={{ fontSize: 12, letterSpacing: 0 }}>No messages yet</span>
          </div>
        ) : (
          visible.map(m => {
            const isOwn = m.senderName === myName;
            const clr = TEAM_CLRS[m.senderTeamId] || '#a3a9b8';
            return (
              <div key={m.id} className="lc-msg" style={{ alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                <span className="lc-sender" style={{ color: clr }}>{m.senderName}</span>
                <div className={`lc-bubble${isOwn ? ' own' : ''}`}>
                  {m.type === 'gif'
                    ? <img src={m.text} alt="GIF" style={{ maxWidth: '100%', borderRadius: 6 }} />
                    : m.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} style={{ height: 1 }} />
      </div>
      <div className="lc-input-row">
        {!isSpectator ? (
          <form onSubmit={send} style={{ display: 'flex', gap: 6, width: '100%' }}>
            <input
              className="lc-input"
              value={msg}
              onChange={e => setMsg(e.target.value)}
              placeholder="Chat with the lobby…"
              autoComplete="off"
              autoCorrect="off"
            />
            <button type="submit" className="lc-send" disabled={!msg.trim()} aria-label="Send"><ArrowUp size={16} strokeWidth={1.5} /></button>
          </form>
        ) : (
          <div style={{ fontSize: 12, color: '#7a8296', letterSpacing: 0, padding: '4px 2px', width: '100%', textAlign: 'center' }}>
            Spectating
          </div>
        )}
      </div>
    </>
  );
});

function BrowseRooms({ name, setName, nameRef, serverRooms, completedRooms, fetchRooms, loading, error, doJoin, onViewCompleted, liveStats, onBack, onCreate }) {
  const [activeTab, setActiveTab] = useState('waiting'); // Show joinable rooms first!
  const privateActivity = getPrivateActivityEstimate(liveStats.rooms, liveStats.players);

  // Filter logic
  const sortRoomsStable = useCallback((rooms) => (
    [...rooms].sort((a, b) => {
      const nameCompare = String(a.name || '').localeCompare(String(b.name || ''));
      if (nameCompare !== 0) return nameCompare;
      return String(a.code || '').localeCompare(String(b.code || ''));
    })
  ), []);

  const liveRooms = useMemo(
    () => sortRoomsStable(serverRooms.filter(r => r.status === 'active')),
    [serverRooms, sortRoomsStable]
  );
  const waitingRooms = useMemo(
    () => sortRoomsStable(serverRooms.filter(r => r.status === 'lobby')),
    [serverRooms, sortRoomsStable]
  );
  const archivedRooms = useMemo(
    () => [...(completedRooms || [])].sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0) || String(a.code || '').localeCompare(String(b.code || ''))),
    [completedRooms]
  );
  const displayRooms = activeTab === 'live'
    ? liveRooms
    : activeTab === 'completed'
      ? archivedRooms
      : waitingRooms;

  return (
    <div className="rb-shell" style={{ position: 'relative', zIndex: 5, animation: 'fadeIn .4s ease' }}>
      {/* ── Header ── */}
      <div className="rb-header" style={{ borderBottom: '1px solid #1a1e28', background: '#0a0a0aee', backdropFilter: 'blur(12px)' }}>
        <div className="rb-header-row" style={{ marginBottom: 16 }}>
          <button className="rb-back-btn" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, letterSpacing: 0 }}>
            <ArrowLeft size={16} strokeWidth={1.5} /> Back
          </button>
          <div className="rb-title-block">
            <div className="rb-title" style={{ fontSize: 26, letterSpacing: 0 }}>Browsing <span style={{ color: GOLD }}>Rooms</span></div>
            <div className="rb-subtitle" style={{ fontSize: 12, letterSpacing: 0, color: '#7a8296' }}>{liveStats.rooms} PUBLIC LOBBIES ACTIVE</div>
            <div className="rb-subtitle" style={{ fontSize: 12, letterSpacing: 0, color: '#7a8296', marginTop: 4 }}>
              PRIVATE ACTIVITY: {privateActivity.rooms}+ ROOMS · {privateActivity.players}+ PLAYERS
            </div>
          </div>
          <div className="rb-header-actions">
            <BrandLink compact={true} />
            <button className="rb-icon-btn" onClick={fetchRooms} title="Refresh" disabled={loading} style={{ background: '#1a1e28', opacity: loading ? 0.55 : 1 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            </button>
            <button className="rb-create-btn" onClick={onCreate} style={{ height: 36, padding: '0 18px' }}>
              New room
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="rb-tabs" style={{ marginBottom: 0, border: 'none' }}>
          <button className={`rb-tab${activeTab === 'waiting' ? ' active' : ''}`} 
            onClick={() => setActiveTab('waiting')}
            style={{ paddingBottom: 14 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: 0 }}>Joinable</span>
            <span className="rb-tab-count" style={{ marginLeft: 6 }}>{waitingRooms.length}</span>
          </button>
          <button className={`rb-tab live-tab${activeTab === 'live' ? ' active' : ''}`} 
            onClick={() => setActiveTab('live')}
            style={{ paddingBottom: 14 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: 0 }}>In progress</span>
            <span className="rb-tab-count" style={{ marginLeft: 6, background: '#ef444422', color: '#e5484d' }}>{liveRooms.length}</span>
          </button>
          <button className={`rb-tab${activeTab === 'completed' ? ' active' : ''}`} 
            onClick={() => setActiveTab('completed')}
            style={{ paddingBottom: 14 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: 0 }}>Completed rooms</span>
            <span className="rb-tab-count" style={{ marginLeft: 6, background: '#22c55e22', color: '#22c55e' }}>{archivedRooms.length}</span>
          </button>
        </div>
      </div>

      {/* ── Name input ── */}
      <div className="rb-name-box" style={{ background: '#11141c', borderBottom: '1px solid #1a1e28' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <label className="rb-name-label" style={{ color: '#7a8296', fontSize: 12 }}>Your identity</label>
          <input
            ref={nameRef}
            className="rb-name-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="What should we call you?"
            style={{ background: '#0b0d14', padding: '16px 20px', fontSize: 18, borderRadius: 8 }}
          />
          {error && <div style={{ color: '#e5484d', fontSize: 12, marginTop: 8, letterSpacing: 0, paddingLeft: 4 }}>{error}</div>}
        </div>
      </div>

      {/* ── Rooms list ── */}
      <div className="rb-rooms-list" style={{ background: '#0b0d14' }}>
        <div style={{ maxWidth: 1440, margin: '0 auto' }}>
          {loading && displayRooms.length === 0 ? (
            <div className="rb-room-grid">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} style={{ background: '#11141c', border: '1px solid #1a1e28', borderRadius: 16, padding: 24, minHeight: 180, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ width: '55%', height: 18, background: '#1a1e28', borderRadius: 6, marginBottom: 18 }} />
                  <div style={{ width: '82%', height: 10, background: '#1a1e28', borderRadius: 6, marginBottom: 10 }} />
                  <div style={{ width: '64%', height: 10, background: '#1a1e28', borderRadius: 6 }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)', animation: 'shimmer 1.1s linear infinite' }} />
                </div>
              ))}
            </div>
          ) : displayRooms.length === 0 ? (
            <div className="rb-empty" style={{ padding: '80px 20px', border: '1px dashed #242936', borderRadius: 20 }}>
                              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: 0, color: '#7a8296' }}>
                {activeTab === 'live' ? 'No live matches' : activeTab === 'completed' ? 'No completed rooms yet' : 'No public lobbies'}
               </div>
               <div style={{ fontSize: 12, color: '#222', marginTop: 8, letterSpacing: 0 }}>
                {activeTab === 'completed' ? 'Finished public auctions stay here for 48 hours' : 'Be the first to start the excitement'}
               </div>
               {activeTab !== 'completed' && (
                 <button className="rp-btn" onClick={onCreate} style={{ maxWidth: 200, margin: '24px auto 0', height: 44, fontSize: 16 }}>
                  Create lobby
                 </button>
               )}
            </div>
          ) : (
            <div className="rb-room-grid">
              {displayRooms.map((room) => {
                const isActive = room.status === 'active';
                const isCompleted = room.status === 'finished';
                const teamCount = room.players || 0;
                const isRivals = room.roomType === 'rivals';
                const teamLimit = isRivals ? 2 : 10;
                
                return (
                  <div key={room.code} className="rb-room-card" 
                    style={{ 
                      animation: 'fadeUp .34s ease both',
                      background: '#11141c',
                      border: '1px solid #1a1e28',
                      borderRadius: 16,
                      padding: 24,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: 180
                    }}>
                    
                    <div className="rb-room-card-header" style={{ marginBottom: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div className="rb-card-topline">
                          <span className={`rb-status-dot ${isActive ? 'live' : 'waiting'}`} />
                          <div className="rb-room-code" style={{ fontSize: 12, color: GOLD, background: `${GOLD}11`, padding: '2px 8px', borderRadius: 4 }}>{room.code}</div>
                        <div style={{ fontSize: 12, color: '#7a8296', letterSpacing: 0 }}>{(room.mode || 'mega').toLowerCase() === 'mini' ? 'Mini' : 'Mega'}</div>
                        {isRivals && <div style={{ fontSize: 12, color: '#f97316', letterSpacing: 0, border: '1px solid #f9731640', background: '#f9731614', padding: '2px 6px', borderRadius: 999 }}>Rivals</div>}
                        {isCompleted && <div style={{ fontSize: 12, color: '#22c55e', letterSpacing: 0 }}>Results ready</div>}
                        </div>
                        <div className="rb-room-name" style={{ fontSize: 28, letterSpacing: 0 }}>{room.name || 'Mega Auction'}</div>
                        {isRivals && room.rivalsMatch && (
                        <div style={{ marginTop: 8, fontSize: 12, color: '#a3a9b8', letterSpacing: 0 }}>
                            {room.rivalsMatch.homeTeam} VS {room.rivalsMatch.awayTeam}
                          </div>
                        )}
                      </div>
                      
                      <div style={{ textAlign: 'right' }}>
                        <div className="rb-team-count" style={{ color: teamCount >= teamLimit ? '#e5484d' : '#fff' }}>{teamCount}<span>/{teamLimit}</span></div>
                        <div className="rb-team-label" style={{ fontSize: 12 }}>Participants</div>
                      </div>
                    </div>

                    <div className="rb-room-footer">
                       <div className="rb-room-meta">
                          {isCompleted
                            ? <>Finished {room.finishedAt ? new Date(room.finishedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'recently'}</>
                            : <>Hosted by <span style={{ color: '#7a8296', fontWeight: 600 }}>{room.host}</span></>
                          }
                       </div>
                       <div className="rb-room-actions">
                        {isCompleted ? (
                          <button 
                            className="rb-join-btn" 
                            onClick={() => onViewCompleted(room)}
                            style={{ width: 'auto', padding: '10px 24px', borderRadius: 8, background:'#22c55e18', color:'#22c55e', border:'1px solid #22c55e40' }}>
                            View results
                          </button>
                        ) : (
                          <>
                            <button 
                              className="rb-join-btn" 
                              onClick={() => doJoin(room.code, 'player')}
                              style={{ width: 'auto', padding: '10px 18px', borderRadius: 8, background: isActive ? '#22D3EE15' : GOLD, color: isActive ? '#a3a9b8' : '#000', border: isActive ? '1px solid #22D3EE40' : 'none' }}>
                              {isActive ? 'Play live' : 'Join lobby'}
                            </button>
                            <button
                              className="rb-join-btn"
                              onClick={() => doJoin(room.code, 'spectator')}
                              style={{ width:'auto', padding:'10px 16px', borderRadius:8, background:'#242936', color:'#c9cdd6', border:'1px solid #334155' }}
                            >
                              WATCH
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main RoomContent ────────────────────────────────────────────────────────
function RoomContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const action = searchParams.get('action');
  const rivalsMatchKey = searchParams.get('matchKey');
  const autoFind = searchParams.get('autoFind') === '1';
  const urlRoomCode = searchParams.get('room');

  const {
    emit, on, playerId,
    roomCode, setRoomCode, lobbyPlayers, setLobbyPlayers,
    isHost, setIsHost, myName, setMyName, setPlayMode,
    lobbyMode, setLobbyMode, multiGS, setMultiGS, startMultiAuction, isSpectator, setIsSpectator,
    roomMeta, setRoomMeta, chatLog,
  } = useGame();

  const [phase,       setPhase]       = useState(() => getPhaseFromAction(action));
  const [name,        setName]        = useState('');
  const [isPrivate,   setIsPrivate]   = useState(false);
  const [joinCode,    setJoinCode]    = useState('');
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [aMode,       setAMode]       = useState('mega');
  const [squadLimit,  setSquadLimit]  = useState(15);
  const [purse,       setPurse]       = useState(DEFAULT_PURSE);
  const [showPlayerRatings, setShowPlayerRatings] = useState(false);
  const [serverRooms, setServerRooms] = useState([]);
  const [completedRooms, setCompletedRooms] = useState([]);
  const [recentRooms, setRecentRooms] = useState([]);
  const [liveStats,   setLiveStats]   = useState({ rooms: 0, players: 0 });
  const [dialog,      setDialog]      = useState(null);
  const [rivalsMatches, setRivalsMatches] = useState([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [matchmakingLineIndex, setMatchmakingLineIndex] = useState(0);
  const privateActivity = useMemo(() => getPrivateActivityEstimate(liveStats.rooms, liveStats.players), [liveStats.players, liveStats.rooms]);
  const [matchmakingStartedAt, setMatchmakingStartedAt] = useState(null);
  const [matchmakingTimedOut, setMatchmakingTimedOut] = useState(false);
  const [matchmakingCycle, setMatchmakingCycle] = useState(0);
  const [showLobbyChatMobile, setShowLobbyChatMobile] = useState(false);
  const nameRef = useRef(null);
  const roomsFetchSeqRef = useRef(0);
  const closeDialog = useCallback(() => setDialog(null), []);
  // Keep a ref to the current phase so the pagehide handler always sees fresh value
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ── Restore name from localStorage ──
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ipl_player_name');
      if (saved) setName(saved);
      const savedRecent = JSON.parse(localStorage.getItem('ipl_recent_rooms') || '[]');
      setRecentRooms(savedRecent);
    }
  }, []);

  // ── Persist name whenever it changes ──
  useEffect(() => {
    if (name.trim() && typeof window !== 'undefined') {
      localStorage.setItem('ipl_player_name', name.trim());
    }
  }, [name]);

  // ── Notify server immediately when user closes tab / navigates away ──
  // This removes the lobby room from the public list right away rather than
  // waiting ~25 s for the socket ping-timeout to fire.
  useEffect(() => {
    const LOBBY_PHASES = new Set(['lobby', 'rivals', 'rivals-searching', 'rivals-found', 'rivals-create']);
    const handlePageHide = () => {
      if (LOBBY_PHASES.has(phaseRef.current)) {
        emit('leave-lobby');
      }
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  // emit is stable (useCallback), no other deps needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (roomMeta?.squadLimit) {
      setSquadLimit(roomMeta.squadLimit);
    } else if (multiGS?.squadLimit) {
      setSquadLimit(multiGS.squadLimit);
    }
    if (roomMeta?.purse) {
      setPurse(roomMeta.purse);
    } else if (multiGS?.initialPurse) {
      setPurse(multiGS.initialPurse);
    }
  }, [multiGS?.initialPurse, multiGS?.squadLimit, roomMeta?.purse, roomMeta?.squadLimit]);

  useEffect(() => {
    setShowPlayerRatings(!!roomMeta?.showPlayerRatings);
  }, [roomMeta?.showPlayerRatings]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (phase !== 'rivals-searching') return undefined;

    setMatchmakingTimedOut(false);
    setMatchmakingStartedAt(Date.now());
    setMatchmakingLineIndex(0);

    const lineTimer = window.setInterval(() => {
      setMatchmakingLineIndex((prev) => (prev + 1) % MATCHMAKING_LINES.length);
    }, 3200);

    const timeoutTimer = window.setTimeout(() => {
      setMatchmakingTimedOut(true);
    }, 60000);

    return () => {
      window.clearInterval(lineTimer);
      window.clearTimeout(timeoutTimer);
    };
  }, [phase, matchmakingCycle]);

  const rivalsFoundRoomCode = urlRoomCode || roomCode || multiGS?.roomCode || '';

  useEffect(() => {
    // Use a stable room-code dependency here. If we depend on the whole game
    // state object, live timer/game updates reset this timeout and trap users
    // on the VS screen while the auction already runs in the background.
    if (phase !== 'rivals-found' || !rivalsFoundRoomCode) return undefined;
    const timer = window.setTimeout(() => {
      router.push(`/auction?room=${rivalsFoundRoomCode}&mode=RIVALS${isSpectator ? '&spectator=1' : ''}`);
    }, 3600);
    return () => window.clearTimeout(timer);
  }, [phase, rivalsFoundRoomCode, router, isSpectator]);

  // ── Auto-focus name input ──
  useEffect(() => {
    if (phase === 'join' || phase === 'join-code' || phase === 'create-form' || phase === 'rivals' || phase === 'rivals-create') nameRef.current?.focus();
  }, [phase]);

  // ── URL action param ──
  useEffect(() => {
    const nextPhase = getPhaseFromAction(action);
    setPhase(prev => {
      if (prev === 'lobby' && nextPhase !== 'lobby' && !String(nextPhase).startsWith('rivals-')) return prev;
      return prev === nextPhase ? prev : nextPhase;
    });
  }, [action]);

  // ── Dedicated rivals game-started listener ──────────────────────────────────
  // This is a safety net for the race condition where:
  //   1. Player A emits join-rivals-match and gets roomStatus='lobby' (waiting)
  //   2. setPlayMode('multi') is called, causing GameContext's socket effect to
  //      temporarily tear down and re-register its listeners
  //   3. Player B joins; server auto-starts and emits game-started in that window
  //   4. GameContext misses the event → Player A is stuck on rivals-searching
  // This local listener fires immediately when the phase is rivals-searching.
  useEffect(() => {
    if (phase !== 'rivals-searching') return;
    const effectiveRoom = urlRoomCode || roomCode;
    const off = on('game-started', (gs) => {
      setMultiGS(gs);
      const targetRoom = effectiveRoom || gs?.roomCode;
      if (targetRoom) {
        router.push(`/room?action=rivals-found&room=${targetRoom}`);
      }
    });
    return () => { if (off) off(); };
  }, [phase, on, router, urlRoomCode, roomCode, setMultiGS]);

  useEffect(() => {
    if (!['rivals', 'rivals-create', 'rivals-searching', 'rivals-found'].includes(phase)) return;
    let cancelled = false;

    fetch(`${getBackendUrl()}/api/rivals/matches`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setRivalsMatches(data?.matches || []);
      })
      .catch(() => {
        if (!cancelled) setRivalsMatches([]);
      });

    return () => {
      cancelled = true;
    };
  }, [phase]);

  // ── Fetch public rooms ──
  const fetchRooms = useCallback(() => {
    const fetchSeq = ++roomsFetchSeqRef.current;
    let settled = false;
    setRoomsLoading(true);
    const applyRooms = (data) => {
      if (fetchSeq !== roomsFetchSeqRef.current) return;
      settled = true;
      setServerRooms(data?.active || []);
      setCompletedRooms(data?.completed || []);
      setLiveStats({ rooms: data?.totalRooms || 0, players: data?.totalPlayers || 0 });
      setRoomsLoading(false);
    };

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    const fallbackTimeout = window.setTimeout(() => {
      if (!settled && fetchSeq === roomsFetchSeqRef.current) setRoomsLoading(false);
    }, 8000);

    fetch(`${getBackendUrl()}/api/rooms`, { cache: 'no-store', signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        window.clearTimeout(timeout);
        window.clearTimeout(fallbackTimeout);
        if (data) applyRooms(data);
        else throw new Error('Room fetch failed');
      })
      .catch(() => {
        window.clearTimeout(timeout);
        if (settled) return;
        emit('get-rooms', (data) => {
          window.clearTimeout(fallbackTimeout);
          applyRooms(data);
        });
      });
  }, [emit]);

  useEffect(() => {
    if (phase === 'home' || phase === 'join') {
      // Socket pushes 'public-rooms-updated' on changes; the slow poll is only a fallback,
      // and nothing is fetched while the tab is hidden.
      const refreshIfVisible = () => { if (document.visibilityState === 'visible') fetchRooms(); };
      fetchRooms();
      const t = setInterval(refreshIfVisible, 30000);
      const off = on('public-rooms-updated', refreshIfVisible);
      document.addEventListener('visibilitychange', refreshIfVisible);
      return () => {
        clearInterval(t);
        document.removeEventListener('visibilitychange', refreshIfVisible);
        if (off) off();
      };
    }
  }, [phase, fetchRooms, on]);

  // ── Helpers ──
  const saveRecentRoom = (code, roomName) => {
    if (typeof window === 'undefined') return;
    try {
      let recents = JSON.parse(localStorage.getItem('ipl_recent_rooms') || '[]');
      recents = [{ code, name: roomName }, ...recents.filter(r => r.code !== code)].slice(0, 3);
      localStorage.setItem('ipl_recent_rooms', JSON.stringify(recents));
      setRecentRooms(recents);
    } catch { /* storage unavailable */ }
  };

  const viewCompletedRoom = useCallback((room) => {
    if (!room?.code) return;
    const params = new URLSearchParams({ room: room.code });
    if (room.mode) params.set('mode', room.mode);
    params.set('completed', '1');
    router.push(`/results?${params.toString()}`);
  }, [router]);

  const todayKey = getDateKey(new Date(nowMs));
  const selectedRivalsMatch = useMemo(() => {
    const sorted = [...rivalsMatches].sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
    if (rivalsMatchKey) {
      const exact = sorted.find((match) => match.key === rivalsMatchKey);
      if (exact && isPlayableRivalsMatch(exact, nowMs)) return exact;
    }

    const todays = sorted.filter((match) => match.date === todayKey);
    const todayPlayable = todays.find((match) => isPlayableRivalsMatch(match, nowMs));
    if (todayPlayable) return todayPlayable;

    return sorted.find((match) => isPlayableRivalsMatch(match, nowMs)) || null;
  }, [rivalsMatches, rivalsMatchKey, todayKey, nowMs]);

  const isRivalsLobby = roomMeta?.roomType === 'rivals';
  const myLobbyPlayer = lobbyPlayers.find((p) => p.id === playerId) || lobbyPlayers.find((p) => p.name === myName);
  const myTeamId  = myLobbyPlayer?.teamId;
  const takenMap  = Object.fromEntries(
    lobbyPlayers.filter(p => p.teamId).map(p => [p.teamId, p.name])
  );
  const rivalsHomeTeam = roomMeta?.rivalsMatch?.homeTeam || selectedRivalsMatch?.homeTeam;
  const rivalsAwayTeam = roomMeta?.rivalsMatch?.awayTeam || selectedRivalsMatch?.awayTeam;
  const rivalsHomePlayer = rivalsHomeTeam ? takenMap[rivalsHomeTeam] : null;
  const rivalsAwayPlayer = rivalsAwayTeam ? takenMap[rivalsAwayTeam] : null;
  const activeRivalsMatch = roomMeta?.rivalsMatch || selectedRivalsMatch;
  const matchmakingElapsed = matchmakingStartedAt ? Math.max(0, 60 - Math.floor((nowMs - matchmakingStartedAt) / 1000)) : 60;
  const formatDuelLabel = useCallback((teamId, playerName) => (
    playerName ? `${teamId} (${playerName})` : teamId || ''
  ), []);

  // ── Handlers ──
  const handleCreate = () => {
    if (!name.trim()) { setError('Enter your name first'); return; }
    setLoading(true); setError('');
    const roomName = `${name.trim()}'s Room`;
    const selectedPurse = squadLimit === 25 && purse === EXTENDED_PURSE ? EXTENDED_PURSE : DEFAULT_PURSE;
    emit('create-room', { playerName: name.trim(), isPrivate, roomName, playerId, auctionMode: aMode, squadLimit, purse: selectedPurse }, (res) => {
      setLoading(false);
      if (!res?.ok) { setError(res?.error || 'Failed to create room'); return; }
      if (typeof window !== 'undefined') {
        localStorage.setItem('ipl_room_code',   res.code);
        localStorage.setItem('ipl_player_name', name.trim());
        localStorage.setItem('ipl_play_mode',   'multi');
      }
      saveRecentRoom(res.code, roomName);
      setRoomCode(res.code);
      setIsHost(true);
      setMyName(name.trim());
      setLobbyPlayers(res.players || []);
      setPlayMode('multi');
      setIsSpectator(false);
      setLobbyMode(aMode);
      setRoomMeta({
        roomType: res.roomType || 'standard',
        activeTeamIds: res.activeTeamIds || null,
        rivalsMatch: res.rivalsMatch || null,
        roomName,
        squadLimit: res.squadLimit || 15,
        purse: res.purse || selectedPurse,
        showPlayerRatings: !!res.showPlayerRatings,
      });
      setPhase('lobby');
    });
  };

  const handleCreateRivalsRoom = () => {
    if (!name.trim()) { setError('Enter your name first'); return; }
    if (!selectedRivalsMatch) { setError('No active Rivals match is available right now.'); return; }
    setLoading(true);
    setError('');
    const roomName = `${selectedRivalsMatch.homeTeam} vs ${selectedRivalsMatch.awayTeam} Rivals`;
    emit('create-room', {
      playerName: name.trim(),
      isPrivate,
      roomName,
      playerId,
      roomType: 'rivals',
      matchKey: selectedRivalsMatch.key,
    }, (res) => {
      setLoading(false);
      if (!res?.ok) { setError(res?.error || 'Failed to create Rivals room'); return; }
      if (typeof window !== 'undefined') {
        localStorage.setItem('ipl_room_code', res.code);
        localStorage.setItem('ipl_player_name', name.trim());
        localStorage.setItem('ipl_play_mode', 'multi');
      }
      saveRecentRoom(res.code, roomName);
      setRoomCode(res.code);
      setIsHost(true);
      setMyName(name.trim());
      setLobbyPlayers(res.players || []);
      setPlayMode('multi');
      setIsSpectator(false);
      setLobbyMode('rivals');
      setRoomMeta({
        roomType: res.roomType || 'rivals',
        activeTeamIds: res.activeTeamIds || [],
        rivalsMatch: res.rivalsMatch || selectedRivalsMatch,
        roomName,
        squadLimit: res.squadLimit || 13,
        purse: res.purse || DEFAULT_PURSE,
        showPlayerRatings: !!res.showPlayerRatings,
      });
      setPhase('lobby');
    });
  };

  const handleFindOnline = useCallback(() => {
    if (!name.trim()) { setError('Enter your name first'); return; }
    if (!selectedRivalsMatch) { setError('No active Rivals match is available right now.'); return; }
    setLoading(true);
    setError('');
    setMatchmakingTimedOut(false);
    setMatchmakingLineIndex(0);
    emit('join-rivals-match', { matchKey: selectedRivalsMatch.key, playerName: name.trim(), playerId }, (res) => {
      setLoading(false);
      if (!res?.ok) {
        setError(res?.error || 'Unable to find a Rivals opponent right now.');
        return;
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('ipl_room_code', res.code);
        localStorage.setItem('ipl_player_name', name.trim());
        localStorage.setItem('ipl_play_mode', 'multi');
      }
      setRoomCode(res.code);
      setIsHost(res.hostId === playerId);
      setMyName(name.trim());
      setLobbyPlayers(res.players || []);
      setPlayMode('multi');
      setIsSpectator(!!res.isSpectator);
      setLobbyMode('rivals');
      setRoomMeta({
        roomType: res.roomType || 'rivals',
        activeTeamIds: res.activeTeamIds || [],
        rivalsMatch: res.rivalsMatch || selectedRivalsMatch,
        roomName: `${selectedRivalsMatch.homeTeam} vs ${selectedRivalsMatch.awayTeam} Rivals`,
        squadLimit: res.squadLimit || 13,
        purse: res.purse || DEFAULT_PURSE,
        showPlayerRatings: !!res.showPlayerRatings,
      });
      if (res.roomStatus === 'active' && res.gameState) {
        setMultiGS(res.gameState);
        router.push(`/room?action=rivals-found&room=${res.code}`);
      } else {
        router.push(`/room?action=rivals-searching&matchKey=${encodeURIComponent(selectedRivalsMatch.key)}&room=${res.code}`);
      }
    });
  }, [emit, name, playerId, router, selectedRivalsMatch, setIsHost, setIsSpectator, setLobbyMode, setLobbyPlayers, setMultiGS, setMyName, setPlayMode, setRoomCode, setRoomMeta]);

  useEffect(() => {
    if (phase !== 'rivals' || !autoFind || loading) return;
    if (!name.trim() || !selectedRivalsMatch) return;
    handleFindOnline();
  }, [autoFind, handleFindOnline, loading, name, phase, selectedRivalsMatch]);

  const doJoin = (targetCode, preferredRole = 'player') => {
    if (!name.trim()) { setError('Enter your name first'); return; }
    const code = (targetCode || '').trim().toUpperCase();
    if (!code) { setError('Enter a room code'); return; }
    setLoading(true); setError('');
    emit('join-room', { code, playerName: name.trim(), playerId, preferredRole }, (res) => {
      setLoading(false);
      if (!res?.ok) {
        setError(res?.error === 'Room not found' ? 'Room not found or already expired.' : (res?.error || 'Room not found'));
        return;
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('ipl_player_name', name.trim());
        if (res.roomStatus === 'finished') {
          localStorage.removeItem('ipl_room_code');
          localStorage.removeItem('ipl_play_mode');
        } else {
          localStorage.setItem('ipl_room_code', code);
          localStorage.setItem('ipl_play_mode', 'multi');
        }
      }
      const hostP   = (res.players || []).find(p => p.id === res.hostId);
      const roomName = hostP ? `${hostP.name}'s Room` : `Room ${code}`;
      saveRecentRoom(res.code || code, roomName);
      setRoomCode(res.code || code);
      setIsHost(res.hostId === playerId);
      setMyName(name.trim());
      setLobbyPlayers(res.players || []);
      setPlayMode('multi');
      setIsSpectator(!!res.isSpectator);
      if (res.auctionMode) { setLobbyMode(res.auctionMode); setAMode(res.auctionMode); }
      setRoomMeta({
        roomType: res.roomType || 'standard',
        activeTeamIds: res.activeTeamIds || null,
        rivalsMatch: res.rivalsMatch || null,
        roomName: res.roomName || null,
        squadLimit: res.squadLimit || null,
        purse: res.purse || null,
        showPlayerRatings: !!res.showPlayerRatings,
      });
      if (res.roomStatus === 'active') {
        setMultiGS(res.gameState);
        const myP = (res.players || []).find(p => p.id === playerId);
        if (res.isSpectator || (myP && myP.teamId)) {
          router.push(`/auction?room=${code}${res.auctionMode ? `&mode=${res.auctionMode}` : ''}${res.isSpectator ? '&spectator=1' : ''}`);
        } else {
          setPhase('lobby'); // Participant but no team -> pick one first
          const params = new URLSearchParams({
            action: 'lobby',
            room: code,
          });
          if (res.auctionMode) params.set('mode', res.auctionMode);
          router.push(`/room?${params.toString()}`);
        }
      } else if (res.roomStatus === 'finished') {
        setMultiGS(res.gameState); router.push(`/results?room=${code}${res.auctionMode ? `&mode=${res.auctionMode}` : ''}`);
      } else { setPhase('lobby'); }
    });
  };

  const selectTeam = (teamId) => {
    emit('select-team', { teamId }, (res) => {
      if (!res?.ok) setError(res?.error || 'Cannot select that team');
    });
  };

  const requestKickPlayer = useCallback((player) => {
    if (!player?.id) return;
    setDialog({
      title: `Kick ${player.name}?`,
      message: player.teamId
        ? `${player.name} will be removed from this room. Their franchise slot will open up again for another player.`
        : `${player.name} will be removed from this room immediately.`,
      tone: 'danger',
      actions: [
        { label: 'Cancel', variant: 'secondary', onClick: closeDialog },
        {
          label: 'Kick player',
          variant: 'danger',
          onClick: () => {
            closeDialog();
            emit('kick-player', { targetPlayerId: player.id }, (res) => {
              if (!res?.ok) {
                setDialog({
                  title: 'Could not kick player',
                  message: res?.error || 'Something went wrong while removing this player.',
                  tone: 'info',
                  actions: [{ label: 'OK', onClick: closeDialog }],
                });
              }
            });
          },
        },
      ],
    });
  }, [closeDialog, emit]);

  const changeMode = (m) => {
    const recommendedLimit = 15;
    setAMode(m);
    setLobbyMode(m);
    setSquadLimit(recommendedLimit);
    setPurse(DEFAULT_PURSE);
    emit('set-auction-mode', { mode: m });
    emit('set-squad-limit', { squadLimit: recommendedLimit });
  };

  const changeSquadLimit = (limit) => {
    setSquadLimit(limit);
    if (limit !== 25) setPurse(DEFAULT_PURSE);
    emit('set-squad-limit', { squadLimit: limit });
  };

  const changePurse = (nextPurse) => {
    const normalizedPurse = squadLimit === 25 && nextPurse === EXTENDED_PURSE ? EXTENDED_PURSE : DEFAULT_PURSE;
    setPurse(normalizedPurse);
    emit('set-purse', { purse: normalizedPurse });
  };

  const changePlayerRatingsVisibility = (shouldShow) => {
    setShowPlayerRatings(shouldShow);
    emit('set-player-ratings-visibility', { showPlayerRatings: shouldShow }, (res) => {
      if (!res?.ok) {
        setShowPlayerRatings(!!roomMeta?.showPlayerRatings);
        setError(res?.error || 'Could not update ratings visibility');
        return;
      }
      setRoomMeta(prev => ({ ...(prev || {}), showPlayerRatings: !!res.showPlayerRatings }));
    });
  };

  const runStartAuction = () => {
    startMultiAuction({
      onError: (message) => {
        setDialog({
          title: 'Cannot start auction',
          message,
          tone: 'info',
          actions: [{ label: 'OK', onClick: closeDialog }],
        });
      },
    });
  };

  const handleStart = () => {
    if (!aMode) { setError('Select MEGA or MINI first'); return; }
    const activePlayers = lobbyPlayers.filter(p => !p.isSpectator && !p.offline);
    if (activePlayers.length === 0) {
      setDialog({
        title: 'More players needed',
        message: 'At least 1 active player must join the room before the auction can start.',
        tone: 'info',
        actions: [{ label: 'OK', onClick: closeDialog }],
      });
      return;
    }

    if (activePlayers.length === 1) {
      const soloPlayer = activePlayers[0];
      setDialog({
        title: 'Start With One Player?',
        message: `${soloPlayer?.name || 'Only one active player'} is currently in the room. You can still start now, and more players can join later.`,
        tone: 'info',
        actions: [
          { label: 'Cancel', variant: 'secondary', onClick: closeDialog },
          {
            label: 'Start auction',
            onClick: () => {
              closeDialog();
              runStartAuction();
            },
          },
        ],
      });
      return;
    }

    runStartAuction();
  };

  const shareUrl  = typeof window !== 'undefined' ? `${window.location.origin}/join/${roomCode}` : '';
  const copyCode  = () => { navigator.clipboard.writeText(roomCode); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); };
  const copyUrl   = () => { navigator.clipboard.writeText(shareUrl); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); };
  const canStart  = isHost && lobbyPlayers.length >= 1 && !!aMode;

  return (
    <>
      <style>{globalStyles}</style>
      <AppDialog
        isOpen={!!dialog}
        title={dialog?.title}
        message={dialog?.message}
        tone={dialog?.tone}
        actions={dialog?.actions || []}
        onClose={closeDialog}
      />

      {/* Particles */}
      <div className="rp-particles">
        {['p1','p2','p3','p4','p5'].map(c => <div key={c} className={`particle ${c}`} />)}
      </div>

      {/* ── Navbar — hidden in join phase (BrowseRooms has its own header) ── */}
      {phase !== 'join' && (
        <nav className="rp-nav">
          <button className="rp-back" onClick={() => {
            if (phase === 'lobby' || phase === 'create-form' || phase === 'rivals-create') setPhase(isRivalsLobby ? 'rivals' : 'home');
            else if (phase === 'rivals-searching') setPhase('rivals');
            else if (phase === 'rivals') router.push('/');
            else router.push('/');
          }}><ArrowLeft size={16} strokeWidth={1.5} /> Back</button>
          <BrandLink compact={true} />
        </nav>
      )}

      {phase === 'rivals-searching' && (
        <div className="rivals-screen">
          <div className="rivals-shell">
            <div className="rivals-search-card">
              <div style={{ color: GOLD, fontSize: 12, letterSpacing: 0, fontWeight: 600, marginBottom: 10 }}>Matchmaking</div>
              <div className="rivals-search-line">{matchmakingTimedOut ? 'No rival found right now' : MATCHMAKING_LINES[matchmakingLineIndex]}</div>

              {activeRivalsMatch && (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:18, flexWrap:'wrap', margin:'18px 0 20px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <img src={`/assets/${activeRivalsMatch.homeTeam}.png`} alt={activeRivalsMatch.homeTeam} style={{ width:64, height:64, objectFit:'contain' }} />
                    <div style={{ fontFamily: 'var(--font-display)', fontSize:32, color:'#fff', letterSpacing: 0 }}>{activeRivalsMatch.homeTeam}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize:38, color:'#a3a9b8', letterSpacing: 0 }}>VS</div>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize:32, color:'#fff', letterSpacing: 0 }}>{activeRivalsMatch.awayTeam}</div>
                    <img src={`/assets/${activeRivalsMatch.awayTeam}.png`} alt={activeRivalsMatch.awayTeam} style={{ width:64, height:64, objectFit:'contain' }} />
                  </div>
                </div>
              )}

              {!matchmakingTimedOut ? (
                <>
                  <div className="rivals-search-progress" style={{ marginBottom: 14 }}>
                    <span style={{ width: `${Math.max(8, ((60 - matchmakingElapsed) / 60) * 100)}%` }} />
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:12, flexWrap:'wrap', color:'#a3a9b8', fontSize:12, letterSpacing: 0 }}>
                    <span>Waiting for one more player to join the duel...</span>
                    <span>{String(matchmakingElapsed).padStart(2, '0')}s left</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ color:'#a3a9b8', fontSize:14, lineHeight:1.7, marginTop:10 }}>
                    No player is online currently for this Rivals match. Try creating a room and invite a friend, or keep waiting in the public queue.
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:14, marginTop:22 }}>
                    <button className="rp-btn" onClick={() => setPhase('rivals-create')}>
                      Create room
                    </button>
                    <button className="rp-btn cyan-btn" onClick={() => { setMatchmakingTimedOut(false); setMatchmakingLineIndex(0); setMatchmakingCycle((prev) => prev + 1); }}>
                      Keep waiting
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {phase === 'rivals-found' && activeRivalsMatch && (
        <div className="rivals-screen">
          <div className="rivals-found-shell">
            <div style={{ color: GOLD, fontSize: 12, letterSpacing: 0, fontWeight: 600 }}>Opponent found</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize:'clamp(38px, 8vw, 74px)', color:'#fff', letterSpacing: 0, lineHeight:.9 }}>
              The auction begins
            </div>
            <div className="rivals-found-arena">
              <div className="rivals-team-entry left" style={{ borderColor: `${TEAMS.find((team) => team.id === activeRivalsMatch.homeTeam)?.color || GOLD}50` }}>
                <img src={`/assets/${activeRivalsMatch.homeTeam}.png`} alt={activeRivalsMatch.homeTeam} style={{ width:88, height:88, objectFit:'contain' }} />
                <div>
                  <div style={{ color: TEAMS.find((team) => team.id === activeRivalsMatch.homeTeam)?.color || GOLD, fontSize: 12, fontWeight: 600, letterSpacing: 0 }}>Home</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize:42, letterSpacing: 0 }}>{activeRivalsMatch.homeTeam}</div>
                  <div style={{ color:'#a3a9b8', fontSize:13, letterSpacing: 0, marginTop:6 }}>
                    {formatDuelLabel(activeRivalsMatch.homeTeam, rivalsHomePlayer)}
                  </div>
                </div>
              </div>
              <div className="rivals-vs-burst">
                <div style={{ fontFamily: 'var(--font-display)', fontSize:44, color:'#fff', letterSpacing: 0 }}>VS</div>
              </div>
              <div className="rivals-team-entry right" style={{ borderColor: `${TEAMS.find((team) => team.id === activeRivalsMatch.awayTeam)?.color || CYAN}50` }}>
                <div>
                  <div style={{ color: TEAMS.find((team) => team.id === activeRivalsMatch.awayTeam)?.color || CYAN, fontSize: 12, fontWeight: 600, letterSpacing: 0 }}>Away</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize:42, letterSpacing: 0 }}>{activeRivalsMatch.awayTeam}</div>
                  <div style={{ color:'#a3a9b8', fontSize:13, letterSpacing: 0, marginTop:6 }}>
                    {formatDuelLabel(activeRivalsMatch.awayTeam, rivalsAwayPlayer)}
                  </div>
                </div>
                <img src={`/assets/${activeRivalsMatch.awayTeam}.png`} alt={activeRivalsMatch.awayTeam} style={{ width:88, height:88, objectFit:'contain' }} />
              </div>
            </div>
            <div style={{ color:'#a3a9b8', fontSize:14, letterSpacing: 0 }}>
              Loading the live auction room...
            </div>
          </div>
        </div>
      )}

      {phase === 'rivals' && (
        <div className="rivals-screen">
          <div className="rivals-shell">
            <span className="rp-eyebrow">Daily Rivals auction</span>
            <h1 className="rp-h1">Play today&apos;s<br /><span>Rivals match</span></h1>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color:'#a3a9b8', margin:'10px 0 22px', lineHeight:1.8 }}>
              Jump straight into today&apos;s 1v1 duel. We&apos;ll assign one of the two teams automatically and start the auction as soon as both rivals are in.
            </p>

            {selectedRivalsMatch ? (() => {
              const state = getRivalsMatchState(selectedRivalsMatch, nowMs);
              const countdown = formatCountdown(new Date(selectedRivalsMatch.startAt).getTime() - nowMs);
              const homeTeam = TEAMS.find((team) => team.id === selectedRivalsMatch.homeTeam);
              const awayTeam = TEAMS.find((team) => team.id === selectedRivalsMatch.awayTeam);
              const timerLabel = state === 'locked' ? 'Match live' : state === 'open' ? 'Auction locks in' : 'Match starts in';
              return (
                <div style={{ background:'linear-gradient(160deg, rgba(232,184,75,0.1), rgba(8,8,8,0.96))', border:'1px solid rgba(232,184,75,0.18)', borderRadius:24, padding:'24px 22px', boxShadow:'0 24px 60px rgba(0,0,0,0.22)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:18, flexWrap:'wrap', marginBottom:18 }}>
                    <div>
                      <div style={{ color:'#E8B84B', fontSize: 12, letterSpacing: 0, fontWeight: 600, marginBottom:6 }}>Today&apos;s fixture</div>
                      <div style={{ color:'#a3a9b8', fontSize:12, letterSpacing: 0 }}>{formatRivalsMeta(selectedRivalsMatch.startAt)} IST • {selectedRivalsMatch.venue}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ color:'#a3a9b8', fontSize: 12, letterSpacing: 0, fontWeight: 600 }}>{timerLabel}</div>
                      <div style={{ color: state === 'locked' ? '#e5484d' : state === 'open' ? '#4cc38a' : CYAN, fontFamily: 'var(--font-display)', fontSize:34, letterSpacing: 0 }}>
                        {state === 'locked' ? 'LIVE' : countdown}
                      </div>
                    </div>
                  </div>

                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:22, flexWrap:'wrap', marginBottom:24 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                      <img src={`/assets/${selectedRivalsMatch.homeTeam}.png`} alt={homeTeam?.short} style={{ width:72, height:72, objectFit:'contain' }} />
                      <div>
                        <div style={{ color:homeTeam?.color || GOLD, fontSize:12, fontWeight: 600, letterSpacing: 0 }}>{homeTeam?.short}</div>
                        <div style={{ color:'#fff', fontFamily: 'var(--font-display)', fontSize:30, letterSpacing: 0 }}>{homeTeam?.name}</div>
                      </div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize:42, color:'#a3a9b8', letterSpacing: 0 }}>VS</div>
                    <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ color:awayTeam?.color || CYAN, fontSize:12, fontWeight: 600, letterSpacing: 0 }}>{awayTeam?.short}</div>
                        <div style={{ color:'#fff', fontFamily: 'var(--font-display)', fontSize:30, letterSpacing: 0 }}>{awayTeam?.name}</div>
                      </div>
                      <img src={`/assets/${selectedRivalsMatch.awayTeam}.png`} alt={awayTeam?.short} style={{ width:72, height:72, objectFit:'contain' }} />
                    </div>
                  </div>

                  <label className="rp-label">Your name</label>
                  <input
                    ref={nameRef}
                    className="rp-input"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Rahul"
                    maxLength={20}
                    onKeyDown={e => e.key === 'Enter' && handleFindOnline()}
                  />

                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:14, marginTop:20 }}>
                    <button className="rp-btn cyan-btn" onClick={handleFindOnline} disabled={loading || state === 'locked' || state === 'completed'}>
                      {loading ? 'Finding rival…' : 'Find online'}
                    </button>
                    <button className="rp-btn" onClick={() => { setError(''); setPhase('rivals-create'); }} disabled={!selectedRivalsMatch || state === 'locked' || state === 'completed'}>
                      Create room
                    </button>
                  </div>

                  <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginTop:16 }}>
                    <button className="lobby-copy-btn" onClick={() => router.push('/room?action=browse')}>Live auction rooms</button>
                    <button className="lobby-copy-btn" onClick={() => router.push('/room?action=join-code')}>Join with code</button>
                  </div>

                  {error && <div className="rp-error" style={{ marginTop:16 }}>{error}</div>}
                </div>
              );
            })() : (
              <div style={{ border:'1px solid #1f2937', borderRadius:18, padding:'24px 22px', background:'#0b0d14', color:'#a3a9b8', lineHeight:1.8 }}>
                No joinable Rivals match is available right now. The card on the homepage will automatically switch to the next daily team matchup.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ HOME ══════════ */}
      {phase === 'home' && (
        <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'80px 24px 60px', position:'relative', zIndex:5 }}>
          <div style={{ width:'100%', maxWidth:780, animation:'fadeUp .4s ease both' }}>
            <span className="rp-eyebrow">Multiplayer</span>
            <h1 className="rp-h1">Start or join an<br /><span>auction room</span></h1>
            <div className="rp-live-counter">
              <div className="rp-live-dot" />
              {liveStats.rooms > 0
                ? `${liveStats.rooms} room${liveStats.rooms !== 1 ? 's' : ''} active · ${liveStats.players} player${liveStats.players !== 1 ? 's' : ''} online`
                : 'No active public rooms, create one'}
            </div>
            <div style={{ color:'#7a8296', fontSize: 13, marginTop:-12, marginBottom:24 }}>
              Private rooms run in parallel, typically {privateActivity.rooms}+ lobbies with {privateActivity.players}+ players
            </div>

            <div className="rp-choices">
              <div className="rp-choice create-card" onClick={() => { setError(''); setPhase('create-form'); }}>
                <div className="rp-choice-label" style={{ color: GOLD }}>Host</div>
                <div className="rp-choice-title">Create room</div>
                <div className="rp-choice-desc">Set up a private or public room. Invite friends with a code.</div>
              </div>
              <div className="rp-choice join-card" onClick={() => { setError(''); setPhase('join-code'); }}>
                <div className="rp-choice-label" style={{ color: CYAN }}>Player</div>
                <div className="rp-choice-title">Join room</div>
                <div className="rp-choice-desc">Enter a private room code to join an ongoing auction.</div>
              </div>
              <div className="rp-choice browse-card" onClick={() => { setError(''); setPhase('join'); }} style={{ position: 'relative' }}>
                <div className="rp-choice-label" style={{ color: '#a3a9b8' }}>Explore</div>
                <div className="rp-choice-title">Browse rooms</div>
                {liveStats.rooms > 0 && (
                   <div style={{ position: 'absolute', top: -8, right: -8, background: '#a3a9b8', color: '#fff', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20, boxShadow: '0 4px 12px rgba(163,169,184, 0.4)', animation: 'pulse 2s infinite' }}>
                    {liveStats.rooms} Lobbies
                   </div>
                )}
                <div className="rp-choice-desc">Pick from active public lobbies to spectate or play.</div>
              </div>
            </div>

            {/* Public lobbies preview */}
            {serverRooms.length > 0 && (
              <div style={{ marginTop:28 }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, letterSpacing: 0, color:'#7a8296', marginBottom:10, borderBottom:'1px solid #1a1e28', paddingBottom:8 }}>Public lobbies</div>
                {serverRooms.slice(0,3).map((r, i) => (
                  <div key={i} className="rp-room-item">
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize:16, color:'#c9cdd6' }}>{r.name}</div>
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color:'#a3a9b8', marginTop:2 }}>Host: {r.host} · {r.players}/10</div>
                    </div>
                    <button className="rp-room-join-btn" onClick={() => {
                      if (!name.trim()) {
                        setError('Enter your name to join room');
                        nameRef.current?.focus();
                        return;
                      }
                      doJoin(r.code, 'player');
                    }}>Play</button>
                  </div>
                ))}
              </div>
            )}

            {/* Recent rooms */}
            {recentRooms.length > 0 && (
              <div style={{ marginTop:24 }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, letterSpacing: 0, color:'#7a8296', marginBottom:10, borderBottom:'1px solid #1a1e28', paddingBottom:8 }}>Recent rooms</div>
                {recentRooms.map((r, i) => (
                  <div key={i} className="rp-room-item">
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize:16, color:'#a3a9b8' }}>{r.name}</div>
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color:'#a3a9b8', marginTop:2 }}>Code: {r.code}</div>
                    </div>
                    <button className="rp-room-rejoin-btn" onClick={() => {
                      if (!name.trim()) {
                        setError('Enter your name to join room');
                        nameRef.current?.focus();
                        return;
                      }
                      doJoin(r.code, 'player');
                    }}>Rejoin</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ CREATE FORM ══════════ */}
      {(phase === 'create-form' || phase === 'rivals-create') && (
        <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'80px 24px 40px', position:'relative', zIndex:5 }}>
          <style>{`
            @media (max-width: 860px) {
              .create-room-grid {
                grid-template-columns: 1fr !important;
              }
            }
          `}</style>
          <div style={{ width:'100%', maxWidth:1120, animation:'fadeUp .35s ease both' }}>
            <div className="create-room-grid" style={{ display:'grid', gridTemplateColumns: phase === 'rivals-create' ? 'minmax(260px, 0.9fr) minmax(0, 1.1fr)' : 'minmax(280px, 0.85fr) minmax(0, 1.15fr)', gap:24, alignItems:'start' }}>
              <div style={{ border:`1px solid ${BORDER}`, borderRadius:22, padding:'24px clamp(18px,3vw,30px)', background:'linear-gradient(180deg, rgba(13,15,20,0.98), rgba(8,10,14,0.98))' }}>
                <span className="rp-eyebrow">{phase === 'rivals-create' ? 'Create Rivals Room' : 'Create Room'}</span>
                <h1 className="rp-h1" style={{ fontSize:'clamp(2.3rem,6vw,4.6rem)', marginBottom:8 }}>
                  {phase === 'rivals-create' ? <>Set up the<br /><span>duel</span></> : <>Set up your<br /><span>room</span></>}
                </h1>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color:'#a3a9b8', margin:'10px 0 0', lineHeight:1.8, maxWidth:420 }}>
                  {phase === 'rivals-create'
                    ? `${selectedRivalsMatch?.homeTeam || ''} vs ${selectedRivalsMatch?.awayTeam || ''} will be locked in automatically. Invite one friend or keep it public and let another rival join.`
                    : 'Configure your auction room, choose the format, set the squad size, and share the room with up to 10 friends.'}
                </p>
                {phase !== 'rivals-create' && (
                  <div className="create-room-summary-grid">
                    {[
                      { label: 'Visibility', value: isPrivate ? 'Private' : 'Public' },
                      { label: 'Mode', value: String(aMode || 'mega').toLowerCase() === 'mini' ? 'Mini' : 'Mega' },
                      { label: 'Squad', value: `${squadLimit} Players` },
                      { label: 'Purse', value: `₹${squadLimit === 25 ? purse : DEFAULT_PURSE} Cr` },
                    ].map((item) => (
                      <div key={item.label} className="create-room-summary-card">
                        <div className="create-room-summary-label">{item.label}</div>
                        <div className="create-room-summary-value">{item.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ border:`1px solid ${BORDER}`, borderRadius:22, padding:'24px clamp(18px,3vw,30px)', background:'#1a1e28' }}>
                <label className="rp-label" style={{ marginTop:0 }}>Your name</label>
                <input
                  ref={nameRef}
                  className="rp-input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Rahul"
                  maxLength={20}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />

                <label className="rp-label">Visibility</label>
                <div className="rp-toggle-grid">
                  <ToggleCard
                    selected={!isPrivate} onSelect={() => setIsPrivate(false)}
                    accentColor={GOLD} title="Public" sub="Open to all players"
                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>}
                  />
                  <ToggleCard
                    selected={isPrivate} onSelect={() => setIsPrivate(true)}
                    accentColor={GOLD} title="Private" sub="Invite code only"
                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
                  />
                </div>

                {phase !== 'rivals-create' && (
                  <>
                    <label className="rp-label">Auction mode</label>
                    <div className="rp-toggle-grid">
                      <ToggleCard
                        selected={aMode === 'mega'}
                        onSelect={() => { setAMode('mega'); setSquadLimit(15); setPurse(DEFAULT_PURSE); }}
                        accentColor={GOLD}
                        title="Mega"
                        sub="500+ players · Full season"
                      />
                      <ToggleCard
                        selected={aMode === 'mini'}
                        onSelect={() => { setAMode('mini'); setSquadLimit(15); setPurse(DEFAULT_PURSE); }}
                        accentColor={CYAN}
                        title="Mini"
                        sub="~200 players · Fast format"
                      />
                    </div>
                    <label className="rp-label" style={{ marginTop: 16 }}>Squad limit</label>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:10 }}>
                      {[15, 20, 25].map((limit) => (
                        <button
                          key={limit}
                          type="button"
                          onClick={() => {
                            setSquadLimit(limit);
                            if (limit !== 25) setPurse(DEFAULT_PURSE);
                          }}
                          style={{
                            padding:'13px 0',
                            borderRadius:12,
                            border:`1px solid ${squadLimit === limit ? GOLD : '#242936'}`,
                            background:squadLimit === limit ? `${GOLD}12` : '#111',
                            color:squadLimit === limit ? GOLD : '#c9cdd6',
                            fontFamily: 'var(--font-display)',
                            fontSize:24,
                            letterSpacing: 0,
                            cursor:'pointer',
                          }}
                        >
                          {limit}
                        </button>
                      ))}
                    </div>
                    {squadLimit === 25 && (
                      <>
                        <label className="rp-label" style={{ marginTop: 16 }}>Purse</label>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:10 }}>
                          {[DEFAULT_PURSE, EXTENDED_PURSE].map((amount) => (
                            <button
                              key={amount}
                              type="button"
                              onClick={() => setPurse(amount)}
                              style={{
                                padding:'13px 0',
                                borderRadius:12,
                                border:`1px solid ${purse === amount ? GOLD : '#242936'}`,
                                background:purse === amount ? `${GOLD}12` : '#111',
                                color:purse === amount ? GOLD : '#c9cdd6',
                                fontFamily: 'var(--font-display)',
                                fontSize:24,
                                letterSpacing: 0,
                                cursor:'pointer',
                              }}
                            >
                              ₹{amount}CR
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}

                {error && <div className="rp-error">{error}</div>}
                <button className="rp-btn" onClick={phase === 'rivals-create' ? handleCreateRivalsRoom : handleCreate} disabled={loading}>
                  {loading ? (phase === 'rivals-create' ? 'Creating rivals room…' : 'Creating room…') : (phase === 'rivals-create' ? 'Create rivals room' : 'Create room')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ JOIN WITH CODE ══════════ */}
      {phase === 'join-code' && (
        <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'80px 24px 40px', position:'relative', zIndex:5 }}>
          <div style={{ width:'100%', maxWidth:480, animation:'fadeUp .35s ease both' }}>
            <span className="rp-eyebrow">Private room</span>
            <h1 className="rp-h1" style={{ fontSize:'clamp(2rem,7vw,3.8rem)', marginBottom:4 }}>Join with<br /><span>Code</span></h1>
            
            <label className="rp-label">Your name</label>
            <input
              ref={nameRef}
              className="rp-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Rahul"
              maxLength={20}
            />

            <label className="rp-label">Room code</label>
            <input
              className="rp-input code-input"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g. X9QWL"
              maxLength={6}
              onKeyDown={e => e.key === 'Enter' && doJoin(joinCode, 'player')}
            />

            {error && <div className="rp-error">{error}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12 }}>
              <button className="rp-btn cyan-btn" onClick={() => doJoin(joinCode, 'player')} disabled={loading}>
                {loading ? 'Joining…' : 'Play if a slot is open'}
              </button>
              <button className="rp-btn" onClick={() => doJoin(joinCode, 'spectator')} disabled={loading}>
                {loading ? 'Joining…' : 'Watch as spectator'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ JOIN — Browse Live Auction Rooms ══════════ */}
      {phase === 'join' && (
        <BrowseRooms
          name={name}
          setName={setName}
          nameRef={nameRef}
          serverRooms={serverRooms}
          completedRooms={completedRooms}
          fetchRooms={fetchRooms}
          loading={roomsLoading}
          error={error}
          doJoin={doJoin}
          onRequireName={() => setError('Enter your name to join room')}
          onViewCompleted={viewCompletedRoom}
          liveStats={liveStats}
          onBack={() => router.push('/')}
          onCreate={() => setPhase('create-form')}
          TEAMS={TEAMS}
          GOLD={GOLD}
          CYAN={CYAN}
        />
      )}

      {/* ══════════ LOBBY ══════════ */}
      {phase === 'lobby' && roomCode && (
        <div className="lobby-shell" style={{ position:'relative', zIndex:5 }}>

          {/* ── LEFT: Code + Players ── */}
          <div className="lobby-col lobby-col-left">
            <div style={{ animation:'fadeUp .35s ease both' }}>
              {/* Room code */}
              <div className="lobby-section-label">Room code</div>
              <div style={{ marginBottom:10 }}>
                <div className="lobby-code-chip" onClick={copyCode} title="Click to copy code">{roomCode}</div>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
                <button className="lobby-copy-btn" onClick={copyCode}>{copiedCode ? 'Copied' : 'Copy code'}</button>
                <button className="lobby-copy-btn" onClick={copyUrl}>{copiedLink ? 'Copied' : 'Copy link'}</button>
                <a className="lobby-wa-btn"
                   href={`https://wa.me/?text=${encodeURIComponent(`Join my IPL auction\n\nLink: ${shareUrl}\nCode: ${roomCode}`)}`}
                   target="_blank" rel="noreferrer">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 2 }}>
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                  </svg> SHARE
                </a>
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color:'#7a8296', wordBreak:'break-all', marginBottom:20 }}>{shareUrl}</div>

              <div className="rp-hr" />

              {/* Auction mode */}
              {isRivalsLobby ? (
                <div style={{ marginBottom: 18 }}>
                  <div className="lobby-section-label">Rivals match</div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', border:'1px solid #242936', borderRadius:12, background:'#1a1e28' }}>
                    <img src={`/assets/${rivalsHomeTeam}.png`} alt="" style={{ width:32, height:32, objectFit:'contain' }} />
                    <div style={{ fontFamily: 'var(--font-display)', fontSize:24, letterSpacing: 0, color:'#fff' }}>{rivalsHomeTeam} VS {rivalsAwayTeam}</div>
                    <img src={`/assets/${rivalsAwayTeam}.png`} alt="" style={{ width:32, height:32, objectFit:'contain' }} />
                  </div>
                </div>
              ) : isHost ? (
                <>
                  <div className="lobby-section-label">Auction mode</div>
                  <div className="rp-toggle-grid" style={{ marginBottom:20 }}>
                    {MODE_OPTIONS.map(mode => (
                      <ToggleCard
                        key={mode.id}
                        selected={aMode === mode.id}
                        onSelect={() => changeMode(mode.id)}
                        accentColor={mode.accentColor}
                        title={mode.title}
                        eyebrow={mode.eyebrow}
                        sub={mode.sub}
                        chips={mode.chips}
                        footer={mode.footer}
                        modeId={mode.id}
                      />
                      ))}
                  </div>

                  <div className="lobby-section-label">Player ratings</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:8, marginBottom:18 }}>
                    {[
                      { id: 'hidden', label: 'HIDDEN', active: !showPlayerRatings, color: '#a3a9b8' },
                      { id: 'shown', label: 'SHOWN', active: showPlayerRatings, color: GOLD },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => changePlayerRatingsVisibility(option.id === 'shown')}
                        style={{
                          padding:'10px 0',
                          borderRadius:10,
                          border:`1px solid ${option.active ? option.color : '#7a8296'}`,
                          background:option.active ? `${option.color}14` : '#101010',
                          color:option.active ? option.color : '#c9cdd6',
                          fontFamily: 'var(--font-display)',
                          fontSize:20,
                          letterSpacing: 0,
                          cursor:'pointer',
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="lobby-section-label">Squad limit</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:8, marginBottom:18 }}>
                    {[15, 20, 25].map((limit) => (
                      <button
                        key={limit}
                        type="button"
                        onClick={() => changeSquadLimit(limit)}
                        style={{
                          padding:'10px 0',
                          borderRadius:10,
                          border:`1px solid ${squadLimit === limit ? GOLD : '#242936'}`,
                          background:squadLimit === limit ? `${GOLD}14` : '#101010',
                          color:squadLimit === limit ? GOLD : '#c9cdd6',
                          fontFamily: 'var(--font-display)',
                          fontSize:20,
                          letterSpacing: 0,
                          cursor:'pointer',
                        }}
                      >
                        {limit}
                      </button>
                    ))}
                  </div>
                  {squadLimit === 25 && (
                    <>
                      <div className="lobby-section-label">Purse</div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:8, marginBottom:18 }}>
                        {[DEFAULT_PURSE, EXTENDED_PURSE].map((amount) => (
                          <button
                            key={amount}
                            type="button"
                            onClick={() => changePurse(amount)}
                            style={{
                              padding:'10px 0',
                              borderRadius:10,
                              border:`1px solid ${purse === amount ? GOLD : '#242936'}`,
                              background:purse === amount ? `${GOLD}14` : '#101010',
                              color:purse === amount ? GOLD : '#c9cdd6',
                              fontFamily: 'var(--font-display)',
                              fontSize:20,
                              letterSpacing: 0,
                              cursor:'pointer',
                            }}
                          >
                            ₹{amount}CR
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div style={{ fontFamily: 'var(--font-ui)', fontSize:12, color:'#7a8296', marginBottom:16 }}>
                  Mode: <span style={{ color: (lobbyMode || aMode) === 'mega' ? GOLD : CYAN }}>{(lobbyMode || aMode || 'mega') === 'mega' ? 'IPL MEGA Auction' : 'IPL MINI Auction'}</span>
                  <br />
                  Player Ratings: <span style={{ color: showPlayerRatings ? GOLD : '#a3a9b8' }}>{showPlayerRatings ? 'Shown during auction' : 'Hidden during auction'}</span>
                  <br />
                  Squad limit: <span style={{ color: GOLD }}>{squadLimit}</span> players
                  <br />
                  Purse: <span style={{ color: GOLD }}>₹{squadLimit === 25 ? purse : DEFAULT_PURSE} Cr</span>
                </div>
              )}

              <div className="rp-hr" />

              {/* Players */}
              <div className="lobby-section-label">PLAYERS ({lobbyPlayers.length}/{isRivalsLobby ? 2 : 10})</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {lobbyPlayers.map((p, i) => {
                  const team = TEAMS.find(t => t.id === p.teamId);
                  return (
                    <div key={p.id || i} className="lobby-player-row" style={{ animationDelay:`${i * 0.04}s` }}>
                      <div className="lobby-player-dot" style={{ background: team?.color || '#333' }} />
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize:15, color: team?.color || '#c9cdd6', flex:1, letterSpacing: 0 }}>
                        {p.name}
                        {p.isHost && <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color:GOLD, marginLeft:6, letterSpacing: 0 }}>Host</span>}
                        {p.isSpectator && <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color:'#a3a9b8', marginLeft:6, letterSpacing: 0 }}>Spec</span>}
                      </span>
                      {team && (
                        <span className="lobby-player-badge" style={{ background:`${team.color}18`, color:team.color, border:`1px solid ${team.color}50` }}>
                          {team.short}
                        </span>
                      )}
                      {isHost && !p.isHost && (
                        <button
                          type="button"
                          onClick={() => requestKickPlayer(p)}
                          style={{ marginLeft:8, padding:'6px 10px', borderRadius:8, border:'1px solid #7f1d1d', background:'#2a0d0d', color:'#fca5a5', fontSize: 12, fontWeight: 600, letterSpacing: 0, cursor:'pointer' }}
                        >
                          KICK
                        </button>
                      )}
                    </div>
                  );
                })}
                {/* Placeholder slots */}
                {Array.from({ length: Math.max(0, (isRivalsLobby ? 2 : 1) - lobbyPlayers.length) }).map((_, i) => (
                  <div key={`empty-${i}`} style={{ padding:'10px 12px', border:'1px dashed #1a1e28', borderRadius:8, height:42 }} />
                ))}
              </div>
            </div>
          </div>

          {/* ── CENTER: Franchise grid ── */}
          <div className="lobby-col lobby-col-center">
            <div style={{ animation:'fadeUp .4s ease both' }}>
              <div style={{ marginBottom:4 }}>
                <span className="rp-eyebrow" style={{ fontSize: 12 }}>Lobby · {roomCode}</span>
              </div>
              {isRivalsLobby ? (
                <>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize:'clamp(1.6rem,4vw,2.8rem)', color:'#fff', letterSpacing: 0, marginBottom:6 }}>
                    RIVALS <span style={{ color:GOLD }}>Showdown</span>
                  </h2>
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color:'#7a8296', marginBottom:24, lineHeight:1.6 }}>
                    Teams are assigned automatically for this 1v1 match. Once the second player joins, the duel starts immediately.
                    {myTeamId && <span style={{ color:GOLD }}> You are playing as <strong>{TEAMS.find(t=>t.id===myTeamId)?.name}</strong>.</span>}
                  </p>

                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:16 }}>
                    {[rivalsHomeTeam, rivalsAwayTeam].map((teamId) => {
                      const team = TEAMS.find((entry) => entry.id === teamId);
                      const owner = takenMap[teamId];
                      const isMine = myTeamId === teamId;
                      return (
                        <div key={teamId} style={{
                          border:`1px solid ${team?.color || '#333'}40`,
                          background: '#11141c',
                          borderRadius:18,
                          padding:'18px 16px',
                          boxShadow:'none'
                        }}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:14 }}>
                            <img src={`/assets/${teamId}.png`} alt={team?.short} style={{ width:48, height:48, objectFit:'contain' }} />
                            {isMine && <div style={{ fontSize: 12, letterSpacing: 0, color:team?.color, fontWeight: 600 }}>Your team</div>}
                          </div>
                          <div style={{ color:team?.color, fontFamily: 'var(--font-display)', fontSize:28, letterSpacing: 0 }}>{team?.short}</div>
                          <div style={{ color:'#fff', fontSize:14, marginTop:4 }}>{team?.name}</div>
                          <div style={{ color:'#a3a9b8', fontSize: 12, marginTop:12, letterSpacing: 0 }}>
                            {owner ? `Assigned to ${owner}` : 'Waiting for rival'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize:'clamp(1.6rem,4vw,2.8rem)', color:'#fff', letterSpacing: 0, marginBottom:6 }}>
                    Pick your franchise
                  </h2>
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color:'#7a8296', marginBottom:24, lineHeight:1.6 }}>
                    Select the IPL team you want to bid for. Each franchise can only be claimed by one player.
                    {myTeamId && <span style={{ color:GOLD }}> You picked <strong>{TEAMS.find(t=>t.id===myTeamId)?.name}</strong>.</span>}
                  </p>

                  <div className="franchise-grid">
                    {TEAMS.map(t => {
                      const isMine  = t.id === myTeamId;
                      const takenBy = takenMap[t.id];
                      const taken   = !!takenBy && !isMine;
                      let cls = 'franchise-tile';
                      if (isMine)  cls += ' ft-mine';
                      if (taken)   cls += ' ft-taken';

                      return (
                        <div
                          key={t.id}
                          className={cls}
                          style={{
                            borderColor: isMine ? t.color : taken ? '#1a1e28' : '#7a8296',
                            background: isMine
                              ? `linear-gradient(160deg, ${t.color}18, ${t.color}08)`
                              : taken ? '#0a0a0a' : `${t.color}06`,
                            boxShadow: isMine ? `0 0 0 transparent, inset 0 0 0 transparent` : 'none',
                          }}
                          onClick={() => !taken && selectTeam(t.id)}
                        >
                          {taken && <div className="taken-overlay" />}
                          <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background: isMine ? t.color : `${t.color}40`, borderRadius:'8px 8px 0 0' }} />
                          <img
                            className="franchise-logo"
                            src={TEAM_LOGOS[t.id]}
                            alt={`${t.name} logo`}
                            loading="lazy"
                          />
                          <div className="franchise-short" style={{ color: isMine ? t.color : taken ? '#7a8296' : t.color }}>
                            {t.short}
                          </div>
                          <div className="franchise-name" style={{ color: isMine ? '#dbe5f1' : taken ? '#a3a9b8' : '#a3a9b8' }}>
                            {t.name}
                          </div>

                          {isMine && (
                            <div className="franchise-mine-badge" style={{ color: t.color, marginTop:4 }}>
                              Your pick
                            </div>
                          )}
                          {taken && (
                            <div className="franchise-mine-badge" style={{ color:'#a3a9b8', marginTop:4 }}>
                              TAKEN
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {error && <div className="rp-error" style={{ marginTop:16 }}>{error}</div>}
            </div>
          </div>

          {/* ── RIGHT: Live stats ── */}
          <div className="lobby-col lobby-col-right">
            <div style={{ animation:'fadeUp .45s ease both' }}>
              <div className="lobby-section-label">Lobby stats</div>

              <div className="lobby-stat-card">
                <div className="lobby-stat-val" style={{ color:GOLD }}>
                  {lobbyPlayers.filter(p => p.teamId).length}/{isRivalsLobby ? 2 : lobbyPlayers.length}
                </div>
                <div className="lobby-stat-lbl">{isRivalsLobby ? 'Rivals ready' : 'Players with team'}</div>
              </div>

              <div className="lobby-stat-card">
                <div className="lobby-stat-val" style={{ color:CYAN }}>
                  {Math.max(0, (isRivalsLobby ? 2 : 10) - lobbyPlayers.length)}
                </div>
                <div className="lobby-stat-lbl">{isRivalsLobby ? 'Duel slots left' : 'Slots remaining'}</div>
              </div>

              <div className="lobby-stat-card">
                <div className="lobby-stat-val" style={{ color:GREEN }}>
                  {isRivalsLobby
                    ? (multiGS ? 'LIVE' : lobbyPlayers.length >= 2 ? 'STARTING' : 'MATCHING')
                    : (lobbyPlayers.length >= 1 && lobbyPlayers.every(p => p.teamId) ? 'READY' : 'WAITING')}
                </div>
                <div className="lobby-stat-lbl">Room status</div>
              </div>

              <div className="rp-hr" />

              {/* Claimed franchises summary */}
              <div className="lobby-section-label">Claimed franchises</div>
              {Object.entries(takenMap).length === 0 ? (
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color:'#7a8296', lineHeight:1.8 }}>
                  {isRivalsLobby ? 'Waiting for the first team assignment to appear.' : <>No franchise selected yet.<br />Be the first!</>}
                </div>
              ) : (
                TEAMS.filter(t => takenMap[t.id]).map(t => (
                  <div key={t.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, padding:'8px 12px', background:`${t.color}08`, border:`1px solid ${t.color}25`, borderRadius:6 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:t.color, flexShrink:0 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize:'1rem', color:t.color, letterSpacing: 0 }}>{t.short}</div>
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color:'#7a8296' }}>{takenMap[t.id]}</div>
                    </div>
                  </div>
                ))
              )}

              {/* ── Desktop Lobby Chat ── */}
              <div className="lc-panel">
                <LobbyChatBox
                  chatLog={chatLog}
                  emit={emit}
                  roomCode={roomCode}
                  myName={myName}
                  isSpectator={isSpectator}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Chat FAB + Drawer (lobby only) ── */}
      {phase === 'lobby' && roomCode && (
        <>
          <button
            className="lc-fab"
            onClick={() => setShowLobbyChatMobile(v => !v)}
            aria-label="Open lobby chat"
            aria-label="Open lobby chat"
          >
            <MessageSquare size={18} strokeWidth={1.5} />
          </button>
          {showLobbyChatMobile && (
            <>
              <div className="lc-drawer-bg" onClick={() => setShowLobbyChatMobile(false)} />
              <div className="lc-drawer">
                <div className="lc-drawer-header">
                  <span className="lc-drawer-title">Lobby chat</span>
                  <button className="lc-drawer-close" onClick={() => setShowLobbyChatMobile(false)} aria-label="Close chat"><X size={16} strokeWidth={1.5} /></button>
                </div>
                <LobbyChatBox
                  chatLog={chatLog}
                  emit={emit}
                  roomCode={roomCode}
                  myName={myName}
                  isSpectator={isSpectator}
                />
              </div>
            </>
          )}
        </>
      )}

      {/* ── Fixed bottom start bar (lobby only) ── */}
      {phase === 'lobby' && (
        <div className="lobby-bottom-bar">
          {isRivalsLobby ? (
            <div style={{ display:'flex', flexDirection:'column', gap:10, width:'100%', alignItems:'center' }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color:'#7a8296', letterSpacing: 0, textAlign:'center' }}>
                {multiGS
                  ? 'Both rivals are locked in. Enter the auction room.'
                  : lobbyPlayers.length >= 2
                    ? 'Second player joined. Starting the Rivals auction...'
                    : isHost
                      ? 'Room created. Share the code or wait while we find another rival.'
                      : 'You are in. Waiting for the duel to begin...'}
              </span>
              {multiGS ? (
                <button
                  className="lobby-start-btn"
                  onClick={() => router.push(`/auction?room=${roomCode}${isSpectator?'&spectator=1':''}&mode=RIVALS`)}
                >
                  Enter auction
                </button>
              ) : (
                <div className="lobby-waiting">
                  {isHost ? '⏳ Waiting for one more rival…' : '⏳ Matching both rivals…'}
                </div>
              )}
            </div>
          ) : isHost ? (
            <>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color:'#7a8296', letterSpacing: 0 }}>
                {multiGS ? 'Auction is ongoing' : (canStart ? 'Ready to go!' : 'Waiting for players…')}
              </span>
              <button
                className="lobby-start-btn"
                onClick={multiGS ? () => router.push(`/auction?room=${roomCode}`) : handleStart}
                disabled={!multiGS && !canStart}
              >
                {multiGS ? 'Enter auction' : 'Start auction'}
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', alignItems: 'center' }}>
               {!myTeamId ? (
                 <div className="lobby-waiting">⏳ Select your franchise to join the auction…</div>
               ) : !multiGS ? (
                 <div className="lobby-waiting">⏳ Host will start the auction once everyone is ready…</div>
               ) : (
                 <button
                   className="lobby-start-btn"
                   onClick={() => router.push(`/auction?room=${roomCode}${isSpectator?'&spectator=1':''}`)}
                 >
                   Enter auction
                 </button>
               )}
            </div>
          )}
        </div>
      )}

      {/* Marquee - hidden during lobby to make room for bottom bar */}
      {phase !== 'lobby' && (
        <div className="rp-marquee-container">
          <div className="rp-marquee-track">
            {TEAMS.map((t, i) => (
              <div
                key={`${t.id}-${i}`}
                className="rp-marquee-item"
                title={t.name}
              >
                <img className="rp-marquee-logo" src={TEAM_LOGOS[t.id]} alt={`${t.name} logo`} loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default function RoomPage() {
  return (
    <Suspense fallback={<div style={{ background:'#0b0d14', height:'100vh' }} />}>
      <RoomContent />
    </Suspense>
  );
}
