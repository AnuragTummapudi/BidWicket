import { useState, useEffect, useRef, useReducer, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { MEGA_SETS, PLAYER_IMAGES } from "./megaPlayers";

import Anthropic from "@anthropic-ai/sdk";
const CLAUDE_API_KEY = import.meta.env.VITE_CLAUDE_API_KEY || "";
import { useSocket, playPulse, playSaleSound } from "./useSocket";
import { PlayModeScreen, RoomScreen, LobbyScreen, TEAMS, ROLE_C, ROLE_L, ROLE_EMOJI, GOLD, BG, CARD, BORDER } from "./MultiScreens";
import { StatsModal } from "./StatsModal";
import { SquadModal } from "./SquadModal";
import confetti from "canvas-confetti";
import html2canvas from "html2canvas";
import iplThemeSrc from "./assets/Ipl.mp3";
import tataIplLogo from "./assets/TataIPL.png";
import boultImg from "./assets/Boult.avif";
import kohliImg from "./assets/Kohli.avif";

// ─── Global IPL Audio ───────────────────────────────────────────────────────
let _iplAudio = null;
function playIplTheme() {
  if (_iplAudio) { _iplAudio.pause(); _iplAudio.currentTime = 0; }
  _iplAudio = new Audio(iplThemeSrc);
  _iplAudio.volume = 0.7;
  _iplAudio.play().catch(() => { });
}
function stopIplTheme(fadeDuration = 2000) {
  if (!_iplAudio) return;
  const a = _iplAudio;
  const step = a.volume / (fadeDuration / 50);
  const fade = setInterval(() => {
    if (a.volume > step) { a.volume = Math.max(0, a.volume - step); }
    else { a.pause(); a.currentTime = 0; clearInterval(fade); }
  }, 50);
}

if (typeof document !== "undefined" && !document.getElementById("ipl-gf")) {
  const l = document.createElement("link"); l.id = "ipl-gf"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@400;500;600;700&family=Barlow+Condensed:wght@300;400;600;700;900&display=swap";
  document.head.appendChild(l);
}




// ── Mini Auction: Build 200-player pool from ALL MEGA_SETS categories ─────────
function buildMiniPlayers() {
  // Collect all players from MEGA_SETS grouped by role
  const byRole = { BAT: [], BOWL: [], AR: [], WK: [] };
  for (const set of MEGA_SETS) {
    for (const player of set.players) {
      if (byRole[player.role]) byRole[player.role].push({ ...player, setName: "Mini Auction" });
    }
  }

  // Sort each role pool: highest base first (priority players appear first)
  for (const role in byRole) byRole[role].sort((a, b) => b.base - a.base);

  // Target counts per role to reach ~270 players
  // BAT:70, BOWL:90, AR:75, WK:35  → total 270
  const targets = { BAT: 70, BOWL: 90, AR: 75, WK: 35 };

  const pool = [];
  for (const role in targets) {
    const available = byRole[role];
    const count = Math.min(targets[role], available.length);
    pool.push(...available.slice(0, count));
  }

  return pool;
}

const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0;[a[i], a[j]] = [a[j], a[i]]; } return a; };
const getIncrement = p => p < 2 ? 0.10 : p < 5 ? 0.20 : p < 10 ? 0.25 : 0.50;
const fmt = c => c >= 1 ? `₹${c.toFixed(2)} Cr` : `₹${Math.round(c * 100)} L`;
const nextBid = c => +(c + getIncrement(c)).toFixed(2);

function buildQueue(mode) {
  if (mode === "mini") {
    const miniPool = buildMiniPlayers();
    return shuffle(miniPool).map((p, i) => ({ ...p, id: i, setName: p.setName || "Mini Auction" }));
  }
  const queue = [];
  for (const set of MEGA_SETS) {
    const s = shuffle(set.players);
    s.forEach((p, i) => queue.push({ ...p, id: queue.length + i, setName: set.name }));
  }
  return queue;
}

function initGame(myTeamId, mode) {
  const queue = buildQueue(mode);
  return {
    myTeamId, mode, playerQueue: queue, currentIdx: 0,
    currentBid: queue[0].base, currentBidder: null,
    timer: 10, phase: "bidding", currentSetName: queue[0].setName,
    purses: Object.fromEntries(TEAMS.map(t => [t.id, 120])),
    squads: Object.fromEntries(TEAMS.map(t => [t.id, []])),
    bidLog: [], auctionLog: [],
  };
}

