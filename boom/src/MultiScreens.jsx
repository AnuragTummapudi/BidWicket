'use client';

import { useState, useEffect } from "react";

const GOLD = "#E8B84B", BG = "#0b0d14", CARD = "#11141c", BORDER = "#1f2430";

const TEAMS = [
    { id: "CSK", name: "Chennai Super Kings", short: "CSK", color: "#F9CA24" },
    { id: "MI", name: "Mumbai Indians", short: "MI", color: "#4FC3F7" },
    { id: "RCB", name: "Royal Challengers Bengaluru", short: "RCB", color: "#FF5252" },
    { id: "KKR", name: "Kolkata Knight Riders", short: "KKR", color: "#CE93D8" },
    { id: "SRH", name: "Sunrisers Hyderabad", short: "SRH", color: "#FF8A65" },
    { id: "DC", name: "Delhi Capitals", short: "DC", color: "#64B5F6" },
    { id: "PBKS", name: "Punjab Kings", short: "PBKS", color: "#EF9A9A" },
    { id: "RR", name: "Rajasthan Royals", short: "RR", color: "#F48FB1" },
    { id: "GT", name: "Gujarat Titans", short: "GT", color: "#4DD0E1" },
    { id: "LSG", name: "Lucknow Super Giants", short: "LSG", color: "#81D4FA" },
];

const ROLE_C = { BAT: '#7fa7d9', WK: '#d9b45f', AR: '#b49ad6', BOWL: '#6fbf95' };
const ROLE_L = { BAT: "Batter", WK: "WK-Batter", AR: "All-rounder", BOWL: "Bowler" };
const ROLE_EMOJI = { BAT: "Bat", WK: "WK", AR: "AR", BOWL: "Bowl" };

const CYAN = '#a3a9b8';
export { TEAMS, ROLE_C, ROLE_L, ROLE_EMOJI, GOLD, CYAN, BG, CARD, BORDER };

