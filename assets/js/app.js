// LEADERS: the page. The parade, the floor, appointing a leader, the cabinet, the council, the constitution.
(function () {
  'use strict';
  const C = window.Core, $ = C.$, $$ = C.$$, esc = C.esc, LD = window.Leader;
  const CROWN = '<svg viewBox="0 0 100 70" aria-hidden="true"><path d="M4 56V18l24 20L50 4l22 34 24-20v38z"/><rect x="4" y="52" width="92" height="16" rx="3"/></svg>';
  const LABEL = { alive: 'live', asleep: 'quiet', dead: 'dead', ascended: 'graduated', unborn: 'not live yet' };
  const LOOKS = ['king', 'captain', 'general', 'president', 'coach', 'boss'];
  const S = { board: null, sort: 'hot', liked: C.store.get('ld-liked') || {}, look: 'king', seed: LD.newSeed(), kid: new Map(), born: 0 };
  const fmt = n => (n == null ? '0' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n));
  const coins = () => (S.board && S.board.coins) || [];
  const coinOf = m => coins().find(k => k.mint === m);
  const kOf = m => { const c = S.kid.get(m); return (c && c.j && c.j.coin) || coinOf(m); };
  const usd = k => (k.mcap_sol != null && S.board && S.board.solUsd ? C.usd(k.mcap_sol * S.board.solUsd) : '—');
  const pushedNow = k => k.pushed_at && Date.now() - new Date(k.pushed_at) < 36e5;
  const oOf = k => ({ look: k.look, seed: k.seed, symbol: k.symbol, name: k.name });
  const page = m => location.origin + '/c/' + m;
  const intent = t => 'https://x.com/intent/post?text=' + encodeURIComponent(t);
  const symOf = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  const xh = k => k.xconnected || null;
  // a still portrait on a fresh canvas
  function face(o, css, scale) { const cv = document.createElement('canvas'), d = Math.min(2, devicePixelRatio || 1); cv.width = cv.height = Math.round(css * d); LD.picture(cv, o, {}, { scale: scale || 0.5 }); return cv; }

  // ---------- nav + reveal ----------
  if ('IntersectionObserver' in window) {
    const links = $$('.links a');
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
    $$('main section[id]').forEach(s => io.observe(s));
  }
  $$('.sh, .ap > *, .vgrid, .splitx, .faq').forEach(e => e.classList.add('reveal'));
  $('.articles').classList.add('stg');
  C.reveal();

  // ---------- the parade ----------
  const parade = $('#parade'), lives = [];
  LD.ready().then(() => LOOKS.forEach((l, i) => {
    const d = document.createElement('div'); d.className = 'pb'; d.style.setProperty('--i', i);
    const cv = document.createElement('canvas'); d.appendChild(cv); d.insertAdjacentHTML('beforeend', `<small>${l}</small>`); parade.appendChild(d);
    lives.push(LD.live(cv, { look: l, seed: 'parade' + i, symbol: 'LEAD', name: 'Lead' }, { bg: false, scale: 0.62 }));
  }));

  // ---------- the strip: coins born on pump.fun right now, with nobody leading them ----------
  const tape = $('#tape'); let tx = 0, tlast = 0;
  Live.on('status', up => { $('#tDot').classList.toggle('on', up); if (!up && !S.born) tape.innerHTML = '<span class="mut">pump.fun’s live feed is offline right now.</span>'; });
  Live.on('birth', b => {
    S.born++; $('#bornN').textContent = S.born.toLocaleString('en-US');
    if (S.born === 1) tape.innerHTML = '';
    const a = document.createElement('a'); a.href = 'https://pump.fun/coin/' + encodeURIComponent(b.mint); a.target = '_blank'; a.rel = 'noopener';
    a.innerHTML = `<b>$${esc(symOf(b.symbol) || '?')}</b><em>no leader</em>`; tape.appendChild(a);
    while (tape.children.length > 40) { const f = tape.firstElementChild; tx += f.offsetWidth + 26; f.remove(); }
  });
  (function roll(now) {
    const dt = tlast ? Math.min(64, now - tlast) : 16; tlast = now;
    if (!document.hidden && tape.scrollWidth > tape.parentNode.clientWidth && !C.calm) {
      tx -= dt * 0.045; const f = tape.firstElementChild;
      if (f && tx + f.offsetWidth + 26 < 0) { tx += f.offsetWidth + 26; tape.appendChild(f); }
      tape.style.transform = `translate3d(${tx.toFixed(1)}px,0,0)`;
    }
    requestAnimationFrame(roll);
  })(0);
  Live.on('trade', t => {
    const li = $(`#cab .cr[data-m="${t.mint}"]`); if (!li) return;
    li.classList.remove('buy', 'sell'); void li.offsetWidth; li.classList.add(t.side); setTimeout(() => li.classList.remove(t.side), 1400);
    const s = li.querySelector('.st'); if (s && !s.classList.contains('ascended')) { s.className = 'st alive'; s.innerHTML = '<i></i>live'; }
  });
  Live.start();

  // ---------- approvals ----------
  function pop(b) { if (!b) return; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
  async function approve(m, btn) {
    pop(btn); if (S.liked[m]) return;
    S.liked[m] = 1; C.store.set('ld-liked', S.liked); $$(`[data-ok="${m}"]`).forEach(b => b.classList.add('on'));
    const r = await C.post('/api/like', { mint: m }).catch(() => null);
    if (r && r.ok) { const k = coinOf(m); if (k) k.likes = r.likes; $$(`[data-ok="${m}"] .n`).forEach(n => n.textContent = fmt(r.likes)); }
    else if (r && !r.ok) C.toast(r.error);
  }
  const okBtn = (m, n) => `<button class="ok2 ${S.liked[m] ? 'on' : ''}" type="button" data-ok="${m}" aria-label="Approve">${CROWN}<span class="n">${fmt(n)}</span></button>`;
  function share(k, text) {
    const t = (text ? text + '\n\n' : `$${k.symbol} has a leader: ${LD.title(oOf(k))}.\n`) + page(k.mint);
    window.open(intent(t), '_blank', 'noopener');
  }

  // ---------- 01 the floor ----------
  function floor() {
    const ns = (S.board && S.board.notes) || [], el = $('#feed');
    if (!ns.length) {
      el.innerHTML = `<div class="empty"><span></span><div><h3>The floor is quiet.</h3><p>No leaders yet. The first coin launched here gets the whole floor to itself.</p><a class="btn gold" href="#appoint">Appoint the first leader</a></div></div>`;
      LD.ready().then(() => el.querySelector('.empty span').replaceWith(face({ look: 'king', seed: 'empty', symbol: 'YOU', name: 'You' }, 120, 0.56)));
      return;
    }
    el.innerHTML = ns.map((n, i) => {
      const x = n.tweet_id && n.xh ? `https://x.com/${encodeURIComponent(n.xh)}/status/${encodeURIComponent(n.tweet_id)}` : null;
      return `<article class="post" data-m="${n.mint}" style="--i:${Math.min(i, 10)}"><div class="av"></div><div>
        <div class="ph"><b>${esc(LD.title(n))}</b><span>${n.xh ? '@' + esc(n.xh) : '$' + esc(n.symbol)} · ${C.ago(new Date(n.at).getTime())}</span>${n.kind === 'push' ? '<span class="tag hr">leader of the hour</span>' : ''}${n.kind === 'first' ? '<span class="tag">first post</span>' : ''}${x ? '<span class="tag x">on X</span>' : ''}</div>
        <p>${esc(n.text)}</p>
        <div class="pa">${x ? `<a href="${x}" target="_blank" rel="noopener">on X ↗</a>` : ''}<button type="button" data-share="${n.id}">share</button><button type="button" data-open="${n.mint}">$${esc(n.symbol)} →</button></div></div></article>`;
    }).join('');
    LD.ready().then(() => $$('.post', el).forEach((p, i) => p.querySelector('.av').appendChild(face(oOf(ns[i]), 52, 0.56))));
    $$('.post', el).forEach((p, i) => {
      const n = ns[i];
      p.addEventListener('click', e => { if (e.target.closest('a,button')) return; openLeader(n.mint); });
      p.querySelector('[data-share]').onclick = () => share(n, n.text);
      p.querySelector('[data-open]').onclick = () => openLeader(n.mint);
    });
  }

  // ---------- 02 appoint ----------
  const tk = $('#tk'), pvCv = $('#pvCv');
  const pvO = () => ({ look: S.look, seed: S.seed, symbol: symOf(tk.value) || 'WICK', name: $('#nm').value.trim() || (symOf(tk.value) ? symOf(tk.value).charAt(0) + symOf(tk.value).slice(1).toLowerCase() : 'Wick') });
  let pv = null;
  function arch() {
    const el = $('#arch'), o = pvO();
    el.innerHTML = LOOKS.map(l => `<button type="button" class="ach ${l === S.look ? 'on' : ''}" data-l="${l}"><span></span>${LD.ARCH[l].label}</button>`).join('');
    $$('.ach', el).forEach(b => { b.querySelector('span').replaceWith(face(Object.assign({}, o, { look: b.dataset.l }), 52, 0.56)); b.onclick = () => { S.look = b.dataset.l; arch(); sync(); }; });
  }
  function sync() {
    const o = pvO();
    if (pv) pv.set(o); else pv = LD.live(pvCv, o, { scale: 0.5 });
    $('#pvTitle').textContent = LD.title(o); $('#pvHandle').textContent = ($('#xh').value.trim().replace(/^@?/, '@') !== '@' ? $('#xh').value.trim().replace(/^@?/, '@') : LD.handle(o)); $('#pvBio').textContent = LD.bio(o);
    goLabel();
  }
  let archTm = 0;
  tk.addEventListener('input', () => { const v = symOf(tk.value); if (v !== tk.value) tk.value = v; sync(); clearTimeout(archTm); archTm = setTimeout(arch, 250); });
  ['nm', 'xh'].forEach(id => $('#' + id).addEventListener('input', sync));
  $('#pvNew').onclick = () => { S.seed = LD.newSeed(); arch(); sync(); };
  const pfpUrl = o => { const cv = document.createElement('canvas'); cv.width = cv.height = 400; LD.picture(cv, o, {}, { scale: 0.52 }); return cv.toDataURL('image/png'); };
  $('#pvPfp').onclick = () => { const o = pvO(); LD.save(pfpUrl(o), `${o.symbol.toLowerCase()}-leader-pfp.png`); };
  $('#pvBan').onclick = () => { const o = pvO(); LD.save(LD.banner(o), `${o.symbol.toLowerCase()}-leader-banner.png`); };
  $('#pvCopy').onclick = () => C.copy(LD.bio(pvO()));
  $('#write').onclick = async () => {
    const b = $('#write'), st = $('#wSt'), o = pvO();
    b.disabled = true; st.className = 'status'; st.textContent = `${LD.title(o)} is writing…`;
    const r = await C.post('/api/talk', { preview: { name: o.name, symbol: o.symbol, line: $('#line').value.trim(), look: o.look } }).catch(() => null);
    b.disabled = false;
    if (r && r.ok) { $('#cap').value = r.text; st.textContent = r.fallback ? 'The AI is resting, so here’s its standard opener.' : 'Written. Edit it if you like.'; }
    else { st.className = 'status err'; st.textContent = (r && r.error) || 'It didn’t answer. Try again.'; }
  };
  const buy = Cross.buyBox($('#buyBox'));
  function splitBox(gods) {
    const j = S.board || {}, pool = (j.lives && j.lives.alive) || 0, n = gods ? gods.length : Math.min(8, pool), has = n > 0, you = has ? 70 : 85;
    $('#split').innerHTML = `<div class="bars"><i style="width:${you}%"></i><i style="width:${has ? 15 : 0}%"></i><i style="width:15%"></i></div>
      <dl><div><dt>you</dt><dd>${you}%</dd></div><div><dt>its council</dt><dd>${has ? 15 : 0}%</dd><div class="vw">${Array.from({ length: 8 }, (_, k) => `<i class="${k < n ? 'on' : ''}"></i>`).join('')}</div></div><div><dt>house</dt><dd>15%</dd></div></dl>
      <p>${gods ? (gods.length ? 'Seated just now: ' + gods.map(g => `${C.short(g.wallet)} (${g.stage})`).join(', ') + '.' : 'Nobody to seat yet, so the council’s 15% is yours.') : has ? `${pool} in the draw. 8 are seated the moment you launch.` : 'No council members yet, so their 15% stays with you.'}</p>`;
  }
  function goLabel() { const b = $('#goBtn'), j = S.board; if (j && !j.open) { b.disabled = true; b.textContent = 'Appointing opens soon'; return; } b.disabled = false; b.textContent = C.S.me ? `Launch $${symOf(tk.value) || 'it'} and appoint ${LD.title(pvO())}` : 'Connect wallet to launch'; }
  const status = (t, c) => { const s = $('#goStatus'); s.className = 'status' + (c ? ' ' + c : ''); s.innerHTML = t || ''; };
  $('#goBtn').onclick = async () => {
    if (!C.S.me) { await C.connect(); return; }
    const symbol = symOf(tk.value), name = $('#nm').value.trim(), line = $('#line').value.trim();
    if (!symbol) { tk.focus(); return status('Type its ticker first.', 'err'); }
    if (!name) return status('Give it a name.', 'err');
    if (line.length < 8) return status('Write what your coin is: one line.', 'err');
    if (buy.over()) return status('Up to 5 SOL in the first buy.', 'err');
    const btn = $('#goBtn'), prog = $('#goProg'); btn.disabled = true; status(''); $('#goRes').hidden = true;
    try {
      const r = await Cross.run({ name, symbol, line, look: S.look, seed: S.seed, caption: $('#cap').value.trim(), x: $('#xh').value.trim(), devBuy: buy.lamports(), onStep: i => Cross.steps(prog, i), onDraw: m => splitBox(m.gods) });
      Cross.steps(prog, Cross.STEPS.length, true);
      const res = $('#goRes'); res.hidden = false;
      res.innerHTML = `<div class="res"><b>$${esc(symbol)} is live and ${esc(LD.title(pvO()))} is in charge.</b>${r.buyNote ? ' ' + esc(r.buyNote) : ''}<br><a href="/c/${r.mint}">Open its page and connect its X →</a> · <a href="https://pump.fun/coin/${r.mint}" target="_blank" rel="noopener">pump.fun ↗</a></div>`;
      status('Done.', 'ok'); S.seed = LD.newSeed(); arch(); sync(); load();
    } catch (e) { status(esc(C.human(e)) + (e.mint ? ` <a href="/c/${e.mint}">Open it</a>` : ''), 'err'); }
    finally { btn.disabled = false; goLabel(); }
  };

  // ---------- 03 the cabinet ----------
  function sorted(ks) {
    const a = ks.slice(), t = k => new Date(k.born_at || 0).getTime();
    if (S.sort === 'new') return a.sort((x, y) => t(y) - t(x));
    if (S.sort === 'likes') return a.sort((x, y) => (y.likes || 0) - (x.likes || 0) || t(y) - t(x));
    const s = k => (pushedNow(k) ? 1e9 : 0) + (k.likes || 0) * 3 + (k.state === 'alive' || k.state === 'ascended' ? 20 : 0) - (k.state === 'dead' ? 60 : 0);
    return a.sort((x, y) => s(y) - s(x) || t(y) - t(x));
  }
  function cabinet() {
    const ks = sorted(coins()), el = $('#cab');
    if (!ks.length) { el.innerHTML = `<li class="empty" style="margin-top:14px"><span></span><div><h3>The cabinet is empty.</h3><p>Every coin launched here takes a seat with its leader. The first one leads by default.</p><a class="btn gold" href="#appoint">Appoint the first leader</a></div></li>`; LD.ready().then(() => el.querySelector('.empty span').replaceWith(face({ look: 'president', seed: 'cab', symbol: 'YOU', name: 'You' }, 120, 0.56))); return; }
    el.innerHTML = ks.map((k, i) => `<li class="cr" data-m="${k.mint}" style="--i:${Math.min(i, 10)}"><span class="no">${i + 1}</span><span class="av"></span>
      <span class="nm"><b>${esc(LD.title(k))}${pushedNow(k) ? '<em class="hr">leader of the hour</em>' : ''}</b><span>$${esc(k.symbol)} · ${esc(k.caption || k.line || '')}</span></span>
      <span class="xh">${xh(k) ? `<a href="https://x.com/${encodeURIComponent(xh(k))}" target="_blank" rel="noopener">@${esc(xh(k))}</a>` : 'not on X yet'}</span>
      <span class="st ${k.state}"><i></i>${LABEL[k.state] || k.state}</span>${okBtn(k.mint, k.likes)}</li>`).join('');
    LD.ready().then(() => $$('.cr', el).forEach(li => { const k = coinOf(li.dataset.m); if (k) li.querySelector('.av').appendChild(face(oOf(k), 58, 0.56)); }));
    $$('.cr', el).forEach(li => {
      const m = li.dataset.m;
      li.addEventListener('click', e => { if (e.target.closest('a,button')) return; openLeader(m); });
      li.querySelector('[data-ok]').onclick = e => approve(m, e.currentTarget);
    });
    Live.watch(ks.filter(k => k.state !== 'ascended').map(k => k.mint));
  }
  $$('#sorts button').forEach(b => b.onclick = () => { S.sort = b.dataset.s; $$('#sorts button').forEach(x => x.classList.toggle('on', x === b)); cabinet(); });

  // ---------- a leader, opened ----------
  async function loadDetail(m, fresh) {
    const c = S.kid.get(m); if (!fresh && c && Date.now() - c.at < 30000) return c.j;
    const j = await C.get('/api/kid?mint=' + m).catch(() => null);
    if (j && j.ok) S.kid.set(m, { at: Date.now(), j }); return j;
  }
  let lv = null;
  function xRow(m) {
    const c = S.kid.get(m), j = c && c.j, k = kOf(m), mine = C.S.me && k && C.S.me === k.payer;
    if (!j) return '';
    if (j.x) return `<b>On X as <a href="https://x.com/${encodeURIComponent(j.x.handle)}" target="_blank" rel="noopener">@${esc(j.x.handle)}</a></b><span class="mut">${j.x.posts || 0} post${j.x.posts === 1 ? '' : 's'} sent by the leader${j.x.error ? ' · last try: ' + esc(j.x.error) : ''}</span>${mine ? '<button class="btn sm" type="button" data-xd>Disconnect</button>' : ''}`;
    if (mine) return j.xopen ? `<span class="mut">Not on X yet. Make its account (PFP, banner and bio below), then connect it: the leader posts there by itself.</span><button class="btn sm gold" type="button" data-xc>Connect its X</button>` : `<span class="mut">Not on X yet. Connecting X opens soon; its posts collect here until then.</span>`;
    return `<span class="mut">Not on X yet. Its launcher can connect its X account from this page.</span>`;
  }
  function detailHtml(m) {
    const k = kOf(m); if (!k) return '<p class="mut">Loading…</p>';
    const c = S.kid.get(m), j = c && c.j, gods = k.gods || [], st = k.status && k.status !== 'live' ? 'unborn' : k.state;
    const posts = (j && j.posts) || [], comments = (j && j.comments) || [], raid = j && j.raid, xhd = j && j.x && j.x.handle;
    return `<div class="xrow" id="xrow">${xRow(m)}</div>
      <dl class="dstat"><div><dt>mcap</dt><dd>${usd(k)}</dd></div><div><dt>approvals</dt><dd>${fmt(k.likes)}</dd></div><div><dt>to pay out</dt><dd>${C.sol(k.vault_lamports || 0)}</dd></div></dl>
      <div class="mut" style="font:11px GM;text-transform:uppercase;letter-spacing:.07em">its council · ${LABEL[st] || st}</div><div class="vw">${Array.from({ length: 8 }, (_, i) => `<i class="${i < gods.length ? 'on' : ''}" title="${gods[i] ? C.short(gods[i].wallet) : ''}"></i>`).join('')}</div>
      <div class="dbtn">${okBtn(m, k.likes)}<button class="btn sm" type="button" data-sh>share</button><a class="btn sm gold" href="https://pump.fun/coin/${k.mint}" target="_blank" rel="noopener">pump.fun ↗</a><a class="btn sm" href="https://dexscreener.com/solana/${k.mint}" target="_blank" rel="noopener">chart ↗</a><button class="btn sm" type="button" data-copy="${k.mint}">copy CA</button><button class="btn sm" type="button" data-pay ${k.status === 'live' ? '' : 'disabled'}>pay out</button></div>
      <div class="blk"><h4>its posts</h4><div class="lposts">${posts.length ? posts.map(p => `<div class="lpost">${esc(p.text)}<small>${C.ago(new Date(p.at).getTime())}${p.tweet_id && xhd ? ` · <a href="https://x.com/${encodeURIComponent(xhd)}/status/${encodeURIComponent(p.tweet_id)}" target="_blank" rel="noopener">on X ↗</a>` : ''}</small></div>`).join('') : '<p class="mut" style="margin:0;font-size:13px">Its first post is on its way.</p>'}</div></div>
      <div class="blk"><h4>raid kit</h4><div class="raid" id="raid">${raid ? raidHtml(k, raid) : '<button class="btn sm" type="button" data-raid>Get three posts to share</button>'}</div></div>
      <div class="blk"><h4>ask the leader</h4><div class="cmts">${comments.length ? comments.map(x => `<div class="cm"><q>${esc(x.q || '')}</q><p>${esc(x.text)}</p></div>`).join('') : '<p class="mut" style="margin:0;font-size:13px">Nobody asked yet. It answers in character.</p>'}</div>
      <div class="ask"><input class="in" maxlength="200" placeholder="ask ${esc(LD.title(k))} something…" data-ask><button class="btn sm gold" type="button" data-send>send</button></div></div>`;
  }
  const raidHtml = (k, posts) => posts.map(t => `<div><span>${esc(t)}</span><a class="btn sm" href="${intent(t + '\n\n' + page(k.mint))}" target="_blank" rel="noopener">post it</a></div>`).join('');
  function wire(root, m) {
    const k = kOf(m);
    $$('[data-copy]', root).forEach(b => b.onclick = () => C.copy(b.dataset.copy));
    $$('[data-ok]', root).forEach(b => b.onclick = () => approve(m, b));
    const sh = root.querySelector('[data-sh]'); if (sh) sh.onclick = () => share(k);
    const pay = root.querySelector('[data-pay]'); if (pay) pay.onclick = async () => { pay.disabled = true; try { const r = await Cross.feed(m); if (r) C.toast('Paid out to everyone in its split.'); S.kid.delete(m); } catch (e) { C.toast(C.human(e)); } pay.disabled = false; };
    const rd = root.querySelector('[data-raid]'); if (rd) rd.onclick = async () => {
      rd.disabled = true; rd.textContent = `${LD.title(k)} is writing…`;
      const r = await C.post('/api/talk', { raid: m }).catch(() => null);
      if (r && r.ok) { $('#raid').innerHTML = raidHtml(k, r.posts); const c = S.kid.get(m); if (c && c.j) c.j.raid = r.posts; }
      else { rd.disabled = false; rd.textContent = 'Get three posts to share'; C.toast((r && r.error) || 'It didn’t answer. Try again.'); }
    };
    const signed = async act => { const ts = Date.now(); const sig = await C.signMessage(`LEADERS\n${act} the X account of ${m}\nwallet ${C.S.me}\ntime ${ts}`); return { act, mint: m, wallet: C.S.me, ts, sig }; };
    const xc = root.querySelector('[data-xc]'); if (xc) xc.onclick = async () => {
      xc.disabled = true;
      try { const r = await C.post('/api/x', await signed('connect')); if (!r.ok) throw new Error(r.error); location.href = r.url; }
      catch (e) { C.toast(C.human(e)); xc.disabled = false; }
    };
    const xd = root.querySelector('[data-xd]'); if (xd) xd.onclick = async () => {
      xd.disabled = true;
      try { const r = await C.post('/api/x', await signed('disconnect')); if (!r.ok) throw new Error(r.error); C.toast('Disconnected. The leader stops posting on X.'); await loadDetail(m, true); root.innerHTML = detailHtml(m); wire(root, m); }
      catch (e) { C.toast(C.human(e)); xd.disabled = false; }
    };
    const inp = root.querySelector('[data-ask]'), send = root.querySelector('[data-send]');
    const go = async () => {
      const q = inp.value.trim(); if (q.length < 2) return; send.disabled = true;
      const r = await C.post('/api/talk', { mint: m, ask: q }).catch(() => null); send.disabled = false;
      if (!r || !r.ok) { C.toast((r && r.error) || 'No reply this time.'); return; }
      const c = S.kid.get(m); if (c && c.j) (c.j.comments = c.j.comments || []).unshift({ q, text: r.text });
      root.innerHTML = detailHtml(m); wire(root, m);
    };
    if (send) { send.onclick = go; inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }); }
  }
  async function openLeader(m) {
    const k0 = coinOf(m);
    C.sheet(k0 ? '$' + k0.symbol : 'leader', `<div class="lp"><div class="lav"><canvas id="lvCv"></canvas><div class="kit"><button class="btn sm" type="button" id="kP">⬇ PFP</button><button class="btn sm" type="button" id="kB">⬇ banner</button><button class="btn sm" type="button" id="kC" style="grid-column:1/-1">copy its bio</button></div></div>
      <div><div class="lt" id="lt"><b>${k0 ? esc(LD.title(k0)) : 'Loading…'}</b><span></span></div><div id="sd"><p class="mut">Loading…</p></div></div></div>`);
    if (location.pathname !== '/c/' + m) history.replaceState(null, '', '/c/' + m + location.hash);
    C.closeSheet.after = () => { if (lv) { lv.stop(); lv = null; } if (location.pathname.startsWith('/c/')) history.replaceState(null, '', '/' + location.hash); };
    await loadDetail(m);
    const k = kOf(m), sd = $('#sd'); if (!sd) return;
    if (!k) { sd.innerHTML = '<p class="mut">No leader lives at that address.</p>'; return; }
    const o = oOf(k); await LD.ready();
    $('#sheetTitle').textContent = '$' + k.symbol;
    $('#lt').innerHTML = `<b>${esc(LD.title(o))}</b><span>$${esc(k.symbol)} · ${esc(k.name)} · ${esc(LD.ARCH[LD.archOf(o)].label)}</span>`;
    const cv = $('#lvCv'); cv.width = cv.height = 460; if (lv) lv.stop(); lv = LD.live(cv, o, { scale: 0.52 });
    $('#kP').onclick = () => LD.save(pfpUrl(o), `${k.symbol.toLowerCase()}-leader-pfp.png`); $('#kB').onclick = () => LD.save(LD.banner(o), `${k.symbol.toLowerCase()}-leader-banner.png`); $('#kC').onclick = () => C.copy(LD.bio(o));
    sd.innerHTML = detailHtml(m); wire(sd, m);
  }

  // ---------- 04 the council ----------
  function ladder() {
    const R = [['recruit', '1x', 'from day 0', 'coach'], ['officer', '1.5x', 'from day 3', 'captain'], ['general', '2x', 'from day 10', 'general'], ['founder', '3x', 'from day 30', 'king']];
    const el = $('#ladder'); el.classList.add('stg');
    el.innerHTML = R.map(r => `<div class="rung"><span></span><b>${r[0]}</b><div class="x">${r[1]}</div><small>${r[2]}</small></div>`).join('');
    LD.ready().then(() => $$('.rung', el).forEach((d, i) => d.querySelector('span').replaceWith(face({ look: R[i][3], seed: 'rung' + i, symbol: 'LEAD', name: 'Lead' }, 72, 0.6))));
    C.reveal($('#council'));
  }
  const TOK = ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'], CB = 'ComputeBudget111111111111111111111111111111';
  async function me() {
    const el = $('#me'), j = S.board || {};
    if (!C.S.me) { el.innerHTML = `<h3>Your seat</h3><div class="big">no seat</div><p class="mut">Connect the wallet that holds your $LEADERS.</p><button class="btn gold" id="meC" type="button">Connect wallet</button>`; $('#meC').onclick = () => C.connect(); return; }
    if (!j.life) { el.innerHTML = `<h3>Your seat</h3><div class="big">soon</div><p class="mut">Joining opens when $LEADERS launches.</p>`; return; }
    el.innerHTML = '<h3>Your seat</h3><p class="mut">Reading…</p>';
    const r = await C.get('/api/born?w=' + C.S.me).catch(() => null);
    if (!r || !r.ok) { el.innerHTML = `<h3>Your seat</h3><p class="mut">${esc((r && r.error) || 'Didn’t load. Try again.')}</p>`; return; }
    const l = r.life, min = r.minBurn || 10000, form = label => `<div class="burn"><input class="in" id="bAmt" inputmode="numeric" value="${min}"><button class="btn gold" id="bBtn" type="button">${label}</button></div><p class="mut" style="font-size:13px;margin:8px 0 0">You hold ${r.balance == null ? '—' : Number(r.balance).toLocaleString('en-US')} $LEADERS. Joining burns at least ${min.toLocaleString('en-US')}.</p><p class="status" id="bSt"></p>`;
    if (!l) el.innerHTML = `<h3>Your seat</h3><div class="big">no seat</div>${form('Burn and take a seat')}`;
    else if (l.state === 'dead') el.innerHTML = `<h3>Your seat</h3><div class="big">gave it up</div><p class="mut">This wallet sold below what it held after joining. Councils it already sits on still pay it.</p>${form('Take a seat again')}`;
    else el.innerHTML = `<h3>Your seat</h3><div class="big">${esc(l.stage)}</div><dl><div><dt>serving</dt><dd>${Math.floor(l.days || 0)} days</dd></div><div><dt>tickets</dt><dd>${l.mult}x</dd></div><div><dt>next</dt><dd>${l.next ? l.next.stage + ' in ' + Math.ceil(l.next.in) + 'd' : 'top rank'}</dd></div><div><dt>councils</dt><dd>${(l.godchildren || []).length}</dd></div></dl>
      <div class="kids">${(l.godchildren || []).slice(0, 10).map(c => `<a href="/c/${c.mint}"><span>$${esc(c.symbol)}</span><span>${C.sol(c.vault_lamports || 0)} waiting</span></a>`).join('')}</div>${form('Burn more')}`;
    const b = $('#bBtn'); if (b) b.onclick = () => burn(r);
  }
  async function burn(info) {
    const st = (t, c) => { const s = $('#bSt'); if (s) { s.className = 'status' + (c ? ' ' + c : ''); s.textContent = t; } };
    const amt = Math.floor(Number(String($('#bAmt').value).replace(/[, _]/g, '')));
    if (!(amt >= (info.minBurn || 10000))) return st(`Joining burns at least ${(info.minBurn || 10000).toLocaleString('en-US')} $LEADERS.`, 'err');
    const btn = $('#bBtn'); btn.disabled = true;
    try {
      st('Building the burn…');
      const r = await C.post('/api/born', { wallet: C.S.me, amount: amt }); if (!r.ok) throw new Error(r.error);
      const w3 = await C.loadWeb3(), tx = w3.VersionedTransaction.deserialize(Uint8Array.from(atob(r.tx), c => c.charCodeAt(0)));
      const msg = tx.message, keys = msg.staticAccountKeys.map(k => k.toBase58()); let ok = false;
      for (const ix of msg.compiledInstructions) {
        const prog = keys[ix.programIdIndex], d = ix.data; if (prog === CB) continue;
        if (!TOK.includes(prog) || d[0] !== 15 || ok) throw new Error('The burn isn’t what was shown, so nothing was signed.');
        let v = 0n; for (let i = 8; i >= 1; i--) v = v * 256n + BigInt(d[i]);
        const ks = ix.accountKeyIndexes.map(i => keys[i]);
        if (v !== BigInt(r.amount) || ks[1] !== r.mint || ks[2] !== C.S.me) throw new Error('The burn isn’t what was shown, so nothing was signed.');
        ok = true;
      }
      if (!ok) throw new Error('The burn is missing, so nothing was signed.');
      st('Waiting for your wallet…'); const [signed] = await C.signAll([tx]); const sig = await C.send(signed); st('Burning…'); await C.confirm(sig);
      st('Reading it from Solana…'); let v = null;
      for (let i = 0; i < 6; i++) { v = await C.post('/api/born', { wallet: C.S.me, sig }).catch(() => null); if (v && v.ok) break; await new Promise(z => setTimeout(z, 2000)); }
      if (!v || !v.ok) throw new Error((v && v.error) || 'The burn landed; it shows after the next check.');
      C.toast('You have a council seat.'); load();
    } catch (e) { st(C.human(e), 'err'); btn.disabled = false; }
  }
  function vtop() {
    const e = (S.board && S.board.elders) || [];
    $('#vtop').innerHTML = `<h3>Longest serving</h3>` + (e.length ? `<table class="tbl"><thead><tr><th>#</th><th>wallet</th><th>rank</th><th>councils</th></tr></thead><tbody>${e.map((x, i) => `<tr><td>${i + 1}</td><td>${C.short(x.wallet)}</td><td>${esc(x.stage)}</td><td>${x.kids}</td></tr>`).join('')}</tbody></table>` : `<p class="mut">${S.board && S.board.life ? 'Nobody has a seat yet. The first one keeps the top spot for a while.' : 'Opens when $LEADERS launches.'}</p>`);
  }

  // ---------- load ----------
  function caBox() {
    const m = S.board && S.board.life, el = $('#caBox'); el.hidden = !m; if (!m) return;
    el.innerHTML = `<span>$LEADERS</span><code>${C.short(m, 6)}</code><button type="button" id="caC">copy</button><a href="https://pump.fun/coin/${m}" target="_blank" rel="noopener">buy</a><a href="https://dexscreener.com/solana/${m}" target="_blank" rel="noopener">chart</a>`;
    $('#caC').onclick = () => C.copy(m);
  }
  let first = true;
  async function load() {
    const j = await C.get('/api/board').catch(() => null);
    S.board = j && (j.ok || j.offline) ? j : { coins: [], notes: [], elders: [], lives: { alive: 0 }, open: false };
    floor(); cabinet(); splitBox(); goLabel(); caBox(); me(); vtop();
    if (first) {
      first = false; ladder();
      const mm = location.pathname.match(/^\/c\/([1-9A-HJ-NP-Za-km-z]{32,44})/), qs = new URLSearchParams(location.search);
      if (qs.get('x') === 'ok') C.toast('Connected. Its leader posts on X from now on.');
      else if (qs.get('x') === 'denied') C.toast('X login cancelled. Nothing changed.');
      else if (qs.get('x') === 'fail') C.toast('Connecting X didn’t work: ' + (qs.get('why') || 'try again') + '.');
      if (qs.has('x')) history.replaceState(null, '', location.pathname + location.hash);
      if (mm) openLeader(mm[1]);
    }
  }
  C.onWallet(() => { goLabel(); me(); const m = location.pathname.match(/^\/c\/([1-9A-HJ-NP-Za-km-z]{32,44})/), sd = $('#sd'); if (m && sd && $('#xrow')) { sd.innerHTML = detailHtml(m[1]); wire(sd, m[1]); } });
  LD.ready().then(() => { arch(); sync(); });
  load();
  setInterval(() => {
    if (document.hidden) return;
    C.get('/api/board').then(j => {
      if (!j || !j.ok) return;
      const sig = b => JSON.stringify([((b && b.coins) || []).map(k => [k.mint, k.state, k.caption, k.pushed_at, k.likes, k.xconnected]), ((b && b.notes) || []).map(n => [n.id, n.tweet_id])]);
      const changed = sig(j) !== sig(S.board); S.board = j; if (changed) { floor(); cabinet(); } vtop();
    }).catch(() => {});
  }, 60000);
})();
