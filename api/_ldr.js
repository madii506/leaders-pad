// LEADERS: every coin launched here is born with its own AI leader, and $LEADERS council members are drawn as the council of
// every new coin. This file: reading coins from the chain, the first-council member draw, council members joining and leaving, the
// posts every leader writes (a small OpenAI model writes them) and the leader of the hour.
const crypto = require('crypto');
const L = require('./_lib');
const DAY = L.DAY, HOUR = 36e5;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const short = a => String(a).slice(0, 4) + '…' + String(a).slice(-4);
const BREAK = 'It’s offline for a bit: the house’s AI credits are being topped up. Try again soon.';
const broke = e => /credit|quota|payment|insufficient|top-?up|limit/i.test(String(e || ''));

// ---------- the chain ----------
async function routingOf(mint) {
  if (L.MOCK && L.MOCK.routing) return L.MOCK.routing(mint);
  return require('./_pump').routing(mint, L.accounts);
}
const sameShares = (got, want) => got.length === want.length && want.every((w, i) => got[i].address === w.address && got[i].bps === w.bps);
const parse = v => (typeof v === 'string' ? JSON.parse(v) : v);
async function settle(mint) {
  const k = (await L.q('SELECT mint, symbol, name, status, slot, shares FROM ldr_coins WHERE mint=$1', [mint]))[0];
  if (!k) return { ok: false, error: 'No coin was recorded for that token.' };
  if (k.status === 'live') return { ok: true, live: true, slot: k.slot };
  if (k.status === 'void') return { ok: true, live: false, void: true };
  const r = await routingOf(mint);
  if (!r.exists) return { ok: true, live: false, waiting: 'coin' };
  if (!(r.routed && r.revoked && sameShares(r.shareholders, parse(k.shares)))) return { ok: true, live: false, waiting: 'split', mint };
  for (let i = 0; i < 4; i++) {
    try {
      const u = await L.q(`UPDATE ldr_coins SET status='live', slot=(SELECT coalesce(max(slot),-1)+1 FROM ldr_coins WHERE status='live'), born_at=now(), state=$4,
        last_trade_at=now(), mcap_sol=$2, mcap_note=$2, complete=$3 WHERE mint=$1 AND status<>'live' RETURNING slot`, [mint, r.mcapSol, !!r.complete, r.complete ? 'ascended' : 'alive']);
      if (u.length) await L.log('born', mint, `${k.name} ($${k.symbol}) went live with its leader`);
      const s = (await L.q('SELECT slot FROM ldr_coins WHERE mint=$1', [mint]))[0];
      return { ok: true, live: true, slot: s && s.slot, fresh: u.length > 0 };
    } catch (e) { if (!/unique|duplicate/i.test(String(e && e.message))) throw e; }
  }
  return { ok: true, live: false, waiting: 'slot' };
}
async function lastTrade(mint) {
  if (L.MOCK && L.MOCK.lastTrade) return L.MOCK.lastTrade(mint);
  const r = await L.rpc('getSignaturesForAddress', [L.bondingCurveOf(mint), { limit: 1, commitment: 'confirmed' }]).catch(() => null);
  return r && r[0] && r[0].blockTime ? new Date(r[0].blockTime * 1000) : null;
}
// alive while it trades; asleep after six quiet hours; dead after a quiet week; ascended once its curve completes
const stateFor = (k, now) => k.complete ? 'ascended' : !k.last_trade_at ? 'alive' : now - new Date(k.last_trade_at) >= 7 * DAY ? 'dead' : now - new Date(k.last_trade_at) >= 6 * HOUR ? 'asleep' : 'alive';
const SAYS = { alive: 'is back: someone traded', asleep: 'went quiet: six hours without a trade', dead: 'died: a week without a trade', ascended: 'graduated: its curve is complete' };
async function readBoard() {
  const ks = await L.q(`SELECT mint, symbol, name, state, mcap_sol, complete, last_trade_at FROM ldr_coins WHERE status='live' ORDER BY slot`);
  const vaults = ks.length ? await L.accounts(ks.map(k => L.vaultOf(k.mint))).catch(() => ks.map(() => null)) : [];
  const curves = ks.length ? await L.accounts(ks.map(k => L.bondingCurveOf(k.mint))).catch(() => ks.map(() => null)) : [];
  const now = Date.now(); let changes = 0;
  await L.pool(ks, 6, async (k, i) => {
    let mcap = k.mcap_sol, complete = k.complete;
    if (L.MOCK && L.MOCK.routing) { const r = await L.MOCK.routing(k.mint); mcap = r.mcapSol; complete = !!r.complete; }
    else if (curves[i]) { try { const { PUMP_SDK } = require('@pump-fun/pump-sdk'); const bc = PUMP_SDK.decodeBondingCurve(curves[i]); const vq = bc.virtualSolReserves || bc.virtualQuoteReserves, vt = bc.virtualTokenReserves; complete = !!bc.complete; if (vt && !vt.isZero()) mcap = Number(vq.mul(bc.tokenTotalSupply).div(vt).toString()) / 1e9; } catch {} }
    const vl = vaults[i] ? Math.max(0, vaults[i].lamports - L.RENT0) : 0;
    const t = complete ? null : await lastTrade(k.mint);
    const last = t && (!k.last_trade_at || t > new Date(k.last_trade_at)) ? t : k.last_trade_at;
    const st = stateFor({ ...k, complete, last_trade_at: last }, now);
    if (st !== k.state) { changes++; await L.log(st, k.mint, `${k.name} ${SAYS[st]}`); }
    await L.q(`UPDATE ldr_coins SET mcap_sol=$2, complete=$3, last_trade_at=$4, state=$5, vault_lamports=$6 WHERE mint=$1`, [k.mint, mcap, complete, last, st, vl]);
  });
  return { coins: ks.length, changes };
}