export function PlayModeScreen({ onSingle, onMulti }) {
    const [hov, setHov] = useState(null);
    const modes = [
        { id: "single", title: "SINGLE PLAYER", desc: "Play against 9 AI-controlled franchises", icon: "🎮", color: '#a3a9b8' },
        { id: "multi", title: "MULTIPLAYER", desc: "Create or join a room with friends. Real-time bidding!", icon: "🌐", color: GOLD },
    ];
    return (
        <div style={{ minHeight: "100vh", background: BG, fontFamily: 'var(--font-ui)', display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
            <div style={{ textAlign: "center", marginBottom: 50, animation: "fadeUp .4s ease-out" }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: "clamp(28px,4vw,48px)", letterSpacing: 0, color: GOLD }}>How do you want to play?</div>
            </div>
            <div style={{ display: "flex", gap: 24, animation: "fadeUp .5s ease-out", flexWrap: "wrap", justifyContent: "center", padding: "0 20px" }}>
                {modes.map(m => (
                    <div key={m.id} onClick={m.id === "single" ? onSingle : onMulti}
                        onMouseEnter={() => setHov(m.id)} onMouseLeave={() => setHov(null)}
                        style={{ width: 300, background: hov === m.id ? `${m.color}10` : CARD, border: `1px solid ${hov === m.id ? m.color : BORDER}`, borderRadius: 16, padding: "40px 28px", cursor: "pointer", transition: 'background-color .15s, border-color .15s, color .15s, opacity .15s', textAlign: "center", boxShadow: hov === m.id ? `0 0 0 transparent` : "none", transform: hov === m.id ? "translateY(-6px)" : "none" }}>
                        <div style={{ fontSize: 56, marginBottom: 16 }}>{m.icon}</div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: m.color, letterSpacing: 0 }}>{m.title}</div>
                        <div style={{ color: "#7a8296", fontSize: 12, marginTop: 12, lineHeight: 1.5 }}>{m.desc}</div>
                        <div style={{ height: 3, background: "#1a1e28", borderRadius: 2, marginTop: 24, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: hov === m.id ? "100%" : "0%", background: m.color, transition: "width .5s" }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function RoomScreen({ emit, onJoined, playerId }) {
    const [mode, setMode] = useState(null); // "create" or "join"
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [isPrivate, setIsPrivate] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [serverData, setServerData] = useState({ active: [], history: [] });

    // Fetch server browser data when in join mode
    useEffect(() => {
        if (mode === "join") {
            emit("get-rooms", (data) => {
                if (data) setServerData(data);
            });
            // Optionally listen for live updates
        }
    }, [mode, emit]);

    const handleCreate = () => {
        if (!name.trim()) return setError("Enter your name");
        setLoading(true); setError("");
        emit("create-room", { playerName: name.trim(), isPrivate, roomName: `${name.trim()}'s Room`, playerId }, (res) => {
            setLoading(false);
            if (res.ok) onJoined({ code: res.code, players: res.players, isHost: true, myName: name.trim() });
            else setError(res.error || "Failed");
        });
    };

    const handleJoinCode = () => {
        if (!name.trim()) return setError("Enter your name");
        if (!code.trim() || code.trim().length < 4) return setError("Enter valid room code");
        handleJoin(code.trim().toUpperCase());
    };

    const handleJoin = (targetCode) => {
        if (!name.trim()) return setError("Enter your name first at the top!");
        setLoading(true); setError("");
        emit("join-room", { code: targetCode, playerName: name.trim(), playerId }, (res) => {
            setLoading(false);
            if (res.ok) {
                const isActualHost = res.hostId === playerId;
                onJoined({
                    code: res.code,
                    players: res.players,
                    isHost: isActualHost,
                    myName: name.trim(),
                    roomStatus: res.roomStatus,
                    gameState: res.gameState,
                    auctionMode: res.auctionMode
                });
            } else {
                setError(res.error || "Failed");
            }
        });
    };

    const inputStyle = { width: "100%", padding: "14px 18px", background: "#1a1e28", border: `1px solid ${BORDER}`, borderRadius: 8, color: "#fff", fontSize: 16, fontFamily: 'var(--font-ui)', letterSpacing: 0, outline: "none", boxSizing: "border-box" };
    const btnStyle = (c) => ({ width: "100%", padding: "14px", background: `linear-gradient(135deg, ${c}, ${c}88)`, border: "none", borderRadius: 8, color: "#000", fontSize: 16, fontWeight: 600, cursor: "pointer", letterSpacing: 0, fontFamily: 'var(--font-display)' });

    return (
        <div style={{ minHeight: "100vh", background: BG, fontFamily: 'var(--font-ui)', display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
            {!mode ? (
                <div style={{ animation: "fadeUp .4s ease-out", textAlign: "center" }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: "clamp(28px,4vw,48px)", color: GOLD, letterSpacing: 0, marginBottom: 40 }}>Multiplayer</div>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
                        {[["CREATE ROOM", "🏟️", '#a3a9b8'], ["JOIN ROOM", "🔗", GOLD]].map(([label, icon, c]) => (
                            <div key={label} onClick={() => setMode(label.includes("CREATE") ? "create" : "join")}
                                style={{ width: 220, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "36px 20px", cursor: "pointer", textAlign: "center", transition: 'background-color .15s, border-color .15s, color .15s, opacity .15s' }}>
                                <div style={{ fontSize: 42, marginBottom: 12 }}>{icon}</div>
                                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: c, letterSpacing: 0 }}>{label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div style={{ width: mode === "create" ? 360 : 660, animation: "fadeUp .3s ease-out" }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, color: GOLD, letterSpacing: 0, textAlign: "center", marginBottom: 30 }}>
                        {mode === "create" ? "CREATE ROOM" : "SERVER BROWSER"}
                    </div>

                    {mode === "create" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            <input value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" style={inputStyle} maxLength={20} />

                            <div style={{ display: "flex", gap: 10, background: CARD, padding: 12, borderRadius: 8, border: `1px solid ${BORDER}` }}>
                                <div onClick={() => setIsPrivate(false)} style={{ flex: 1, textAlign: "center", padding: "10px", background: !isPrivate ? `${GOLD}22` : "transparent", color: !isPrivate ? GOLD : "#7a8296", border: `1px solid ${!isPrivate ? GOLD : "transparent"}`, borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>Public</div>
                                <div onClick={() => setIsPrivate(true)} style={{ flex: 1, textAlign: "center", padding: "10px", background: isPrivate ? `${GOLD}22` : "transparent", color: isPrivate ? GOLD : "#7a8296", border: `1px solid ${isPrivate ? GOLD : "transparent"}`, borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>Private</div>
                            </div>

                            {error && <div style={{ color: "#ef4444", fontSize: 13, textAlign: "center" }}>{error}</div>}
                            <button onClick={handleCreate} disabled={loading} style={btnStyle('#a3a9b8')}>
                                {loading ? "..." : "CREATE ROOM"}
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                            <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter Your Name First To Join" style={{ ...inputStyle, textAlign: "center", letterSpacing: 0, fontSize: 18 }} maxLength={20} />
                            {error && <div style={{ color: "#ef4444", fontSize: 13, textAlign: "center" }}>{error}</div>}

                            <div style={{ display: "flex", gap: 20 }}>
                                {/* Active Public Rooms */}
                                <div style={{ flex: 1, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#a3a9b8', letterSpacing: 0, marginBottom: 14 }}>Active lobbies</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 300, overflowY: "auto" }}>
                                        {serverData.active.length === 0 ? <div style={{ color: "#7a8296", fontSize: 13, textAlign: "center", padding: 20 }}>No public rooms right now. Create one!</div> :
                                            serverData.active.map((r, i) => (
                                                <div key={i} style={{ background: "#1a1e28", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                    <div>
                                                        <div style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>{r.name}</div>
                                                        <div style={{ color: "#7a8296", fontSize: 12, marginTop: 4 }}>Host: {r.host} · {r.players}/10 Players</div>
                                                    </div>
                                                    <button onClick={() => handleJoin(r.code)} disabled={loading} style={{ background: "#22D3EE22", color: '#a3a9b8', border: "1px solid #22D3EE55", borderRadius: 4, padding: "6px 14px", fontWeight: 600, cursor: "pointer" }}>Join</button>
                                                </div>
                                            ))
                                        }
                                    </div>
                                </div>

                                {/* Join Private */}
                                <div style={{ width: 220, display: "flex", flexDirection: "column", gap: 14 }}>
                                    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: GOLD, letterSpacing: 0, marginBottom: 14 }}>Join private</div>
                                        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="CODE" style={{ ...inputStyle, letterSpacing: 0, fontSize: 22, textAlign: "center", fontFamily: 'var(--font-display)', marginBottom: 14 }} maxLength={6} />
                                        <button onClick={handleJoinCode} disabled={loading} style={btnStyle(GOLD)}>Join code</button>
                                    </div>

                                    {/* Recent Finishes */}
                                    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, flex: 1 }}>
                                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: "#C084FC", letterSpacing: 0, marginBottom: 10 }}>Recent results</div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 150, overflowY: "auto" }}>
                                            {serverData.history.length === 0 ? <div style={{ color: "#7a8296", fontSize: 12, textAlign: "center" }}>No recent games</div> :
                                                serverData.history.map((h, i) => (
                                                    <div key={i} style={{ background: "#11141c", padding: 8, borderRadius: 6, border: `1px solid #C084FC33` }}>
                                                        <div style={{ color: "#c9cdd6", fontSize: 12, fontWeight: 600 }}>{h.name}</div>
                                                        <div style={{ color: "#7a8296", fontSize: 12 }}>{h.totalSold} players sold</div>
                                                        {h.topBuy && <div style={{ color: GOLD, fontSize: 12, marginTop: 4 }}>Top: {h.topBuy.player.name}</div>}
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ textAlign: "center", marginTop: 20 }}>
                        <button onClick={() => { setMode(null); setError(""); }} style={{ ...btnStyle("#333"), width: "auto", padding: "10px 40px", background: "transparent", color: "#7a8296", border: `1px solid ${BORDER}` }}>Back</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export function LobbyScreen({ roomCode, players, isHost, auctionMode, emit, onModeSelect, onStart }) {
    const [hov, setHov] = useState(null);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);
    const takenTeams = new Set(players.filter(p => p.teamId).map(p => p.teamId));
    const myPlayer = players.find(p => p.isHost === isHost) || players[0]; // rough, fixed in App

    const selectTeam = (teamId) => {
        emit("select-team", { teamId }, (res) => {
            if (!res?.ok) setError(res?.error || "Cannot select");
            else setError("");
        });
    };

    const startGame = () => {
        if (!auctionMode) return setError("Host must select auction mode first");
        onStart();
    };

    return (
        <div style={{ minHeight: "100vh", background: BG, fontFamily: 'var(--font-ui)', padding: "30px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
            <div style={{ animation: "fadeUp .4s ease-out", textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: "clamp(24px,3.5vw,42px)", color: GOLD, letterSpacing: 0 }}>IPL auction lobby</div>
                <div style={{ display: "flex", gap: 14, justifyContent: "center", alignItems: "center", marginTop: 12 }}>
                    <span style={{ color: "#a3a9b8", fontSize: 12, letterSpacing: 0 }}>Room code</span>
                    <span
                        onClick={() => {
                            navigator.clipboard.writeText(roomCode);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                        }}
                        style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: '#a3a9b8', letterSpacing: 0, background: `#22D3EE10`, padding: "4px 18px", borderRadius: 8, border: "1px solid #22D3EE30", cursor: "pointer", position: "relative" }}
                        title="Click to copy room code"
                    >
                        {roomCode}
                        {copied && <div style={{ position: "absolute", top: -25, left: "50%", transform: "translateX(-50%)", background: '#a3a9b8', color: "#000", fontSize: 12, padding: "2px 8px", borderRadius: 4, letterSpacing: 0, fontFamily: 'var(--font-ui)' }}>Copied!</div>}
                    </span>
                    <a href={`https://wa.me/?text=Join%20my%20IPL%20Auction%20room!%20Code:%20${roomCode}`} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, background: "#25D36622", border: "1px solid #25D36650", padding: "6px 14px", borderRadius: 8, color: "#25D366", fontSize: 13, fontWeight: 600, textDecoration: "none", transition: 'background-color .15s, border-color .15s, color .15s, opacity .15s' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" /></svg>
                        SHARE
                    </a>
                </div>
            </div>

            {/* Players List */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginBottom: 24, animation: "fadeUp .5s ease-out" }}>
                {players.map((p, i) => {
                    const team = TEAMS.find(t => t.id === p.teamId);
                    return (
                        <div key={i} style={{ background: CARD, border: `1px solid ${team ? team.color + "40" : BORDER}`, borderRadius: 10, padding: "12px 20px", minWidth: 140, textAlign: "center" }}>
                            <div style={{ fontSize: 14, color: team ? team.color : "#c9cdd6", fontWeight: 600 }}>{p.name}</div>
                            <div style={{ fontSize: 12, color: "#7a8296", marginTop: 4 }}>{p.isHost ? "👑 HOST" : "Player"}</div>
                            {team && <div style={{ fontSize: 12, color: team.color, marginTop: 6, fontWeight: 600 }}>{team.short}</div>}
                            {!team && <div style={{ fontSize: 12, color: "#7a8296", marginTop: 6 }}>No team</div>}
                        </div>
                    );
                })}
            </div>

            {/* Auction Mode (Host only) */}
            {isHost && (
                <div style={{ marginBottom: 20, textAlign: "center" }}>
                    <div style={{ fontSize: 12, color: "#7a8296", letterSpacing: 0, marginBottom: 10 }}>IPL auction mode</div>
                    <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                        {[["mega", "MEGA (500+)", GOLD], ["mini", "MINI (40)", '#a3a9b8']].map(([m, label, c]) => (
                            <button key={m} onClick={() => onModeSelect(m)}
                                style={{ background: auctionMode === m ? c : "transparent", border: `1px solid ${c}`, borderRadius: 6, padding: "8px 20px", color: auctionMode === m ? "#000" : c, cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-ui)' }}>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {!isHost && auctionMode && <div style={{ color: "#7a8296", fontSize: 12, marginBottom: 16 }}>Mode: {auctionMode === "mega" ? "IPL MEGA AUCTION" : "IPL MINI AUCTION"}</div>}

            {/* Team Selection Grid */}
            <div style={{ fontSize: 12, color: "#7a8296", letterSpacing: 0, marginBottom: 10 }}>Select your franchise</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, maxWidth: 700, marginBottom: 20 }}>
                {TEAMS.map(t => {
                    const taken = takenTeams.has(t.id);
                    const isMine = players.find(p => p.teamId === t.id)?.id === myPlayer?.id;
                    return (
                        <div key={t.id} onClick={() => !taken || isMine ? selectTeam(t.id) : null}
                            onMouseEnter={() => setHov(t.id)} onMouseLeave={() => setHov(null)}
                            style={{ background: isMine ? `${t.color}20` : taken ? "#0a0a0a" : hov === t.id ? `${t.color}10` : CARD, border: `1px solid ${isMine ? t.color : taken ? "#1a1e28" : BORDER}`, borderRadius: 10, padding: "16px 12px", cursor: taken && !isMine ? "not-allowed" : "pointer", textAlign: "center", opacity: taken && !isMine ? 0.35 : 1, transition: 'background-color .15s, border-color .15s, color .15s, opacity .15s' }}>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: t.color, letterSpacing: 0 }}>{t.short}</div>
                            <div style={{ fontSize: 12, color: "#7a8296", marginTop: 4 }}>{t.name}</div>
                            {taken && !isMine && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>Taken</div>}
                            {isMine && <div style={{ fontSize: 12, color: t.color, marginTop: 4 }}>Your team</div>}
                        </div>
                    );
                })}
            </div>

            {error && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</div>}

            {isHost && (
                <button onClick={startGame}
                    style={{ background: `${GOLD}`, border: "none", borderRadius: 6, padding: "14px 50px", color: "#000", fontWeight: 600, fontSize: 16, letterSpacing: 0, cursor: "pointer", fontFamily: 'var(--font-display)' }}>
                    START AUCTION
                </button>
            )}
            {!isHost && <div style={{ color: "#7a8296", fontSize: 13, letterSpacing: 0 }}>Waiting for host to start...</div>}
        </div>
    );
}