export default function App() {
  const [screen, setScreen] = useState("home");
  const [auctionMode, setAuctionMode] = useState(null);
  const [playMode, setPlayMode] = useState(null); // "single" | "multi"
  const g = useRef(null);
  const intervalRef = useRef(null);
  const tickRef = useRef(null);
  const [, forceUpdate] = useReducer(x => x + 1, 0);
  const prevTimerRef = useRef(10);

  // Multiplayer state
  const { emit, on } = useSocket();
  const [roomCode, setRoomCode] = useState(null);
  const [lobbyPlayers, setLobbyPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [myName, setMyName] = useState("");
  const [lobbyMode, setLobbyMode] = useState(null);
  const [myTeamId, setMyTeamId] = useState(null);
  const [showSquad, setShowSquad] = useState(false);
  const [viewingTeam, setViewingTeam] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [multiGS, setMultiGS] = useState(null);

  const [playerId] = useState(() => {
    const saved = localStorage.getItem("ipl_player_id");
    if (saved) return saved;
    const n = uuidv4();
    localStorage.setItem("ipl_player_id", n);
    return n;
  });

  // Auto-Rejoin Logic (Multi & Single)
  useEffect(() => {
    const savedPlayMode = localStorage.getItem("ipl_play_mode");

    if (savedPlayMode === "multi") {
      const savedRoom = localStorage.getItem("ipl_room_code");
      const savedName = localStorage.getItem("ipl_player_name");

      if (savedRoom && savedName) {
        setRoomCode(savedRoom);
        setMyName(savedName);
        setPlayMode("multi");

        emit("join-room", { code: savedRoom, playerName: savedName, playerId }, (res) => {
          if (res.ok) {
            setLobbyPlayers(res.players);
            setIsHost(res.hostId === playerId);
            if (res.auctionMode) setLobbyMode(res.auctionMode);

            if (res.roomStatus === "active") {
              setMultiGS(res.gameState);
              setScreen("auction");
            } else if (res.roomStatus === "finished") {
              setMultiGS(res.gameState);
              setScreen("results");
            } else {
              setScreen("lobby");
            }
          } else {
            localStorage.removeItem("ipl_room_code");
            localStorage.removeItem("ipl_play_mode");
          }
        });
      }
    } else if (savedPlayMode === "single") {
      const savedGS = localStorage.getItem("ipl_single_gs");
      const savedScreen = localStorage.getItem("ipl_single_screen");
      const savedMode = localStorage.getItem("ipl_auction_mode");
      const savedTeamId = localStorage.getItem("ipl_my_team_id");

      if (savedGS && savedScreen) {
        try {
          const parsedGS = JSON.parse(savedGS);
          g.current = parsedGS;
          setPlayMode("single");
          setAuctionMode(savedMode);
          setMyTeamId(savedTeamId);
          setScreen(savedScreen);

          if (savedScreen === "auction") {
            clearInterval(intervalRef.current);
            intervalRef.current = setInterval(() => tickRef.current?.(), 1000);
          }
        } catch (e) {
          console.error("Failed to restore single player session", e);
        }
      }
    }
  }, [emit, playerId]);

  // Persist Single Player State
  useEffect(() => {
    if (playMode === "single" && g.current) {
      localStorage.setItem("ipl_play_mode", "single");
      localStorage.setItem("ipl_single_gs", JSON.stringify(g.current));
      localStorage.setItem("ipl_single_screen", screen);
      localStorage.setItem("ipl_auction_mode", auctionMode);
      localStorage.setItem("ipl_my_team_id", myTeamId);
    }
  }, [playMode, screen, auctionMode, myTeamId, multiGS]); // using multiGS as a proxy for 'tick' forceUpdates if needed, but actually g.current update is manual. 



  // Socket listeners for multiplayer
  useEffect(() => {
    if (playMode !== "multi") return;
    const off1 = on("lobby-update", ({ players, auctionMode: m }) => {
      setLobbyPlayers(players);
      if (m) setLobbyMode(m);
    });
    const off2 = on("game-started", (gs) => {
      setMultiGS(gs);
      setScreen("auction");
    });
    const off3 = on("game-state", (gs) => {
      setMultiGS(gs);
    });
    const off4 = on("game-over", (gs) => {
      setMultiGS(gs);
      setScreen("results");
    });
    return () => { off1(); off2(); off3(); off4(); };
  }, [playMode, on]);

  // Unified Audio & Animation side-effects
  useEffect(() => {
    const currentGS = isMulti ? multiGS : g.current;
    if (!currentGS) return;

    // Timer Pulse (Heartbeat) for last 5 seconds
    if (currentGS.timer <= 5 && currentGS.timer > 0 && currentGS.phase === "bidding") {
      playPulse();
    }

    // Phase Transitions (Sale Sound only)
    if (currentGS.phase === "sold" || currentGS.phase === "unsold") {
      if (prevTimerRef.current !== currentGS.phase) {
        playSaleSound(currentGS.phase === "sold");
      }
    }
    prevTimerRef.current = currentGS.phase;
  }, [multiGS?.timer, multiGS?.phase, g.current?.timer, g.current?.phase]);

  function syncSingleGS() {
    if (playMode === "single" && g.current) {
      localStorage.setItem("ipl_single_gs", JSON.stringify(g.current));
      localStorage.setItem("ipl_single_screen", screen);
    }
  }



  // ─── Single Player Logic ───
  function advanceToNext() {
    const gs = g.current; if (!gs) return;
    const next = gs.currentIdx + 1;
    if (next >= gs.playerQueue.length) { setScreen("results"); return; }
    gs.currentIdx = next;
    const np = gs.playerQueue[next];
    gs.currentBid = np.base; gs.currentBidder = null;
    gs.timer = 10; gs.phase = "bidding"; gs.bidLog = [];
    gs.currentSetName = np.setName;
    syncSingleGS();
    forceUpdate();
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => tickRef.current?.(), 1000);
  }

  function finishCurrent() {
    const gs = g.current; if (!gs || gs.phase !== "bidding") return;
    clearInterval(intervalRef.current);
    gs.phase = gs.currentBidder ? "sold" : "unsold";
    const player = gs.playerQueue[gs.currentIdx];
    if (gs.currentBidder) {
      gs.purses[gs.currentBidder] = +(gs.purses[gs.currentBidder] - gs.currentBid).toFixed(2);
      gs.squads[gs.currentBidder] = [...gs.squads[gs.currentBidder], { ...player, soldFor: gs.currentBid }];
      gs.auctionLog = [{ player, bidder: gs.currentBidder, price: gs.currentBid, sold: true }, ...gs.auctionLog];
    } else {
      gs.auctionLog = [{ player, bidder: null, price: 0, sold: false }, ...gs.auctionLog];
    }
    syncSingleGS();
    forceUpdate();
    setTimeout(advanceToNext, 2800);
  }

  function tick() {
    const gs = g.current; if (!gs || gs.phase !== "bidding") return;
    gs.timer--;
    if (gs.timer <= 5 && gs.timer > 0) playPulse();
    if (gs.timer <= 0) finishCurrent(); else forceUpdate();
  }
  tickRef.current = tick;

  function humanBid() {
    if (playMode === "multi") {
      emit("place-bid", {}, (res) => { /* handled by game-state event */ });
      return;
    }
    const gs = g.current; if (!gs || gs.phase !== "bidding") return;
    if (gs.currentBidder === gs.myTeamId) return;
    const nb = gs.currentBidder === null ? gs.currentBid : nextBid(gs.currentBid);
    const osCount = gs.squads[gs.myTeamId].filter(p => p.overseas).length;
    const playerOnAuction = gs.playerQueue[gs.currentIdx];
    const maxSquadSize = (gs.playerQueue?.length || 0) <= 200 ? 15 : 25;
    if (gs.purses[gs.myTeamId] < nb || gs.squads[gs.myTeamId].length >= maxSquadSize || (playerOnAuction.overseas && osCount >= 8)) return;
    gs.currentBid = nb; gs.currentBidder = gs.myTeamId; gs.timer = 10;
    gs.bidLog = [{ teamId: gs.myTeamId, bid: nb, isMe: true }, ...gs.bidLog].slice(0, 7);
    syncSingleGS();
    forceUpdate();
  }

  function startSingleAuction(tId) {
    const queue = buildQueue(auctionMode);
    setPlayMode("single");
    setMyTeamId(tId);
    g.current = {
      ...createGameState(queue),
      myTeamId: tId,
      playingXI: Object.fromEntries(TEAMS.map(t => [t.id, []])),
      selections: Object.fromEntries(TEAMS.map(t => [t.id, false]))
    };
    // Fade out IPL theme 2s before auction starts
    stopIplTheme(2000);
    setTimeout(() => {
      setScreen("auction");
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => tickRef.current?.(), 1000);
    }, 2000);
  }

  function submitXI(players) {
    if (playMode === "multi") {
      emit("submit-xi", { players }, (res) => {
        if (!res?.ok) alert(res?.error || "Submission failed");
      });
    } else {
      // Single player XI submission
      g.current.playingXI[effectiveMyTeamId] = players;
      g.current.selections[effectiveMyTeamId] = true;

      // AI teams pick top 11 automatically
      TEAMS.forEach(t => {
        if (t.id !== effectiveMyTeamId) {
          g.current.playingXI[t.id] = [...(g.current.squads[t.id] || [])]
            .sort((a, b) => b.soldFor - a.soldFor)
            .slice(0, 11);
          g.current.selections[t.id] = true;
        }
      });

      g.current.phase = "finished";
      syncSingleGS();
      setScreen("auction"); // Trigger re-render
    }
  }

  const handleCreateRoom = (isPrivate, name) => {
    emit("create-room", { playerName: name, isPrivate, playerId }, (res) => {
      localStorage.setItem("ipl_room_code", res.code);
      localStorage.setItem("ipl_player_name", name);
      localStorage.setItem("ipl_play_mode", "multi");

      setRoomCode(res.code);
      setIsHost(true);
      setMyName(name);
      setLobbyPlayers(res.players);
      setScreen("lobby");
    });
  };

  const handleJoinRoom = (code, name) => {
    emit("join-room", { code, playerName: name, playerId }, (res) => {
      if (res.ok) {
        localStorage.setItem("ipl_room_code", code);
        localStorage.setItem("ipl_player_name", name);
        localStorage.setItem("ipl_play_mode", "multi");

        setRoomCode(res.code || code);
        setMyName(name);
        setLobbyPlayers(res.players);
        setScreen("lobby");
      } else {
        alert(res.error || "Failed to join room");
      }
    });
  };

  function startMultiAuction() {
    const queue = buildQueue(lobbyMode || "mega");
    // Fade out IPL theme before multiplayer auction starts
    stopIplTheme(2000);
    emit("start-game", { playerQueue: queue }, (res) => {
      if (!res?.ok) alert(res?.error || "Cannot start");
    });
  }

  useEffect(() => () => clearInterval(intervalRef.current), []);

  // ─── Determine data source ───
  const gs = playMode === "multi" ? multiGS : g.current;
  const isMulti = playMode === "multi";


  // Audio and Confetti for sold
  useEffect(() => {
    if (gs?.phase === "sold") {
      // Fire confetti from bottom left and bottom right
      const duration = 2000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 5, angle: 60, spread: 55, origin: { x: 0, y: 0.9 },
          colors: ['#D4AF37', '#ffffff', '#a3a9b8']
        });
        confetti({
          particleCount: 5, angle: 120, spread: 55, origin: { x: 1, y: 0.9 },
          colors: ['#D4AF37', '#ffffff', '#a3a9b8']
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [gs?.phase, gs?.currentIdx]);

  const progresses = useMemo(() => {
    const maxPurse = 120;
    const p = {};
    TEAMS.forEach(team => {
      p[team.id] = (gs?.purses?.[team.id] || 0) / maxPurse;
    });
    return p;
  }, [gs?.purses]);

  // ─── Screen Routing ───
  if (screen === "home") return <Home onPlay={() => { playIplTheme(); setScreen("modeSelect"); }} onCreateRoom={() => { setPlayMode("multi"); setScreen("roomScreen"); }} onJoinRoom={() => { setPlayMode("multi"); setScreen("roomScreen"); }} />;

  if (screen === "modeSelect") return <ModeSelect onSelect={m => { setAuctionMode(m); setScreen("playMode"); }} />;

  if (screen === "playMode") return <PlayModeScreen onSingle={() => { setPlayMode("single"); setScreen("teamSelect"); }} onMulti={() => { setPlayMode("multi"); setScreen("roomScreen"); }} />;
  if (screen === "roomScreen") return <RoomScreen emit={emit} playerId={playerId} onJoined={({ code, players, isHost: h, myName: n, roomStatus, gameState, auctionMode: resMode }) => {
    setRoomCode(code);
    setLobbyPlayers(players);
    setIsHost(h);
    setMyName(n);

    if (resMode) setLobbyMode(resMode);

    if (roomStatus === "active") {
      setMultiGS(gameState);
      setScreen("auction");
    } else if (roomStatus === "finished") {
      setMultiGS(gameState);
      setScreen("results");
    } else {
      setScreen("lobby");
    }
  }} />;
  if (screen === "lobby") return <LobbyScreen roomCode={roomCode} players={lobbyPlayers} isHost={isHost} auctionMode={lobbyMode} emit={emit} onModeSelect={m => { setLobbyMode(m); emit("set-auction-mode", { mode: m }); }} onStart={startMultiAuction} />;
  if (screen === "teamSelect") return <TeamSelect onSelect={startSingleAuction} mode={auctionMode} />;

  if (!gs) return null;

  const effectiveMyTeamId = isMulti ? (lobbyPlayers.find(p => p.name === myName)?.teamId || myTeamId) : (g.current?.myTeamId || myTeamId);

  // New Selection Phase
  if (gs.phase === "selection") {
    const mySquad = gs.squads[effectiveMyTeamId] || [];
    const submitted = isMulti ? gs.selections[effectiveMyTeamId] : false;
    return <SelectionScreen mySquad={mySquad} onSubmit={submitXI} submitted={submitted} playersNeeded={11} />;
  }

  if (gs.phase === "finished") {
    return <Results gs={gs} myTeamId={effectiveMyTeamId} onRestart={() => {
      ["ipl_room_code", "ipl_play_mode", "ipl_single_gs", "ipl_single_screen", "ipl_auction_mode", "ipl_my_team_id"].forEach(k => localStorage.removeItem(k));
      clearInterval(intervalRef.current);
      g.current = null;
      setMultiGS(null);
      setPlayMode(null);
      setAuctionMode(null);
      setLobbyMode(null);
      setScreen("home");
      window.location.reload();
    }} />;
  }

  const player = gs.playerQueue[gs.currentIdx];
  const myTeam = TEAMS.find(t => t.id === effectiveMyTeamId);
  const bidderTeam = gs.currentBidder ? TEAMS.find(t => t.id === gs.currentBidder) : null;
  const osCount = (gs.squads[effectiveMyTeamId] || []).filter(p => p.overseas).length;
  const maxSquadSize = (gs.playerQueue?.length || 0) <= 200 ? 15 : 25;
  const canBid = gs.phase === "bidding" && gs.currentBidder !== effectiveMyTeamId
    && (gs.purses[effectiveMyTeamId] || 0) >= (gs.currentBidder === null ? gs.currentBid : nextBid(gs.currentBid))
    && (gs.squads[effectiveMyTeamId]?.length || 0) < maxSquadSize && (!player.overseas || osCount < 8);
  const iLeading = gs.currentBidder === effectiveMyTeamId;
  const upcoming = gs.playerQueue.slice(gs.currentIdx + 1, gs.currentIdx + 9);

  return (
    <div style={{ fontFamily: 'var(--font-ui)', background: BG, color: "#fff", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @keyframes sold{0%{transform:scale(0.4);opacity:0}65%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
        @keyframes timerPulse{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes rowIn{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:3px;background:transparent}
        ::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:2px}
        button{transition:filter .15s,transform .15s!important}
        button:hover:not(:disabled){filter:brightness(1.18)!important;transform:translateY(-1px)!important}
        .ipl-topbar{padding:6px 14px!important}
        .ipl-topbar-title{font-size:clamp(14px,1.5vw,22px)!important}
        .ipl-topbar-timer{font-size:clamp(26px,3vw,40px)!important;min-width:40px!important}
        .ipl-left{width:clamp(180px,18vw,264px)!important;padding:10px!important}
        .ipl-right{width:clamp(150px,16vw,240px)!important}
        .ipl-center{padding:12px 10px!important}
        .ipl-sold-text{font-size:clamp(48px,7vw,86px)!important}
        .ipl-bid-amount{font-size:clamp(40px,6vw,72px)!important}
        .ipl-bid-btn{padding:12px 24px!important;font-size:clamp(13px,1.4vw,19px)!important}
        .ipl-ticker{padding:5px 12px!important}
        @media(max-width:900px){.ipl-left,.ipl-right{display:none!important}.ipl-center{padding:10px 8px!important}.ipl-topbar{flex-wrap:wrap;gap:4px}}
      `}</style>

      <SquadModal isOpen={showSquad} onClose={() => { setShowSquad(false); setViewingTeam(null); }} squads={gs.squads} myTeamId={viewingTeam || effectiveMyTeamId} TEAMS={TEAMS} />
      <StatsModal isOpen={showStats} gs={gs} onClose={() => setShowStats(false)} />

      {/* TOP BAR */}
      <div className="ipl-topbar" style={{ background: "linear-gradient(90deg,#0B0D16 0%,#141008 50%,#0B0D16 100%)", borderBottom: `1px solid ${BORDER}`, padding: "8px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="ipl-topbar-title" style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: GOLD, letterSpacing: 0 }}>Bidwicket IPL auction</div>

          <div style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}30`, borderRadius: 4, padding: "2px 10px", fontSize: 10, color: GOLD, fontWeight: 600, letterSpacing: 0 }}>{gs.currentSetName}</div>
          {isMulti && <div style={{ background: "#22D3EE18", border: "1px solid #22D3EE30", borderRadius: 4, padding: "2px 8px", fontSize: 9, color: '#a3a9b8', letterSpacing: 0 }}>Live</div>}
          <button onClick={() => setShowStats(true)} style={{ background: `${GOLD}11`, border: `1px solid ${GOLD}40`, color: GOLD, padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, letterSpacing: 0, cursor: "pointer", marginLeft: 8 }}>Stats</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#444", fontSize: 11, letterSpacing: 0 }}>Player</span>
          <span style={{ color: "#aaa", fontWeight: 600, fontSize: 14 }}>{gs.currentIdx + 1} / {gs.playerQueue.length}</span>

          {/* HOST CONTROLS */}
          {isMulti && isHost && (
            <div style={{ display: "flex", gap: 6, marginLeft: 16, borderLeft: `1px solid ${BORDER}`, paddingLeft: 16 }}>
              {isHost && (
                <>
                  <button onClick={() => gs.isPaused ? emit("resume-game") : emit("pause-game")} style={{ background: "transparent", border: "1px solid #FFCA28", borderRadius: 4, color: "#FFCA28", padding: "4px 12px", cursor: "pointer", fontWeight: "bold" }}>
                    {gs.isPaused ? "RESUME" : "PAUSE"}
                  </button>
                  <button onClick={() => {
                    if (window.confirm("Are you sure you want to end the auction early?")) {
                      emit("end-game");
                    }
                  }} style={{ background: "transparent", border: "1px solid #ef4444", borderRadius: 4, color: "#ef4444", padding: "4px 12px", cursor: "pointer", fontWeight: "bold" }}>
                    END
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => { setViewingTeam(effectiveMyTeamId); setShowSquad(true); }} style={{ background: "#22D3EE22", color: '#a3a9b8', border: "1px solid #22D3EE55", borderRadius: 6, padding: "6px 16px", cursor: "pointer", fontWeight: "bold", fontFamily: 'var(--font-display)', fontSize: 16, letterSpacing: 0 }}>
            MY SQUAD
          </button>
          <button onClick={() => setShowStats(true)} style={{ background: `${GOLD}11`, border: `1px solid ${GOLD}40`, color: GOLD, padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, letterSpacing: 0, cursor: "pointer" }}>📊 Stats</button>
        </div>

        <div className="ipl-topbar-timer" style={{
          fontFamily: 'var(--font-display)', fontSize: 40, letterSpacing: 0, minWidth: 56, textAlign: "center", lineHeight: 1,
          color: gs.isPaused ? "#888" : (gs.timer <= 5 ? "#ef4444" : GOLD),
          textShadow: gs.isPaused ? "none" : (gs.timer <= 5 ? "0 0 0 transparent" : `0 0 0 transparent`),
          animation: !gs.isPaused && gs.timer <= 5 ? "timerPulse .5s infinite" : "none",
        }}>
          {gs.isPaused ? "PAUSE" : String(gs.timer).padStart(2, "0")}

          {/* Host Timer Editor */}
          {isHost && isMulti && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
              <button
                onClick={() => {
                  const curr = gs.timerDuration || 10;
                  const val = prompt("Set new bid timer duration (5 to 60 seconds):", curr);
                  if (val && !isNaN(val)) emit("set-timer-duration", { duration: parseInt(val) });
                }}
                style={{ background: "#111", border: `1px solid #333`, color: "#888", fontSize: 10, padding: "2px 6px", borderRadius: 4, cursor: "pointer", fontFamily: 'var(--font-ui)', letterSpacing: 0 }}
                title="Edit Timer Length"
              >
                EDIT TIMER ⏱
              </button>
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: myTeam?.color, boxShadow: `0 0 0 transparent` }} />
          <span style={{ color: "#fff", fontWeight: 600, letterSpacing: 0, fontSize: 16 }}>{myTeam?.short} ★</span>
          <span style={{ color: GOLD, fontSize: 14, fontWeight: 600, textShadow: 'none' }}>₹{(gs.purses[effectiveMyTeamId] || 0).toFixed(1)} Cr <span style={{ color: "#555", fontSize: 11, fontWeight: 400 }}>· {gs.squads[effectiveMyTeamId]?.length || 0} pl</span></span>
        </div>
      </div>

      {/* MAIN BODY */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div className="ipl-left" style={{ width: 300, padding: "20px 14px", borderRight: `1px solid ${BORDER}`, overflowY: "auto", flexShrink: 0, background: `linear-gradient(180deg, ${CARD}, transparent)` }}>
          <div style={{ textAlign: "center", animation: "fadeUp .4s ease-out" }}>
            <div style={{ background: `${ROLE_C[player.role]}15`, width: 140, height: 140, borderRadius: "50%", margin: "0 auto 24px", overflow: "hidden", border: `2px solid ${ROLE_C[player.role]}40`, boxShadow: `0 0 0 transparent`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {player.name.toLowerCase() === "virat kohli" ? (
                <img
                  src={kohliImg}
                  alt={player.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
                />
              ) : (
                <span style={{ fontSize: 72 }}>{ROLE_EMOJI[player.role]}</span>
              )}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: "#fff", letterSpacing: 0, marginBottom: 8, lineHeight: 1.1 }}>{player.name.toUpperCase()}</div>
            <div style={{ color: ROLE_C[player.role], fontSize: 13, fontWeight: 600, letterSpacing: 0, marginBottom: 24 }}>{ROLE_L[player.role]} · {player.overseas ? "OVERSEAS" : "INDIAN"}</div>

            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ background: `rgba(255,255,255,0.03)`, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 10px" }}>
                <div style={{ color: "#555", fontSize: 10, letterSpacing: 0, marginBottom: 6 }}>Base price</div>
                <div style={{ color: GOLD, fontFamily: 'var(--font-display)', fontSize: 28 }}>{fmt(player.base)}</div>
              </div>
              <div style={{ background: `rgba(255,255,255,0.03)`, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 10px" }}>
                <div style={{ color: "#555", fontSize: 10, letterSpacing: 0, marginBottom: 6 }}>Category</div>
                <div style={{ color: "#fff", fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: 0 }}>{player.setName.toUpperCase()}</div>
              </div>
            </div>

            <div style={{ marginTop: 30, padding: 16, background: `${GOLD}08`, borderRadius: 12, border: `1px dashed ${GOLD}30` }}>
              <div style={{ fontSize: 11, color: GOLD, opacity: 0.7, fontStyle: "italic" }}>"A key player to watch in this set. Expected to command a high premium."</div>
            </div>

            {/* LIVE BID HISTORY ON LEFT */}
            {gs.bidLog.length > 0 && (
              <div style={{ marginTop: 30, textAlign: "left" }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: "#555", letterSpacing: 0, marginBottom: 12 }}>Bid history</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {gs.bidLog.map((b, i) => {
                    const t = TEAMS.find(team => team.id === b.teamId);
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: i === 0 ? `${t?.color}15` : "transparent", padding: i === 0 ? "6px 10px" : "2px 0", borderRadius: 6, border: i === 0 ? `1px solid ${t?.color}30` : "none" }}>
                        <span style={{ color: t?.color, fontWeight: 600, fontSize: 13 }}>{t?.short}</span>
                        <span style={{ color: i === 0 ? "#fff" : "#999", fontWeight: 600, fontSize: i === 0 ? 14 : 12 }}>{fmt(b.bid)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="ipl-center" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, position: "relative" }}>
          {[260, 400, 540].map(s => <div key={s} style={{ position: "absolute", width: s, height: s, border: "1px solid rgba(212,175,55,0.025)", borderRadius: "50%", pointerEvents: "none" }} />)}

          {gs.phase === "sold" && (
            <div style={{ textAlign: "center", animation: "sold .4s ease-out", zIndex: 2 }}>
              <div className="ipl-sold-text" style={{ fontFamily: 'var(--font-display)', fontSize: 86, color: GOLD, letterSpacing: 0, textShadow: 'none', lineHeight: 0.9 }}>Sold!</div>
              <div style={{ color: bidderTeam?.color, fontSize: 20, fontWeight: 600, letterSpacing: 0, marginTop: 10 }}>{bidderTeam?.name}</div>
              <div style={{ color: GOLD, fontSize: 30, fontFamily: 'var(--font-display)', letterSpacing: 0, marginTop: 4 }}>{fmt(gs.currentBid)}</div>
            </div>
          )}
          {gs.phase === "unsold" && (
            <div style={{ textAlign: "center", animation: "sold .4s ease-out", zIndex: 2 }}>
              <div className="ipl-sold-text" style={{ fontFamily: 'var(--font-display)', fontSize: 86, color: "#ef4444", letterSpacing: 0, textShadow: 'none', lineHeight: 0.9 }}>Unsold</div>
              <div style={{ color: "#555", fontSize: 15, marginTop: 10, letterSpacing: 0 }}>No bids received</div>
            </div>
          )}

          {gs.phase === "bidding" && (<>
            <div style={{ color: "#444", fontSize: 10, letterSpacing: 0, marginBottom: 6 }}>Current bid</div>
            <div className="ipl-bid-amount" style={{ fontFamily: 'var(--font-display)', fontSize: 72, color: GOLD, letterSpacing: 0, lineHeight: 1, textShadow: 'none' }}>{fmt(gs.currentBid)}</div>

            {bidderTeam ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, background: `${bidderTeam.color}16`, border: `1px solid ${bidderTeam.color}40`, borderRadius: 20, padding: "6px 18px" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: bidderTeam.color, boxShadow: `0 0 0 transparent` }} />
                <span style={{ color: bidderTeam.color, fontWeight: 600, fontSize: 14 }}>{bidderTeam.name}</span>
                <span style={{ color: "#555", fontSize: 13 }}>is leading</span>
              </div>
            ) : <div style={{ color: "#444", fontSize: 14, marginTop: 10, letterSpacing: 0 }}>↑ BASE PRICE — No bids yet</div>}

            <div style={{ marginTop: 30 }}>
              {iLeading ? (
                <div style={{ background: `${myTeam?.color}20`, border: `2px solid ${myTeam?.color}80`, borderRadius: 8, padding: "14px 30px", color: myTeam?.color, fontWeight: 600, fontSize: 15, letterSpacing: 0, textAlign: "center" }}>✓ YOU'RE LEADING — {fmt(gs.currentBid)}</div>
              ) : (
                <button className="ipl-bid-btn" onClick={humanBid} disabled={!canBid}
                  style={{ background: canBid ? `linear-gradient(135deg,${myTeam?.color}40,${myTeam?.color}20)` : "#0e0e0e", border: `2px solid ${canBid ? myTeam?.color : "#2a2a2a"}`, borderRadius: 8, padding: "15px 44px", color: canBid ? myTeam?.color : "#3a3a3a", fontSize: 19, fontWeight: 600, cursor: canBid ? "pointer" : "not-allowed", letterSpacing: 0, fontFamily: 'var(--font-display)', boxShadow: canBid ? `0 0 0 transparent` : "none" }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: 0 }}>
                    {canBid ? `BID ${fmt(gs.currentBidder === null ? gs.currentBid : nextBid(gs.currentBid))}` :
                      (player.overseas && osCount >= 8 ? "MAX 8 OS" : "INSUFFICIENT")}
                  </div>
                </button>
              )}
            </div>

            <div style={{ marginTop: 22, width: "100%", maxWidth: 380 }}>
              {gs.bidLog.map((b, i) => {
                const t = TEAMS.find(t => t.id === b.teamId);
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 12px", borderRadius: 5, marginBottom: 3, background: i === 0 ? `${t?.color}12` : "transparent", animation: i === 0 ? "rowIn .2s ease-out" : "none", opacity: Math.max(0.12, 1 - i * 0.14) }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: t?.color }} />
                      <span style={{ color: t?.color, fontWeight: 600, fontSize: 13 }}>{t?.short}</span>
                      {b.teamId === effectiveMyTeamId && <span style={{ fontSize: 10, background: `${t?.color}33`, color: t?.color, padding: "1px 6px", borderRadius: 8 }}>YOU</span>}
                      {b.playerName && <span style={{ fontSize: 10, color: "#888" }}>{b.playerName}</span>}
                    </div>
                    <span style={{ color: GOLD, fontWeight: 600, fontSize: 13 }}>{fmt(b.bid)}</span>
                  </div>
                );
              })}
            </div>
          </>)}
        </div>

        {/* RIGHT: Teams + Upcoming */}
        <div className="ipl-right" style={{ width: 240, borderLeft: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
          <div style={{ padding: "8px 14px", fontSize: 10, letterSpacing: 0, color: "#444", borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>Franchises</div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {[...TEAMS].sort((a, b) => (gs.purses[b.id] || 0) - (gs.purses[a.id] || 0)).map(team => {
              const isLead = team.id === gs.currentBidder, isMe = team.id === effectiveMyTeamId;
              return (
                <div key={team.id} onClick={() => { setViewingTeam(team.id); setShowSquad(true); }} style={{
                  cursor: "pointer", padding: "10px 14px", borderLeft: `4px solid ${isLead ? team.color : "transparent"}`,
                  background: isLead ? `${team.color}20` : isMe ? `${team.color}10` : "transparent",
                  borderBottom: `1px solid ${BORDER}`, transition: "all .2s"
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: team.color, boxShadow: `0 0 0 transparent` }} />
                      <span style={{ fontWeight: 600, color: progresses[team.id] < 0.2 ? "#ef4444" : "#fff", fontSize: 15, letterSpacing: 0 }}>{team.short}</span>
                      {isMe && <span style={{ fontSize: 10, color: team.color }}>YOU</span>}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: team.color, fontWeight: 600, fontSize: 16, fontFamily: 'var(--font-display)', letterSpacing: 0 }}>{fmt(gs.purses[team.id])}</div>
                      <div style={{ fontSize: 9, color: "#666", letterSpacing: 0, fontWeight: 600 }}>{gs.squads[team.id]?.length} PLAYS</div>
                    </div>
                  </div>
                  {/* Progress bar for purse */}
                  <div style={{ height: 2, background: "#111", marginTop: 6, borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: team.color, width: `${progresses[team.id] * 100}%`, transition: "width .3s" }} />
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* BOTTOM TICKER */}
      <div className="ipl-ticker" style={{ borderTop: `1px solid ${BORDER}`, padding: "10px 20px", display: "flex", gap: 28, overflowX: "auto", flexShrink: 0, background: "#05070A", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: GOLD, letterSpacing: 0, fontWeight: 600, flexShrink: 0 }}>Recent history</span>
        {(gs.auctionLog || []).slice(0, 15).map((item, i) => {
          const t = TEAMS.find(t => t.id === item.bidder);
          return (
            <div key={i} style={{ flexShrink: 0, fontSize: 14, color: "#ddd", display: "flex", gap: 8, alignItems: "center", background: "#ffffff05", padding: "4px 12px", borderRadius: 6, border: `1px solid ${BORDER}` }}>
              <span style={{ fontWeight: 600 }}>{item.player.name}</span>
              {item.sold ? (<><span style={{ color: GOLD }}>→</span><span style={{ color: t?.color, fontWeight: 600 }}>{item.bidder}</span><span style={{ color: "#fff", fontWeight: 600 }}>{fmt(item.price)}</span></>) : <span style={{ color: "#ef4444", fontWeight: 600 }}>Unsold</span>}
            </div>
          );
        })}
        {(!gs.auctionLog || gs.auctionLog.length === 0) && <span style={{ color: "#555", fontSize: 12 }}>Auction in progress...</span>}
      </div>

      <StatsModal
        isOpen={showStats}
        onClose={() => setShowStats(false)}
        gs={multiGS || g.current}
        TEAMS={TEAMS}
        myTeamId={myTeamId}
      />

      <SquadModal
        isOpen={showSquad}
        onClose={() => { setShowSquad(false); setViewingTeam(null); }}
        squads={(multiGS || g.current)?.squads || {}}
        myTeamId={viewingTeam || effectiveMyTeamId}
        TEAMS={TEAMS}
      />

    </div >
  );
}

function PlayerCard({ player }) {
  const rc = ROLE_C[player.role];
  const photo = kohliImg;

  return (
    <div style={{ background: `linear-gradient(160deg, #0E1220, ${rc}08)`, border: `1px solid ${rc}20`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ height: 3, background: `linear-gradient(90deg, ${rc}, transparent)` }} />
      <div style={{ height: 180, background: `linear-gradient(160deg, ${rc}18, #060810)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52, position: "relative" }}>
        {player.name.toLowerCase() === "virat kohli" ? (
          <div style={{ width: "100%", height: "100%", overflow: "hidden", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <img src={kohliImg} alt={player.name} referrerPolicy="no-referrer" style={{ height: "100%", width: "100%", objectFit: "cover", objectPosition: "top center", filter: "drop-shadow(0 0 0 transparent,0,0,0.8))" }} />
          </div>
        ) : (
          <div style={{ fontSize: 80 }}>{ROLE_EMOJI[player.role]}</div>
        )}
        {player.overseas && <div style={{ position: "absolute", top: 8, right: 10, fontSize: 9, background: "#C084FC22", color: "#C084FC", padding: "2px 7px", borderRadius: 4, fontWeight: 600, letterSpacing: 0, zIndex: 10 }}>OS</div>}
      </div>
      <div style={{ padding: "10px 14px" }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: 0, lineHeight: 1.1, color: "#f0f0f0" }}>{player.name}</div>
        <div style={{ display: "flex", gap: 7, marginTop: 6, alignItems: "center" }}>
          <span style={{ background: `${rc}1a`, color: rc, padding: "2px 10px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{ROLE_L[player.role]}</span>
        </div>
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
          <div style={{ background: "#07090E", borderRadius: 7, padding: "6px 10px" }}>
            <div style={{ fontSize: 9, color: "#888", letterSpacing: 0 }}>Base</div>
            <div style={{ color: GOLD, fontWeight: 600, fontSize: 15, fontFamily: 'var(--font-display)' }}>{fmt(player.base)}</div>
          </div>
          <div style={{ background: "#07090E", borderRadius: 7, padding: "6px 10px" }}>
            <div style={{ fontSize: 9, color: "#888", letterSpacing: 0 }}>Rating</div>
            <div style={{ color: rc, fontWeight: 600, fontSize: 15, fontFamily: 'var(--font-display)' }}>{player.rating || "—"}/100</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectionScreen({ mySquad, onSubmit, submitted, playersNeeded = 11 }) {
  const [selected, setSelected] = useState([]);
  const toggle = (p) => {
    setSelected(prev =>
      prev.find(x => x.name === p.name)
        ? prev.filter(x => x.name !== p.name)
        : prev.length < playersNeeded ? [...prev, p] : prev
    );
  };
  if (submitted) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: 'var(--font-ui)' }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 48, color: GOLD, letterSpacing: 0 }}>XI submitted!</div>
        <div style={{ color: "#555", fontSize: 14, marginTop: 12, letterSpacing: 0 }}>Waiting for other teams...</div>
      </div>
    </div>
  );
  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: 'var(--font-ui)', padding: "24px 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: "clamp(28px,4vw,48px)", color: GOLD, letterSpacing: 0 }}>Select your playing XI</div>
        <div style={{ color: "#555", fontSize: 12, letterSpacing: 0, marginTop: 6 }}>
          {selected.length}/{playersNeeded} selected — {playersNeeded - selected.length} more needed
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, maxWidth: 1000, margin: "0 auto 28px" }}>
        {mySquad.map((p, i) => {
          const sel = !!selected.find(x => x.name === p.name);
          const rc = ROLE_C[p.role];
          return (
            <div key={i} onClick={() => toggle(p)}
              style={{ background: sel ? `${rc}18` : CARD, border: `1px solid ${sel ? rc : BORDER}`, borderRadius: 10, padding: "12px", cursor: "pointer", transition: "all .2s", transform: sel ? "translateY(-3px)" : "none", boxShadow: sel ? `0 0 0 transparent` : "none" }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: sel ? rc : "#ddd", letterSpacing: 0 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: rc, marginTop: 4, fontWeight: 600 }}>{ROLE_L[p.role]}</div>
              <div style={{ fontSize: 11, color: GOLD, marginTop: 4 }}>₹{p.soldFor?.toFixed(2) || p.base?.toFixed(2)} Cr</div>
              {sel && <div style={{ fontSize: 9, color: rc, marginTop: 6, letterSpacing: 0, fontWeight: 600 }}>✓ Selected</div>}
            </div>
          );
        })}
      </div>
      <div style={{ textAlign: "center" }}>
        <button onClick={() => selected.length === playersNeeded && onSubmit(selected)}
          disabled={selected.length !== playersNeeded}
          style={{ background: selected.length === playersNeeded ? `${GOLD}` : "#1a1a1a", border: `1px solid ${selected.length === playersNeeded ? GOLD : "#333"}`, borderRadius: 6, padding: "14px 50px", color: selected.length === playersNeeded ? "#000" : "#555", fontWeight: 600, fontSize: 16, letterSpacing: 0, cursor: selected.length === playersNeeded ? "pointer" : "not-allowed", fontFamily: 'var(--font-display)' }}>
          SUBMIT PLAYING XI
        </button>
      </div>
    </div>
  );
}

function Home({ onPlay, onCreateRoom, onJoinRoom }) {
  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(ellipse at 50% 90%, #1c150a 0%, ${BG} 62%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: 'var(--font-ui)', position: "relative", overflow: "hidden" }}>
      <style>{`.home-title{font-size:clamp(52px,9vw,110px)!important}.home-year{font-size:clamp(28px,4.5vw,58px)!important}.home-stats{gap:clamp(20px,4vw,54px)!important;flex-wrap:wrap!important}.home-btn{padding:14px clamp(28px,5vw,60px)!important;font-size:clamp(13px,1.4vw,17px)!important;margin-top:clamp(28px,4vh,52px)!important}.home-stat-val{font-size:clamp(18px,2.5vw,28px)!important}@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>
      {[300, 500, 700, 900].map(s => <div key={s} style={{ position: "absolute", width: s, height: s, border: "1px solid rgba(212,175,55,0.035)", borderRadius: "50%", pointerEvents: "none" }} />)}
      <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(212,175,55,0.015) 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(212,175,55,0.015) 40px)", pointerEvents: "none" }} />

      {/* TATA IPL LOGO - top left */}
      <div style={{ position: "absolute", top: 16, left: 20, zIndex: 10 }}>
        <img src={tataIplLogo} alt="TATA IPL" style={{ height: 52, objectFit: "contain", filter: "drop-shadow(0 2px 12px rgba(0,0,0,0.6))" }} />
      </div>

      {/* TOP SHORTCUTS */}
      <div style={{ position: "absolute", top: 20, right: 20, display: "flex", gap: 12, zIndex: 10 }}>
        <button onClick={onJoinRoom} style={{ background: "transparent", border: `1px solid ${GOLD}40`, borderRadius: 6, padding: "8px 16px", color: GOLD, fontSize: 11, fontWeight: 600, cursor: "pointer", letterSpacing: 0, fontFamily: 'var(--font-ui)' }}>Join room</button>
        <button onClick={onCreateRoom} style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}`, borderRadius: 6, padding: "8px 16px", color: GOLD, fontSize: 11, fontWeight: 600, cursor: "pointer", letterSpacing: 0, fontFamily: 'var(--font-ui)' }}>Create room</button>
      </div>

      <div style={{ textAlign: "center", zIndex: 1, animation: "fadeUp .6s ease-out" }}>
        <div style={{ color: `${GOLD}77`, fontSize: 11, letterSpacing: 0, marginBottom: 22, fontWeight: 600 }}>Tata indian premier league</div>

        <div className="home-title" style={{ fontFamily: 'var(--font-display)', fontSize: 110, lineHeight: 0.85, letterSpacing: 0, color: "#f0f0f0", textShadow: 'none' }}>Bidwicket IPL<br /><span style={{ color: GOLD, textShadow: 'none' }}>Auction</span></div>
        <div className="home-year" style={{ fontFamily: 'var(--font-display)', fontSize: 58, color: "#1e1e1e", letterSpacing: 0, marginTop: 6 }}>2025</div>
        <div style={{ color: "#444", fontSize: 12, marginTop: 22, letterSpacing: 0 }}>The ultimate bidding simulation</div>
        <button className="home-btn" onClick={onPlay} style={{ marginTop: 52, background: `${GOLD}`, border: "none", borderRadius: 3, padding: "17px 60px", color: "#000", fontSize: 17, fontWeight: 600, cursor: "pointer", letterSpacing: 0, fontFamily: 'var(--font-display)', boxShadow: `0 4px 60px ${GOLD}55, 0 0 0 1px ${GOLD}22` }}>Start auction</button>
        <div className="home-stats" style={{ marginTop: 54, display: "flex", gap: 54, justifyContent: "center" }}>
          {[["500+", "PLAYERS"], ["10", "TEAMS"], ["₹120Cr", "EACH PURSE"], ["LIVE", "MULTIPLAYER"]].map(([n, l]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div className="home-stat-val" style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: GOLD, letterSpacing: 0 }}>{n}</div>
              <div style={{ fontSize: 10, color: "#3a3a3a", letterSpacing: 0 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModeSelect({ onSelect }) {
  const [hov, setHov] = useState(null);
  const modes = [
    { id: "mega", title: "BIDWICKET IPL MEGA AUCTION", subtitle: "500+ Official Players · 40+ Sets", desc: "Full mega auction with all official sets.", icon: "🏟️", players: "500+", color: GOLD },
    { id: "mini", title: "BIDWICKET IPL MINI AUCTION", subtitle: "200 Players · Quick Mode", desc: "Quick game with top players from all categories shuffled randomly.", icon: "⚡", players: "200", color: '#a3a9b8' },
  ];
  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: 'var(--font-ui)', display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
      <div style={{ textAlign: "center", marginBottom: 50, animation: "fadeUp .4s ease-out" }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: "clamp(32px,5vw,52px)", letterSpacing: 0, color: GOLD }}>Select bidwicket IPL auction mode</div>
      </div>
      <div style={{ display: "flex", gap: 24, animation: "fadeUp .5s ease-out", flexWrap: "wrap", justifyContent: "center", padding: "0 20px" }}>
        {modes.map(m => (
          <div key={m.id} onClick={() => onSelect(m.id)} onMouseEnter={() => setHov(m.id)} onMouseLeave={() => setHov(null)}
            style={{ width: 320, background: hov === m.id ? `${m.color}10` : CARD, border: `1px solid ${hov === m.id ? m.color : BORDER}`, borderRadius: 16, padding: "36px 28px", cursor: "pointer", transition: "all .25s", textAlign: "center", boxShadow: hov === m.id ? `0 0 0 transparent` : "none", transform: hov === m.id ? "translateY(-6px)" : "none" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>{m.icon}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: m.color, letterSpacing: 0 }}>{m.title}</div>
            <div style={{ color: "#555", fontSize: 12, marginTop: 10 }}>{m.subtitle}</div>
            <div style={{ color: "#3a3a3a", fontSize: 11, marginTop: 8 }}>{m.desc}</div>
            <div style={{ marginTop: 20, display: "flex", justifyContent: "center", gap: 20 }}>
              <div><div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: m.color }}>{m.players}</div><div style={{ fontSize: 9, color: "#444", letterSpacing: 0 }}>Players</div></div>
              <div><div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: m.color }}>10</div><div style={{ fontSize: 9, color: "#444", letterSpacing: 0 }}>Teams</div></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamSelect({ onSelect, mode }) {
  const [hov, setHov] = useState(null);
  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: 'var(--font-ui)', padding: "clamp(20px,4vh,38px) clamp(16px,3vw,32px)" }}>
      <style>{`.ts-title{font-size:clamp(26px,4vw,46px)!important}.ts-grid{grid-template-columns:repeat(5,1fr)!important}@media(max-width:1000px){.ts-grid{grid-template-columns:repeat(3,1fr)!important}}@media(max-width:600px){.ts-grid{grid-template-columns:repeat(2,1fr)!important}}`}</style>
      <div style={{ textAlign: "center", marginBottom: 38 }}>
        <div className="ts-title" style={{ fontFamily: 'var(--font-display)', fontSize: 46, letterSpacing: 0, color: GOLD }}>Choose your franchise</div>
        <div style={{ color: "#444", fontSize: 13, letterSpacing: 0, marginTop: 6 }}>{mode === "mega" ? "MEGA AUCTION — 500+ PLAYERS" : "MINI AUCTION — 200 PLAYERS"}</div>
      </div>
      <div className="ts-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, maxWidth: 880, margin: "0 auto" }}>
        {TEAMS.map(t => (
          <div key={t.id} onClick={() => onSelect(t.id)} onMouseEnter={() => setHov(t.id)} onMouseLeave={() => setHov(null)}
            style={{ background: hov === t.id ? `${t.color}14` : CARD, border: `1px solid ${hov === t.id ? t.color : BORDER}`, borderRadius: 12, padding: "22px 16px", cursor: "pointer", textAlign: "center", transition: "all .2s", boxShadow: hov === t.id ? `0 0 0 transparent` : "none", transform: hov === t.id ? "translateY(-4px)" : "none" }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, color: t.color, letterSpacing: 0, lineHeight: 1 }}>{t.short}</div>
            <div style={{ fontSize: 11, color: hov === t.id ? "#aaa" : "#555", marginTop: 7, lineHeight: 1.4, fontWeight: 500 }}>{t.name}</div>
            <div style={{ marginTop: 14, fontSize: 12, color: `${t.color}88`, fontWeight: 600, letterSpacing: 0 }}>₹120 Cr purse</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// -- Gemini AI Analysis Screen --------------------------------------------------------
function GeminiAnalysisScreen({ gs, onBack }) {
  const [status, setStatus] = useState("idle");
  const [analysis, setAnalysis] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [expanded, setExpanded] = useState({});

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  async function runAnalysis() {
    if (!CLAUDE_API_KEY) {
      setErrorMsg("API key missing. Add VITE_CLAUDE_API_KEY to your env variables.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setErrorMsg("");

    const teamSummaries = TEAMS.map(t => {
      const xi = gs.playingXI?.[t.id] || gs.squads?.[t.id]?.slice(0, 11) || [];
      const lines = xi.map(p => `    - ${p.name} (${p.role === "WK" ? "Wicket-Keeper" : p.role === "BAT" ? "Batter" : p.role === "BOWL" ? "Bowler" : "All-Rounder"}${p.overseas ? ", Overseas" : ""}) -- Rs.${p.soldFor?.toFixed(2) || p.base}Cr`).join("\n");
      const purseLeft = (gs.purses?.[t.id] || 0).toFixed(2);
      return `**${t.name} (${t.id})**\nPlaying XI:\n${lines || "  No players"}\nRemaining Purse: Rs.${purseLeft}Cr`;
    }).join("\n\n---\n\n");

    const prompt = `You are a world-class IPL cricket analyst with deep knowledge of IPL 2025 conditions and current player form. Based on the BidWicket IPL Auction results below, critically analyze and rank ALL 10 teams from BEST (1st) to WORST (10th).

Consider: team balance (batting depth, bowling attack, all-round options, wicket-keeping), IPL 2025 current player form and recent performances, overseas slot usage (max 4 allowed), death bowling and powerplay specialists, star power and match-winners, and overall squad synergy.

Here are the 10 Final Playing XIs:

${teamSummaries}

RESPOND IN THIS EXACT JSON FORMAT (no markdown wrapper, pure JSON only, no text before or after):
{
  "rankings": [
    {
      "rank": 1,
      "teamId": "TEAM_ID",
      "teamName": "Full Team Name",
      "score": 92,
      "verdict": "One sentence championship-level verdict",
      "strengths": ["Strength 1", "Strength 2", "Strength 3"],
      "weaknesses": ["Weakness 1", "Weakness 2"],
      "whyWins": "Detailed 3-4 sentence explanation of why this team is the strongest based on their XI and real IPL 2025 conditions"
    }
  ],
  "overallSummary": "2-3 sentence expert summary of the overall auction and competitive landscape"
}

Rank ALL 10 teams. Be brutally honest and specific about real IPL 2025 conditions.`;

    try {
      const anthropic = new Anthropic({
        apiKey: CLAUDE_API_KEY,
        dangerouslyAllowBrowser: true
      });

      const response = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }]
      });

      const text = response.content?.[0]?.text || "";
      const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(jsonStr);
      setAnalysis(parsed);
      setStatus("done");
    } catch (e) {
      console.error("Claude error:", e);
      setErrorMsg(e.message || "Failed to get analysis.");
      setStatus("error");
    }
  }

  useEffect(() => { runAnalysis(); }, []);

  const teamColor = (id) => TEAMS.find(t => t.id === id)?.color || "#888";

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: 'var(--font-ui)', padding: "clamp(14px,3vh,28px)" }}>
      <style>{`
        @keyframes fadeUpG{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes pulseG{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes spinG{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes rankInG{from{opacity:0;transform:translateX(-18px)}to{opacity:1;transform:none}}
        .gem-card{transition:transform .2s,box-shadow .2s;cursor:pointer}
        .gem-card:hover{transform:translateY(-3px)!important}
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12, animation: "fadeUpG .4s ease-out" }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: "clamp(26px,4vw,48px)", color: GOLD, letterSpacing: 0, lineHeight: 1 }}>🤖 AI team analysis</div>
          <div style={{ color: "#444", fontSize: 11, letterSpacing: 0, marginTop: 4 }}>Powered by advanced AI · IPL 2025 conditions</div>
        </div>
        <button onClick={onBack} style={{ background: "transparent", border: `1px solid ${GOLD}50`, borderRadius: 6, padding: "10px 22px", color: GOLD, fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: 0, fontFamily: 'var(--font-display)' }}>
          ← BACK TO RESULTS
        </button>
      </div>

      {/* LOADING */}
      {status === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 28 }}>
          <div style={{ width: 70, height: 70, border: `4px solid ${GOLD}22`, borderTop: `4px solid ${GOLD}`, borderRadius: "50%", animation: "spinG 1s linear infinite" }} />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: GOLD, letterSpacing: 0, animation: "pulseG 1.5s infinite" }}>AI is analyzing your teams...</div>
          <div style={{ color: "#444", fontSize: 13, letterSpacing: 0, maxWidth: 420, textAlign: "center" }}>
            Evaluating squad balance, IPL 2025 form, overseas usage, death bowling and powerplay specialists across all 10 franchises...
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {TEAMS.map((t, i) => (
              <div key={t.id} style={{ width: 8, height: 8, borderRadius: "50%", background: t.color, animation: `pulseG ${0.8 + i * 0.1}s infinite` }} />
            ))}
          </div>
        </div>
      )}

      {/* ERROR */}
      {status === "error" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 20, animation: "fadeUpG .4s ease-out" }}>
          <div style={{ fontSize: 52 }}>⚠️</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: "#ef4444", letterSpacing: 0 }}>Analysis failed</div>
          <div style={{ background: "#0d0d0d", border: "1px solid #ef444428", borderRadius: 12, padding: "18px 28px", maxWidth: 520, textAlign: "center" }}>
            <div style={{ color: "#ef4444", fontSize: 13, lineHeight: 1.7 }}>{errorMsg}</div>
            {!CLAUDE_API_KEY && (
              <div style={{ marginTop: 14, padding: "10px 16px", background: "#1a1a1a", borderRadius: 8, fontFamily: 'var(--font-ui)', fontSize: 12, color: GOLD, letterSpacing: 0 }}>
                VITE_CLAUDE_API_KEY=your_key_here
              </div>
            )}
          </div>
          <button onClick={runAnalysis} style={{ background: `${GOLD}`, border: "none", borderRadius: 6, padding: "12px 32px", color: "#000", fontWeight: 600, cursor: "pointer", fontSize: 14, letterSpacing: 0, fontFamily: 'var(--font-display)' }}>
            RETRY ANALYSIS
          </button>
        </div>
      )}

      {/* DONE */}
      {status === "done" && analysis && (
        <div style={{ animation: "fadeUpG .5s ease-out" }}>

          {/* Summary banner */}
          {analysis.overallSummary && (
            <div style={{ background: `${GOLD}09`, border: `1px solid ${GOLD}28`, borderRadius: 12, padding: "18px 24px", maxWidth: 900, margin: "0 auto 28px" }}>
              <div style={{ fontSize: 10, color: GOLD, letterSpacing: 0, fontWeight: 600, marginBottom: 8 }}>🏏 Expert summary</div>
              <div style={{ color: "#ccc", fontSize: 15, lineHeight: 1.75 }}>{analysis.overallSummary}</div>
            </div>
          )}

          {/* Champion hero card */}
          {analysis.rankings?.[0] && (() => {
            const champ = analysis.rankings[0];
            const tc = teamColor(champ.teamId);
            return (
              <div style={{ background: `linear-gradient(135deg,${tc}14,${GOLD}06,${CARD})`, border: `2px solid ${GOLD}`, borderRadius: 16, padding: "26px 30px", maxWidth: 900, margin: "0 auto 24px", boxShadow: `0 0 0 transparent`, animation: "fadeUpG .6s ease-out" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, background: `${GOLD}`, color: "#000", borderRadius: 6, padding: "4px 16px", letterSpacing: 0 }}>🥇 #1 champion</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, color: GOLD, letterSpacing: 0 }}>{champ.teamName}</div>
                  <div style={{ marginLeft: "auto", background: `${GOLD}14`, border: `1px solid ${GOLD}40`, borderRadius: 10, padding: "10px 18px", textAlign: "center" }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, color: GOLD }}>{champ.score}</div>
                    <div style={{ fontSize: 9, color: "#888", letterSpacing: 0 }}>SCORE/100</div>
                  </div>
                </div>
                <div style={{ color: "#e0c97b", fontSize: 15, fontStyle: "italic", marginBottom: 16, lineHeight: 1.65 }}>"{champ.verdict}"</div>
                {champ.whyWins && (
                  <div style={{ background: "#ffffff05", borderRadius: 10, padding: "14px 18px", borderLeft: `4px solid ${GOLD}`, marginBottom: 16 }}>
                    <div style={{ fontSize: 10, color: GOLD, letterSpacing: 0, fontWeight: 600, marginBottom: 8 }}>Why this team wins IPL 2025</div>
                    <div style={{ color: "#bbb", fontSize: 14, lineHeight: 1.8 }}>{champ.whyWins}</div>
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {champ.strengths?.length > 0 && (
                    <div style={{ background: "#00cc6608", border: "1px solid #00cc6620", borderRadius: 10, padding: "14px 16px" }}>
                      <div style={{ fontSize: 10, color: "#00cc88", letterSpacing: 0, marginBottom: 8, fontWeight: 600 }}>✅ Strengths</div>
                      {champ.strengths.map((s, i) => <div key={i} style={{ color: "#aaa", fontSize: 13, marginBottom: 5, paddingLeft: 10, borderLeft: "2px solid #00cc8840" }}>• {s}</div>)}
                    </div>
                  )}
                  {champ.weaknesses?.length > 0 && (
                    <div style={{ background: "#ff444408", border: "1px solid #ff444422", borderRadius: 10, padding: "14px 16px" }}>
                      <div style={{ fontSize: 10, color: "#ff6b6b", letterSpacing: 0, marginBottom: 8, fontWeight: 600 }}>⚠️ Vulnerabilities</div>
                      {champ.weaknesses.map((w, i) => <div key={i} style={{ color: "#aaa", fontSize: 13, marginBottom: 5, paddingLeft: 10, borderLeft: "2px solid #ff444440" }}>• {w}</div>)}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Remaining rankings - click to expand */}
          <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: "#444", letterSpacing: 0, marginBottom: 6 }}>All team rankings — click to expand</div>
            {analysis.rankings?.map((r, idx) => {
              const tc = teamColor(r.teamId);
              const isOpen = expanded[r.teamId];
              const borderC = idx === 0 ? GOLD : idx === 1 ? "#aaa" : idx === 2 ? "#CD7F32" : BORDER;
              return (
                <div key={r.teamId} className="gem-card" onClick={() => toggleExpand(r.teamId)}
                  style={{ background: CARD, border: `1px solid ${borderC}`, borderRadius: 12, overflow: "hidden", animation: `rankInG ${0.15 + idx * 0.06}s ease-out both` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: idx === 0 ? `${GOLD}07` : "transparent" }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, minWidth: 40, textAlign: "center", lineHeight: 1, color: idx === 0 ? GOLD : idx === 1 ? "#aaa" : idx === 2 ? "#CD7F32" : "#555" }}>
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${r.rank}`}
                    </div>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: tc, boxShadow: `0 0 0 transparent`, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: tc, letterSpacing: 0, lineHeight: 1 }}>{r.teamName}</div>
                      <div style={{ color: "#555", fontSize: 12, marginTop: 2, letterSpacing: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.verdict}</div>
                    </div>
                    <div style={{ textAlign: "center", minWidth: 52, flexShrink: 0 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: idx === 0 ? GOLD : idx === 1 ? "#aaa" : idx === 2 ? "#CD7F32" : "#555" }}>{r.score}</div>
                      <div style={{ fontSize: 8, color: "#444", letterSpacing: 0 }}>/100</div>
                    </div>
                    <div style={{ color: "#444", fontSize: 16, marginLeft: 6, flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</div>
                  </div>

                  {isOpen && (
                    <div style={{ padding: "0 18px 16px", borderTop: `1px solid ${BORDER}`, animation: "fadeUpG .2s ease-out" }}>
                      {r.whyWins && (
                        <div style={{ margin: "14px 0 12px", background: "#ffffff05", borderRadius: 8, padding: "12px 16px", borderLeft: `3px solid ${tc}` }}>
                          <div style={{ fontSize: 9, color: tc, letterSpacing: 0, fontWeight: 600, marginBottom: 6 }}>Detailed analysis</div>
                          <div style={{ color: "#bbb", fontSize: 13, lineHeight: 1.75 }}>{r.whyWins}</div>
                        </div>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                        {r.strengths?.length > 0 && (
                          <div style={{ background: "#00cc6606", border: "1px solid #00cc6618", borderRadius: 8, padding: "10px 14px" }}>
                            <div style={{ fontSize: 9, color: "#00cc88", letterSpacing: 0, marginBottom: 6, fontWeight: 600 }}>Strengths</div>
                            {r.strengths.map((s, i) => <div key={i} style={{ color: "#999", fontSize: 12, marginBottom: 4 }}>• {s}</div>)}
                          </div>
                        )}
                        {r.weaknesses?.length > 0 && (
                          <div style={{ background: "#ff444406", border: "1px solid #ff444418", borderRadius: 8, padding: "10px 14px" }}>
                            <div style={{ fontSize: 9, color: "#ff6b6b", letterSpacing: 0, marginBottom: 6, fontWeight: 600 }}>Weaknesses</div>
                            {r.weaknesses.map((w, i) => <div key={i} style={{ color: "#999", fontSize: 12, marginBottom: 4 }}>• {w}</div>)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ textAlign: "center", marginTop: 32, color: "#2a2a2a", fontSize: 11, letterSpacing: 0 }}>
            Analysis by Advanced AI · Based on IPL 2025 player form & team balance
          </div>
        </div>
      )}
    </div>
  );
}

function Results({ gs, myTeamId: mti, onRestart }) {
  const [activeId, setActiveId] = useState(mti || TEAMS[0].id);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const team = TEAMS.find(t => t.id === activeId);

  if (showAnalysis) return <GeminiAnalysisScreen gs={gs} onBack={() => setShowAnalysis(false)} />;
  const playingXI = gs.playingXI[activeId] || [];
  const fullSquad = gs.squads[activeId] || [];
  const displayList = playingXI.length === 11 ? playingXI : fullSquad;

  const spent = +(120 - (gs.purses[activeId] || 0)).toFixed(2);
  const soldCount = (gs.auctionLog || []).filter(l => l.sold).length;
  const unsoldCount = (gs.auctionLog || []).filter(l => !l.sold).length;

  const downloadSheet = async () => {
    const el = document.getElementById("capture-results");
    if (!el) return;
    const canvas = await html2canvas(el, { backgroundColor: BG, scale: 2 });
    const link = document.createElement("a");
    link.download = `BidWicket-${team?.short}-XI.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const shareWhatsApp = () => {
    const text = `🏏 *BidWicket IPL Auction* \nCheck out my Playing XI for *${team?.name}*!\n\n${displayList.map((p, i) => `${i + 1}. ${ROLE_EMOJI[p.role]} ${p.name}`).join("\n")}\n\nBuild your own squad at BidWicket!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: 'var(--font-ui)', padding: "clamp(16px,3vh,28px)" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}.res-squad{grid-template-columns:repeat(2,1fr)!important}@media(max-width:700px){.res-squad{grid-template-columns:1fr!important}}`}</style>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: "clamp(30px,5vw,54px)", color: GOLD, letterSpacing: 0 }}>Bidwicket IPL auction complete</div>

        <div style={{ color: "#555", fontSize: 12, letterSpacing: 0, marginTop: 4 }}>{soldCount} SOLD · {unsoldCount} UNSOLD</div>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap", justifyContent: "center" }}>
        {TEAMS.map(t => (
          <button key={t.id} onClick={() => setActiveId(t.id)} style={{ background: activeId === t.id ? t.color : "transparent", border: `1px solid ${t.color}`, borderRadius: 4, padding: "6px 14px", color: activeId === t.id ? "#000" : t.color, cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-ui)' }}>
            {t.short}{t.id === mti ? " ★" : ""}
          </button>
        ))}
      </div>
      <div id="capture-results" style={{ maxWidth: 1000, margin: "0 auto", animation: "fadeUp .3s ease-out", background: BG, padding: 20, borderRadius: 16 }}>
        <div style={{ display: "flex", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
          {/* PURSE HIGHLIGHT */}
          <div style={{ background: `linear-gradient(135deg, ${CARD}, #0A0D15)`, border: `1px solid ${GOLD}40`, borderRadius: 12, padding: "20px", flex: 1, display: "flex", flexDirection: "column", gap: 10, boxShadow: `0 8px 30px ${GOLD}15` }}>
            <div style={{ fontSize: 13, color: GOLD, letterSpacing: 0, fontWeight: 600 }}>{team?.name}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 38, color: "#fff", letterSpacing: 0 }}>{playingXI.length === 11 ? "FINAL PLAYING XI" : "FULL SQUAD"}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px dashed ${BORDER}`, paddingTop: 10, marginTop: 4 }}>
              <span style={{ fontSize: 12, color: "#aaa" }}>Remaining purse</span>
              <strong style={{ color: GOLD, fontSize: 16 }}>{fmt(gs.purses[activeId])}</strong>
            </div>
          </div>
        </div>

        {displayList.length === 0 ? <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px", flex: 1 }}>No players purchased by {team?.name}</div> : (
          <div className="res-squad" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
            {displayList.map((p, i) => (
              <div key={i} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{ROLE_EMOJI[p.role]}</span>
                  <div><div style={{ fontWeight: 600, fontSize: 14, color: "#eee" }}>{p.name}</div><div style={{ fontSize: 12, color: ROLE_C[p.role], marginTop: 2 }}>{ROLE_L[p.role]}{p.overseas ? " · OS" : ""}</div></div>
                </div>
                <div style={{ textAlign: "right" }}><div style={{ color: GOLD, fontWeight: 600, fontSize: 16 }}>{fmt(p.soldFor)}</div></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: 40, display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
        <button onClick={() => setShowAnalysis(true)} style={{ background: `linear-gradient(135deg,#6366f1,#4338ca)`, border: "none", borderRadius: 3, padding: "14px 30px", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13, letterSpacing: 0, fontFamily: 'var(--font-display)', boxShadow: "0 0 0 transparent" }}>🤖 AI team analysis</button>
        <button onClick={downloadSheet} style={{ background: '#a3a9b8', border: "none", borderRadius: 3, padding: "14px 30px", color: "#000", fontWeight: 600, cursor: "pointer", fontSize: 13, letterSpacing: 0, fontFamily: 'var(--font-display)' }}>Download image ⬇</button>
        <button onClick={shareWhatsApp} style={{ background: "#25D366", border: "none", borderRadius: 3, padding: "14px 30px", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13, letterSpacing: 0, fontFamily: 'var(--font-display)' }}>Share on whatsapp 📱</button>
        <button onClick={onRestart} style={{ background: `${GOLD}`, border: "none", borderRadius: 3, padding: "14px 36px", color: "#000", fontWeight: 600, cursor: "pointer", fontSize: 13, letterSpacing: 0, fontFamily: 'var(--font-display)' }}>Play again 🔄</button>
      </div>
    </div>
  );
}