// ---------- council members: drawn from $LEADERS council members the moment a coin is recorded, weighted by how long each has been
// serving (new 1x, regular 1.5x, fan 2x, day one 3x). The draw is seeded by Solana's latest finalized blockhash. ----------
function prng(seedHex) { let ctr = 0; return () => crypto.createHash('sha256').update(seedHex + ':' + (ctr++)).digest().readUInt32BE(0) / 4294967296; }
async function drawGods(mint, payer) {
  const lives = await L.q(`SELECT wallet, born_at FROM ldr_lives WHERE state='alive' ORDER BY born_at LIMIT 5000`);
  const pool = lives.filter(l => l.wallet !== payer && l.wallet !== L.STUDIO);
  let bh = null; try { bh = (await L.rpc('getLatestBlockhash', [{ commitment: 'finalized' }])).value.blockhash; } catch {}
  const draw = { blockhash: bh, pool: pool.length, at: new Date().toISOString() };
  if (!pool.length) return { gods: [], draw };
  if (!bh) throw new Error('Solana didn’t answer, so the council members couldn’t be drawn. Try again in a moment.');
  const rnd = prng(crypto.createHash('sha256').update(bh + ':' + mint).digest('hex'));
  const keyed = pool.map(l => { const s = L.stageOf(l.born_at); return { wallet: l.wallet, stage: s.stage, mult: s.mult, key: Math.log(Math.max(1e-12, rnd())) / s.mult }; });
  keyed.sort((a, b) => b.key - a.key);
  return { gods: keyed.slice(0, L.MAX_GODS).map(({ wallet, stage, mult }) => ({ wallet, stage, mult })), draw };
}

