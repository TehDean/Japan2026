// ---- Stop photos (website only) ----
// Each stop gets a photo from Wikipedia: the article that matches the place's name and is close to its pin,
// or else the nearest article with a photo ("Nearby: …"). A place can name its own article with `photo`,
// or hide its photo with photo: "none". Results are remembered on the phone so each place is looked up once.
(() => {
  const API = "https://en.wikipedia.org/w/api.php?format=json&formatversion=2&origin=*&action=query"
    + "&prop=pageimages%7Ccoordinates%7Cinfo&inprop=url&piprop=thumbnail&pithumbsize=800&colimit=max";
  const CACHE_KEY = "jp-photos-v1", RETRY_EMPTY_MS = 3 * 864e5;
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { cache = {}; }
  const save = () => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {} };
  const km = (a, b, c, d) => { const r = Math.PI / 180, x = (d - b) * r * Math.cos((a + c) / 2 * r), y = (c - a) * r; return 6371 * Math.hypot(x, y); };
  const pick = p => p.thumbnail && { src: p.thumbnail.source, title: p.title, url: p.fullurl };
  const get = async qs => { const r = await fetch(API + qs); if (!r.ok) throw new Error(r.status); return ((await r.json()).query || {}).pages || []; };

  async function lookup(place) {
    if (place.photo) return pick((await get("&titles=" + encodeURIComponent(place.photo) + "&redirects=1"))[0] || {}) || null;
    // 1) An article matching the name whose own location is near the pin
    const q = place.name.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
    const hits = (await get("&generator=search&gsrlimit=5&gsrsearch=" + encodeURIComponent(q))).sort((a, b) => a.index - b.index);
    for (const p of hits) {
      const c = p.coordinates && p.coordinates[0];
      if (p.thumbnail && c && km(place.lat, place.lng, c.lat, c.lon) < 2) return pick(p);
    }
    // 2) The nearest article with a photo, labeled as nearby
    const near = (await get(`&generator=geosearch&ggsradius=300&ggslimit=10&ggscoord=${place.lat}%7C${place.lng}`))
      .filter(p => p.thumbnail && p.coordinates)
      .sort((a, b) => km(place.lat, place.lng, a.coordinates[0].lat, a.coordinates[0].lon) - km(place.lat, place.lng, b.coordinates[0].lat, b.coordinates[0].lon));
    return near[0] ? { ...pick(near[0]), nearby: true } : null;
  }

  const pending = {};
  function photoFor(place) {
    const key = (place.photo || place.name) + "@" + place.lat.toFixed(3) + "," + place.lng.toFixed(3);
    const c = cache[key];
    if (c && (c.src || Date.now() - c.at < RETRY_EMPTY_MS)) return Promise.resolve(c.src ? c : null);
    return pending[key] || (pending[key] = lookup(place)
      .then(r => { cache[key] = r ? r : { at: Date.now() }; save(); return r; })
      .catch(() => null)                              // offline or blocked: just no photo
      .finally(() => { delete pending[key]; }));
  }

  function decorate() {
    panel.querySelectorAll(".stop[data-id]:not([data-photo])").forEach(li => {
      li.dataset.photo = "1";
      const place = PLACES[li.dataset.id];
      if (!place || place.photo === "none") return;
      const box = document.createElement("div");
      box.className = "stop-photo loading";
      li.querySelector(".stop-name").after(box);
      photoFor(place).then(r => {
        if (!r) { box.remove(); return; }
        box.className = "stop-photo";
        box.innerHTML = `<a href="${esc(r.url)}" target="_blank" rel="noopener"><img src="${esc(r.src)}" alt="${esc(r.nearby ? "Near " + place.name + ": " + r.title : r.title)}" loading="lazy" referrerpolicy="no-referrer"></a>
          <small class="photo-credit">${r.nearby ? "Nearby: " : "Photo: "}${esc(r.title)} · Wikipedia</small>`;
        box.querySelector("img").addEventListener("error", () => box.remove());
      });
    });
  }
  new MutationObserver(decorate).observe(panel, { childList: true });
  decorate();
})();
