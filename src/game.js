// $EVOLVE game rules. The server is the source of truth for live progress.
// Keep these numbers in step with the TIERS / STAGES / FORMS lists in public/index.html.

export const TIERS = [
  { id: "pink",    n: "Pink Egg",    min: 1,        mult: 1,   devOdds: 0.001,  dragon: 0 },
  { id: "silver",  n: "Silver Egg",  min: 1000000,  mult: 1.5, devOdds: 0.0015, dragon: 5 },
  { id: "gold",    n: "Gold Egg",    min: 5000000,  mult: 2,   devOdds: 0.0025, dragon: 10 },
  { id: "diamond", n: "Diamond Egg", min: 10000000, mult: 3,   devOdds: 0.005,  dragon: 20 },
];
export const STAGES = [
  { lvl: 1, xp: 0, n: "Egg" }, { lvl: 2, xp: 100, n: "Goblin" }, { lvl: 3, xp: 300, n: "Degenerate" },
  { lvl: 4, xp: 700, n: "Whale" }, { lvl: 5, xp: 1500, n: "???" },
];
export const FORMS = [
  { id: "dev", n: "The Dev", base: 0 }, { id: "dragon", n: "Diamond Dragon", base: 4 },
  { id: "phoenix", n: "Rug Phoenix", base: 8 }, { id: "alien", n: "Chart Alien", base: 20 },
  { id: "robot", n: "MEV Bot", base: 20 }, { id: "ghost", n: "Paper Ghost", base: 30 },
];
export const XP_PER_MIN = 1, BUY_XP = 25, SELL_XP = -30;

const ADJ = ["Feral","Sleepy","Based","Crusty","Shiny","Unhinged","Lucky","Greasy","Cosmic","Damp","Turbo","Haunted"];
const NOUN = ["Bagholder","Wick","Pump","Moonboy","Candle","Jeet","Gremlin","Floor","Sniper","Dipper","Chad","Noodle"];

export const tierOf = bal => [...TIERS].reverse().find(t => bal >= t.min) || null;
export const stageOf = xp => STAGES.filter(s => xp >= s.xp).pop();
const fmtNum = n => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M" : n >= 1e3 ? Math.round(n / 1e3) + "K" : String(Math.floor(n));
const fmtTime = ms => { const m = Math.floor(ms / 60000); if (m < 60) return m + "m"; const h = Math.floor(m / 60); return h < 48 ? h + "h" : Math.floor(h / 24) + "d"; };

function hash(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

export function fresh(addr) {
  const h = hash(addr);
  return { addr, name: ADJ[h % ADJ.length] + " " + NOUN[(h >>> 8) % NOUN.length], bal: 0, xp: 0, buys: 0, sells: 0,
    comebacks: 0, heldMs: 0, last: Date.now(), form: null, hatched: false, tier: null, log: [] };
}

function log(st, m, c = "") { st.log.unshift({ m, c, t: Date.now() }); st.log = st.log.slice(0, 30); }

function roll(st, tier) {
  if (Math.random() < tier.devOdds) return "dev";
  const w = {}; FORMS.forEach(f => w[f.id] = f.base);
  w.dragon += tier.dragon + (st.sells === 0 ? 30 : 0);
  w.phoenix += st.comebacks * 8;
  w.ghost += st.sells * 8;
  w.robot += Math.max(0, st.buys - 5) * 3;
  w.alien += Math.floor(st.heldMs / 21600000) * 2;
  let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
  for (const k in w) { r -= w[k]; if (r <= 0) return k; }
  return "alien";
}

function gain(st, dx) {
  const before = stageOf(st.xp).lvl;
  st.xp = Math.max(0, Math.round(st.xp + dx));
  const after = stageOf(st.xp).lvl;
  if (after <= before) return;
  if (after === 5 && !st.form) {
    st.form = roll(st, tierOf(st.bal) || TIERS[0]);
    const f = FORMS.find(x => x.id === st.form);
    log(st, `The box opened: ${f.n}.`, "g");
  } else {
    log(st, `Evolved into a ${stageOf(st.xp).n}.`, "g");
  }
}

/** Apply a fresh on-chain balance reading to a wallet's state. Mutates st. */
export function applyBalance(st, bal, now) {
  bal = Math.max(0, Number(bal) || 0);
  const prevTier = tierOf(st.bal);
  if (st.bal > 0) {
    const mins = Math.floor((now - st.last) / 60000);
    if (mins > 0) {
      st.heldMs += mins * 60000; st.last += mins * 60000;
      const xp = mins * XP_PER_MIN * prevTier.mult;
      if (mins >= 30) log(st, `Held for ${fmtTime(mins * 60000)}: +${Math.round(xp)} XP.`, "g");
      gain(st, xp);
    }
  } else st.last = now;

  if (bal > st.bal) {
    const first = !st.hatched;
    if (st.sells > 0 && st.bal === 0) st.comebacks++;
    st.buys++; st.bal = bal; st.hatched = true;
    const t = tierOf(bal);
    if (first) log(st, `${t.n} cracked open. Say hi to ${st.name}.`, "g");
    else { log(st, `Bought in. Bag is now ${fmtNum(bal)}.`, "g"); gain(st, BUY_XP * t.mult); }
    if (prevTier && TIERS.indexOf(t) > TIERS.indexOf(prevTier)) log(st, `Upgraded to a ${t.n}.`, "g");
  } else if (bal < st.bal) {
    st.sells++; st.bal = bal;
    log(st, bal === 0 ? "Sold everything. Your creature is waiting for you to come back." : `Sold some. Bag is now ${fmtNum(bal)}.`, "r");
    gain(st, SELL_XP);
    const t = tierOf(bal);
    if (prevTier && (!t || TIERS.indexOf(t) < TIERS.indexOf(prevTier))) log(st, t ? `Dropped to a ${t.n}.` : "No bag, no tier.", "r");
  }
  const t = tierOf(st.bal);
  st.tier = t ? t.id : null;
  return st;
}

export function publicState(st) {
  const { addr, name, bal, xp, buys, sells, comebacks, heldMs, last, form, hatched, tier, log } = st;
  return { addr, name, bal, xp, buys, sells, comebacks, heldMs, last, form, hatched, tier, log };
}
