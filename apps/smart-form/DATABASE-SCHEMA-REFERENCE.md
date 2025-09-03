# Unit Talk Platform - Database Schema Reference

**Generated**: 2025-08-02T07:22:30.807Z **Purpose**: Comprehensive reference for
all table structures to prevent schema mismatches

## 📊 Schema Summary

- **Existing Tables**: 4
- **Missing Tables**: 5
- **Total Columns**: 273

## 📋 `raw_props` Table

**Status**: ✅ Active **Columns**: 63

### Column Structure

| Column              | Type      | Sample Value                         |
| ------------------- | --------- | ------------------------------------ |
| `id`                | varchar   | aeb0f8b1-32ef-4d72-ac3e-5a2a80ce5725 |
| `player_name`       | varchar   | Dylan Carlson                        |
| `sport`             | varchar   | MLB                                  |
| `team`              | varchar   | bal                                  |
| `stat_type`         | varchar   | totalBases                           |
| `outcome`           | nullable  | NULL                                 |
| `line`              | decimal   | 0.5                                  |
| `odds`              | integer   | 0                                    |
| `game_date`         | varchar   | 2025-07-30                           |
| `matchup`           | varchar   | bal vs tor                           |
| `trend_confidence`  | integer   | 0                                    |
| `matchup_quality`   | integer   | 0                                    |
| `line_value_score`  | integer   | 0                                    |
| `role_stability`    | integer   | 0                                    |
| `confidence_score`  | integer   | 0                                    |
| `edge_score`        | integer   | 0                                    |
| `tier_tag`          | nullable  | NULL                                 |
| `auto_approved`     | boolean   | false                                |
| `context_flag`      | boolean   | false                                |
| `created_at`        | timestamp | 2025-07-30T00:10:55.116              |
| `source`            | varchar   | optimal-api                          |
| `promoted_to_picks` | boolean   | false                                |
| `game_id`           | nullable  | NULL                                 |
| `bet_type`          | nullable  | NULL                                 |
| `market_type`       | nullable  | NULL                                 |
| `outcomes`          | nullable  | NULL                                 |
| `player_id`         | nullable  | NULL                                 |
| `player_slug`       | nullable  | NULL                                 |
| `external_game_id`  | varchar   | MLB-tor-bal-2025072918               |
| `sport_key`         | varchar   | mlb                                  |
| `fair_odds`         | nullable  | NULL                                 |
| `league`            | nullable  | NULL                                 |
| `promoted_at`       | nullable  | NULL                                 |
| `unit_size`         | nullable  | NULL                                 |
| `tier`              | nullable  | NULL                                 |
| `promoted`          | boolean   | false                                |
| `ev_percent`        | nullable  | NULL                                 |
| `trend_score`       | nullable  | NULL                                 |
| `matchup_score`     | nullable  | NULL                                 |
| `line_score`        | nullable  | NULL                                 |
| `role_score`        | nullable  | NULL                                 |
| `direction`         | nullable  | NULL                                 |
| `unique_key`        | nullable  | NULL                                 |
| `is_promoted`       | boolean   | false                                |
| `event_id`          | nullable  | NULL                                 |
| `book`              | nullable  | NULL                                 |
| `updated_at`        | nullable  | NULL                                 |
| `is_alt_line`       | nullable  | NULL                                 |
| `is_primary`        | nullable  | NULL                                 |
| `opponent`          | varchar   | tor                                  |
| `start_time`        | nullable  | NULL                                 |
| `is_valid`          | nullable  | NULL                                 |
| `external_id`       | nullable  | NULL                                 |
| `over_odds`         | integer   | 0                                    |
| `under_odds`        | integer   | 0                                    |
| `market`            | nullable  | NULL                                 |
| `provider`          | varchar   | Optimal                              |
| `game_time`         | timestamp | 2025-07-30T00:10:55.116+00:00        |
| `scraped_at`        | timestamp | 2025-07-30T00:10:55.116+00:00        |
| `home_team`         | nullable  | NULL                                 |
| `home_team_id`      | nullable  | NULL                                 |
| `away_team`         | nullable  | NULL                                 |
| `away_team_id`      | nullable  | NULL                                 |

