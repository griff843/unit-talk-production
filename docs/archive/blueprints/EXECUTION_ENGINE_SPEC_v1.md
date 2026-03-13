# EXECUTION ENGINE SPEC v1.0

Blueprint Type: Market Timing & Edge Realization Contract  
Applies To: Promotion Layer, AlertAgent, Outbox Routing, CLV Engine  
Status: RATIFIED (Phase 2A)  
Binding Over: All bet promotion timing, routing, throttling, and CLV
exploitation

---

# 1. PURPOSE

The Execution Engine determines:

• When to fire a pick  
• Where to fire it  
• Whether to wait  
• Whether to throttle  
• Whether to suppress

It exists to maximize:

1. CLV
2. Realized edge
3. Liquidity efficiency
4. Portfolio stability

Model edge alone is insufficient. Execution determines dominance.

---

# 2. EXECUTION OBJECTIVES

Primary objectives:

A) Positive mean CLV  
B) Reduced slippage  
C) Controlled market impact  
D) Timing advantage vs information arrival  
E) Smart book routing

Secondary objectives:

F) Avoid chasing steam  
G) Avoid stale-line traps  
H) Avoid thin liquidity traps

---

# 3. INPUTS TO EXECUTION ENGINE

From Schema:

• P_final • uncertainty_final • edge_final • clv_forecast • correlation_group_id
• market_snapshot (entry) • time_to_start • information_event timeline •
liquidity tier distribution • book_profile mix

---

# 4. EXECUTION STATES

Each bet_event receives an execution state:

1. FIRE_NOW
2. WAIT_FOR_MOVE
3. WAIT_FOR_CONFIRMATION
4. AVOID
5. LIMITED_ROUTING

---

# 5. FIRE_NOW CONDITIONS

Default when:

• edge_final > threshold • clv_forecast positive • no recent adverse
information_event • sufficient liquidity • dispersion between books exists

Additional boost:

• Sharp books disagree with retail • Early line detected before market move

---

# 6. WAIT_FOR_MOVE LOGIC

Triggered when:

• clv_forecast suggests favorable move • information_event likely to resolve
soon • model confidence high but line unstable

Must store:

• re-evaluation timestamp • movement trigger threshold

Re-check logic runs at defined interval.

---

# 7. WAIT_FOR_CONFIRMATION

Used for:

• lineup-sensitive props • injury-dependent roles • starting pitcher/goalie
confirmations

If confirmation event not yet logged: Execution suppressed.

---

# 8. AVOID STATE

Triggered when:

• edge < minimum viable edge • high volatility + low confidence • thin liquidity
• data_quality_flag != good • excessive correlation stacking • suspicious market
resistance

Avoid state is explicit and logged.

---

# 9. LIMITED_ROUTING

Used when:

• edge exists but liquidity uneven • certain books flagged as slow • Black Label
tenant routing differs

Routing logic:

• prioritize high-liquidity books • deprioritize low-limit props • avoid books
flagged retail-only when sharp signal weak

---

# 10. CLV FORECAST INTEGRATION

CLV forecast determines aggressiveness.

If:

CLV_forecast strong positive → aggressive routing

CLV_forecast weak → conservative routing

CLV_forecast negative → suppress

---

# 11. STEAM & INFORMATION CLASSIFICATION

If price moves:

Execution engine must classify:

• Steam-driven (no info_event) • News-driven (info_event within time window)

Steam-driven positive movement: accelerate execution

News-driven movement: re-evaluate projection before firing

---

# 12. SLIPPAGE CONTROL

Track:

entry_price posted_price available_price_post_publish

If slippage > threshold: • flag execution quality event • adjust routing weights

---

# 13. CORRELATION GUARD

Before firing:

Check:

• correlation_group exposure • portfolio overlap • same-player multi-prop
stacking

If threshold exceeded: • throttle stake • limit routing • optionally suppress

---

# 14. BOOK ROUTING STRATEGY

Books classified:

• sharp • market_maker • retail

Routing priority:

1. High liquidity + sharp book
2. Market maker
3. Retail

Never treat all books equally.

---

# 15. EXECUTION METRICS

We track:

• CLV by execution state • Slippage rate • Fire-now vs wait performance • Entry
timing percentile • Edge decay over time • Hit rate vs timing bucket

Execution engine is evaluated independently of projection model.

---

# 16. FAILURE MODES

If:

• Fire-now produces negative CLV over window • Wait strategy misses positive CLV
• Slippage exceeds threshold

Engine enters review mode.

---

# 17. BLACK LABEL COMPATIBILITY

Execution thresholds may be tenant-specific:

• Aggressive profile • Conservative profile • Volume profile

But must never violate devig or model integrity.

---

# 18. VERSIONING

Execution logic versioned separately from model.

Log:

• execution_version • routing_strategy_version • threshold_set_version

No silent changes.

---

END.
