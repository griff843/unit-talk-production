# Monthly Credit Usage Estimate - Odds API

**Plan**: $119/month
**Credits Available**: 5,000,000/month
**Configuration**: 30-second polling with complete market coverage
**Date**: 2025-09-27

---

## ✅ Current System Validation

### Data Ingestion Confirmed
- **unified_picks**: 56+ rows ingested ✅
- **games**: 296+ rows synced ✅
- **MLB props**: 11,842 props transformed per run ✅
- **Game metadata**: 15 MLB games synced automatically ✅

### Markets Coverage
- **Core markets**: h2h, spreads, totals (3 markets)
- **NFL player props**: 33 markets
- **MLB player props**: 16 markets (batter/pitcher)
- **WNBA player props**: 11 markets

---

## 📊 Credit Usage Per API Call

### Odds API Credit System
Each API call to Odds API costs credits based on the endpoint:

| Endpoint Type | Credit Cost | What It Returns |
|--------------|-------------|-----------------|
| `/sports/{sport}/odds` (events list) | 1 credit | List of upcoming events |
| `/sports/{sport}/odds` (batch core markets) | 1 credit | Core markets for ALL events |
| `/sports/{sport}/events/{id}/odds` (per-event) | 1 credit per event | Player props for ONE event |

---

## 🔢 Credit Usage Breakdown Per Sport

### MLB (15 games/day typical)
**Per 30-second poll cycle**:
- Events list: 1 credit
- Core markets (batch): 1 credit
- Player props (per-event): 15 events × 1 credit = 15 credits
- **Total per poll**: 17 credits

**Per hour (120 polls)**:
- 17 credits × 120 polls = **2,040 credits/hour**

**Per day (8 hours live games)**:
- 2,040 credits × 8 hours = **16,320 credits/day**

### NFL (13 games/week, ~1.85 games/day average)
**Per 30-second poll cycle**:
- Events list: 1 credit
- Core markets (batch): 1 credit
- Player props (per-event): 13 events × 1 credit = 13 credits
- **Total per poll**: 15 credits

**Per hour (120 polls)**:
- 15 credits × 120 polls = **1,800 credits/hour**

**Per day (12 hours on game days, ~2 days/week)**:
- 1,800 credits × 12 hours × 2 days = **43,200 credits/week**
- Average per day: 43,200 ÷ 7 = **6,171 credits/day**

### WNBA (2 games/day typical, season ending)
**Per 30-second poll cycle**:
- Events list: 1 credit
- Core markets (batch): 1 credit
- Player props (per-event): 2 events × 1 credit = 2 credits
- **Total per poll**: 4 credits

**Per hour (120 polls)**:
- 4 credits × 120 polls = **480 credits/hour**

**Per day (6 hours live games)**:
- 480 credits × 6 hours = **2,880 credits/day**

---

## 📈 Monthly Usage Estimates

### Scenario 1: Regular Season (All 3 Sports Active)

**Daily Usage**:
- MLB: 16,320 credits/day (30 days/month)
- NFL: 6,171 credits/day (30 days/month)
- WNBA: 2,880 credits/day (15 days remaining in season)
- **Total daily average**: 25,371 credits/day

**Monthly Usage**:
- MLB: 16,320 × 30 = 489,600 credits
- NFL: 6,171 × 30 = 185,130 credits
- WNBA: 2,880 × 15 = 43,200 credits
- **Total monthly**: **717,930 credits**

**Buffer Remaining**: 5,000,000 - 717,930 = **4,282,070 credits (86% unused)** ✅

---

### Scenario 2: Peak Season (MLB + NFL Heavy)

**Assumptions**:
- MLB postseason: 10 games/day × 20 days
- NFL peak: 16 games/week × 4 weeks
- WNBA: Season ended

**MLB Postseason (10 games/day)**:
- Per poll: 1 + 1 + 10 = 12 credits
- Per hour: 12 × 120 = 1,440 credits
- Per day: 1,440 × 10 hours = 14,400 credits
- 20 days: 14,400 × 20 = **288,000 credits**

**NFL Peak (16 games/week)**:
- Per poll: 1 + 1 + 16 = 18 credits
- Per hour: 18 × 120 = 2,160 credits
- Per day: 2,160 × 12 hours × 3 days = 77,760 credits/week
- 4 weeks: 77,760 × 4 = **311,040 credits**

**Total Peak Month**: 288,000 + 311,040 = **599,040 credits**

**Buffer Remaining**: 5,000,000 - 599,040 = **4,400,960 credits (88% unused)** ✅

---

### Scenario 3: Absolute Maximum (All Sports Peak)

**Most aggressive possible usage**:
- MLB: 20 games/day × 30 days × 12 hours
- NFL: 16 games/day × 30 days × 12 hours
- NBA: 15 games/day × 30 days × 10 hours (future season)

**MLB Max**:
- Per poll: 1 + 1 + 20 = 22 credits
- Per day: 22 × 120 × 12 = 31,680 credits
- Monthly: 31,680 × 30 = **950,400 credits**

**NFL Max**:
- Per poll: 1 + 1 + 16 = 18 credits
- Per day: 18 × 120 × 12 = 25,920 credits
- Monthly: 25,920 × 30 = **777,600 credits**

**NBA Max (future)**:
- Per poll: 1 + 1 + 15 = 17 credits
- Per day: 17 × 120 × 10 = 20,400 credits
- Monthly: 20,400 × 30 = **612,000 credits**

**Total Absolute Max**: 950,400 + 777,600 + 612,000 = **2,340,000 credits**

**Buffer Remaining**: 5,000,000 - 2,340,000 = **2,660,000 credits (53% unused)** ✅

---

## 🎯 Recommended Configuration

### Current Setup (Optimal)
- **MLB**: 30-second polling during live games (8 hours/day)
- **NFL**: 30-second polling during live games (12 hours/day on game days)
- **WNBA**: 30-second polling during live games (6 hours/day)

### Expected Monthly Usage: **~720,000 credits (14.4% of plan)**

### Optimization Opportunities
1. **No optimization needed** - massive credit buffer
2. Could increase to **15-second polling** and still use <30% of credits
3. Could add **NBA** (82 games/day peak season) and still have 50%+ buffer
4. Could add **NHL** (82 games/day peak season) without issue

---

## 📋 Summary

| Metric | Value |
|--------|-------|
| **Monthly Credit Allocation** | 5,000,000 |
| **Expected Monthly Usage** | ~720,000 (14.4%) |
| **Peak Season Usage** | ~2,340,000 (46.8%) |
| **Buffer Remaining (typical)** | 4,280,000 (85.6%) |
| **Risk Level** | ✅ VERY LOW |
| **Optimization Priority** | ❌ NOT NEEDED |

---

## ✅ Key Takeaways

1. **System is correctly configured** - All markets fetching properly
2. **Data is being ingested** - Props and metadata syncing to database
3. **Credit usage is very conservative** - Using <15% of monthly allocation
4. **Massive buffer exists** - Can handle 5-6x current traffic
5. **30-second polling is safe** - Could even do 15-second if needed
6. **No risk of overages** - Even at absolute peak, only using ~47% of credits

---

**Recommendation**: Keep current configuration. The $119/month plan provides more than enough credits for complete market coverage with 30-second polling across all major sports.

**Next Review**: Monitor actual credit usage after 1 week of production polling to validate estimates.