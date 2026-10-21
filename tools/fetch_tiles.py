import math, os, sys, base64, json, concurrent.futures as cf, urllib.request
OUT = sys.argv[1]; RAW = sys.argv[2]
URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
def tx(lng, z): return int((lng + 180) / 360 * 2**z)
def ty(lat, z):
    r = math.radians(lat); return int((1 - math.log(math.tan(r) + 1/math.cos(r)) / math.pi) / 2 * 2**z)
def box(z, s, w, n, e):
    return [(z, x, y) for x in range(tx(w, z), tx(e, z) + 1) for y in range(ty(n, z), ty(s, z) + 1)]
want = set()
region = (34.95, 138.85, 35.95, 140.05)          # Tokyo + Kamakura + Hakone
for z in (8, 9, 10, 11): want.update(box(z, *region))
want.update(box(12, 35.50, 139.55, 35.82, 139.92))  # greater central Tokyo
core = (35.625, 139.680, 35.740, 139.810)          # all city stops
for z in (13, 14, 15): want.update(box(z, *core))
for (lat, lng) in [(35.3167, 139.5358), (35.3190, 139.5500), (35.2050, 139.0250), (35.2330, 139.1050)]:  # Kamakura, Hakone
    for z, r in ((12, 1), (13, 1), (14, 1)):
        cx, cy = tx(lng, z), ty(lat, z)
        want.update((z, x, y) for x in range(cx - r, cx + r + 1) for y in range(cy - r, cy + r + 1))

# Osaka (added for the Thu-Fri overnight)
osaka = (34.40, 135.20, 35.00, 135.80)
for z in (8, 9, 10, 11): want.update(box(z, *osaka))
want.update(box(12, 34.60, 135.44, 34.76, 135.56))
for z in (13, 14, 15): want.update(box(z, 34.645, 135.485, 34.740, 135.530))
want.update(box(8, 34.30, 135.00, 36.00, 140.30))   # the corridor between, for zoomed-out views
# Kyoto and Nara (added Oct 21, 2026 for the 3-night Osaka stay with day trips)
for z in (9, 10, 11): want.update(box(z, 34.60, 135.60, 35.10, 135.95))
for z in (12, 13, 14): want.update(box(z, 34.945, 135.755, 35.012, 135.795))   # Fushimi Inari to Nishiki and Gion
want.update(box(15, 34.990, 135.760, 35.008, 135.790))                          # central Kyoto close-ups
for z in (12, 13, 14, 15): want.update(box(z, 34.678, 135.825, 34.693, 135.848)) # Nara Park and Todai-ji
want = sorted(want)
print("tiles:", len(want))
def get(t):
    z, x, y = t; p = os.path.join(RAW, f"{z}_{x}_{y}.jpg")
    if not os.path.exists(p):
        for _ in range(3):
            try:
                data = urllib.request.urlopen(URL.format(z=z, x=x, y=y), timeout=30).read()
                open(p, "wb").write(data); break
            except Exception as ex: err = ex
        else: return t, None
    return t, p
with cf.ThreadPoolExecutor(12) as ex: res = list(ex.map(get, want))
missing = [t for t, p in res if not p]; print("missing:", len(missing))
# Chunk: one file per (z, x>>s, y>>s) group, aiming for < ~1.5 MB each
index = {}; chunks = {}
for (z, x, y), p in res:
    if not p: continue
    s = max(0, z - 10)  # group close-up tiles by their zoom-10 parent
    cid = f"t{z}" if z <= 10 else f"t{z}_{x >> s}_{y >> s}"
    if z >= 14: cid = f"t{z}_{x >> (z-12)}_{y >> (z-12)}"
    key = f"{z}/{x}/{y}"
    chunks.setdefault(cid, {})[key] = "data:image/jpeg;base64," + base64.b64encode(open(p, "rb").read()).decode()
    index[key] = cid
total = 0
for cid, tiles in chunks.items():
    js = "window.MAP_TILES=window.MAP_TILES||{};Object.assign(window.MAP_TILES," + json.dumps(tiles, separators=(",", ":")) + ");\n"
    open(os.path.join(OUT, cid + ".js"), "w").write(js); total += len(js)
open(os.path.join(OUT, "tile-index.js"), "w").write("window.TILE_INDEX=" + json.dumps(index, separators=(",", ":")) + ";\n")
sizes = sorted((os.path.getsize(os.path.join(OUT, c + ".js")), c) for c in chunks)
print("chunks:", len(chunks), "total MB:", round(total / 1e6, 2), "largest:", sizes[-3:])