// ---------- council members ----------
async function lifeOf(wallet) {
  const l = (await L.q('SELECT wallet, born_at, burned, held, state, died_at, cause, lives FROM ldr_lives WHERE wallet=$1', [wallet]))[0];
  if (!l) return null;
  const kids = await L.q(`SELECT mint, name, symbol, seed, state, mcap_sol, vault_lamports, born_at FROM ldr_coins WHERE status='live' AND gods @> $1::jsonb ORDER BY born_at DESC LIMIT 100`,
    [JSON.stringify([{ wallet }])]);
  return { ...l, burned: String(l.burned), held: String(l.held), ...(l.state === 'alive' ? L.stageOf(l.born_at) : {}), godchildren: kids };
}
async function buildBurn(wallet, whole) {
  const t = await L.lifeToken(); if (!t) throw new Error('Joining opens when $LEADERS launches.');
  const n = Math.floor(Number(whole));
  if (!(n >= L.MIN_BURN)) throw new Error(`Joining burns at least ${L.MIN_BURN.toLocaleString('en-US')} $LEADERS.`);
  const raw = BigInt(n) * 10n ** BigInt(t.decimals);
  const ata = L.ataOf(wallet, t.mint, t.program);
  const [acct] = await L.accounts([ata]);
  const have = L.tokenAmount(acct);
  if (have < raw) throw new Error(have === 0n ? 'This wallet holds no $LEADERS yet.' : 'This wallet holds less $LEADERS than that.');
  const { PublicKey, TransactionMessage, VersionedTransaction, ComputeBudgetProgram } = require('@solana/web3.js');
  const { createBurnCheckedInstruction } = require('@solana/spl-token');
  const ix = createBurnCheckedInstruction(new PublicKey(ata), new PublicKey(t.mint), new PublicKey(wallet), raw, t.decimals, [], new PublicKey(t.program));
  const bh = (await L.rpc('getLatestBlockhash', [{ commitment: 'confirmed' }])).value.blockhash;
  const msg = new TransactionMessage({ payerKey: new PublicKey(wallet), recentBlockhash: bh,
    instructions: [ComputeBudgetProgram.setComputeUnitLimit({ units: 40000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100000 }), ix] }).compileToV0Message();
  return { tx: Buffer.from(new VersionedTransaction(msg).serialize()).toString('base64'), amount: raw.toString(), have: have.toString(), decimals: t.decimals, mint: t.mint, program: t.program, ata };
}
async function verifyBirth(wallet, sig) {
  const t = await L.lifeToken(); if (!t) return { ok: false, error: 'Joining opens when $LEADERS launches.' };
  const seen = await L.q('SELECT wallet FROM ldr_births WHERE sig=$1', [sig]);
  if (seen.length) return seen[0].wallet === wallet ? { ok: true, already: true, life: await lifeOf(wallet) } : { ok: false, error: 'That burn was already used.' };
  let tx = null;
  for (let i = 0; i < 6 && !tx; i++) {
    tx = await L.rpc('getTransaction', [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]).catch(() => null);
    if (!tx) await sleep(1500);
  }
  if (!tx) return { ok: false, error: 'Solana hasn’t shown that transaction yet. Try again in a moment.' };
  if (tx.meta && tx.meta.err) return { ok: false, error: 'That transaction failed on-chain, so nothing was burned.' };
  const keys = tx.transaction.message.accountKeys.map(k => (typeof k === 'string' ? k : k.pubkey));
  if (keys[0] !== wallet) return { ok: false, error: 'That burn wasn’t signed by this wallet.' };
  const all = [...tx.transaction.message.instructions, ...((tx.meta && tx.meta.innerInstructions) || []).flatMap(x => x.instructions || [])];
  let burned = 0n;
  for (const ix of all) {
    const p = ix.parsed; if (!p || !/^spl-token/.test(ix.program || '')) continue;
    if ((p.type === 'burn' || p.type === 'burnChecked') && p.info && p.info.mint === t.mint && (p.info.authority === wallet || p.info.multisigAuthority === wallet))
      burned += BigInt(p.info.amount || (p.info.tokenAmount && p.info.tokenAmount.amount) || '0');
  }
  const min = BigInt(L.MIN_BURN) * 10n ** BigInt(t.decimals);
  if (burned < min) return { ok: false, error: `Joining burns at least ${L.MIN_BURN.toLocaleString('en-US')} $LEADERS.` };
  const post = ((tx.meta && tx.meta.postTokenBalances) || []).find(b => b.mint === t.mint && b.owner === wallet);
  const held = post && post.uiTokenAmount ? String(post.uiTokenAmount.amount) : '0';
  try { await L.q('INSERT INTO ldr_births (sig, wallet, amount) VALUES ($1,$2,$3)', [sig, wallet, burned.toString()]); }
  catch { return { ok: true, already: true, life: await lifeOf(wallet) }; }
  const before = (await L.q('SELECT state FROM ldr_lives WHERE wallet=$1', [wallet]))[0];
  await L.q(`INSERT INTO ldr_lives (wallet, born_at, burned, held, checked_at) VALUES ($1, now(), $2, $3, now())
    ON CONFLICT (wallet) DO UPDATE SET
      born_at = CASE WHEN ldr_lives.state='dead' THEN now() ELSE ldr_lives.born_at END,
      lives = CASE WHEN ldr_lives.state='dead' THEN ldr_lives.lives + 1 ELSE ldr_lives.lives END,
      burned = CASE WHEN ldr_lives.state='dead' THEN EXCLUDED.burned ELSE ldr_lives.burned + EXCLUDED.burned END,
      held = EXCLUDED.held, state='alive', died_at=NULL, cause=NULL, checked_at=now()`, [wallet, burned.toString(), held]);
  await L.log(before && before.state === 'alive' ? 'fed' : 'birth', null, before && before.state === 'alive' ? `${short(wallet)} burned more $LEADERS` : `${short(wallet)} took a council seat${before ? ' again' : ''}`);
  return { ok: true, life: await lifeOf(wallet) };
}
// a council member whose $LEADERS drops below what it held right after joining has sold: it stops serving
async function checkLives() {
  const t = await L.lifeToken().catch(() => null); if (!t) return { checked: 0, died: 0 };
  const lives = await L.q(`SELECT wallet, held FROM ldr_lives WHERE state='alive' ORDER BY checked_at NULLS FIRST LIMIT 400`);
  if (!lives.length) return { checked: 0, died: 0 };
  let accts; try { accts = await L.accounts(lives.map(l => L.ataOf(l.wallet, t.mint, t.program))); } catch { return { checked: 0, died: 0, why: 'rpc' }; }
  let died = 0;
  for (let i = 0; i < lives.length; i++) {
    const have = L.tokenAmount(accts[i]), held = BigInt(String(lives[i].held).split('.')[0] || '0');
    if (have * 100n < held * 99n) {
      const u = await L.q(`UPDATE ldr_lives SET state='dead', died_at=now(), cause='sold', checked_at=now() WHERE wallet=$1 AND state='alive' RETURNING wallet`, [lives[i].wallet]);
      if (u.length) { died++; await L.log('died', null, `${short(lives[i].wallet)} stopped serving: it sold`); }
    } else await L.q(`UPDATE ldr_lives SET checked_at=now() WHERE wallet=$1`, [lives[i].wallet]);
  }
  return { checked: lives.length, died };
}

