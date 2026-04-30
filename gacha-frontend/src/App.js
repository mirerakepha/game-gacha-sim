import { useState, useCallback } from "react";
import "./App.css";

const API = "http://localhost:8080";
const SESSION = "player_" + Math.random().toString(36).slice(2, 9);

const TIER_CONFIG = {
  mythic: { label: "MYTHIC", bg: "#1a0020", border: "#cc00ff", glow: "#cc00ff", text: "#f0aaff", badge: "#cc00ff" },
  legendary: { label: "LEGENDARY", bg: "#1a0d00", border: "#ff8800", glow: "#ff8800", text: "#ffd080", badge: "#ff8800" },
  epic: { label: "EPIC", bg: "#00101a", border: "#00c3ff", glow: "#00c3ff", text: "#80e8ff", badge: "#00c3ff" },
  coin: { label: "COIN", bg: "#0d0d0a", border: "#c8a800", glow: "#c8a800", text: "#ffe566", badge: "#c8a800" },
};

const REDEEMABLE_POOL = [
  { id: "mw1", name: "Shadow Reaper", tier: "mythic", cost: 500 },
  { id: "mw2", name: "Void Striker", tier: "mythic", cost: 500 },
  { id: "mw3", name: "Crimson Eclipse", tier: "mythic", cost: 500 },
  { id: "lw1", name: "Storm Cleaver", tier: "legendary", cost: 200 },
  { id: "lw2", name: "Inferno Pulse", tier: "legendary", cost: 200 },
  { id: "ep1", name: "Phantom Armor", tier: "epic", cost: 80 },
  { id: "ep2", name: "Neon Parachute", tier: "epic", cost: 80 },
];

function RewardBox({ reward, size = "md", dimmed = false }) {
  const cfg = TIER_CONFIG[reward.tier];
  const s = { sm: { box: 70, name: 10 }, md: { box: 120, name: 12 }, lg: { box: 160, name: 13 } }[size];
  return (
    <div style={{ width: s.box, height: s.box, background: cfg.bg, border: `2px solid ${cfg.border}`, borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: dimmed ? "none" : `0 0 18px ${cfg.glow}55`, opacity: dimmed ? 0.45 : 1, flexShrink: 0, position: "relative", transition: "all 0.2s" }}>
      <div style={{ position: "absolute", top: 4, right: 5, fontSize: 9, fontWeight: 800, color: cfg.badge, letterSpacing: 1, textTransform: "uppercase" }}>{cfg.label}</div>
      <div style={{ fontSize: reward.tier === "coin" ? 28 : 24 }}>
        {reward.tier === "mythic" && "⚔️"}{reward.tier === "legendary" && "🗡️"}{reward.tier === "epic" && "🛡️"}{reward.tier === "coin" && "🪙"}
      </div>
      <div style={{ color: cfg.text, fontSize: s.name, fontWeight: 700, textAlign: "center", padding: "0 4px", lineHeight: 1.2 }}>{reward.name}</div>
    </div>
  );
}

function InventoryPanel({ collected, coins }) {
  return (
    <div className="inventory-panel">
      <div className="panel-header"><span className="panel-title">INVENTORY</span><span className="coin-badge">🪙 {coins}</span></div>
      <div className="inv-section-label">WEAPONS & GEAR</div>
      <div className="inv-grid">
        {collected.filter(r => r.tier !== "coin").length === 0 && <div className="empty-msg">No rewards yet</div>}
        {collected.filter(r => r.tier !== "coin").map((r, i) => <RewardBox key={i} reward={r} size="sm" />)}
      </div>
      <div className="inv-section-label" style={{ marginTop: 14 }}>COIN PULLS</div>
      <div className="coin-list">
        {collected.filter(r => r.tier === "coin").length === 0 && <div className="empty-msg">No coin drops yet</div>}
        {collected.filter(r => r.tier === "coin").map((r, i) => (
          <div key={i} style={{ fontSize: 12, color: "#ffe566", borderBottom: "1px solid #2a2500", padding: "3px 0" }}>🪙 {r.name}</div>
        ))}
      </div>
    </div>
  );
}

