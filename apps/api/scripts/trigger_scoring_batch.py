#!/usr/bin/env python3
"""
Minimal scoring trigger for MLB props in unified_picks.
Applies basic professional scoring calculations via REST API.
"""
import os
import sys
import requests
from datetime import datetime

# Load env
SUPABASE_URL = os.getenv("SUPABASE_URL")
SRK = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SRK:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
    sys.exit(1)

def calculate_basic_score(odds, line):
    """
    Basic scoring: normalize odds to a 0-100 scale.
    Positive odds = underdog = higher potential score
    Negative odds = favorite = lower score
    """
    if odds >= 100:
        # Underdog: score based on potential return
        return min(85, 50 + (odds / 50))  # Cap at 85
    elif odds <= -100:
        # Favorite: score inversely proportional to odds
        return max(30, 60 - (abs(odds) / 20))  # Floor at 30
    else:
        return 50  # Neutral

def calculate_devigged_edge(odds):
    """
    Simplified devigging: remove ~5% vig estimate
    Real devigging requires both sides of market
    """
    if odds >= 100:
        implied_prob = 100 / (odds + 100)
    else:
        implied_prob = abs(odds) / (abs(odds) + 100)

    # Remove ~5% vig
    fair_prob = implied_prob * 0.95
    return fair_prob * 10  # Scale to 0-10 range

def main():
    print("=== Scoring Batch Processor ===")

    # 1) Fetch unscored MLB props
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/unified_picks?select=id,odds,line,selection,market,bookmaker_key&sport=eq.mlb&source=eq.odds-api&professional_score=is.null&limit=100",
        headers={"apikey": SRK, "Authorization": f"Bearer {SRK}"}
    )

    if not resp.ok:
        print(f"Error fetching props: {resp.status_code} - {resp.text}")
        sys.exit(1)

    props = resp.json()
    print(f"Found {len(props)} unscored props")

    if not props:
        print("No props to score. All caught up!")
        return

    # 2) Score each prop
    scored_count = 0
    failed_count = 0

    for prop in props:
        prop_id = prop["id"]
        odds = prop.get("odds", 0)
        line = prop.get("line", 0)

        # Calculate scores
        prof_score = calculate_basic_score(odds, line)
        devigged = calculate_devigged_edge(odds)

        # Assign tier based on score
        if prof_score >= 75:
            tier = "S"
        elif prof_score >= 65:
            tier = "A"
        elif prof_score >= 55:
            tier = "B"
        else:
            tier = "C"

        # Generate CLV tracking ID
        clv_id = f"clv_{prop_id[:8]}_{int(datetime.utcnow().timestamp())}"

        # Update prop with scores (don't change pick_type/pick_source to avoid constraints)
        update_data = {
            "professional_score": round(prof_score, 2),
            "tier_when_placed": tier,
            "devigged_edge": round(devigged, 4),
            "clv_tracking_id": clv_id,
            "promotion_status": "draft" if tier in ["S", "A"] else "not_promoted",
            "sharp_grading_version": "v2025.minimal",
            "processing_time": 100,  # milliseconds
            "updated_at": datetime.utcnow().isoformat() + "Z"
        }

        update_resp = requests.patch(
            f"{SUPABASE_URL}/rest/v1/unified_picks?id=eq.{prop_id}",
            json=update_data,
            headers={
                "apikey": SRK,
                "Authorization": f"Bearer {SRK}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            }
        )

        if update_resp.ok:
            scored_count += 1
            if scored_count % 10 == 0:
                print(f"  Scored {scored_count}/{len(props)}...")
        else:
            failed_count += 1
            if failed_count == 1:  # Only print first error
                print(f"  Error scoring prop {prop_id}: {update_resp.status_code} - {update_resp.text[:200]}")

    print(f"\n=== Scoring Complete ===")
    print(f"Successfully scored: {scored_count}")
    print(f"Failed: {failed_count}")

    # 3) Summary stats
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/unified_picks?select=tier_when_placed,promotion_status&sport=eq.mlb&source=eq.odds-api&professional_score=not.is.null",
        headers={"apikey": SRK, "Authorization": f"Bearer {SRK}"}
    )

    if resp.ok:
        scored_props = resp.json()
        tier_counts = {}
        promo_counts = {}
        for p in scored_props:
            tier = p.get("tier_when_placed", "unknown")
            promo = p.get("promotion_status", "unknown")
            tier_counts[tier] = tier_counts.get(tier, 0) + 1
            promo_counts[promo] = promo_counts.get(promo, 0) + 1

        print(f"\nTier Distribution:")
        for tier in ["S", "A", "B", "C"]:
            print(f"  {tier}: {tier_counts.get(tier, 0)}")

        print(f"\nPromotion Status:")
        for status, count in sorted(promo_counts.items()):
            print(f"  {status}: {count}")

if __name__ == "__main__":
    main()
