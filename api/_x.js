// LEADERS × X. A coin's launcher can connect the X account its leader posts from (OAuth 2.0 with PKCE, X's own login).
// Tokens are encrypted at rest. With the studio's X app keys set (X_CLIENT_ID, X_CLIENT_SECRET), the cycle posts each
// leader's new posts to its own account: at most one every three hours per coin, X_DAILY (default 40) a day in all.
const crypto = require('crypto');
const L = require('./_lib');
const CID = (process.env.X_CLIENT_ID || '').trim(), SECRET = (process.env.X_CLIENT_SECRET || '').trim();
const open = () => !!(CID && SECRET);
const KEY = crypto.createHash('sha256').update('leaders-x:' + (process.env.X_TOKEN_KEY || process.env.DATABASE_URL || process.env.POSTGRES_URL || 'dev')).digest();
function seal(t) { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', KEY, iv), ct = Buffer.concat([c.update(String(t), 'utf8'), c.final()]); return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64'); }
function unseal(b) { const buf = Buffer.from(String(b), 'base64'), d = crypto.createDecipheriv('aes-256-gcm', KEY, buf.subarray(0, 12)); d.setAuthTag(buf.subarray(12, 28)); return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8'); }
const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const API = 'https://api.x.com/2';
const redirectUri = req => (process.env.X_REDIRECT || (L.origin(req) + '/api/x')).trim();

// the launcher proves it's them by signing this with the wallet that launched the coin
const msgFor = (act, mint, wallet, ts) => `LEADERS\n${act} the X account of ${mint}\nwallet ${wallet}\ntime ${ts}`;
function verify(wallet, text, sigB58) {
  try {
    const pub = Buffer.from(L.b58dec(wallet)), sig = Buffer.from(L.b58dec(sigB58));
    if (pub.length !== 32 || sig.length !== 64) return false;
    const key = crypto.createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), pub]), format: 'der', type: 'spki' });
    return crypto.verify(null, Buffer.from(text, 'utf8'), key, sig);
  } catch { return false; }
}
async function owner(b, act) {
  const mint = String(b.mint || ''), wallet = String(b.wallet || ''), ts = Number(b.ts), sig = String(b.sig || '');
  if (!L.isAddr(mint) || !L.isAddr(wallet)) throw new Error('That request doesn’t look right.');
  if (!(Math.abs(Date.now() - ts) < 10 * 60e3)) throw new Error('That signature is too old. Try again.');
  const k = (await L.q(`SELECT mint, payer, symbol, status FROM ldr_coins WHERE mint=$1`, [mint]))[0];
  if (!k || k.status !== 'live') throw new Error('That coin isn’t live here.');
  if (k.payer !== wallet) throw new Error('Only the wallet that launched this coin can connect its X.');
  if (!verify(wallet, msgFor(act, mint, wallet, ts), sig)) throw new Error('The signature didn’t check out, so nothing changed.');
  return k;
}
async function start(req, b) {
  if (!open()) throw new Error('Connecting X opens soon.');
  const k = await owner(b, 'connect');
  const verifier = b64u(crypto.randomBytes(32)), state = b64u(crypto.randomBytes(18));
  const challenge = b64u(crypto.createHash('sha256').update(verifier).digest());
  await L.q(`DELETE FROM ldr_xstate WHERE at < now() - interval '20 minutes'`);
  await L.q(`INSERT INTO ldr_xstate (state, mint, wallet, verifier) VALUES ($1,$2,$3,$4)`, [state, k.mint, k.payer, verifier]);
  const u = new URL('https://x.com/i/oauth2/authorize');
  u.search = new URLSearchParams({ response_type: 'code', client_id: CID, redirect_uri: redirectUri(req), scope: 'tweet.read tweet.write users.read offline.access', state, code_challenge: challenge, code_challenge_method: 'S256' }).toString();
  return u.toString();
}
async function tokenCall(params) {
  const r = await fetch(API + '/oauth2/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: 'Basic ' + Buffer.from(CID + ':' + SECRET).toString('base64') }, body: new URLSearchParams({ ...params, client_id: CID }).toString(), signal: AbortSignal.timeout(12000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error((j && (j.error_description || j.error)) || 'X didn’t hand over the keys.');
  return j;
}
async function finish(req, code, state) {
  if (!open()) throw new Error('Connecting X opens soon.');
  const st = (await L.q(`DELETE FROM ldr_xstate WHERE state=$1 AND at > now() - interval '20 minutes' RETURNING mint, wallet, verifier`, [state]))[0];
  if (!st) throw new Error('That login expired. Start again from the coin’s page.');
  const t = await tokenCall({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(req), code_verifier: st.verifier });
  const me = await fetch(API + '/users/me', { headers: { authorization: 'Bearer ' + t.access_token }, signal: AbortSignal.timeout(10000) }).then(r => r.json()).catch(() => null);
  if (!me || !me.data || !me.data.id) throw new Error('X didn’t say which account that was.');
  await L.q(`INSERT INTO ldr_x (mint, x_id, handle, xname, access_enc, refresh_enc, expires_at, by_wallet) VALUES ($1,$2,$3,$4,$5,$6, now() + make_interval(secs => $7::int), $8)
    ON CONFLICT (mint) DO UPDATE SET x_id=EXCLUDED.x_id, handle=EXCLUDED.handle, xname=EXCLUDED.xname, access_enc=EXCLUDED.access_enc, refresh_enc=EXCLUDED.refresh_enc,
      expires_at=EXCLUDED.expires_at, by_wallet=EXCLUDED.by_wallet, connected_at=now(), error=NULL`,
    [st.mint, String(me.data.id), String(me.data.username || '').slice(0, 30), String(me.data.name || '').slice(0, 60), seal(t.access_token), t.refresh_token ? seal(t.refresh_token) : null, Math.max(60, Number(t.expires_in) || 7200), st.wallet]);
  await L.q(`UPDATE ldr_coins SET xhandle=$2 WHERE mint=$1`, [st.mint, String(me.data.username || '').slice(0, 30)]);
  await L.log('x', st.mint, `its leader now posts as @${me.data.username}`);
  return { mint: st.mint, handle: me.data.username };
}
async function disconnect(b) {
  const k = await owner(b, 'disconnect');
  await L.q(`DELETE FROM ldr_x WHERE mint=$1`, [k.mint]);
  return { ok: true };
}
async function access(mint) {
  const row = (await L.q(`SELECT access_enc, refresh_enc, expires_at FROM ldr_x WHERE mint=$1`, [mint]))[0];
  if (!row) throw new Error('not connected');
  if (row.expires_at && new Date(row.expires_at) - Date.now() > 5 * 60e3) return unseal(row.access_enc);
  if (!row.refresh_enc) throw new Error('X login expired: reconnect it');
  const t = await tokenCall({ grant_type: 'refresh_token', refresh_token: unseal(row.refresh_enc) });
  await L.q(`UPDATE ldr_x SET access_enc=$2, refresh_enc=$3, expires_at=now() + make_interval(secs => $4::int) WHERE mint=$1`, [mint, seal(t.access_token), t.refresh_token ? seal(t.refresh_token) : row.refresh_enc, Math.max(60, Number(t.expires_in) || 7200)]);
  return t.access_token;
}
async function tweet(mint, text) {
  const at = await access(mint);
  const r = await fetch(API + '/tweets', { method: 'POST', headers: { authorization: 'Bearer ' + at, 'content-type': 'application/json' }, body: JSON.stringify({ text: String(text).slice(0, 280) }), signal: AbortSignal.timeout(12000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.data || !j.data.id) throw new Error(String((j && (j.detail || j.title)) || ('X said ' + r.status)).slice(0, 160));
  return String(j.data.id);
}
// the cycle: each connected leader's newest unposted post goes out, at most one every three hours per coin
async function postDue(limit = 6) {
  if (!open()) return { posted: 0, closed: true };
  const cap = Math.max(1, Number(process.env.X_DAILY) || 40);
  const today = (await L.q(`SELECT count(*)::int AS n FROM ldr_notes WHERE posted_at > now() - interval '24 hours'`))[0].n;
  if (today >= cap) return { posted: 0, capped: true };
  const due = await L.q(`SELECT DISTINCT ON (n.mint) n.id, n.mint, n.text FROM ldr_notes n JOIN ldr_x x ON x.mint = n.mint JOIN ldr_coins c ON c.mint = n.mint
      WHERE n.kind IN ('first','note','push') AND n.tweet_id IS NULL AND n.post_error IS NULL AND n.at > x.connected_at - interval '1 hour'
        AND (x.last_post_at IS NULL OR x.last_post_at < now() - interval '3 hours') AND c.state <> 'dead'
      ORDER BY n.mint, n.id DESC LIMIT $1`, [Math.min(limit, cap - today)]);
  let posted = 0;
  for (const n of due) {
    try {
      const id = await tweet(n.mint, n.text);
      await L.q(`UPDATE ldr_notes SET tweet_id=$2, posted_at=now() WHERE id=$1`, [n.id, id]);
      await L.q(`UPDATE ldr_x SET posts=posts+1, last_post_at=now(), error=NULL WHERE mint=$1`, [n.mint]); posted++;
    } catch (e) {
      const m = String(e && e.message || e).slice(0, 200);
      await L.q(`UPDATE ldr_notes SET post_error=$2 WHERE id=$1`, [n.id, m]); await L.q(`UPDATE ldr_x SET error=$2 WHERE mint=$1`, [n.mint, m]);
    }
  }
  return { posted };
}
module.exports = { open, start, finish, disconnect, postDue, msgFor, verify };