### Sample Record

```json
{
  "id": "aeb0f8b1-32ef-4d72-ac3e-5a2a80ce5725",
  "player_name": "Dylan Carlson",
  "sport": "MLB",
  "team": "bal",
  "stat_type": "totalBases",
  "outcome": null,
  "line": 0.5,
  "odds": 0,
  "game_date": "2025-07-30",
  "matchup": "bal vs tor",
  "trend_confidence": 0,
  "matchup_quality": 0,
  "line_value_score": 0,
  "role_stability": 0,
  "confidence_score": 0,
  "edge_score": 0,
  "tier_tag": null,
  "auto_approved": false,
  "context_flag": false,
  "created_at": "2025-07-30T00:10:55.116",
  "source": "optimal-api",
  "promoted_to_picks": false,
  "game_id": null,
  "bet_type": null,
  "market_type": null,
  "outcomes": null,
  "player_id": null,
  "player_slug": null,
  "external_game_id": "MLB-tor-bal-2025072918",
  "sport_key": "mlb",
  "fair_odds": null,
  "league": null,
  "promoted_at": null,
  "unit_size": null,
  "tier": null,
  "promoted": false,
  "ev_percent": null,
  "trend_score": null,
  "matchup_score": null,
  "line_score": null,
  "role_score": null,
  "direction": null,
  "unique_key": null,
  "is_promoted": false,
  "event_id": null,
  "book": null,
  "updated_at": null,
  "is_alt_line": null,
  "is_primary": null,
  "opponent": "tor",
  "start_time": null,
  "is_valid": null,
  "external_id": null,
  "over_odds": 0,
  "under_odds": 0,
  "market": null,
  "provider": "Optimal",
  "game_time": "2025-07-30T00:10:55.116+00:00",
  "scraped_at": "2025-07-30T00:10:55.116+00:00",
  "home_team": null,
  "home_team_id": null,
  "away_team": null,
  "away_team_id": null
}
```

## 📋 `games` Table

**Status**: ✅ Active **Columns**: 35

### Column Structure

| Column             | Type      | Sample Value                         |
| ------------------ | --------- | ------------------------------------ |
| `id`               | varchar   | 9a134e77-d3e5-4e7f-9697-347cadb27fab |
| `game_id`          | varchar   | c3775c9a-801d-4d4a-a9bc-7c092e477f57 |
| `sport`            | varchar   | BASKETBALL                           |
| `season`           | nullable  | NULL                                 |
| `date`             | nullable  | NULL                                 |
| `start_time`       | nullable  | NULL                                 |
| `status`           | nullable  | NULL                                 |
| `home_team`        | varchar   | BOSTON_CELTICS_NBA                   |
| `away_team`        | varchar   | NEW_YORK_KNICKS_NBA                  |
| `home_score`       | nullable  | NULL                                 |
| `away_score`       | nullable  | NULL                                 |
| `venue`            | nullable  | NULL                                 |
| `created_at`       | timestamp | 2025-05-14T20:04:51.411924+00:00     |
| `matchup`          | nullable  | NULL                                 |
| `game_date`        | nullable  | NULL                                 |
| `event_id`         | nullable  | NULL                                 |
| `source`           | varchar   | sgo                                  |
| `home_odds`        | nullable  | NULL                                 |
| `away_odds`        | nullable  | NULL                                 |
| `spread`           | nullable  | NULL                                 |
| `total`            | varchar   | 207.5                                |
| `updated_at`       | timestamp | 2025-05-14T20:04:51.411924+00:00     |
| `commence_time`    | nullable  | NULL                                 |
| `sport_key`        | nullable  | NULL                                 |
| `source_event_id`  | nullable  | NULL                                 |
| `external_id`      | nullable  | NULL                                 |
| `league`           | varchar   | NBA                                  |
| `home_team_meta`   | json      | JSON object                          |
| `away_team_meta`   | json      | JSON object                          |
| `external_game_id` | varchar   | qAJez6YqCqTXdQ6FYjIx                 |
| `moneyline_home`   | varchar   | -188                                 |
| `moneyline_away`   | varchar   | +158                                 |
| `total_under_odds` | varchar   | -110                                 |
| `spread_odds`      | nullable  | NULL                                 |
| `total_over_odds`  | varchar   | -110                                 |

