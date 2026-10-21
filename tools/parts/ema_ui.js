// =====================================================================
// Ema Wall: shared trip notes on wooden plaques (絵馬), plus the trip countdown and omikuji.
// Data comes from EMA_BACKEND (website: Supabase directly; Claude dashboard: the owner's Supabase connector).
// =====================================================================
const EMA = (() => {
  const BOARDS = {
    wish: { k: "願", label: "Wishes", hint: "Something you hope to do, eat or see on the trip.", empty: "No wishes yet. Hang the first one!", word: "wish", max: 280, check: false },
    book: { k: "予", label: "To book", hint: "Things to reserve or buy before the trip. Tap the circle to stamp it booked.", empty: "Nothing left to book. Nice!", word: "to-do", max: 280, check: true, stamp: "済" },
    pack: { k: "荷", label: "Packing", hint: "What to bring, and who's bringing it. Tap the circle once it's packed.", empty: "Nothing on the packing list yet.", word: "packing item", max: 280, check: true, stamp: "済" },
    note: { k: "記", label: "Notes", hint: "Addresses, confirmation codes, phrases, anything else worth keeping.", empty: "No notes yet.", word: "note", max: 1000, check: false },
  };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const B = window.EMA_BACKEND;
  let notes = null, board = BOARDS[store.get("jp-ema-board", "")] ? store.get("jp-ema-board", "") : "book";
  let banner = "", readOnly = false, open = false, timer = null, known = null, mine = new Set(), swayNext = true, busy = false;

  const ago = iso => {
    const m = Math.round((Date.now() - new Date(iso)) / 60000);
    if (m < 1) return "just now"; if (m < 60) return m + " min ago";
    const h = Math.round(m / 60); if (h < 24) return h + " hr ago";
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  // ---- toasts (the kitsune talks) ----
  let toastTimer = null;
  function toast(text, action) {
    document.querySelectorAll(".ema-toast").forEach(t => t.remove());
    const t = document.createElement("div");
    t.className = "ema-toast"; t.setAttribute("role", "status");
    t.innerHTML = `<span>${esc(text)}</span>` + (action ? `<button type="button">${esc(action.label)}</button>` : "");
    if (action) t.querySelector("button").addEventListener("click", () => { t.remove(); action.run(); });
    document.body.appendChild(t);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), action ? 7000 : 3500);
  }

  // ---- data ----
  async function load(quiet) {
    if (!B) { banner = "The Ema Wall isn't available here."; readOnly = true; render(); return; }
    try {
      const r = await B.list();
      readOnly = !!r.readOnly; banner = r.banner || "";
      const fresh = r.notes || [];
      if (known && quiet) {
        const added = fresh.filter(n => !known.has(n.id) && !mine.has(n.id));
        if (added.length) {
          const n = added[added.length - 1], b = BOARDS[n.board] || BOARDS.note;
          toast(added.length > 1 ? `🦊 ${added.length} new plaques just went up on the wall!` : `🦊 ${n.author} hung a new ${b.word} on the wall!`);
          swayNext = true;
        }
      }
      known = new Set(fresh.map(n => n.id));
      notes = fresh;
    } catch (e) {
      banner = (e && e.userMessage) || "Couldn't reach the wall just now. It'll try again shortly.";
      if (e && e.action) banner = { text: banner, action: e.action };
      if (!notes) notes = [];
    }
    if (open) render();
  }

  async function act(fn, okText, undo) {
    if (busy) return; busy = true;
    try { const r = await fn(); await load(false); if (okText) toast(okText, undo && { label: "Undo", run: undo }); return r; }
    catch (e) { toast((e && e.userMessage) || "🦊 The kitsune tripped over its tail. Try that again in a moment."); }
    finally { busy = false; }
  }

  // ---- rendering ----
  function plaque(n, i) {
    const b = BOARDS[n.board];
    return `<li class="ema${b.check ? " check" : ""}${n.done ? " done" : ""}${swayNext ? " sway" : ""}" style="--i:${i}">
      <span class="ema-cord" aria-hidden="true"></span>
      <button type="button" class="ema-wood" data-id="${n.id}" aria-label="${esc(b.label)} by ${esc(n.author)}: ${esc(n.body.slice(0, 80))}. Tap to open">
        <span class="ema-body">${esc(n.body)}</span>
        <span class="ema-by">${esc(n.author)} · ${esc(ago(n.updated_at || n.created_at))}</span>
      </button>
      ${b.check ? `<button type="button" class="ema-stamp" data-stamp="${n.id}" aria-pressed="${n.done}" aria-label="${n.done ? "Done. Tap to undo" : "Mark done"}">${n.done ? b.stamp : "✓"}</button>` : ""}
    </li>`;
  }

  function render() {
    if (!open) return;
    const b = BOARDS[board];
    const counts = Object.fromEntries(Object.keys(BOARDS).map(k => [k, (notes || []).filter(n => n.board === k && !n.done).length]));
    let list = (notes || []).filter(n => n.board === board);
    list = b.check ? list.sort((x, y) => (x.done - y.done) || (new Date(x.created_at) - new Date(y.created_at)))
                   : list.sort((x, y) => new Date(y.created_at) - new Date(x.created_at));
    const ban = !banner ? "" : typeof banner === "string" ? `<p class="ema-banner">${esc(banner)}</p>`
      : `<p class="ema-banner">${esc(banner.text)} <button type="button" id="emaFix">${esc(banner.action.label)}</button></p>`;
    const name = store.get("jp-name", "");
    panel.innerHTML = `
      <div class="day-head"><div class="eyebrow">Shared notes · <span lang="ja" class="ja">絵馬</span></div><h2>The Ema Wall</h2>
        <p class="hotel-intro">At shrines, people write wishes on little wooden plaques called ema and hang them up. This is ours: anyone with the link can hang, edit or take down a plaque.</p></div>
      <div class="ema-boards" role="group" aria-label="Boards">${Object.entries(BOARDS).map(([k, x]) =>
        `<button type="button" data-board="${k}" aria-pressed="${k === board}"><span class="k" lang="ja" aria-hidden="true">${x.k}</span>${esc(x.label)}<span class="n">${notes ? counts[k] : "…"}</span></button>`).join("")}</div>
      <p class="ema-hint">${esc(b.hint)}</p>
      ${ban}
      ${readOnly ? "" : `<form class="ema-compose" id="emaForm">
        <textarea id="emaBody" maxlength="${b.max}" rows="2" placeholder="Write a ${esc(b.word)}…" aria-label="New ${esc(b.word)}" required></textarea>
        <div class="row"><input id="emaName" maxlength="30" placeholder="Your name" aria-label="Your name" value="${esc(name)}" required>
          <span class="ema-count" id="emaCount">0 / ${b.max}</span>
          <button class="ema-btn" type="submit">Hang it 🦊</button></div>
      </form>`}
      ${notes == null ? `<p class="ema-empty">The kitsune is fetching the plaques…</p>`
        : list.length ? `<ul class="ema-wall" role="list">${list.map(plaque).join("")}</ul>` : `<p class="ema-empty">${esc(b.empty)}</p>`}
      <section class="omikuji" aria-label="Omikuji fortune">
        <h3><span lang="ja">おみくじ</span> Draw a fortune</h3>
        <p>Shake the box like at Senso-ji and see what the trip has in store.</p>
        <div class="omikuji-box" id="kujiBox" aria-hidden="true" lang="ja">籤</div><br>
        <button type="button" class="ema-btn ghost" id="kujiBtn">Shake the box</button>
        <div id="kujiSlip" aria-live="polite"></div>
      </section>`;
    swayNext = false;
    panel.querySelectorAll("[data-board]").forEach(x => x.addEventListener("click", () => {
      board = x.dataset.board; store.set("jp-ema-board", board); swayNext = true; render();
    }));
    const fix = panel.querySelector("#emaFix"); if (fix) fix.addEventListener("click", () => banner.action.run());
    const form = panel.querySelector("#emaForm");
    if (form) {
      const body = form.querySelector("#emaBody"), count = form.querySelector("#emaCount");
      body.addEventListener("input", () => { count.textContent = body.value.length + " / " + b.max; count.classList.toggle("over", body.value.length >= b.max); });
      form.addEventListener("submit", e => {
        e.preventDefault();
        const text = body.value.trim(), who = form.querySelector("#emaName").value.trim();
        if (!text || !who) return;
        store.set("jp-name", who);
        act(async () => { const id = await B.add(who, board, text); if (id != null) mine.add(Number(id)); body.value = ""; swayNext = true; },
            `🦊 Your ${b.word} is hanging on the wall!`);
      });
    }
    panel.querySelectorAll(".ema-wood").forEach(x => x.addEventListener("click", () => openEditor(Number(x.dataset.id))));
    panel.querySelectorAll("[data-stamp]").forEach(x => x.addEventListener("click", () => {
      const n = notes.find(m => m.id === Number(x.dataset.stamp)); if (!n || readOnly) return;
      act(() => B.setDone(n.id, !n.done), n.done ? "Un-stamped. Back on the list." : (board === "pack" ? "🦊 Packed! 済" : "🦊 Booked! The kitsune stamps it 済"));
    }));
    panel.querySelector("#kujiBtn").addEventListener("click", drawFortune);
  }

  function openEditor(id) {
    const n = notes.find(m => m.id === id); if (!n) return;
    const b = BOARDS[n.board];
    const wrap = document.createElement("div");
    wrap.className = "ema-edit-wrap";
    wrap.innerHTML = `<div class="ema-edit" role="dialog" aria-modal="true" aria-labelledby="emaEditTitle">
      <h3 id="emaEditTitle"><span lang="ja">${b.k}</span> ${esc(b.label)}</h3>
      <p class="meta">Hung by ${esc(n.author)} · ${esc(ago(n.created_at))}${n.updated_at && n.updated_at !== n.created_at ? " · edited " + esc(ago(n.updated_at)) : ""}</p>
      <textarea id="emaEditBody" maxlength="${b.max}" rows="5" ${readOnly ? "readonly" : ""} aria-label="Plaque text">${esc(n.body)}</textarea>
      ${readOnly ? "" : `<input id="emaEditName" maxlength="30" value="${esc(store.get("jp-name", "") || n.author)}" aria-label="Your name (shown as the last editor)">`}
      <div class="actions">${readOnly ? "" : `<button type="button" class="ema-btn danger" id="emaDel">Take it down</button>`}
        <button type="button" class="ema-btn ghost" id="emaCancel">${readOnly ? "Close" : "Cancel"}</button>
        ${readOnly ? "" : `<button type="button" class="ema-btn" id="emaSave">Save</button>`}</div></div>`;
    const close = () => { wrap.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = e => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    wrap.addEventListener("click", e => { if (e.target === wrap) close(); });
    document.body.appendChild(wrap);
    wrap.querySelector("#emaCancel").addEventListener("click", close);
    const ta = wrap.querySelector("#emaEditBody"); ta.focus();
    if (readOnly) return;
    wrap.querySelector("#emaSave").addEventListener("click", () => {
      const text = ta.value.trim(), who = wrap.querySelector("#emaEditName").value.trim();
      if (!text) return;
      if (who) store.set("jp-name", who);
      close();
      if (text !== n.body) act(() => B.edit(n.id, text, who || n.author), "🦊 Plaque updated.");
    });
    wrap.querySelector("#emaDel").addEventListener("click", () => {
      close();
      act(() => B.remove(n.id), "The plaque was taken down.", () => act(() => B.restore(n.id), "🦊 Back on the wall!"));
    });
  }

  // ---- omikuji ----
  const FORTUNES = [
    ["大吉", "Great blessing", "Every train arrives the moment you reach the platform."],
    ["大吉", "Great blessing", "The best bite of the trip will come from a stall with no English menu. Point and trust."],
    ["大吉", "Great blessing", "Sunset at Shibuya Sky will be exactly as good as the photos. Better, even."],
    ["大吉", "Great blessing", "A vending machine will surprise you with the perfect hot drink on a cold night."],
    ["中吉", "Middle blessing", "Your karaoke song choice will be legendary. Commit to it fully."],
    ["中吉", "Middle blessing", "Get lost in a side street on purpose. Something wonderful is down there."],
    ["中吉", "Middle blessing", "The kitsune predicts at least one perfect bowl of ramen. Possibly two."],
    ["吉", "Blessing", "Bring a coin purse: fortune favors those with exact change."],
    ["吉", "Blessing", "A stranger's kindness will turn a wrong turn into a highlight."],
    ["吉", "Blessing", "Say yes to the thing on the menu you can't pronounce."],
    ["小吉", "Small blessing", "Your feet will complain, your heart will not. Wear the comfy shoes."],
    ["小吉", "Small blessing", "One of you will buy something completely unnecessary and adorable. Allow it."],
    ["末吉", "Future blessing", "The best part of the trip hasn't been planned yet. Leave room for it."],
    ["末吉", "Future blessing", "A small delay will lead somewhere great. The fox is never late; everyone else is early."],
  ];
  function drawFortune() {
    const box = panel.querySelector("#kujiBox"), slip = panel.querySelector("#kujiSlip");
    box.classList.remove("shake"); void box.offsetWidth; box.classList.add("shake");
    slip.innerHTML = "";
    setTimeout(() => {
      const [lvl, en, msg] = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
      slip.innerHTML = `<div class="omikuji-slip"><div class="lvl" lang="ja">${lvl}</div><div class="lvl-en">${en}</div>${esc(msg)}</div>`;
    }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 700);
  }

  // ---- tab lifecycle ----
  function show() {
    open = true; setCap("none");
    if (map) { Object.values(markers).forEach(m => m.remove()); markers = {}; }
    swayNext = true; render();
    load(false);
    clearInterval(timer);
    timer = setInterval(() => { if (!document.hidden && open && !busy) load(true); }, (B && B.pollMs) || 15000);
  }
  // Leaving the tab: stop polling (show() is called again when it's picked)
  new MutationObserver(() => { if (open && !panel.querySelector(".ema-boards")) { open = false; clearInterval(timer); } })
    .observe(panel, { childList: true });
  return { show };
})();
window.EMA = EMA;

// ---- Trip countdown in the header ----
(() => {
  const el = document.getElementById("countdown"); if (!el) return;
  const start = new Date(2026, 10, 29), end = new Date(2026, 11, 5);      // Nov 29 – Dec 5, local dates
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((start - today) / 864e5);
  let html;
  if (days > 1) html = `<b>${days}</b> days until Japan`;
  else if (days === 1) html = `<b>1</b> day until Japan. Pack the bags!`;
  else if (today <= end) html = `Day <b>${Math.round((today - start) / 864e5) + 1}</b> in Japan. Enjoy it!`;
  else html = `<span lang="ja">おかえり</span> Welcome home!`;
  el.innerHTML = `<span class="cd-fox" aria-hidden="true">🦊</span><span>${html}</span>`;
  el.hidden = false;
})();
