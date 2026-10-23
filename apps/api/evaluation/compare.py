"""Compare contract findings only; never produce a model-quality score."""
import argparse
import json
from pathlib import Path


def compare(baseline, candidate):
    if baseline["corpus_sha256"] != candidate["corpus_sha256"]:
        raise ValueError("Different corpora cannot be treated as a matched comparison")
    def index(report):
        return {(r["case"], r["retained"], r["turn"]): r for r in report["records"]}
    before, after = index(baseline), index(candidate)
    if before.keys() != after.keys():
        raise ValueError("Different replay coverage")
    changes = []
    for key, old in before.items():
        new = after[key]
        if old["checks"].keys() != new["checks"].keys():
            raise ValueError("Contract checks changed; requires separate review")
        for check, passed in old["checks"].items():
            if passed != new["checks"][check]:
                changes.append({"case": key[0], "retained": key[1], "turn": key[2],
                                "check": check, "before": passed, "after": new["checks"][check]})
    return {"scope": "offline contracts only", "records_per_variant": len(before),
            "changes": changes,
            "remaining_contract_findings": [
                {"case": r["case"], "retained": r["retained"], "turn": r["turn"], "issues": r["issue_types"]}
                for r in after.values() if r["issue_types"]],
            "real_model_quality": "not_verified", "human_review": "pending"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("baseline", type=Path)
    parser.add_argument("candidate", type=Path)
    args = parser.parse_args()
    result = compare(*(json.loads(p.read_text(encoding="utf-8")) for p in (args.baseline, args.candidate)))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