### Sample Record

```json
{
  "id": "9a134e77-d3e5-4e7f-9697-347cadb27fab",
  "game_id": "c3775c9a-801d-4d4a-a9bc-7c092e477f57",
  "sport": "BASKETBALL",
  "season": null,
  "date": null,
  "start_time": null,
  "status": null,
  "home_team": "BOSTON_CELTICS_NBA",
  "away_team": "NEW_YORK_KNICKS_NBA",
  "home_score": null,
  "away_score": null,
  "venue": null,
  "created_at": "2025-05-14T20:04:51.411924+00:00",
  "matchup": null,
  "game_date": null,
  "event_id": null,
  "source": "sgo",
  "home_odds": null,
  "away_odds": null,
  "spread": null,
  "total": "207.5",
  "updated_at": "2025-05-14T20:04:51.411924+00:00",
  "commence_time": null,
  "sport_key": null,
  "source_event_id": null,
  "external_id": null,
  "league": "NBA",
  "home_team_meta": {
    "names": {
      "long": "Boston Celtics",
      "short": "BOS",
      "medium": "Celtics",
      "location": "Boston",
      "nickname": "Celtics"
    },
    "colors": {
      "primary": "#008348",
      "primaryContrast": "#FFFFFF"
    },
    "teamID": "BOSTON_CELTICS_NBA",
    "statEntityID": "home"
  },
  "away_team_meta": {
    "names": {
      "long": "New York Knicks",
      "short": "NYK",
      "medium": "Knicks",
      "location": "New York",
      "nickname": "Knicks"
    },
    "colors": {
      "primary": "#006BB6",
      "secondary": "#F58426",
      "primaryContrast": "#FFFFFF",
      "secondaryContrast": "#006BB6"
    },
    "teamID": "NEW_YORK_KNICKS_NBA",
    "statEntityID": "away"
  },
  "external_game_id": "qAJez6YqCqTXdQ6FYjIx",
  "moneyline_home": "-188",
  "moneyline_away": "+158",
  "total_under_odds": "-110",
  "spread_odds": null,
  "total_over_odds": "-110"
}
```

## 📋 `daily_picks` Table

**Status**: ✅ Active **Columns**: 93

### Column Structure

