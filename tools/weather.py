"""The kitsune's daily weather check for the Japan December Plan.

  python3 tools/weather.py fetch            # get the forecast, print a summary per trip day
  python3 tools/weather.py write notes.json # merge the kitsune's notes with the forecast into weather.json

`fetch` saves the raw forecast to tools/build/wx_raw.json and prints, for each trip day still to come:
its stops, the cities it covers, the daily forecast per city, the rainy hours (8 AM to 11 PM), and
whether it looks rough. Whoever runs the check (the scheduled task) then writes notes.json:

  {"2026-12-04": {"level": "ok" | "watch" | "bad",
                  "note": "one or two sentences in the kitsune's voice",
                  "alternatives": ["Backup idea: why it works", ...]}}   # only when level is "bad"; at most 3

`write` checks notes.json and writes weather.json at the repo root. The website reads weather.json
(the kitsune's notes) and fetches the live forecast itself; the Claude dashboard shows the copy of
weather.json that was in the repo when it was built.
"""
import json, os, sys, urllib.request, datetime as dt
# Forecast source: Open-Meteo; if it refuses (e.g. its daily limit on a shared connection), MET Norway as a backup.

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RAW = os.path.join(HERE, "build", "wx_raw.json")
OUT = os.path.join(ROOT, "weather.json")
JST = dt.timezone(dt.timedelta(hours=9))
CITIES = {"Tokyo": (35.68, 139.76), "Osaka": (34.67, 135.50), "Kyoto": (34.99, 135.77), "Hakone": (35.23, 139.10)}
SB = "https://qsztbfixleqhxovkfaeg.supabase.co/rest/v1/rpc/get_trip_plan"
SB_KEY = "sb_publishable_IfxPpo_h0HNGY5_maQyqlA_cdDjiWFE"   # public key, same as on the website
CODES = {0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Cloudy", 45: "Fog", 48: "Fog", 51: "Light drizzle",
         53: "Drizzle", 55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle", 61: "Light rain", 63: "Rain",
         65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow",
         77: "Snow grains", 80: "Showers", 81: "Showers", 82: "Heavy showers", 85: "Snow showers", 86: "Heavy snow showers",
         95: "Thunderstorms", 96: "Thunderstorms with hail", 99: "Thunderstorms with hail"}

def get(url, data=None, headers=None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method="POST" if data else "GET")
    return json.loads(urllib.request.urlopen(req, timeout=60).read())

def plan():
    d = get(SB, b"{}", {"apikey": SB_KEY, "Content-Type": "application/json"})
    return d.get("data", d)

def day_iso(day):
    m, d = day["date"].split()[1].split("/")
    return f"2026-{int(m):02d}-{int(d):02d}"

def day_cities(day, places):
    out = []
    for s in day["stops"]:
        p = places.get(s["id"])
        if not p: continue
        best = min(CITIES, key=lambda n: (p["lat"] - CITIES[n][0]) ** 2 + (p["lng"] - CITIES[n][1]) ** 2)
        if (p["lat"] - CITIES[best][0]) ** 2 + (p["lng"] - CITIES[best][1]) ** 2 < 0.25 and best not in out:
            out.append(best)
    return out

def rough(f):
    why = []
    if f["code"] >= 95: why.append("thunderstorms")
    if f["code"] in (65, 67, 82) or (f["rain"] >= 0.4 and (f["pop"] or 0) >= 60): why.append(f"heavy rain ({f['rain']:.1f} in)")
    if f["snow"] >= 0.4 or f["code"] in (73, 75, 86): why.append(f"snow ({f['snow']:.1f} in)")
    if f["wind"] >= 25: why.append(f"strong wind ({f['wind']:.0f} mph)")
    return why

MET_UA = "Japan2026 weather check github.com/TehDean/Japan2026"
MET_CODES = {"clearsky": 0, "fair": 1, "partlycloudy": 2, "cloudy": 3, "fog": 45, "lightrain": 61, "rain": 63, "heavyrain": 65,
             "lightrainshowers": 80, "rainshowers": 81, "heavyrainshowers": 82, "lightsleet": 66, "sleet": 67, "heavysleet": 67,
             "lightsleetshowers": 66, "sleetshowers": 67, "heavysleetshowers": 67, "lightsnow": 71, "snow": 73, "heavysnow": 75,
             "lightsnowshowers": 85, "snowshowers": 85, "heavysnowshowers": 86}