// ---------- words: every coin's leader writes its own posts, in its own voice ----------
const ARCH = {
  king: { title: 'King', voice: 'a regal, dramatic king who calls holders his loyal subjects and issues royal decrees' },
  captain: { title: 'Captain', voice: 'a calm, steady ship captain who calls holders the crew and talks in sailing terms' },
  general: { title: 'General', voice: 'a tough, disciplined general who calls holders the troops and gives clear orders' },
  president: { title: 'President', voice: 'a polished president who gives short speeches and makes promises only about memes' },
  coach: { title: 'Coach', voice: 'a loud, hyped-up sports coach who calls holders the team and gives pep talks' },
  boss: { title: 'Boss', voice: 'a cool, calm boss who calls holders the family and never raises his voice' },
};
const archOf = k => ARCH[k.look] || ARCH.king;
const titleOf = k => `${archOf(k).title} ${k.name}`;
const RULES = 'House rules: no financial advice, no price predictions, no numbers about price or market cap, no promises of gains, never tell anyone to buy or sell, never say "100x", "moon" or "guaranteed", no real or famous people, nothing sexual or hateful, no links, no hashtags, at most one emoji.';
const who = k => `You are ${titleOf(k)}, the AI leader of $${k.symbol} (${k.name}), a coin on Solana. Your character: ${archOf(k).voice}. What the coin is, in its launcher's words: """${L.clean(k.line, 300)}""". You lead its community on X: you post updates, rally the holders and answer questions. There is no dev and no CTO lead: you are the leader.`;
async function talk(system, user, max = 160) {
  if (!(await L.spendTalk())) return { ok: false, error: 'Today’s budget for words is spent. It resets at 00:00 UTC.' };
  return L.ai([{ role: 'system', content: system }, { role: 'user', content: user }], max, 20000);
}
function clamp(t, min, max) { t = L.scrub(String(t || '').replace(/[*#]/g, '').replace(/^"|"$/g, '').replace(/https?:\/\/\S+/g, ''), max); return t.length >= min && !L.BANNED.test(t) ? t : null; }
const MOODS = {
  first: 'You were just appointed. Write your first post as the leader: introduce yourself and what you stand for.',
  good: 'Since your last post, people piled in and it was a good day for the community.',
  bad: 'Since your last post, people left and it was a rough day. Keep the community steady.',
  quiet: 'Since your last post, not much happened. Keep the community awake.',
  sleepy: 'Nobody has traded for hours. Rally whoever is still around.',
  push: 'Your coin was just named leader of the hour on LEADERS. Celebrate it, in character.',
};
const FALLBACK = {
  first: k => `${titleOf(k).toLowerCase()} here. $${k.symbol} has a leader now. no dev to wait for, no cto to beg. i post, i rally, i answer. let's get to work.`,
  good: k => `good day for $${k.symbol}. new faces in the room. welcome them, then get back to work.`,
  bad: k => `rough day for $${k.symbol}. leaders don't run when it's red. we hold the line together.`,
  quiet: k => `quiet day for $${k.symbol}. quiet is when the real ones show up. who's still here?`,
  sleepy: k => `$${k.symbol} roll call. if you're still here, say it.`,
  push: k => `$${k.symbol} is leader of the hour. act like you've been here before.`,
};
function moodOf(k, first) {
  if (first) return 'first';
  if (k.state === 'asleep') return 'sleepy';
  const a = Number(k.mcap_note), b = Number(k.mcap_sol);
  if (a > 0 && b > 0) { if (b > a * 1.03) return 'good'; if (b < a * 0.97) return 'bad'; }
  return 'quiet';
}
async function postText(k, mood) {
  const r = await talk(`${who(k)} ${RULES}`, `${MOODS[mood]} Write your next post on X: 80 to 240 characters, in character, plain text, lowercase is fine, mention $${k.symbol} once. No hashtags, no links.`, 110);
  return (r.ok ? clamp(r.text, 30, 260) : null) || FALLBACK[mood](k);
}
// before a launch: the leader's first post, to preview (nothing is stored)
async function preview(k) {
  const r = await talk(`${who(k)} ${RULES}`, `${MOODS.first} Write your first post on X: 80 to 240 characters, in character, plain text, mention $${k.symbol} once. No hashtags, no links.`, 110);
  if (!r.ok) return { ok: true, text: FALLBACK.first(k), fallback: true };
  return { ok: true, text: clamp(r.text, 30, 260) || FALLBACK.first(k) };
}
// a raid kit: three posts any holder can post, in the leader's voice
async function raidKit(k) {
  const r = await talk(`${who(k)} ${RULES}`, `Write 3 different short posts that holders of $${k.symbol} can post on X to spread the word, each from a different angle, each under 200 characters, each mentioning $${k.symbol} once, no hashtags, no links. Answer with a JSON array of 3 strings only.`, 260);
  let arr = null;
  if (r.ok) { const a = r.text.indexOf('['), b = r.text.lastIndexOf(']'); if (a >= 0 && b > a) try { arr = JSON.parse(r.text.slice(a, b + 1)); } catch {} }
  if (!Array.isArray(arr)) arr = [];
  arr = arr.map(t => clamp(t, 20, 220)).filter(Boolean).slice(0, 3);
  const base = [`every coin gets a cto. $${k.symbol} got a leader.`, `$${k.symbol} has a leader that never sleeps. ${titleOf(k).toLowerCase()} runs the room.`, `no dev, no cto lead, no problem. $${k.symbol} answers to ${titleOf(k).toLowerCase()}.`];
  while (arr.length < 3) arr.push(base[arr.length]);
  return arr;
}
async function answerText(k, q) {
  const r = await talk(`${who(k)} Someone in your community asks you something. Reply in character, in under 200 characters, plain text, no hashtags. If asked about price, gains or when to buy or sell, say a leader doesn't talk price. Never invent facts about a team, partners or listings. ${RULES}`, L.clean(q, 200), 100);
  if (!r.ok) return { ok: false, error: broke(r.error) ? BREAK : 'No reply this time. Try again.' };
  const t = clamp(r.text, 2, 220); return t ? { ok: true, text: t } : { ok: false, error: 'No reply this time. Try again.' };
}
async function note(k, kind, text, q) {
  const ins = await L.q('INSERT INTO ldr_notes (mint, kind, text, q) VALUES ($1,$2,$3,$4) RETURNING id, at', [k.mint || null, kind, text, q || null]);
  if (k.mint && kind !== 'answer') {
    await L.q('UPDATE ldr_coins SET notes=notes+1, note_at=now(), mcap_note=mcap_sol WHERE mint=$1', [k.mint]);
    await L.log(kind === 'push' ? 'push' : 'post', k.mint, kind === 'push' ? `${k.name}'s leader is leader of the hour` : `${titleOf(k)} posted`);
  }
  return { ok: true, id: Number(ins[0].id), text, at: ins[0].at };
}
async function first(k) {
  const have = await L.q(`SELECT id FROM ldr_notes WHERE mint=$1 AND kind IN ('first','note','push') LIMIT 1`, [k.mint]);
  if (have.length) return { ok: true, already: true };
  return note(k, 'first', k.cap0 || await postText(k, 'first'));
}
async function shift(k) { return note(k, 'note', await postText(k, moodOf(k, false))); }
// leader of the hour: the most approvals in the last six hours (plus 20 if it traded in the last six hours), not named in
// the last day
async function push() {
  const last = (await L.q(`SELECT max(pushed_at) AS t FROM ldr_coins`))[0];
  if (last && last.t && Date.now() - new Date(last.t) < 55 * 60e3) return { pushed: null };
  const top = (await L.q(`SELECT c.mint, c.name, c.symbol, c.line, c.look, c.state, c.mcap_sol, c.mcap_note,
      (SELECT count(*)::int FROM ldr_likes l WHERE l.mint = c.mint AND l.at > now() - interval '6 hours') * 3 + CASE WHEN c.state IN ('alive','ascended') THEN 20 ELSE 0 END AS score
    FROM ldr_coins c WHERE c.status='live' AND c.state <> 'dead' AND (c.pushed_at IS NULL OR c.pushed_at < now() - interval '24 hours')
    ORDER BY score DESC, c.last_trade_at DESC NULLS LAST LIMIT 1`))[0];
  if (!top || top.score <= 0) return { pushed: null };
  await L.q(`UPDATE ldr_coins SET pushed_at=now(), pushes=pushes+1 WHERE mint=$1`, [top.mint]);
  await note(top, 'push', await postText(top, 'push'));
  return { pushed: top.mint, score: top.score };
}

module.exports = { settle, routingOf, readBoard, drawGods, lifeOf, buildBurn, verifyBirth, checkLives, answerText, note, first, shift, push, preview, raidKit, titleOf, ARCH, BREAK, stateFor };