| Column                      | Type      | Sample Value                                       |
| --------------------------- | --------- | -------------------------------------------------- |
| `id`                        | varchar   | ac0f1cea-ec2e-4402-81e3-b2a5de68d503               |
| `player_name`               | varchar   | Jaylen Brown                                       |
| `sport`                     | varchar   | BASKETBALL                                         |
| `team`                      | varchar   | BOSTON_CELTICS_NBA                                 |
| `stat_type`                 | varchar   | rebounds                                           |
| `outcome`                   | nullable  | NULL                                               |
| `line`                      | decimal   | 7.5                                                |
| `odds`                      | integer   | 113                                                |
| `game_date`                 | varchar   | 2025-05-14                                         |
| `matchup`                   | nullable  | NULL                                               |
| `capper`                    | nullable  | NULL                                               |
| `unit_size`                 | integer   | 1                                                  |
| `play_tag`                  | nullable  | NULL                                               |
| `parlay_id`                 | nullable  | NULL                                               |
| `is_primary_leg`            | boolean   | true                                               |
| `confidence_score`          | nullable  | NULL                                               |
| `role_stability`            | nullable  | NULL                                               |
| `line_value_score`          | nullable  | NULL                                               |
| `trend_confidence`          | nullable  | NULL                                               |
| `matchup_quality`           | nullable  | NULL                                               |
| `edge_score`                | integer   | 3                                                  |
| `tier_tag`                  | nullable  | NULL                                               |
| `auto_approved`             | boolean   | false                                              |
| `context_flag`              | boolean   | false                                              |
| `created_at`                | timestamp | 2025-05-14T13:56:11.163                            |
| `promoted_to_final`         | boolean   | false                                              |
| `has_alert`                 | boolean   | false                                              |
| `alert_type`                | nullable  | NULL                                               |
| `units`                     | integer   | 1                                                  |
| `rr_ticket_id`              | nullable  | NULL                                               |
| `play_type`                 | varchar   | Player Prop                                        |
| `was_impacted_by_injury`    | boolean   | false                                              |
| `game_id`                   | nullable  | NULL                                               |
| `home_team`                 | nullable  | NULL                                               |
| `away_team`                 | nullable  | NULL                                               |
| `player_team`               | nullable  | NULL                                               |
| `l5_avg`                    | nullable  | NULL                                               |
| `l10_avg`                   | nullable  | NULL                                               |
| `dvp_score`                 | nullable  | NULL                                               |
| `h2h_avg`                   | nullable  | NULL                                               |
| `awaiting_review`           | boolean   | true                                               |
| `initial_line`              | nullable  | NULL                                               |
| `current_line`              | nullable  | NULL                                               |
| `initial_odds`              | nullable  | NULL                                               |
| `current_odds`              | nullable  | NULL                                               |
| `line_moved`                | boolean   | false                                              |
| `direction`                 | nullable  | NULL                                               |
| `tier`                      | nullable  | NULL                                               |
| `graded`                    | boolean   | false                                              |
| `source`                    | varchar   | sgo                                                |
| `promoted_to_picks`         | boolean   | false                                              |
| `player_id`                 | nullable  | NULL                                               |
| `opponent`                  | varchar   | NEW_YORK_KNICKS_NBA                                |
| `commencement_date`         | nullable  | NULL                                               |
| `bet_type`                  | nullable  | NULL                                               |
| `raw_prop_id`               | nullable  | NULL                                               |
| `market_type`               | nullable  | NULL                                               |
| `approved_by`               | nullable  | NULL                                               |
| `play_status`               | varchar   | pending                                            |
| `tags`                      | nullable  | NULL                                               |
| `ai_tier`                   | nullable  | NULL                                               |
| `ai_confidence_score`       | nullable  | NULL                                               |
| `ai_win_prob`               | nullable  | NULL                                               |
| `ai_risk_flag`              | nullable  | NULL                                               |
| `expected_value_score`      | nullable  | NULL                                               |
| `true_tier`                 | nullable  | NULL                                               |
| `staff_review_required`     | boolean   | false                                              |
| `play_tags`                 | nullable  | NULL                                               |
| `pick_explainer`            | nullable  | NULL                                               |
| `start_time`                | nullable  | NULL                                               |
| `book`                      | nullable  | NULL                                               |
| `ev_percent`                | nullable  | NULL                                               |
| `event_id`                  | nullable  | NULL                                               |
| `external_game_id`          | nullable  | NULL                                               |
| `position_vs_defense_score` | nullable  | NULL                                               |
| `promoted_at`               | timestamp | 2025-05-14T16:07:06.868                            |
| `fair_odds`                 | nullable  | NULL                                               |
| `is_alt_line`               | boolean   | false                                              |
| `is_primary`                | boolean   | true                                               |
| `is_promoted`               | boolean   | false                                              |
| `is_valid`                  | boolean   | true                                               |
| `league`                    | varchar   | NBA                                                |
| `line_score`                | nullable  | NULL                                               |
| `matchup_score`             | nullable  | NULL                                               |
| `outcomes`                  | nullable  | NULL                                               |
| `player_slug`               | nullable  | NULL                                               |
| `promoted`                  | nullable  | NULL                                               |
| `role_score`                | nullable  | NULL                                               |
| `sport_key`                 | nullable  | NULL                                               |
| `trend_score`               | nullable  | NULL                                               |
| `unique_key`                | varchar   | Jaylen Brown-rebounds-7.5-+113-qAJez6YqCqTXdQ6F... |
| `updated_at`                | nullable  | NULL                                               |
| `admin_override_tier`       | nullable  | NULL                                               |

