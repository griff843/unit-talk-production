# DEVIG NORMALIZATION SPEC v1.0

Blueprint Type: Mathematical Truth Contract  
Applies To: Market Snapshots, Edge Engine, CLV Engine, Model Training  
Status: DRAFT (Phase 2A)  
Binding Over: All edge calculations, consensus pricing, and CLV computation

---

# 1. PURPOSE

All edge, confidence, CLV, and EV calculations depend on fair probability
estimation.

Raw sportsbook prices include vigorish (overround). This document defines:

• How implied probability is computed  
• How vig is removed  
• How consensus fair probability is computed  
• How edge is calculated  
• How CLV is standardized  
• How live / incomplete markets are handled

This spec is mandatory for all scoring logic.

---

# 2. PRICE → IMPLIED PROBABILITY CONVERSION

## 2.1 American Odds

For negative odds (favorite): P_implied = |odds| / (|odds| + 100)

For positive odds (underdog): P_implied = 100 / (odds + 100)

Example: -110 → 110 / 210 = 0.5238  
+150 → 100 / 250 = 0.4000

---

## 2.2 Decimal Odds

P_implied = 1 / decimal_odds

Example: 1.91 → 0.5236

---

## 2.3 Fractional Odds

P_implied = denominator / (numerator + denominator)

---

# 3. OVERROUND (VIG) CALCULATION

For a two-outcome market:

Overround = P1_implied + P2_implied

For N-outcome market:

Overround = Σ P_i_implied

If Overround > 1.0 → vig present

---

# 4. VIG REMOVAL METHODS

We support 4 devig methods.

---

## 4.1 Proportional Normalization (Baseline)

P_fair_i = P_implied_i / Overround

Use when: • Low-information books • No sharp weighting available • Quick
fallback

---

## 4.2 Shin Method (Sharp-aware)

Used when: • Market likely influenced by informed traders • High liquidity
market • Market maker books available

Requires solving:

P_fair_i = (sqrt(z^2 + 4(1 - z)P_implied_i) - z) / (2(1 - z))

Where: z = insider trading parameter estimated numerically.

We solve z via iterative root-finding.

---

## 4.3 Power Method

P_fair_i = P_implied_i^k / Σ(P_implied_j^k)

Where: k determined via calibration on historical closing accuracy.

Use when: • Calibrated for specific sport/market type

---

## 4.4 Logit Method (Advanced)

Transform to log-odds:

logit(P) = ln(P / (1-P))

Adjust margin in logit space.

Used only for: • High-volume, multi-outcome markets • Research mode

---

# 5. MULTI-BOOK CONSENSUS FAIR PROBABILITY

Each book produces:

P_fair_i_book

Consensus fair probability is weighted:

P_consensus_i = Σ (w_book × P_fair_i_book)

Weights defined as:

w_book = liquidity_weight × sharp_weight × data_quality_weight

Normalized so Σ w_book = 1

---

## 5.1 Liquidity Weight

limit_tier: low = 0.5  
medium = 1.0  
high = 1.5

---

## 5.2 Sharp Weight

book_profile: retail = 1.0  
market_maker = 1.2  
sharp = 1.5

---

## 5.3 Data Quality Weight

data_quality_flag: good = 1.0  
partial = 0.7  
suspect = 0.3

---

# 6. EDGE CALCULATION

Let:

P_model = model probability  
P_market = devig consensus probability

Edge = P_model - P_market

Expected Value (EV):

EV = (P_model × payout) - (1 - P_model)

Where payout = decimal_odds - 1

EV% = EV

---

# 7. KELLY FRACTION (BASE)

Kelly = (bp - q) / b

Where: b = payout  
p = P_model  
q = 1 - P_model

We do not use full Kelly in production. System default = 0.25 Kelly.

---

# 8. CLV (CLOSING LINE VALUE)

## 8.1 Definition

CLV = closing_devig_probability - entry_devig_probability

OR in price terms:

CLV_decimal = closing_decimal - entry_decimal

Primary metric: probability delta.

---

## 8.2 Closing Snapshot Rule

Closing snapshot must satisfy:

• is_closing_snapshot = true  
• closing_locked_at_utc not null  
• event status transitioned from scheduled → live

If missing: CLV is marked null.

---

# 9. LIVE MARKET HANDLING

If:

• fewer than 2 books available • data_quality_flag != good • incomplete outcome
set

Then:

• devig_method defaults to proportional  
• weight adjustment applied  
• confidence penalty applied downstream

---

# 10. TRAINING DATA RULES

For model training:

• Use consensus devig probability  
• Store devig_method used  
• Store weight composition  
• Store snapshot timestamp

Never train on raw implied probability.

---

# 11. STORAGE REQUIREMENTS

Each `market_snapshot` must store:

• devig_method  
• devig_fair_probabilities_json  
• consensus_weights_json  
• overround

---

# 12. VERSIONING

This spec is versioned v1.0.  
Changes require:

• new version doc  
• recalibration tests  
• governance closeout marker

---

END.
