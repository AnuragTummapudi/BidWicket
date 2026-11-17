'use client';

import { useState, useMemo } from "react";
import { TEAMS, ROLE_C, ROLE_L, ROLE_EMOJI, GOLD, BG, CARD, BORDER } from "./MultiScreens";


const fmt = c => c >= 1 ? `₹${c.toFixed(2)} Cr` : `₹${Math.round(c * 100)} L`;

export function StatsModal({ isOpen, gs, onClose }) {
    const [tab, setTab] = useState("upcoming");

    const sold = useMemo(() => (gs?.auctionLog || []).filter(l => l.sold), [gs?.auctionLog]);
    const unsold = useMemo(() => (gs?.auctionLog || []).filter(l => !l.sold), [gs?.auctionLog]);
    const upcoming = useMemo(() => (gs?.playerQueue || []).slice((gs?.currentIdx || 0) + 1), [gs?.playerQueue, gs?.currentIdx]);
    const leaderboard = useMemo(() => [...sold].sort((a, b) => b.price - a.price), [sold]);

    if (!isOpen) return null;

    const tabs = [
        { id: "upcoming", label: `UPCOMING (${upcoming.length})` },
        { id: "sold", label: `SOLD (${sold.length})` },
        { id: "unsold", label: `UNSOLD (${unsold.length})` },
        { id: "leaderboard", label: "LEADERBOARD" },
    ];

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center", fontFamily: 'var(--font-ui)', padding: 20 }}>
            {/* Backdrop */}
            <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(5,7,13,0.85)", backdropFilter: "blur(8px)", animation: "fadeIn .2s" }} />

            {/* Modal Container */}
            <div style={{ position: "relative", width: "100%", maxWidth: 880, height: "85vh", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden", animation: "popIn .3s cubic-bezier(0.16, 1, 0.3, 1)", boxShadow: `0 0 0 transparent` }}>
                <style>{`
          @keyframes fadeIn{from{opacity:0}to{opacity:1}}
          @keyframes popIn{from{opacity:0;transform:scale(0.96) translateY(20px)}to{opacity:1;transform:none}}
          .st-tab{padding:14px 20px;font-family:var(--font-display);font-size:22px;letter-spacing:0;cursor:pointer;transition:background-color .15s, border-color .15s, color .15s, opacity .15s;text-align:center;flex:1}
          .st-tab:hover{background:rgba(212,175,55,0.05)}
        `}</style>

                {/* Header Tabs */}
                <div style={{ display: "flex", borderBottom: `1px solid ${BORDER}`, background: "#1a1e28" }}>
                    {tabs.map(t => (
                        <div key={t.id} className="st-tab" onClick={() => setTab(t.id)}
                            style={{ color: tab === t.id ? GOLD : "#7a8296", borderBottom: `2px solid ${tab === t.id ? GOLD : "transparent"}`, background: tab === t.id ? `${GOLD}11` : "transparent" }}>
                            {t.label}
                        </div>
                    ))}
                    <div onClick={onClose} style={{ padding: "0 24px", cursor: "pointer", display: "flex", alignItems: "center", borderLeft: `1px solid ${BORDER}`, color: "#ef4444", fontWeight: 600, fontSize: 24 }}>×</div>
                </div>

                {/* Content Area */}
                <div style={{ flex: 1, overflowY: "auto", padding: 20, background: BG }}>
                    {/* UPCOMING */}
                    {tab === "upcoming" && (
                        <div style={{ display: "grid", gap: 8 }}>
                            {upcoming.length === 0 && <div style={{ color: "#7a8296", textAlign: "center", padding: 40 }}>No upcoming players</div>}
                            {upcoming.map((p, i) => {
                                const newSet = i === 0 ? true : upcoming[i - 1].setName !== p.setName;
                                return (
                                    <div key={i}>
                                        {newSet && <div style={{ color: GOLD, fontSize: 13, letterSpacing: 0, fontWeight: 600, padding: "16px 0 8px" }}>{p.setName.toUpperCase()}</div>}
                                        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                <span style={{ fontSize: 20, background: `${ROLE_C[p.role]}1a`, borderRadius: "50%", display: "flex", width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>{ROLE_EMOJI[p.role]}</span>
                                                <div>
                                                    <div style={{ fontSize: 16, fontWeight: 600, color: "#c9cdd6" }}>{p.name}</div>
                                                    <div style={{ fontSize: 12, color: "#7a8296", marginTop: 2 }}>{ROLE_L[p.role]} {p.overseas ? "· OVERSEAS" : ""}</div>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: "right" }}>
                                                <div style={{ color: GOLD, fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: 0 }}>{fmt(p.base)}</div>
                                                <div style={{ color: "#7a8296", fontSize: 12, letterSpacing: 0 }}>Base price</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* SOLD */}
                    {tab === "sold" && (
                        <div style={{ display: "grid", gap: 8 }}>
                            {sold.length === 0 && <div style={{ color: "#7a8296", textAlign: "center", padding: 40 }}>No players sold yet</div>}
                            {sold.map((l, i) => {
                                const team = TEAMS.find(t => t.id === l.bidder);
                                return (
                                    <div key={i} style={{ background: CARD, border: `1px solid ${team?.color}40`, borderLeft: `4px solid ${team?.color}`, borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                            <span style={{ fontSize: 20, background: `${ROLE_C[l.player.role]}1a`, borderRadius: "50%", display: "flex", width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>{ROLE_EMOJI[l.player.role]}</span>
                                            <div>
                                                <div style={{ fontSize: 16, fontWeight: 600, color: "#c9cdd6" }}>{l.player.name}</div>
                                                <div style={{ fontSize: 13, color: team?.color || GOLD, marginTop: 4, fontWeight: 600, textShadow: 'none' }}>BOUGHT BY {team?.name?.toUpperCase()}</div>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                            <div style={{ color: GOLD, fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: 0 }}>{fmt(l.price)}</div>
                                            <div style={{ color: "#7a8296", fontSize: 12 }}>Base: {fmt(l.player.base)}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* UNSOLD */}
                    {tab === "unsold" && (
                        <div style={{ display: "grid", gap: 8 }}>
                            {unsold.length === 0 && <div style={{ color: "#7a8296", textAlign: "center", padding: 40 }}>No unsold players</div>}
                            {unsold.map((l, i) => (
                                <div key={i} style={{ background: CARD, border: `1px solid #ef444440`, borderLeft: `4px solid #ef4444`, borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.8 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        <span style={{ fontSize: 20, background: `${ROLE_C[l.player.role]}1a`, borderRadius: "50%", display: "flex", width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>{ROLE_EMOJI[l.player.role]}</span>
                                        <div>
                                            <div style={{ fontSize: 16, fontWeight: 600, color: "#c9cdd6" }}>{l.player.name}</div>
                                            <div style={{ fontSize: 12, color: "#7a8296", marginTop: 4 }}>{l.player.setName}</div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        <div style={{ color: "#ef4444", fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: 0 }}>Unsold</div>
                                        <div style={{ color: "#7a8296", fontSize: 12 }}>Base: {fmt(l.player.base)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* LEADERBOARD */}
                    {tab === "leaderboard" && (
                        <div style={{ display: "grid", gap: 12 }}>
                            {leaderboard.length === 0 && <div style={{ color: "#7a8296", textAlign: "center", padding: 40 }}>Leaderboard empty</div>}
                            {leaderboard.map((l, i) => {
                                const team = TEAMS.find(t => t.id === l.bidder);
                                return (
                                    <div key={i} style={{ background: i === 0 ? `linear-gradient(90deg, ${GOLD}22, ${CARD})` : CARD, border: `1px solid ${i === 0 ? GOLD : BORDER}`, borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: i === 0 ? GOLD : "#7a8296", width: 30, textAlign: "center" }}>#{i + 1}</div>
                                        <span style={{ fontSize: 24, background: `${ROLE_C[l.player.role]}1a`, borderRadius: "50%", display: "flex", width: 50, height: 50, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{ROLE_EMOJI[l.player.role]}</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 18, fontWeight: 600, color: i === 0 ? GOLD : "#c9cdd6" }}>{l.player.name}</div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                                                <span style={{ fontSize: 13, color: team?.color || GOLD, fontWeight: 600 }}>{team?.name?.toUpperCase()}</span>
                                                <span style={{ fontSize: 12, color: "#7a8296" }}>•</span>
                                                <span style={{ fontSize: 13, color: ROLE_C[l.player.role], fontWeight: 600 }}>{ROLE_L[l.player.role]}</span>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                            <div style={{ color: GOLD, fontFamily: 'var(--font-display)', fontSize: 28, letterSpacing: 0, textShadow: i === 0 ? `0 0 0 transparent` : "none" }}>{fmt(l.price)}</div>
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
