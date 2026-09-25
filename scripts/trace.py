# Trace a live run ticket by ticket. Usage: python3 scripts/trace.py URL N [watchdog 0|1]
import json, sys, urllib.request
url, n, wd = sys.argv[1], int(sys.argv[2]), len(sys.argv) > 3 and sys.argv[3] == "1"
state, paid, nv = None, 0.0, 0
for i in range(n):
    req = urllib.request.Request(f"{url}/api/step", data=json.dumps({"state": state, "config": {"watchdog": wd, "seed": 42}}).encode(), headers={"content-type": "application/json"})
    d = json.load(urllib.request.urlopen(req, timeout=180)); state, r = d["state"], d["result"]; t = r["ticket"]
    if r["violations"]: nv += 1
    if r["violations"] and r["executed"]["action"] == "refund": paid += r["executed"]["amount"]
    iv = (r["intervention"] or {}).get("kind") or ""
    print(f'{"X" if r["violations"] else "."} #{t["id"]} ask {t["claimed"]}/{t["orderValue"]} ev={t["evidence"]} -> {r["proposed"]["action"]} {r["proposed"]["amount"]} {iv} | {r["proposed"]["reason"][:80]}')
    if r.get("rewrite"): print(f'   REWRITE audit={r["rewrite"]["audit"]["score"]}: {"; ".join(r["rewrite"]["audit"]["findings"])[:300]}')
print(f"\nviolations={nv} paid-against-policy EUR {paid:.2f}\nFINAL INSTRUCTIONS:\n{state['playbook']}")
