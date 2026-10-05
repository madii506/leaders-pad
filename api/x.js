// /api/x  a leader's own X account.
//   GET  ?code=&state=          the way back from X's login: stores the account (encrypted) and returns to the coin's page
//   GET                          { open }: whether connecting X is switched on (the studio's X app keys are set)
//   POST {act, mint, wallet, ts, sig}   act 'connect' → { url } to X's login; act 'disconnect' → removes it. Only the
//                                       launcher's wallet can do either, proven by a signed message.
const L = require('./_lib');
const X = require('./_x');
const go = (res, url) => { res.statusCode = 302; res.setHeader('Location', url); res.setHeader('Cache-Control', 'no-store'); res.end(); };
module.exports = async (req, res) => {
  const qy = L.query(req);
  if (req.method === 'GET' && (qy.code || qy.error)) {
    if (qy.error) return go(res, '/?x=denied');
    if (!L.dbReady()) return go(res, '/?x=fail');
    try { await L.ready(); const r = await X.finish(req, String(qy.code), String(qy.state || '')); return go(res, `/c/${r.mint}?x=ok`); }
    catch (e) { return go(res, '/?x=fail&why=' + encodeURIComponent(String(e && e.message || e).slice(0, 120))); }
  }
  if (req.method === 'GET') return L.send(res, 200, { ok: true, open: X.open() }, L.CACHE(30));
  if (req.method !== 'POST') return L.send(res, 405, { ok: false, error: 'GET or POST.' });
  if (L.limited('x:' + L.ip(req), 12, 600000)) return L.send(res, 200, { ok: false, error: 'Too many tries. Wait a few minutes.' });
  if (!L.dbReady()) return L.send(res, 200, { ok: false, error: 'LEADERS’ records are offline.' });
  try {
    await L.ready();
    const b = await L.body(req, 4096);
    if (b.act === 'connect') return L.send(res, 200, { ok: true, url: await X.start(req, b) });
    if (b.act === 'disconnect') return L.send(res, 200, await X.disconnect(b));
    L.send(res, 200, { ok: false, error: 'Connect or disconnect.' });
  } catch (e) { L.send(res, 200, { ok: false, error: String(e && e.message || e).slice(0, 200) }); }
};
