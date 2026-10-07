# 밀도 시안용: 표본 수만 바꿔 charts 블록을 다시 뽑는다(사이트 데이터는 건드리지 않음)
import json, sys, gzip
from pathlib import Path
sys.path.insert(0, "/Users/hyde/dev/untitled folder/signal-ml-portfolio/scripts")
import export_charts as ec
import export_terrain as et
import pandas as pd
OUT = Path(sys.argv[1])
metrics = json.loads(ec.METRICS_PATH.read_text(encoding="utf-8"))
as_of = metrics["_meta"]["asOf"]
raw = pd.read_csv(ec.AIRFARE_ROOT / "data" / "raw" / "flight_prices.csv")
kept, removed = et.split_rows(raw, as_of)
daily = et.load_completed_daily(kept, as_of)
print("daily rows", len(daily))
kept2, _ = et.add_route_class_pct(kept, removed)
sub = ec.route_rows(kept2, ec.MODEL_ROUTE, ec.MODEL_CABIN)
print("model route rows", len(sub))
base = json.loads((Path("/Users/hyde/dev/untitled folder/signal-ml-portfolio/public/data") / f"charts.{as_of}.json").read_text())
dates = base["dates"]
out = {}
for k, mult in (("x1", 1), ("x2", 2), ("x4", 4)):
    out[k] = {
        "curve": ec.curve_sample(daily, size=4000 * mult),
        "obs": ec.model_obs(sub, dates, per_date=12 * mult),
        "filter": ec.filter_block(raw, as_of, size=4000 * mult),
        "split": ec.split_block(kept, dates, size=4000 * mult),
    }
    o = dict(base); o["curve"] = dict(base["curve"], sample=out[k]["curve"]); o["model"] = dict(base["model"], obs=out[k]["obs"]); o["filter"] = out[k]["filter"]; o["split"] = out[k]["split"]
    body = json.dumps(o, separators=(",", ":")).encode()
    (OUT / f"charts.{k}.json").write_bytes(body)
    print(k, "curve", len(out[k]["curve"]["pct"]), "obs", len(out[k]["obs"]["pct"]), "gzip", len(gzip.compress(body)))