### Sample Record

```json
{
  "id": "ac0f1cea-ec2e-4402-81e3-b2a5de68d503",
  "player_name": "Jaylen Brown",
  "sport": "BASKETBALL",
  "team": "BOSTON_CELTICS_NBA",
  "stat_type": "rebounds",
  "outcome": null,
  "line": 7.5,
  "odds": 113,
  "game_date": "2025-05-14",
  "matchup": null,
  "capper": null,
  "unit_size": 1,
  "play_tag": null,
  "parlay_id": null,
  "is_primary_leg": true,
  "confidence_score": null,
  "role_stability": null,
  "line_value_score": null,
  "trend_confidence": null,
  "matchup_quality": null,
  "edge_score": 3,
  "tier_tag": null,
  "auto_approved": false,
  "context_flag": false,
  "created_at": "2025-05-14T13:56:11.163",
  "promoted_to_final": false,
  "has_alert": false,
  "alert_type": null,
  "units": 1,
  "rr_ticket_id": null,
  "play_type": "Player Prop",
  "was_impacted_by_injury": false,
  "game_id": null,
  "home_team": null,
  "away_team": null,
  "player_team": null,
  "l5_avg": null,
  "l10_avg": null,
  "dvp_score": null,
  "h2h_avg": null,
  "awaiting_review": true,
  "initial_line": null,
  "current_line": null,
  "initial_odds": null,
  "current_odds": null,
  "line_moved": false,
  "direction": null,
  "tier": null,
  "graded": false,
  "source": "sgo",
  "promoted_to_picks": false,
  "player_id": null,
  "opponent": "NEW_YORK_KNICKS_NBA",
  "commencement_date": null,
  "bet_type": null,
  "raw_prop_id": null,
  "market_type": null,
  "approved_by": null,
  "play_status": "pending",
  "tags": null,
  "ai_tier": null,
  "ai_confidence_score": null,
  "ai_win_prob": null,
  "ai_risk_flag": null,
  "expected_value_score": null,
  "true_tier": null,
  "staff_review_required": false,
  "play_tags": null,
  "pick_explainer": null,
  "start_time": null,
  "book": null,
  "ev_percent": null,
  "event_id": null,
  "external_game_id": null,
  "position_vs_defense_score": null,
  "promoted_at": "2025-05-14T16:07:06.868",
  "fair_odds": null,
  "is_alt_line": false,
  "is_primary": true,
  "is_promoted": false,
  "is_valid": true,
  "league": "NBA",
  "line_score": null,
  "matchup_score": null,
  "outcomes": null,
  "player_slug": null,
  "promoted": null,
  "role_score": null,
  "sport_key": null,
  "trend_score": null,
  "unique_key": "Jaylen Brown-rebounds-7.5-+113-qAJez6YqCqTXdQ6FYjIx",
  "updated_at": null,
  "admin_override_tier": null
}
```

## 📋 `final_picks` Table

**Status**: ✅ Active **Columns**: 82

### Column Structure

