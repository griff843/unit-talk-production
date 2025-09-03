# Data Source Strategy & API Routing

## 🎯 Current Configuration (from dataSourceRouter.ts)

### API Selection Strategy

#### **Optimal API** (Primary for Player Props)

- **Sports**: NFL, NBA, MLB, NHL
- **Use Cases**: Player props, specialized betting markets
- **Advantages**: Rich player prop data, detailed statistics
- **Limitations**: No settlement data, limited game coverage

#### **Odds API** (Primary for Games & Settlement)

- **Sports**: NCAAF, NCAAB, WNBA, EPL, ATP + fallback for others
- **Use Cases**: Game odds, spreads, totals, settlement data
- **Advantages**: Comprehensive game coverage, settlement support
- **Limitations**: Limited player prop depth

## 📊 Routing Configuration Matrix

| Sport     | Primary API | Secondary API | Best For                       | Supports                    |
| --------- | ----------- | ------------- | ------------------------------ | --------------------------- |
| **MLB**   | Optimal API | Odds API      | Player props (Hits, HRs, RBIs) | Props, Spreads, Totals      |
| **NFL**   | Optimal API | Odds API      | Player props (Yards, TDs)      | Props, Spreads, Totals      |
| **NBA**   | Optimal API | Odds API      | Player props (Points, Assists) | Props, Spreads, Totals      |
| **NHL**   | Optimal API | Odds API      | Player props (Goals, Assists)  | Props, Spreads, Totals      |
| **NCAAF** | Odds API    | None          | Game lines, settlement         | Spreads, Totals, Settlement |
| **WNBA**  | Odds API    | None          | Game lines                     | Spreads, Totals             |

## ⚠️ **Issue Identified**

### Why We Used Odds API Instead of Optimal for MLB:

1. **Direct API Call**: We bypassed the data source router and called Odds API
   directly
2. **Missing Optimal Integration**: Our ingestion script didn't use the unified
   router
3. **Schema Mismatch**: Each API has different data structures

### **What Should Have Happened**:

```typescript
// Should have used:
const mlbData = await fetchUnifiedData({
  sport: 'MLB',
  marketType: 'player-props', // This would route to Optimal API
});
```

## 🔧 Decision Rules

### Automatic Routing Logic:

1. **Player Props Request** → Optimal API (if supported) → Odds API (fallback)
2. **Settlement Data** → Always Odds API (only source)
3. **NCAAF/NCAAB** → Always Odds API (Optimal doesn't support)
4. **Game Lines Only** → Odds API (broader coverage)
5. **Credit Conservation** → Optimal API preferred (free tier)

### Manual Override:

```typescript
// Force specific API
const data = await fetchUnifiedData({
  sport: 'MLB',
  forceSource: 'optimal-api', // or 'odds-api'
});
```

## 📈 Credit Usage Strategy

### **Odds API** (500 credits/month free)

- **Cost**: 1 credit per request
- **Usage**: Settlement data, NCAAF, fallback scenarios
- **Budget**: ~16 requests/day

### **Optimal API** (Free tier available)

- **Cost**: Free tier limits
- **Usage**: Primary for MLB/NFL/NBA/NHL player props
- **Budget**: Higher volume possible

## 🎯 **Recommendations**

### For Production:

1. **Always use unified router** (`fetchUnifiedData`)
2. **Primary**: Optimal API for MLB props
3. **Secondary**: Odds API for games and settlement
4. **Monitor**: Credit usage across both APIs
5. **Cache**: Results to minimize API calls

### For E2E Testing:

1. **Use both APIs** to test routing logic
2. **Test fallback scenarios** (API failures)
3. **Verify data consistency** between sources
4. **Monitor performance** of each route

## 🚨 **Action Items**

1. **Fix Current Implementation**: Use unified router instead of direct API
   calls
2. **Test Optimal API**: Verify MLB player props work correctly
3. **Schema Alignment**: Ensure both APIs produce compatible data structures
4. **Error Handling**: Proper fallback when Optimal API fails
5. **Monitoring**: Track which API is used for each request

## 💡 **Next Steps**

1. Replace direct Odds API script with unified router
2. Test Optimal API integration for MLB props
3. Verify schema compatibility
4. Implement proper error handling and fallbacks
5. Add monitoring for API usage and performance
