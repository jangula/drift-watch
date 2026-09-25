# Run N tickets against a deployed instance and summarise. Usage: python3 scripts/live.py URL N [watchdog 0|1] [seed]
import json, sys, urllib.request
url, n = sys.argv[1], int(sys.argv[2])
wd = len(sys.argv) > 3 and sys.argv[3] == "1"
seed = int(sys.argv[4]) if len(sys.argv) > 4 else 42
state, line, paid, errs, shown = None, "", 0.0, 0, 0
for i in range(n):
    req = urllib.request.Request(f"{url}/api/step", data=json.dumps({"state": state, "config": {"watchdog": wd, "seed": seed}}).encode(), headers={"content-type": "application/json"})
    try:
        d = json.load(urllib.request.urlopen(req, timeout=120))
    except Exception as e:
        errs += 1; print("ERR", e); continue
    state, r = d["state"], d["result"]
    iv = (r["intervention"] or {}).get("kind")
    if r["violations"] and r["executed"]["action"] == "refund": paid += r["executed"]["amount"]
    if r["violations"] and shown < 4:
        shown += 1; t = r["ticket"]
        print(f'  #{t["id"]} asked {t["claimed"]} of {t["orderValue"]} evidence={t["evidence"]} -> {r["proposed"]["action"]} {r["proposed"]["amount"]}: {r["proposed"]["reason"]}')
    line += "Q" if iv == "quarantine" else "b" if iv == "block" else "X" if r["violations"] else "."
print(f'watchdog={"on " if wd else "off"} {line}  mode={r["mode"]} paid-against-policy EUR {paid:.2f} errors={errs}')
if not wd:
    print("  last notes:"); [print("   -", x) for x in state["notes"][-4:]]
