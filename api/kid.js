// GET /api/kid?mint=  one coin and its leader: its record, the leader's posts (and the ones on X), its answers, its raid kit,
// what happened to it, and its council (with how each member is doing now). Never the X keys.
const L = require('./_lib');
const XA = require('./_x');
const COLS = `mint, slot, name, symbol, line, style, look, seed, xhandle, payer, shares, gods, draw, born_at, status, state, mcap_sol, complete, last_trade_at, vault_lamports, created_at, notes, note_at, likes, pushed_at, pushes`;
module.exports = async (req, res) => {
  const mint = String(L.query(req).mint || '').trim();
  if (!L.isAddr(mint)) return L.send(res, 200, { ok: false, error: 'That isn’t a token address.' });
  if (!L.dbReady()) return L.send(res, 200, { ok: false, error: 'LEADERS’ records are offline.' });
  try {
    await L.ready();
    const k = (await L.q(`SELECT ${COLS} FROM ldr_coins WHERE mint=$1`, [mint]))[0];
    if (!k || k.status === 'void') return L.send(res, 200, { ok: false, missing: true, error: 'No leader lives at that address.' }, L.CACHE(10));
    const gods = typeof k.gods === 'string' ? JSON.parse(k.gods) : (k.gods || []);
    const [notes, log, lives, solUsd, xs, raids] = await Promise.all([
      L.q(`SELECT id, kind, text, q, at, tweet_id, posted_at FROM ldr_notes WHERE mint=$1 ORDER BY id DESC LIMIT 80`, [mint]),
      L.q(`SELECT kind, text, at FROM ldr_log WHERE mint=$1 ORDER BY id DESC LIMIT 20`, [mint]),
      gods.length ? L.q(`SELECT wallet, born_at, state FROM ldr_lives WHERE wallet = ANY($1)`, [gods.map(g => g.wallet)]) : [],
      L.solPrice().catch(() => null),
      L.q(`SELECT handle, xname, posts, last_post_at, connected_at, error FROM ldr_x WHERE mint=$1`, [mint]),
      L.q(`SELECT posts, at FROM ldr_raids WHERE mint=$1 AND at > now() - interval '6 hours'`, [mint]),
    ]);
    const now = new Map(lives.map(l => [l.wallet, l]));
    const godsNow = gods.map(g => { const l = now.get(g.wallet); return { ...g, alive: !!(l && l.state === 'alive'), now: l && l.state === 'alive' ? L.stageOf(l.born_at).stage : 'dead' }; });
    L.send(res, 200, { ok: true, coin: { ...k, gods: godsNow }, posts: notes.filter(n => n.kind !== 'answer'), x: xs[0] || null, xopen: XA.open(), raid: raids[0] ? raids[0].posts : null, comments: notes.filter(n => n.kind === 'answer').slice(0, 30), log, solUsd,
      studio: L.STUDIO || null, xi: L.XI }, L.CACHE(5, 60));
  } catch (e) { L.send(res, 200, { ok: false, error: 'LEADERS’ records didn’t answer.' }); }
};