| Column                   | Type      | Sample Value                         |
| ------------------------ | --------- | ------------------------------------ |
| `id`                     | varchar   | 11111111-2222-3333-4444-555555555555 |
| `player_name`            | varchar   | LeBron James                         |
| `sport`                  | nullable  | NULL                                 |
| `team`                   | varchar   | LAL                                  |
| `stat_type`              | varchar   | PTS                                  |
| `outcome`                | nullable  | NULL                                 |
| `line`                   | decimal   | 27.5                                 |
| `odds`                   | integer   | -110                                 |
| `game_date`              | nullable  | NULL                                 |
| `matchup`                | varchar   | LAL vs BOS                           |
| `capper`                 | nullable  | NULL                                 |
| `unit_size`              | integer   | 2                                    |
| `play_tag`               | nullable  | NULL                                 |
| `parlay_id`              | nullable  | NULL                                 |
| `is_primary_leg`         | boolean   | true                                 |
| `edge_score`             | integer   | 22                                   |
| `tier_tag`               | nullable  | NULL                                 |
| `photo_url`              | nullable  | NULL                                 |
| `play_status`            | varchar   | Pending                              |
| `actual_stat`            | nullable  | NULL                                 |
| `final_result`           | nullable  | NULL                                 |
| `result_value`           | nullable  | NULL                                 |
| `context_flag`           | boolean   | false                                |
| `steam_flag`             | boolean   | false                                |
| `recap_posted`           | boolean   | false                                |
| `approved_by`            | nullable  | NULL                                 |
| `discord_post_id`        | nullable  | NULL                                 |
| `created_at`             | timestamp | 2025-05-27T00:40:22.25343            |
| `has_alert`              | boolean   | false                                |
| `alert_type`             | nullable  | NULL                                 |
| `posted_to_discord`      | boolean   | false                                |
| `tier`                   | varchar   | S                                    |
| `direction`              | varchar   | over                                 |
| `play_type`              | nullable  | NULL                                 |
| `ticket_type`            | nullable  | NULL                                 |
| `result`                 | nullable  | NULL                                 |
| `trend_confidence`       | nullable  | NULL                                 |
| `matchup_quality`        | nullable  | NULL                                 |
| `line_value_score`       | nullable  | NULL                                 |
| `role_stability`         | nullable  | NULL                                 |
| `confidence_score`       | nullable  | NULL                                 |
| `graded_at`              | nullable  | NULL                                 |
| `was_impacted_by_injury` | boolean   | false                                |
| `auto_approved`          | boolean   | true                                 |
| `initial_line`           | nullable  | NULL                                 |
| `current_line`           | nullable  | NULL                                 |
| `initial_odds`           | nullable  | NULL                                 |
| `current_odds`           | nullable  | NULL                                 |
| `line_moved`             | boolean   | false                                |
| `odds_moved`             | boolean   | false                                |
| `movement_trigger`       | nullable  | NULL                                 |
| `suppress_alert`         | boolean   | false                                |
| `hedge_flag`             | boolean   | false                                |
| `graded`                 | boolean   | false                                |
| `injury_flag`            | boolean   | false                                |
| `game_id`                | nullable  | NULL                                 |
| `daily_pick_id`          | nullable  | NULL                                 |
| `tags`                   | nullable  | NULL                                 |
| `ai_tier`                | nullable  | NULL                                 |
| `ai_confidence_score`    | nullable  | NULL                                 |
| `ai_win_prob`            | nullable  | NULL                                 |
| `ai_risk_flag`           | nullable  | NULL                                 |
| `expected_value_score`   | nullable  | NULL                                 |
| `true_tier`              | nullable  | NULL                                 |
| `pick_explainer`         | nullable  | NULL                                 |
| `opponent`               | nullable  | NULL                                 |
| `is_primary`             | boolean   | false                                |
| `ticket_id`              | nullable  | NULL                                 |
| `bet_type`               | varchar   | single                               |
| `latest_line`            | nullable  | NULL                                 |
| `latest_odds`            | nullable  | NULL                                 |
| `player_team`            | nullable  | NULL                                 |
| `is_alt_line`            | boolean   | false                                |
| `start_time`             | nullable  | NULL                                 |
| `ev_percent`             | decimal   | 8.2                                  |
| `trend_score`            | nullable  | NULL                                 |
| `matchup_score`          | nullable  | NULL                                 |
| `player_slug`            | nullable  | NULL                                 |
| `game_time`              | timestamp | 2025-05-28T20:00:00+00:00            |
| `legs`                   | nullable  | NULL                                 |
| `score_breakdown`        | nullable  | NULL                                 |
| `admin_override_tier`    | nullable  | NULL                                 |

