"""Build both versions of the Japan December Plan from tools/page_template.html.

  python3 tools/build.py

Writes:
  index.html                     the website (live street map, suggestion box, app install, offline)
  tools/build/dashboard.html     the Claude dashboard page (stored street map, no suggestion box)

The Claude dashboard also needs its stored map pieces (t*.js and tile-index.js), made by
  python3 tools/fetch_tiles.py tools/build/tiles tools/build/tiles_raw
and published next to the page. They are large, so they are not kept in the repo.
"""
import os, re, subprocess, sys, tarfile, io

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
P = lambda *a: os.path.join(HERE, *a)

def leaflet_css():
    path = P("build", "leaflet.css")
    if not os.path.exists(path):
        os.makedirs(P("build"), exist_ok=True)
        tgz = subprocess.run(["npm", "pack", "leaflet@1.9.4", "--silent", "--pack-destination", P("build")],
                             check=True, capture_output=True, text=True).stdout.strip().splitlines()[-1]
        with tarfile.open(P("build", tgz)) as t:
            open(path, "wb").write(t.extractfile("package/dist/leaflet.css").read())
    css = open(path).read()
    css = re.sub(r"[^;{}]*url\([^)]*\)[^;{}]*;", "", css)      # drop rules for Leaflet's default images
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)

s = open(P("page_template.html")).read()
css = leaflet_css()
part = lambda name: open(P("parts", name)).read()

# Claude dashboard: stored map, no suggestion box or app pieces
dash = (s.replace("/*LEAFLET_CSS*/", css)
         .replace("<!--SUGGEST_HTML-->\n", "").replace("\n/*SUGGEST_JS*/", "")
         .replace("<!--APP_HTML-->\n", "").replace("\n/*APP_JS*/", ""))
os.makedirs(P("build"), exist_ok=True)
open(P("build", "dashboard.html"), "w").write(dash)

# Website: suggestion box, app pieces, live map
w = (s.replace("<!--SUGGEST_HTML-->", part("suggest_html.html").rstrip("\n"))
      .replace("/*SUGGEST_JS*/", part("suggest_js.js"))
      .replace("<!--APP_HTML-->", part("app_install.html").rstrip("\n"))
      .replace("/*APP_JS*/", part("app_js.js")))
def rep(a, b):
    global w
    if w.count(a) != 1: sys.exit("build.py: expected exactly one of: " + a[:70])
    w = w.replace(a, b)
rep("<title>Japan December Plan</title>",
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    '<title>Japan December Plan</title>\n'
    '<meta name="description" content="Our day-by-day Tokyo plan, Nov 29 to Dec 5, 2026: sights, sushi and day trips on a map.">\n'
    '<meta name="robots" content="noindex">\n'
    '<meta property="og:title" content="Japan December Plan">\n'
    '<meta property="og:description" content="Day-by-day Tokyo plan, Nov 29 to Dec 5: sights, sushi and day trips on a map.">\n'
    '<link rel="manifest" href="manifest.webmanifest">\n'
    '<link rel="icon" href="icon-192.png">\n'
    '<link rel="apple-touch-icon" href="icon-180.png">\n'
    '<meta name="theme-color" content="#c0392b">\n'
    '<meta name="mobile-web-app-capable" content="yes">\n'
    '<meta name="apple-mobile-web-app-capable" content="yes">\n'
    '<meta name="apple-mobile-web-app-title" content="Japan Plan">\n'
    '<meta name="apple-mobile-web-app-status-bar-style" content="default">')
rep('<script src="tile-index.js"></script>\n', "")
rep("<header>", "</head>\n<body>\n<header>")
rep("map.setMaxBounds([[34.2, 134.9], [36.2, 140.3]]);", "map.setMaxBounds([[24, 122], [46, 146]]);")   # live map: all of Japan
rep("* { box-sizing: border-box; }", "* { box-sizing: border-box; }\nhtml { -webkit-text-size-adjust: 100%; }")
a = w.index("  const IDX = window.TILE_INDEX || {};"); b = w.index("  map.setMinZoom(8);")
w = w[:a] + '''  // Live street map (normal websites can load map images directly).
  const streets = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19, crossOrigin: true, attribution: "Map tiles &copy; Esri &mdash; Esri, HERE, Garmin, USGS"
  }).addTo(map);
  let fellBack = false, tileErrors = 0;
  streets.on("tileerror", () => {
    if (++tileErrors === 6 && !fellBack) {
      fellBack = true; map.removeLayer(streets);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, crossOrigin: true, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
    }
  });
''' + w[b:]
w = w.rstrip() + "\n</body>\n</html>\n"
open(os.path.join(ROOT, "index.html"), "w").write(w.replace("/*LEAFLET_CSS*/", css))
print("built index.html and tools/build/dashboard.html")