function RedeemPanel({ coins, onRedeem }) {
  const [msg, setMsg] = useState(null);
  const handleRedeem = async (item) => {
    const res = await fetch(`${API}/redeem`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: SESSION, weapon_id: item.id }) });
    const data = await res.json();
    setMsg({ success: data.success, text: data.message });
    if (data.success) onRedeem(data.collected_coins, item);
    setTimeout(() => setMsg(null), 3000);
  };
  return (
    <div className="redeem-panel">
      <div className="panel-header"><span className="panel-title">REDEEM</span><span className="coin-badge">🪙 {coins}</span></div>
      {msg && <div className="redeem-msg" style={{ color: msg.success ? "#88ff88" : "#ff6666" }}>{msg.text}</div>}
      <div className="redeem-list">
        {REDEEMABLE_POOL.map(item => {
          const cfg = TIER_CONFIG[item.tier];
          const canAfford = coins >= item.cost;
          return (
            <div key={item.id} className="redeem-item" style={{ borderColor: cfg.border + "66" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: cfg.border, flexShrink: 0 }} />
                <div>
                  <div style={{ color: cfg.text, fontSize: 12, fontWeight: 700 }}>{item.name}</div>
                  <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase" }}>{item.tier}</div>
                </div>
              </div>
              <button className="redeem-btn" style={{ borderColor: canAfford ? cfg.border : "#333", color: canAfford ? cfg.text : "#444", cursor: canAfford ? "pointer" : "not-allowed" }} onClick={() => handleRedeem(item)} disabled={!canAfford}>🪙 {item.cost}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [spinning, setSpinning] = useState(false);
  const [lastReward, setLastReward] = useState(null);
  const [collected, setCollected] = useState([]);
  const [coins, setCoins] = useState(0);
  const [pity, setPity] = useState(0);
  const [spinCount, setSpinCount] = useState(0);
  const [tab, setTab] = useState("inventory");

  const spin = useCallback(async () => {
    if (spinning) return;
    setSpinning(true);
    try {
      const res = await fetch(`${API}/spin?session=${SESSION}`, { method: "POST" });
      const data = await res.json();
      setLastReward(data.reward);
      setPity(data.pity_counter);
      setCoins(data.collected_coins);
      setSpinCount(c => c + 1);
      setCollected(prev => [data.reward, ...prev]);
    } catch (e) {
      alert("Cannot reach backend. Make sure Go server is running on :8080");
    } finally {
      setSpinning(false);
    }
  }, [spinning]);

  const handleRedeem = (newCoins, item) => {
    setCoins(newCoins);
    setCollected(prev => [{ ...item, redeemed: true }, ...prev]);
  };

  return (
    <div className="app-root">
      <div className="left-panel">
        <div className="left-tabs">
          {["inventory", "redeem"].map(t => (
            <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t.toUpperCase()}</button>
          ))}
        </div>
        {tab === "inventory" && <InventoryPanel collected={collected} coins={coins} />}
        {tab === "redeem" && <RedeemPanel coins={coins} onRedeem={handleRedeem} />}
      </div>

      <div className="main-area">
        <div className="game-title"><span className="title-glow">SHADOW</span><span className="title-accent"> CRATE</span></div>
        <div className="subtitle">Bloodstrike-style Gacha Simulator</div>

        <div className="stats-row">
          <div className="stat-box"><span className="stat-label">SPINS</span><span className="stat-val">{spinCount}</span></div>
          <div className="stat-box"><span className="stat-label">PITY</span><span className="stat-val">{pity}<span style={{ fontSize: 11, color: "#555" }}>/100</span></span></div>
          <div className="stat-box"><span className="stat-label">COINS</span><span className="stat-val coin-val">🪙 {coins}</span></div>
        </div>

        <div className="pity-bar-wrap">
          <div className="pity-bar-label">PITY PROGRESS — guaranteed mythic at 100 spins</div>
          <div className="pity-bar-track"><div className="pity-bar-fill" style={{ width: `${Math.min(pity, 100)}%` }} /></div>
        </div>

        <div className="result-area">
          {!lastReward && !spinning && (
            <div className="result-placeholder"><div className="placeholder-icon">🎰</div><div className="placeholder-text">Press SPIN to pull from the crate</div></div>
          )}
          {spinning && (
            <div className="result-placeholder"><div className="spin-pulse">⚡</div><div className="placeholder-text">Opening crate...</div></div>
          )}
          {lastReward && !spinning && (
            <div className="result-reveal">
              <div className="result-label" style={{ color: TIER_CONFIG[lastReward.tier].border }}>YOU GOT</div>
              <RewardBox reward={lastReward} size="lg" />
              <div className="result-name" style={{ color: TIER_CONFIG[lastReward.tier].text }}>{lastReward.name}</div>
              <div className="result-tier" style={{ color: TIER_CONFIG[lastReward.tier].badge, borderColor: TIER_CONFIG[lastReward.tier].border + "44" }}>
                {TIER_CONFIG[lastReward.tier].label}{lastReward.tier === "coin" && ` (+${lastReward.coin_value} coins)`}
              </div>
            </div>
          )}
        </div>

        <button className={`spin-btn ${spinning ? "spinning" : ""}`} onClick={spin} disabled={spinning}>
          {spinning ? "OPENING..." : "⚔ SPIN"}
        </button>

        {collected.length > 0 && (
          <div className="history-row">
            <div className="history-label">RECENT PULLS</div>
            <div className="history-scroll">
              {collected.slice(0, 12).map((r, i) => <RewardBox key={i} reward={r} size="sm" dimmed={i > 0} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}