### Sample Record

```json
{
  "id": "11111111-2222-3333-4444-555555555555",
  "player_name": "LeBron James",
  "sport": null,
  "team": "LAL",
  "stat_type": "PTS",
  "outcome": null,
  "line": 27.5,
  "odds": -110,
  "game_date": null,
  "matchup": "LAL vs BOS",
  "capper": null,
  "unit_size": 2,
  "play_tag": null,
  "parlay_id": null,
  "is_primary_leg": true,
  "edge_score": 22,
  "tier_tag": null,
  "photo_url": null,
  "play_status": "Pending",
  "actual_stat": null,
  "final_result": null,
  "result_value": null,
  "context_flag": false,
  "steam_flag": false,
  "recap_posted": false,
  "approved_by": null,
  "discord_post_id": null,
  "created_at": "2025-05-27T00:40:22.25343",
  "has_alert": false,
  "alert_type": null,
  "posted_to_discord": false,
  "tier": "S",
  "direction": "over",
  "play_type": null,
  "ticket_type": null,
  "result": null,
  "trend_confidence": null,
  "matchup_quality": null,
  "line_value_score": null,
  "role_stability": null,
  "confidence_score": null,
  "graded_at": null,
  "was_impacted_by_injury": false,
  "auto_approved": true,
  "initial_line": null,
  "current_line": null,
  "initial_odds": null,
  "current_odds": null,
  "line_moved": false,
  "odds_moved": false,
  "movement_trigger": null,
  "suppress_alert": false,
  "hedge_flag": false,
  "graded": false,
  "injury_flag": false,
  "game_id": null,
  "daily_pick_id": null,
  "tags": null,
  "ai_tier": null,
  "ai_confidence_score": null,
  "ai_win_prob": null,
  "ai_risk_flag": null,
  "expected_value_score": null,
  "true_tier": null,
  "pick_explainer": null,
  "opponent": null,
  "is_primary": false,
  "ticket_id": null,
  "bet_type": "single",
  "latest_line": null,
  "latest_odds": null,
  "player_team": null,
  "is_alt_line": false,
  "start_time": null,
  "ev_percent": 8.2,
  "trend_score": null,
  "matchup_score": null,
  "player_slug": null,
  "game_time": "2025-05-28T20:00:00+00:00",
  "legs": null,
  "score_breakdown": null,
  "admin_override_tier": null
}
```

## 📋 `capper_profiles` Table

**Status**: ❌ Does not exist **Error**: relation "public.capper_profiles" does
not exist

## 📋 `tickets` Table

**Status**: ❌ Does not exist **Error**: relation "public.tickets" does not
exist

## 📋 `analytics` Table

**Status**: ❌ Does not exist **Error**: relation "public.analytics" does not
exist

## 📋 `users` Table

**Status**: ❌ Does not exist **Error**: relation "public.users" does not exist

## 📋 `settlements` Table

**Status**: ❌ Does not exist **Error**: relation "public.settlements" does not
exist

## 🔗 API Data Source Compatibility

### Optimal API Expected Fields

- `player_name`: string
- `stat_type` / `market_type`: string
- `line`: number
- `odds`: number
- `team`: string
- `opponent`: string
- `game_id`: string
- `external_id`: string

### Odds API Expected Fields

- `sport_key`: string
- `commence_time`: timestamp
- `home_team`: string
- `away_team`: string
- `matchup`: string
- `external_game_id`: string

## ⚠️ Known Schema Issues

1. **Missing is_active column** in raw_props table
2. **Missing completed column** in games table
3. **Inconsistent ID fields** between API sources
4. **Different timestamp formats** across tables

## 🛠️ Recommended Schema Fixes

1. Add standardized columns for all data sources
2. Create unified timestamp format (ISO 8601)
3. Implement consistent ID strategy
4. Add data validation constraints