def met_code(sym):
    base = sym.split("_")[0]
    return 95 if "thunder" in base else MET_CODES.get(base, 3)

def fetch_met(names):
    """Backup source: MET Norway (api.met.no), used when Open-Meteo refuses (for example its daily limit).
    Gives about 9 days. It has no rain chance for Japan, so "pop" is the share of 8 AM-11 PM time with rain."""
    fc, hours = {}, {}
    for n in names:
        lat, lng = CITIES[n]
        d = get(f"https://api.met.no/weatherapi/locationforecast/2.0/complete?lat={lat}&lon={lng}", headers={"User-Agent": MET_UA})
        days, covered = {}, None
        for e in d["properties"]["timeseries"]:
            t = dt.datetime.fromisoformat(e["time"].replace("Z", "+00:00")).astimezone(JST)
            x = days.setdefault(t.date().isoformat(), {"temps": [], "wind": 0, "rain": 0.0, "snow": 0.0, "code": None, "wet": 0, "slots": 0})
            inst = e["data"]["instant"]["details"]
            x["temps"].append(inst["air_temperature"]); x["wind"] = max(x["wind"], inst.get("wind_speed", 0))
            for key, span in (("next_1_hours", 1), ("next_6_hours", 6)):
                blk = e["data"].get(key)
                if not blk: continue
                if key == "next_6_hours":
                    det = blk.get("details", {})
                    x["temps"] += [v for v in (det.get("air_temperature_max"), det.get("air_temperature_min")) if v is not None]
                if covered and t < covered: break
                sym = blk.get("summary", {}).get("symbol_code", "cloudy")
                mm = blk.get("details", {}).get("precipitation_amount", 0) or 0
                c = met_code(sym)
                x["code"] = c if x["code"] is None else max(x["code"], c)
                if c in (66, 67, 71, 73, 75, 85, 86): x["snow"] += mm / 25.4 * (10 if c >= 71 else 1)
                else: x["rain"] += mm / 25.4
                wet = mm / span >= 0.15
                for h in range(span):
                    ht = t + dt.timedelta(hours=h)
                    if 8 <= ht.hour <= 23:
                        y = days.setdefault(ht.date().isoformat(), {"temps": [], "wind": 0, "rain": 0.0, "snow": 0.0, "code": None, "wet": 0, "slots": 0})
                        y["slots"] += 1; y["wet"] += wet
                        if wet: hours.setdefault(ht.date().isoformat(), {}).setdefault(n, []).append(ht.hour)
                covered = t + dt.timedelta(hours=span)
                break
        for day, x in days.items():
            if not x["temps"] or x["code"] is None or x["slots"] < 8: continue
            fc.setdefault(day, {})[n] = {"code": x["code"], "hi": round(max(x["temps"]) * 9 / 5 + 32), "lo": round(min(x["temps"]) * 9 / 5 + 32),
                                         "rain": round(x["rain"], 2), "pop": round(100 * x["wet"] / x["slots"]),
                                         "wind": round(x["wind"] * 2.237), "snow": round(x["snow"], 2)}
    for day in hours:
        for n in hours[day]: hours[day][n] = sorted(set(hours[day][n]))
    return fc, hours

def fetch():
    names = list(CITIES)
    q = ("https://api.open-meteo.com/v1/forecast?latitude=" + ",".join(str(CITIES[n][0]) for n in names) +
         "&longitude=" + ",".join(str(CITIES[n][1]) for n in names) +
         "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,snowfall_sum"
         "&hourly=precipitation_probability,precipitation,weather_code"
         "&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=Asia%2FTokyo&forecast_days=16")
    try:
        res = get(q)
        source = "Open-Meteo"
    except Exception as err:
        print(f"Open-Meteo didn't answer ({err}); using the backup, MET Norway (about 9 days ahead).")
        res, source = None, "MET Norway (backup)"
    fc, hours = ({}, {}) if res is not None else fetch_met(names)
    res = [] if res is None else res if isinstance(res, list) else [res]
    for n, c in zip(names, res):
        D = c["daily"]
        for k, t in enumerate(D["time"]):
            fc.setdefault(t, {})[n] = {"code": D["weather_code"][k], "hi": round(D["temperature_2m_max"][k]), "lo": round(D["temperature_2m_min"][k]),
                                       "rain": round(D["precipitation_sum"][k] or 0, 2), "pop": D["precipitation_probability_max"][k],
                                       "wind": round(D["wind_speed_10m_max"][k]), "snow": round(D["snowfall_sum"][k] or 0, 2)}
        H = c["hourly"]
        for k, t in enumerate(H["time"]):
            day, hr = t[:10], int(t[11:13])
            if 8 <= hr <= 23 and ((H["precipitation_probability"][k] or 0) >= 50 or (H["precipitation"][k] or 0) >= 0.02):
                hours.setdefault(day, {}).setdefault(n, []).append(hr)
    p = plan()
    os.makedirs(os.path.dirname(RAW), exist_ok=True)
    today = dt.datetime.now(JST).date().isoformat()
    days = []
    for day in p["days"]:
        d = day_iso(day)
        if d < today: continue
        cs = day_cities(day, p["places"])
        days.append({"date": d, "label": day["full"], "title": day["title"], "cities": cs,
                     "stops": [f"{s['t']} {p['places'].get(s['id'], {}).get('name', s['id'])}" for s in day["stops"]],
                     "forecast": {n: fc.get(d, {}).get(n) for n in cs}, "rain_hours": {n: hours.get(d, {}).get(n, []) for n in cs}})
    json.dump({"checked": dt.datetime.now(JST).isoformat(timespec="minutes"), "days": days, "forecast": fc}, open(RAW, "w"))
    def span(hs):
        if not hs: return "none"
        out, a = [], hs[0]
        for i in range(1, len(hs) + 1):
            if i == len(hs) or hs[i] != hs[i - 1] + 1:
                b = hs[i - 1]; out.append(f"{a}:00" if a == b else f"{a}:00-{b + 1}:00"); a = hs[i] if i < len(hs) else None
        return ", ".join(out)
    print(f"Checked {dt.datetime.now(JST):%a %b %d, %H:%M} Japan time. Source: {source}. Units: °F, inches, mph.")
    for x in days:
        print(f"\n== {x['date']} {x['label']}: {x['title']}")
        print("   stops: " + " | ".join(x["stops"]))
        for n in x["cities"]:
            f = x["forecast"][n]
            if not f: print(f"   {n}: no forecast yet (too far ahead)"); continue
            r = rough(f)
            print(f"   {n}: {CODES.get(f['code'], f['code'])}, {f['hi']}/{f['lo']}°F, rain {f['pop']}% {f['rain']} in, snow {f['snow']} in, "
                  f"wind {f['wind']} mph; rainy hours: {span(x['rain_hours'][n])}" + (f"  ROUGH: {', '.join(r)}" if r else ""))

def write(path):
    raw = json.load(open(RAW))
    notes = json.load(open(path))
    want = {x["date"] for x in raw["days"] if any(x["forecast"].values())}
    missing = sorted(want - set(notes))
    if missing: sys.exit("weather.py: notes.json is missing days: " + ", ".join(missing))
    for d, n in notes.items():
        if n.get("level") not in ("ok", "watch", "bad"): sys.exit(f"weather.py: {d}: level must be ok, watch or bad")
        if not isinstance(n.get("note"), str) or not 10 <= len(n["note"]) <= 450: sys.exit(f"weather.py: {d}: note must be 10-450 characters")
        alts = n.get("alternatives", [])
        if not isinstance(alts, list) or len(alts) > 3 or any(not isinstance(a, str) or len(a) > 220 for a in alts):
            sys.exit(f"weather.py: {d}: alternatives must be up to 3 strings of up to 220 characters")
        if n["level"] == "bad" and not alts: sys.exit(f"weather.py: {d}: a bad day needs at least one alternative")
        n["alternatives"] = alts
    checked = dt.datetime.fromisoformat(raw["checked"])
    keep = {d: f for d, f in raw["forecast"].items() if "2026-11-28" <= d <= "2026-12-07"}
    out = {"checked": raw["checked"], "checked_label": f"{checked:%b} {checked.day}, {checked:%I:%M %p}".replace(" 0", " ") + " Japan time",
           "forecast": keep, "notes": {d: notes[d] for d in sorted(notes)}}
    json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=1)
    print("wrote weather.json:", ", ".join(f"{d} {n['level']}" for d, n in sorted(notes.items())))

if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "fetch": fetch()
    elif len(sys.argv) >= 3 and sys.argv[1] == "write": write(sys.argv[2])
    else: sys.exit(__doc__)
