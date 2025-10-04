

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "archive";


ALTER SCHEMA "archive" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






CREATE SCHEMA IF NOT EXISTS "ops";


ALTER SCHEMA "ops" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."auto_fill_created_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if NEW.created_at is null then
    NEW.created_at := now();
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."auto_fill_created_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_fill_matchup"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if NEW.matchup is null or NEW.matchup = '' then
    NEW.matchup := NEW.home_team || ' vs ' || NEW.away_team;
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."auto_fill_matchup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_generate_player_slug"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if NEW.player_slug is null or NEW.player_slug = '' then
    NEW.player_slug := lower(replace(NEW.player_name, ' ', '-'));
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."auto_generate_player_slug"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_generate_team_slug"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if NEW.team_slug is null or NEW.team_slug = '' then
    NEW.team_slug := lower(replace(NEW.team_name, ' ', '-'));
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."auto_generate_team_slug"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dequeue_scoring_job"("batch_size" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "pick_id" "uuid", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    UPDATE public.scoring_queue sq
    SET status = 'PROCESSING',
        updated_at = now()
    FROM (
        SELECT sq2.id
        FROM public.scoring_queue sq2
        WHERE sq2.status = 'PENDING'
        ORDER BY sq2.created_at ASC
        LIMIT batch_size
        FOR UPDATE SKIP LOCKED
    ) sub
    WHERE sq.id = sub.id
    RETURNING sq.id, sq.pick_id, sq.created_at;
END;
$$;


ALTER FUNCTION "public"."dequeue_scoring_job"("batch_size" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."dequeue_scoring_job"("batch_size" integer) IS 'Atomically dequeues pending scoring jobs using FOR UPDATE SKIP LOCKED to prevent race conditions';



CREATE OR REPLACE FUNCTION "public"."enforce_single_writer"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NOT pg_has_role(SESSION_USER, 'promoter_rw', 'MEMBER') THEN
    RAISE EXCEPTION 'Writes to unified_picks require promoter_rw membership';
  END IF;
  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."enforce_single_writer"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_update_processed_at_only"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NOT pg_has_role(SESSION_USER, 'processor_rw', 'MEMBER') THEN
    RAISE EXCEPTION 'Updating raw_props.processed_at requires processor_rw membership';
  END IF;

  -- Ensure no columns other than processed_at change
  IF (to_jsonb(NEW) - 'processed_at') <> (to_jsonb(OLD) - 'processed_at') THEN
    RAISE EXCEPTION 'Only processed_at may be updated on raw_props by processor_rw';
  END IF;

  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."enforce_update_processed_at_only"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_missing_games"() RETURNS SETOF "uuid"
    LANGUAGE "sql"
    AS $$
  select distinct raw_props.game_id
  from raw_props
  left join games on raw_props.game_id = games.game_id
  where games.game_id is null
  and raw_props.game_id is not null;
$$;


ALTER FUNCTION "public"."find_missing_games"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."outbox_events" (
    "id" bigint NOT NULL,
    "tenant_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "available_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "processed_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL
);


ALTER TABLE "public"."outbox_events" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_claim_outbox"("p_limit" integer) RETURNS SETOF "public"."outbox_events"
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  with cte as (
    select id
    from public.outbox_events
    where status = 'pending' and available_at <= now()
    order by available_at asc
    for update skip locked
    limit p_limit
  )
  update public.outbox_events o
  set status = 'processing', attempts = o.attempts + 1
  from cte
  where o.id = cte.id
  returning o.*;
end;
$$;


ALTER FUNCTION "public"."fn_claim_outbox"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_enqueue_event"("p_tenant_id" "text", "p_event_type" "text", "p_entity_type" "text", "p_entity_id" "text", "p_payload" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.outbox_events (tenant_id, event_type, entity_type, entity_id, payload)
  VALUES (p_tenant_id, p_event_type, p_entity_type, p_entity_id, COALESCE(p_payload, '{}'::JSONB));
END;
$$;


ALTER FUNCTION "public"."fn_enqueue_event"("p_tenant_id" "text", "p_event_type" "text", "p_entity_type" "text", "p_entity_id" "text", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_credit_usage_summary"() RETURNS TABLE("provider" "text", "credits" bigint, "calls" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'ops'
    AS $$
  select
    provider::text,
    coalesce(sum(credits), 0)::bigint as credits,
    coalesce(sum(calls), 0)::bigint   as calls
  from ops.credit_usage
  group by provider
  order by provider;
$$;


ALTER FUNCTION "public"."get_credit_usage_summary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_recent_games_today"("p_limit" integer DEFAULT 20) RETURNS TABLE("id" "text", "matchup" "text", "sport" "text", "date" timestamp with time zone, "props_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  WITH base AS (
    SELECT 
      COALESCE(rp.matchup,
               NULLIF(CONCAT_WS(' vs ', NULLIF(rp.team, ''), NULLIF(rp.opponent, '')), '')) AS matchup_name,
      rp.sport,
      rp.created_at
    FROM public.raw_props rp
    WHERE rp.created_at >= date_trunc('day', now())
  ), agg AS (
    SELECT 
      matchup_name,
      sport,
      MAX(created_at) AS recent_at,
      COUNT(*)::bigint AS props_count
    FROM base
    WHERE matchup_name IS NOT NULL AND matchup_name <> ''
    GROUP BY matchup_name, sport
  )
  SELECT 
    (matchup_name || '-' || sport) AS id,
    matchup_name AS matchup,
    sport,
    recent_at AS date,
    props_count
  FROM agg
  ORDER BY recent_at DESC
  LIMIT p_limit
$$;


ALTER FUNCTION "public"."get_recent_games_today"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_recent_raw_props_48h"("p_limit" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "player_name" "text", "sport" "text", "stat_type" "text", "line" numeric, "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT rp.id, rp.player_name, rp.sport, rp.stat_type, rp.line, rp.created_at
  FROM (
    SELECT * FROM public.raw_props
    WHERE COALESCE(
      NULLIF(game_time, TIMESTAMP 'epoch'),
      CASE WHEN game_date IS NULL THEN NULL ELSE (game_date::timestamp) END,
      created_at
    ) BETWEEN (now() - interval '48 hours') AND (now() + interval '48 hours')
  ) rp
  ORDER BY rp.created_at DESC
  LIMIT p_limit
$$;


ALTER FUNCTION "public"."get_recent_raw_props_48h"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_recent_unified_picks"("p_limit" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT up.id, up.created_at
  FROM public.unified_picks up
  ORDER BY up.created_at DESC
  LIMIT p_limit
$$;


ALTER FUNCTION "public"."get_recent_unified_picks"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_today_sports_breakdown"() RETURNS TABLE("sport" "text", "props_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT rp.sport, COUNT(*)::bigint AS props_count
  FROM public.raw_props rp
  WHERE rp.created_at >= date_trunc('day', now())
  GROUP BY rp.sport
  ORDER BY props_count DESC
$$;


ALTER FUNCTION "public"."get_today_sports_breakdown"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_top_performers_by_volume_today"("p_limit" integer DEFAULT 5) RETURNS TABLE("player" "text", "sport" "text", "picks_count" bigint, "avg_score" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT 
    rp.player_name AS player,
    rp.sport,
    COUNT(*)::bigint AS picks_count,
    0::numeric AS avg_score
  FROM public.raw_props rp
  WHERE rp.created_at >= date_trunc('day', now())
    AND rp.player_name IS NOT NULL AND rp.player_name <> ''
  GROUP BY rp.player_name, rp.sport
  ORDER BY picks_count DESC
  LIMIT p_limit
$$;


ALTER FUNCTION "public"."get_top_performers_by_volume_today"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grade_all_raw_props"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM raw_props WHERE edge_score IS NULL
  LOOP
    PERFORM grade_raw_prop(r.id);
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."grade_all_raw_props"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grade_next_100_props"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM raw_props
    WHERE edge_score IS NULL
    LIMIT 100
  LOOP
    PERFORM grade_raw_prop(r.id);
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."grade_next_100_props"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grade_raw_prop"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  prop RECORD;

  -- Safe variable names
  trend_score_val INT := 0;
  matchup_score_val INT := 0;
  line_score_val INT := 0;
  confidence_score_val INT := 0;
  role_score_val INT := 0;
  edge_score_val INT := 0;
  tier_val TEXT := 'C';
BEGIN
  -- Pull prop and trend data
  SELECT rp.*, pt.hit_rate_l3, pt.hit_rate_l5, pt.hit_rate_l10
  INTO prop
  FROM raw_props rp
  LEFT JOIN view_prop_trends pt
    ON rp.player_name = pt.player_name
   AND rp.stat_type = pt.stat_type
  WHERE rp.id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prop not found';
  END IF;

  -- 🧠 Trend Score Logic
  trend_score_val := CASE
    WHEN prop.hit_rate_l10 >= 70 THEN 5
    WHEN prop.hit_rate_l10 >= 60 THEN 4
    WHEN prop.hit_rate_l10 >= 50 THEN 3
    WHEN prop.hit_rate_l10 >= 40 THEN 2
    ELSE 1
  END;

  -- L3 Cap Guardrail
  IF prop.hit_rate_l3 IS NOT NULL AND prop.hit_rate_l3 < 40 THEN
    trend_score_val := LEAST(trend_score_val, 3);
  END IF;

  -- 🛡 Matchup Score Placeholder
  matchup_score_val := 3;

  -- 📉 Line Value Score
  line_score_val := CASE
    WHEN prop.odds >= 120 THEN 5
    WHEN prop.odds >= 100 THEN 4
    WHEN prop.odds >= -110 THEN 3
    WHEN prop.odds >= -125 THEN 2
    ELSE 1
  END;

  -- 📈 Confidence Score Placeholder
  confidence_score_val := 3;

  -- 🏀 Role Score Logic
  role_score_val := 4;
  IF prop.context_flag IS TRUE THEN
    role_score_val := role_score_val - 1;
  END IF;

  -- 🧮 Total Edge Score
  edge_score_val := trend_score_val + matchup_score_val + line_score_val + confidence_score_val + role_score_val;

  -- 🎯 Tier Assignment
  tier_val := CASE
    WHEN edge_score_val >= 20 THEN 'S'
    WHEN edge_score_val >= 15 THEN 'A'
    WHEN edge_score_val >= 10 THEN 'B'
    ELSE 'C'
  END;

  -- ✅ Update raw_props with final values
  UPDATE raw_props
  SET
    trend_score = trend_score_val,
    matchup_score = matchup_score_val,
    line_score = line_score_val,
    confidence_score = confidence_score_val,
    role_score = role_score_val,
    edge_score = edge_score_val,
    tier = tier_val
  WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."grade_raw_prop"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_credit_usage"("p_provider" "text", "p_credits" integer DEFAULT 1) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into ops.credit_usage (provider, credits, calls, bucket_hour)
  values (p_provider, p_credits, 1, date_trunc('hour', now()));
end; $$;


ALTER FUNCTION "public"."log_credit_usage"("p_provider" "text", "p_credits" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_snapshot_json"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
SELECT jsonb_build_object(
  'at', now(),
  'ingestion', (SELECT to_jsonb(v) FROM public.v_ingestion_health v),
  'unified',   (SELECT to_jsonb(v) FROM public.v_unified_health   v),
  'ops',       (SELECT to_jsonb(v) FROM public.v_ops_health       v),
  'blockers',  (SELECT jsonb_agg(to_jsonb(b)) FROM public.v_pipeline_blockers b)
);
$$;


ALTER FUNCTION "public"."pipeline_snapshot_json"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_snapshot_pretty"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
SELECT jsonb_pretty(public.pipeline_snapshot_json());
$$;


ALTER FUNCTION "public"."pipeline_snapshot_pretty"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."plays_update_search_tsv"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.search_tsv :=
    setweight(to_tsvector('simple', unaccent(coalesce(new.name,''))), 'A') ||
    setweight(to_tsvector('simple', unaccent(array_to_string(new.reads,' '))), 'B') ||
    setweight(to_tsvector('simple', unaccent(array_to_string(new.key_points,' '))), 'C');
  return new;
end;
$$;


ALTER FUNCTION "public"."plays_update_search_tsv"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_unified_picks_fingerprint"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.promotion_fingerprint :=
    encode(
      digest(
        array_to_string(ARRAY[
          COALESCE(NEW.prop_id::text,''),
          COALESCE(NEW.sport::text,''),
          COALESCE(NEW.pick_type,''),
          COALESCE(NEW.selection,''),
          COALESCE(NEW.line::text,''),
          COALESCE(NEW.odds::text,''),
          COALESCE(COALESCE(NEW.game_id::text,
                  to_char(NEW.game_start_time, 'YYYY-MM-DD"T"HH24:MI:SSOF')),''),
          COALESCE(NEW.pick_source,'')
        ], '|'),
        'sha256'
      ),
      'hex'
    );
  RETURN NEW;
END$$;


ALTER FUNCTION "public"."set_unified_picks_fingerprint"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."smart_form_picks_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_exists int;
  v_new_id uuid;
BEGIN
  -- Guard: user must exist (friendlier than raw FK error)
  SELECT 1 INTO v_exists FROM public.users WHERE id = NEW.user_id;
  IF v_exists IS NULL THEN
    RAISE EXCEPTION 'Smart Form insert failed: user_id % not found in public.users', NEW.user_id
      USING ERRCODE='23503';
  END IF;

  -- Insert into unified_picks (explicit columns only)
  INSERT INTO public.unified_picks (
    user_id, pick_type, selection, line, odds,
    stake, potential_payout, sport,
    parlay_id, parlay_leg_number, parlay_total_legs, parlay_total_odds, parlay_stake_allocation,
    placed_at, status, published, workflow_stage, promotion_status, pick_source, metadata
  )
  VALUES (
    NEW.user_id, COALESCE(NEW.pick_type,'single'), NEW.selection, NEW.line, NEW.odds,
    NEW.stake, NEW.potential_payout, NEW.sport,
    NEW.parlay_id, NEW.parlay_leg_number, NEW.parlay_total_legs, NEW.parlay_total_odds, NEW.parlay_stake_allocation,
    COALESCE(NEW.placed_at, now()),
    COALESCE(NEW.status, 'pending'),
    COALESCE(NEW.published, false),
    COALESCE(NEW.workflow_stage, 'pending_review'),
    COALESCE(NEW.promotion_status, 'queued'),
    'manual',
    COALESCE(NEW.metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_new_id;

  -- Return a row shaped EXACTLY like the view (column-by-column, in order)
  SELECT
    u.id,
    u.user_id,
    u.pick_type,
    u.selection,
    u.line,
    u.odds,
    u.stake,
    u.potential_payout,
    u.sport,
    u.parlay_id,
    u.parlay_leg_number,
    u.parlay_total_legs,
    u.parlay_total_odds,
    u.parlay_stake_allocation,
    u.placed_at,
    u.status,
    u.published,
    u.workflow_stage,
    u.promotion_status,
    u.created_at,
    u.updated_at,
    u.metadata
  INTO NEW
  FROM public.unified_picks u
  WHERE u.id = v_new_id;

  RETURN NEW;
END $$;


ALTER FUNCTION "public"."smart_form_picks_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_quota_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end $$;


ALTER FUNCTION "public"."touch_quota_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_pick_grades_outbox"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.result IS NOT NULL AND NEW.result <> 'pending' THEN
    PERFORM public.fn_enqueue_event(NEW.tenant_id, 'pick_graded', 'pick_grades', NEW.pick_id::TEXT,
      jsonb_build_object('pick_id', NEW.pick_id, 'result', NEW.result, 'settled_at', NEW.settled_at));
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_pick_grades_outbox"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_pick_grades_writeback"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.result IS NOT NULL AND NEW.result <> 'pending' THEN
    UPDATE public.picks
      SET result = NEW.result,
          settled_at = COALESCE(NEW.settled_at, NOW())
      WHERE id::TEXT = NEW.pick_id
        AND tenant_id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_pick_grades_writeback"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_picks_outbox"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  new_status TEXT;
BEGIN
  new_status := NEW.status;
  IF TG_OP = 'INSERT' THEN
    IF new_status IN ('final','published') THEN
      PERFORM public.fn_enqueue_event(NEW.tenant_id, 'final_pick', 'picks', NEW.id::TEXT, jsonb_build_object('pick_id', NEW.id));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF COALESCE(OLD.status,'') <> COALESCE(NEW.status,'') AND new_status IN ('final','published') THEN
      PERFORM public.fn_enqueue_event(NEW.tenant_id, 'final_pick', 'picks', NEW.id::TEXT, jsonb_build_object('pick_id', NEW.id));
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_picks_outbox"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_agent_health_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_agent_health_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_rbi_data"("p_unified_history_id" "uuid", "p_rbi_value" integer, "p_data_source" "text" DEFAULT 'manual'::"text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE unified_sports_history 
  SET 
    stats = jsonb_set(
      jsonb_set(stats, '{rbi}', to_jsonb(p_rbi_value)),
      '{needs_rbi_backfill}', 'false'
    ),
    updated_at = NOW()
  WHERE id = p_unified_history_id;
  
  UPDATE rbi_backfill_queue 
  SET 
    status = 'completed',
    rbi_value = p_rbi_value,
    data_source = p_data_source,
    updated_at = NOW()
  WHERE unified_history_id = p_unified_history_id;
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  UPDATE rbi_backfill_queue 
  SET 
    status = 'failed',
    error_message = SQLERRM,
    backfill_attempts = backfill_attempts + 1,
    last_attempt_at = NOW(),
    updated_at = NOW()
  WHERE unified_history_id = p_unified_history_id;
  
  RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."update_rbi_data"("p_unified_history_id" "uuid", "p_rbi_value" integer, "p_data_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_scoring_queue_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_scoring_queue_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_system_health"() RETURNS SETOF "record"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 'HOT_PROPS'::text AS section, COUNT(*)::bigint AS value
  FROM prop_ticks_hot
  WHERE asof > now() - interval '10 minutes';

  -- Add more RETURN QUERY blocks for each table...
END;
$$;


ALTER FUNCTION "public"."validate_system_health"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "archive"."raw_props" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_name" "text",
    "sport" "text",
    "team" "text",
    "stat_type" "text",
    "outcome" "text",
    "line" numeric,
    "odds" integer,
    "game_date" "date",
    "matchup" "text",
    "trend_confidence" integer,
    "matchup_quality" integer,
    "line_value_score" integer,
    "role_stability" integer,
    "confidence_score" integer,
    "edge_score" integer,
    "tier_tag" "text",
    "auto_approved" boolean DEFAULT false,
    "context_flag" boolean DEFAULT false,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "source" "text",
    "promoted_to_picks" boolean DEFAULT false,
    "game_id" "uuid",
    "bet_type" "text",
    "market_type" "text",
    "outcomes" "jsonb",
    "player_id" integer,
    "player_slug" "text",
    "external_game_id" "text",
    "sport_key" "text",
    "fair_odds" "text",
    "league" "text",
    "promoted_at" timestamp without time zone,
    "unit_size" numeric DEFAULT 1,
    "tier" "text",
    "promoted" boolean DEFAULT false,
    "ev_percent" numeric,
    "trend_score" integer,
    "matchup_score" integer,
    "line_score" integer,
    "role_score" integer,
    "direction" "text",
    "unique_key" "text",
    "is_promoted" boolean DEFAULT false,
    "event_id" "text",
    "book" "text",
    "updated_at" timestamp without time zone,
    "is_alt_line" boolean DEFAULT false,
    "is_primary" boolean DEFAULT true,
    "opponent" "text",
    "start_time" "text",
    "is_valid" boolean DEFAULT true,
    "external_id" "text",
    "over_odds" numeric,
    "under_odds" numeric,
    "market" "text",
    "provider" "text",
    "game_time" timestamp with time zone,
    "scraped_at" timestamp with time zone,
    "home_team" "text",
    "home_team_id" "text",
    "away_team" "text",
    "away_team_id" "text",
    "expected_value" numeric,
    "sharp_money" numeric,
    "line_movement" numeric,
    "player_form" numeric,
    "injury_impact" numeric,
    "steam_detected" boolean DEFAULT false,
    "best_available_line" numeric,
    "best_book" "text",
    "public_betting_percentage" numeric,
    "sharp_betting_percentage" numeric,
    "volatility" numeric DEFAULT 5,
    "correlation_risk" numeric,
    "bid_ask_spread" numeric DEFAULT 0.02,
    "weather_impact" numeric,
    "market_intelligence" numeric,
    "volume_profile" numeric,
    "closing_line_value" numeric,
    "predicted_closing_line" numeric,
    "optimal_betting_time" "text",
    "contrarian_opportunity" boolean DEFAULT false,
    "injury_timing_advantage" numeric,
    "cross_market_arbitrage" numeric,
    "player_fatigue" numeric,
    "venue_advantage" numeric,
    "referee_impact" numeric,
    "pace_impact" numeric,
    "motivational_factors" numeric,
    "data_completeness" numeric DEFAULT 0.95,
    "outlier_score" numeric DEFAULT 0.95,
    "consistency_score" numeric DEFAULT 0.95,
    "data_validation_score" numeric DEFAULT 0.95,
    "portfolio_impact" numeric,
    "metadata" "jsonb",
    "over" numeric,
    "under" numeric,
    "confidence" numeric(5,4) DEFAULT 0,
    "prop_category" character varying(10),
    "team_name" character varying(255),
    "standardized_sport" character varying(10),
    "standardized_stat" character varying(50),
    "data_quality_score" numeric(3,2) DEFAULT 0.0,
    "needs_review" boolean DEFAULT false,
    "processed_at" timestamp without time zone,
    "pro_attempts" integer DEFAULT 0,
    "processing_error" "text",
    "professional_score" numeric(4,3),
    "kelly_fraction" numeric(6,5),
    "clv_tracking_id" "uuid",
    "inserted_at" timestamp with time zone DEFAULT "now"(),
    "is_canary" boolean DEFAULT false NOT NULL,
    "settled_at" timestamp with time zone,
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "result" character varying(50),
    "actual_value" numeric,
    "external_prop_id" "text",
    CONSTRAINT "raw_props_prop_category_check" CHECK ((("prop_category")::"text" = ANY ((ARRAY['player'::character varying, 'team'::character varying, 'game'::character varying])::"text"[]))),
    CONSTRAINT "raw_props_standardized_sport_check" CHECK ((("standardized_sport")::"text" = ANY ((ARRAY['NFL'::character varying, 'NBA'::character varying, 'MLB'::character varying, 'NHL'::character varying, 'NCAAF'::character varying, 'NCAAB'::character varying])::"text"[])))
);


ALTER TABLE "archive"."raw_props" OWNER TO "postgres";


COMMENT ON COLUMN "archive"."raw_props"."confidence" IS 'ML confidence score (0-1) for this prop prediction';



CREATE TABLE IF NOT EXISTS "ops"."credit_usage" (
    "id" bigint NOT NULL,
    "provider" "text" NOT NULL,
    "credits" integer DEFAULT 1 NOT NULL,
    "calls" integer DEFAULT 1 NOT NULL,
    "bucket_hour" timestamp with time zone DEFAULT "date_trunc"('hour'::"text", "now"()) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "ops"."credit_usage" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "ops"."credit_usage_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "ops"."credit_usage_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "ops"."credit_usage_id_seq" OWNED BY "ops"."credit_usage"."id";



CREATE TABLE IF NOT EXISTS "public"."players" (
    "id" bigint NOT NULL,
    "player_name" "text",
    "sport" "text",
    "team" "text",
    "team_id" "text",
    "player_id" "text",
    "photo_url" "text",
    "position" "text",
    "status" "text",
    "is_injured" boolean,
    "jersey_number" numeric,
    "nationality" "text",
    "team_name" "text",
    "player_slug" "text",
    "height_cm" numeric,
    "weight_kg" numeric,
    "birthday" "date"
);


ALTER TABLE "public"."players" OWNER TO "postgres";


ALTER TABLE "public"."players" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."Players_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."_migrations" (
    "id" integer NOT NULL,
    "filename" "text" NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."_migrations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."_migrations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."_migrations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."_migrations_id_seq" OWNED BY "public"."_migrations"."id";



CREATE TABLE IF NOT EXISTS "public"."agent_controls" (
    "name" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agent_controls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_health" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent" character varying(100) NOT NULL,
    "status" character varying(20) DEFAULT 'unknown'::character varying NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "last_run" timestamp with time zone DEFAULT "now"(),
    "total_operations" integer DEFAULT 0,
    "response_time_ms" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agent_health" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_job_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent" "text" NOT NULL,
    "workflow" "text",
    "job_name" "text",
    "status" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "duration_ms" integer,
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "agent_job_runs_status_check" CHECK (("status" = ANY (ARRAY['started'::"text", 'success'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."agent_job_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent" character varying(100) NOT NULL,
    "metric_name" character varying(100) NOT NULL,
    "metric_value" numeric NOT NULL,
    "metric_type" character varying(20) DEFAULT 'gauge'::character varying,
    "logged_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "metric" "text"
);


ALTER TABLE "public"."agent_metrics" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."agent_metrics_compat" AS
 SELECT "agent_metrics"."id",
    "agent_metrics"."agent",
    "agent_metrics"."logged_at" AS "ts",
    COALESCE("agent_metrics"."metric", ("agent_metrics"."metric_name")::"text") AS "metric",
    "agent_metrics"."metric_value" AS "value",
    "agent_metrics"."metric_type",
    "agent_metrics"."metadata",
    "agent_metrics"."created_at"
   FROM "public"."agent_metrics";


ALTER TABLE "public"."agent_metrics_compat" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_type" "text" NOT NULL,
    "related_pick_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text",
    "priority" integer DEFAULT 0,
    "retries" integer DEFAULT 0,
    "result" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "due_at" timestamp without time zone,
    "is_recurring" boolean DEFAULT false,
    "ai_tag" "text",
    "execution_time_ms" integer,
    "urgency_score" double precision,
    "assigned_to" "text",
    "agent" "text",
    "command" "text",
    "created_by" "text",
    "agent_tasks" "text",
    "input" "text",
    "rationale" "text"
);


ALTER TABLE "public"."agent_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "version" "text" DEFAULT '1.0.0'::"text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'inactive'::"text" NOT NULL,
    "health_score" numeric DEFAULT 100,
    "last_heartbeat" timestamp with time zone,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "environment" "text" DEFAULT 'production'::"text",
    "schedule_cron" "text",
    "last_run" timestamp with time zone,
    "next_run" timestamp with time zone,
    "run_count" integer DEFAULT 0,
    "success_rate" numeric DEFAULT 100,
    "average_duration" interval,
    "error_count" integer DEFAULT 0,
    "last_error" "text",
    "last_error_at" timestamp with time zone,
    "performance_metrics" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "last_ping" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "agents_health_score_check" CHECK ((("health_score" >= (0)::numeric) AND ("health_score" <= (100)::numeric))),
    CONSTRAINT "agents_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'error'::"text", 'maintenance'::"text", 'disabled'::"text"])))
);


ALTER TABLE "public"."agents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_alerts_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "alert_type" "text" NOT NULL,
    "bet_id" "uuid",
    "ticket_id" "uuid",
    "user_id" "uuid",
    "capper_id" "uuid",
    "advice_given" "text",
    "response" "text",
    "outcome" "text",
    "ev_change" double precision,
    "was_pos_ev_advice" boolean,
    "notes" "text",
    "feedback" "text"
);


ALTER TABLE "public"."ai_alerts_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alerts_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "final_pick_id" "uuid",
    "alert_type" "text",
    "player_name" "text",
    "sport" "text",
    "capper" "text",
    "triggered_at" timestamp without time zone DEFAULT "now"(),
    "resolved" boolean DEFAULT false,
    "notes" "text",
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."alerts_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_summary" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "metric_type" "text" NOT NULL,
    "category" "text",
    "user_id" "uuid",
    "tier" "text",
    "sport" "text",
    "value" numeric NOT NULL,
    "count" integer,
    "trend" numeric,
    "comparison_value" numeric,
    "breakdown" "jsonb",
    "generated_at" timestamp with time zone DEFAULT "now"(),
    "period_start" timestamp with time zone,
    "period_end" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."analytics_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."annotations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "play_id" "uuid" NOT NULL,
    "note" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."annotations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "hashed_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone,
    "active" boolean DEFAULT true NOT NULL,
    "scopes" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL
);


ALTER TABLE "public"."api_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_quota_configs" (
    "provider" "text" NOT NULL,
    "daily_limit" integer DEFAULT 1000 NOT NULL,
    "used_today" integer DEFAULT 0 NOT NULL,
    "reset_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."api_quota_configs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."archived_props" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "prop_id" "uuid",
    "player_name" "text",
    "sport" "text",
    "team" "text",
    "stat_type" "text",
    "line" numeric,
    "odds" numeric,
    "matchup" "text",
    "game_date" "date",
    "archived_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archive_date" "date" DEFAULT CURRENT_DATE NOT NULL
);


ALTER TABLE "public"."archived_props" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "resource_type" "text",
    "resource_id" "text",
    "old_values" "jsonb",
    "new_values" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "text",
    "actor_user_id" "text",
    "entity_type" "text",
    "entity_id" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "occurred_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."box_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_name" "text",
    "player_id" bigint,
    "sport" "text",
    "stat_type" "text",
    "stat_value" numeric,
    "team" "text",
    "game_id" "uuid",
    "game_date" "date",
    "source" "text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."box_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bridge_outbox" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" character varying(50) NOT NULL,
    "event_data" "jsonb" NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone,
    "retry_count" integer DEFAULT 0,
    "error_message" "text",
    "bet_slip_id" "uuid"
);


ALTER TABLE "public"."bridge_outbox" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."capper_channels" (
    "capper_id" "uuid" NOT NULL,
    "discord_thread_id" "text" NOT NULL,
    "fallback_channel_id" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."capper_channels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "discord_id" "text" NOT NULL,
    "username" "text" NOT NULL,
    "display_name" "text",
    "email" "text",
    "tier" "text" DEFAULT 'members'::"text" NOT NULL,
    "subscription_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "subscription_tier" "text" DEFAULT 'free'::"text" NOT NULL,
    "subscription_expires_at" timestamp with time zone,
    "is_capper" boolean DEFAULT false,
    "capper_status" "text" DEFAULT 'inactive'::"text",
    "capper_tier" "text",
    "roles" "jsonb" DEFAULT '["user"]'::"jsonb",
    "total_picks" integer DEFAULT 0,
    "wins" integer DEFAULT 0,
    "losses" integer DEFAULT 0,
    "pushes" integer DEFAULT 0,
    "win_rate" numeric DEFAULT 0,
    "roi" numeric DEFAULT 0,
    "units_won" numeric DEFAULT 0,
    "streak_current" integer DEFAULT 0,
    "streak_type" "text" DEFAULT 'none'::"text",
    "streak_best" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_active" timestamp with time zone DEFAULT "now"(),
    "timezone" "text" DEFAULT 'UTC'::"text",
    "language" "text" DEFAULT 'en'::"text",
    "notification_preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "privacy_settings" "jsonb" DEFAULT '{}'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    CONSTRAINT "users_capper_status_check" CHECK (("capper_status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'suspended'::"text", 'pending'::"text"]))),
    CONSTRAINT "users_streak_type_check" CHECK (("streak_type" = ANY (ARRAY['win'::"text", 'loss'::"text", 'none'::"text"]))),
    CONSTRAINT "users_subscription_status_check" CHECK (("subscription_status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'cancelled'::"text", 'trial'::"text", 'suspended'::"text"]))),
    CONSTRAINT "users_subscription_tier_check" CHECK (("subscription_tier" = ANY (ARRAY['free'::"text", 'premium'::"text", 'vip'::"text", 'enterprise'::"text"]))),
    CONSTRAINT "users_tier_check" CHECK (("tier" = ANY (ARRAY['members'::"text", 'vip'::"text", 'vip+'::"text", 'black label'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."cappers" AS
 SELECT "u"."id",
    "u"."discord_id" AS "name",
    "u"."capper_status" AS "status",
    "u"."tier" AS "role",
    "u"."created_at",
    "u"."is_capper" AS "is_active"
   FROM "public"."users" "u"
  WHERE ("u"."is_capper" = true);


ALTER TABLE "public"."cappers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cappers_backup_20250803" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'Active'::"text",
    "role" "text" DEFAULT 'Capper'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean GENERATED ALWAYS AS (("status" = 'active'::"text")) STORED
);


ALTER TABLE "public"."cappers_backup_20250803" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."cappers_legacy" AS
 SELECT "u"."id",
    "u"."discord_id" AS "name",
    "u"."capper_status" AS "status",
    "u"."tier" AS "role",
    "u"."created_at",
    "u"."is_capper" AS "is_active"
   FROM "public"."users" "u"
  WHERE ("u"."is_capper" = true);


ALTER TABLE "public"."cappers_legacy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clv_tracking" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clv_tracking_id" character varying(100) NOT NULL,
    "prop_id" "uuid",
    "opening_line" numeric(10,2),
    "closing_line" numeric(10,2),
    "bet_line" numeric(10,2),
    "clv_value" numeric(10,4),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."clv_tracking" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contest_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contest_id" "uuid",
    "user_id" "uuid",
    "entry_date" timestamp with time zone DEFAULT "now"(),
    "score" numeric(10,2) DEFAULT 0,
    "rank" integer
);


ALTER TABLE "public"."contest_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text",
    "prize" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sport" "text",
    "status" "text" DEFAULT 'active'::"text",
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "description" "text",
    "prize_pool" numeric,
    "max_participants" integer,
    "entry_fee" numeric DEFAULT 0,
    "contest_type" "text" DEFAULT 'general'::"text",
    "rules" "jsonb" DEFAULT '{}'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "contests_contest_type_check" CHECK (("contest_type" = ANY (ARRAY['general'::"text", 'sport_specific'::"text", 'daily'::"text", 'weekly'::"text", 'monthly'::"text"]))),
    CONSTRAINT "contests_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'completed'::"text", 'cancelled'::"text", 'upcoming'::"text"])))
);


ALTER TABLE "public"."contests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_picks_backup_20250803" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_name" "text",
    "sport" "text",
    "team" "text",
    "stat_type" "text",
    "outcome" "text",
    "line" numeric,
    "odds" integer,
    "game_date" "date",
    "matchup" "text",
    "capper" "text",
    "unit_size" numeric,
    "play_tag" "text",
    "parlay_id" "text",
    "is_primary_leg" boolean DEFAULT true,
    "confidence_score" integer,
    "role_stability" integer,
    "line_value_score" integer,
    "trend_confidence" integer,
    "matchup_quality" integer,
    "edge_score" integer,
    "tier_tag" "text",
    "auto_approved" boolean DEFAULT false,
    "context_flag" boolean DEFAULT false,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "promoted_to_final" boolean DEFAULT false,
    "has_alert" boolean DEFAULT false,
    "alert_type" "text",
    "units" numeric DEFAULT 1,
    "rr_ticket_id" "text",
    "play_type" "text" DEFAULT 'Player Prop'::"text",
    "was_impacted_by_injury" boolean DEFAULT false,
    "game_id" "text",
    "home_team" "text",
    "away_team" "text",
    "player_team" "text",
    "l5_avg" numeric,
    "l10_avg" numeric,
    "dvp_score" numeric,
    "h2h_avg" numeric,
    "awaiting_review" boolean DEFAULT true,
    "initial_line" numeric,
    "current_line" numeric,
    "initial_odds" integer,
    "current_odds" integer,
    "line_moved" boolean DEFAULT false,
    "direction" "text",
    "tier" "text",
    "graded" boolean DEFAULT false,
    "source" "text",
    "promoted_to_picks" boolean DEFAULT false,
    "player_id" "uuid",
    "opponent" "text",
    "commencement_date" timestamp without time zone,
    "bet_type" "text",
    "raw_prop_id" "uuid",
    "market_type" "text",
    "approved_by" "text",
    "play_status" "text" DEFAULT 'pending'::"text",
    "tags" "text",
    "ai_tier" "text",
    "ai_confidence_score" numeric,
    "ai_win_prob" numeric,
    "ai_risk_flag" "text",
    "expected_value_score" numeric,
    "true_tier" "text",
    "staff_review_required" boolean DEFAULT false,
    "play_tags" "text",
    "pick_explainer" "text",
    "start_time" "text",
    "book" "text",
    "ev_percent" numeric,
    "event_id" "text",
    "external_game_id" "text",
    "position_vs_defense_score" numeric,
    "promoted_at" timestamp without time zone,
    "fair_odds" integer,
    "is_alt_line" boolean,
    "is_primary" boolean,
    "is_promoted" boolean DEFAULT true,
    "is_valid" boolean DEFAULT true,
    "league" "text",
    "line_score" integer,
    "matchup_score" integer,
    "outcomes" "jsonb",
    "player_slug" "text",
    "promoted" boolean DEFAULT true,
    "role_score" integer,
    "sport_key" "text",
    "trend_score" integer,
    "unique_key" "text",
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "admin_override_tier" "text"
);


ALTER TABLE "public"."daily_picks_backup_20250803" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unified_picks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "prop_id" "uuid",
    "game_id" "uuid",
    "pick_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "selection" "text" NOT NULL,
    "line" numeric,
    "odds" numeric NOT NULL,
    "stake" numeric NOT NULL,
    "potential_payout" numeric NOT NULL,
    "actual_payout" numeric DEFAULT 0,
    "profit_loss" numeric DEFAULT 0,
    "confidence" integer,
    "analysis" "text",
    "reasoning" "text",
    "tier_when_placed" "text",
    "pick_source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "workflow_stage" "text" DEFAULT 'draft'::"text",
    "promotion_status" "text" DEFAULT 'not_promoted'::"text",
    "promotion_data" "jsonb",
    "placed_at" timestamp with time zone DEFAULT "now"(),
    "settled_at" timestamp with time zone,
    "game_start_time" timestamp with time zone,
    "settlement_source" "text",
    "settlement_details" "jsonb",
    "actual_result" numeric,
    "parlay_id" "uuid",
    "parlay_leg_number" integer,
    "parlay_total_legs" integer,
    "parlay_total_odds" numeric,
    "parlay_stake_allocation" numeric,
    "discord_thread_id" "text",
    "discord_message_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid",
    "updated_by" "uuid",
    "sport" character varying(10) DEFAULT 'MLB'::character varying,
    "published" boolean DEFAULT false,
    "promotion_fingerprint" "text",
    "approved_by" "text",
    "approved_at" timestamp with time zone,
    "publish_targets" "jsonb",
    "dry_run" boolean DEFAULT true,
    "capper_id" "uuid",
    "promoted_at" timestamp with time zone DEFAULT "now"(),
    "raw_id" "uuid",
    "kelly_fraction" numeric(6,4),
    "professional_score" numeric(5,2),
    "devigged_edge" numeric(6,2),
    "clv_tracking_id" "text",
    "feature_contributions" "jsonb" DEFAULT '{}'::"jsonb",
    "processing_time" integer,
    "rule_compliance_score" integer,
    "sharp_grading_version" "text" DEFAULT 'v2025.09.05'::"text",
    "posted_at" timestamp with time zone DEFAULT "now"(),
    "ticket_id" "uuid",
    "clv_line" numeric,
    "clv_delta" numeric,
    "source" "text",
    "market" "text",
    "external_game_id" "text",
    "matchup" "text",
    "game_date" timestamp with time zone,
    "external_prop_id" "text",
    CONSTRAINT "unified_picks_confidence_check" CHECK ((("confidence" >= 0) AND ("confidence" <= 100))),
    CONSTRAINT "unified_picks_pick_source_check" CHECK (("pick_source" = ANY (ARRAY['manual'::"text", 'promoted'::"text", 'imported'::"text", 'system'::"text"]))),
    CONSTRAINT "unified_picks_pick_type_check" CHECK (("pick_type" = ANY (ARRAY['single'::"text", 'parlay'::"text", 'system'::"text", 'teaser'::"text"]))),
    CONSTRAINT "unified_picks_promotion_status_check" CHECK (("promotion_status" = ANY (ARRAY['not_promoted'::"text", 'queued'::"text", 'promoted'::"text", 'failed'::"text"]))),
    CONSTRAINT "unified_picks_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'won'::"text", 'lost'::"text", 'push'::"text", 'void'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "unified_picks_system_requires_prop" CHECK ((("pick_source" <> 'system'::"text") OR ("prop_id" IS NOT NULL))),
    CONSTRAINT "unified_picks_workflow_stage_check" CHECK (("workflow_stage" = ANY (ARRAY['draft'::"text", 'pending_review'::"text", 'approved'::"text", 'published'::"text", 'settled'::"text"])))
);


ALTER TABLE "public"."unified_picks" OWNER TO "postgres";


COMMENT ON COLUMN "public"."unified_picks"."sport" IS 'Sport classification for cross-sport analytics';



CREATE OR REPLACE VIEW "public"."daily_picks_legacy" AS
 SELECT "up"."id",
    "u"."discord_id" AS "capper_discord_id",
    "u"."username" AS "capper",
    "up"."selection",
    "up"."odds",
    "up"."stake" AS "units",
    "up"."confidence" AS "confidence_score",
    "up"."analysis",
    "up"."tier_when_placed" AS "tier",
    "up"."pick_type" AS "play_type",
    "up"."parlay_id",
    "up"."parlay_total_legs" AS "total_legs",
    "up"."parlay_total_odds" AS "total_odds",
    "up"."workflow_stage" AS "status",
    "up"."placed_at" AS "created_at",
    "up"."updated_at"
   FROM ("public"."unified_picks" "up"
     JOIN "public"."users" "u" ON (("up"."user_id" = "u"."id")))
  WHERE ("up"."pick_source" = 'manual'::"text");


ALTER TABLE "public"."daily_picks_legacy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."raw_props" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_name" "text",
    "sport" "text",
    "team" "text",
    "stat_type" "text",
    "outcome" "text",
    "line" numeric,
    "odds" integer,
    "game_date" "date",
    "matchup" "text",
    "trend_confidence" integer,
    "matchup_quality" integer,
    "line_value_score" integer,
    "role_stability" integer,
    "confidence_score" integer,
    "edge_score" integer,
    "tier_tag" "text",
    "auto_approved" boolean DEFAULT false,
    "context_flag" boolean DEFAULT false,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "source" "text",
    "promoted_to_picks" boolean DEFAULT false,
    "game_id" "uuid",
    "bet_type" "text",
    "market_type" "text",
    "outcomes" "jsonb",
    "player_id" integer,
    "player_slug" "text",
    "external_game_id" "text",
    "sport_key" "text",
    "fair_odds" "text",
    "league" "text",
    "promoted_at" timestamp without time zone,
    "unit_size" numeric DEFAULT 1,
    "tier" "text",
    "promoted" boolean DEFAULT false,
    "ev_percent" numeric,
    "trend_score" integer,
    "matchup_score" integer,
    "line_score" integer,
    "role_score" integer,
    "direction" "text",
    "unique_key" "text",
    "is_promoted" boolean DEFAULT false,
    "event_id" "text",
    "book" "text",
    "updated_at" timestamp without time zone,
    "is_alt_line" boolean DEFAULT false,
    "is_primary" boolean DEFAULT true,
    "opponent" "text",
    "start_time" "text",
    "is_valid" boolean DEFAULT true,
    "external_id" "text",
    "over_odds" numeric,
    "under_odds" numeric,
    "market" "text",
    "provider" "text",
    "game_time" timestamp with time zone,
    "scraped_at" timestamp with time zone,
    "home_team" "text",
    "home_team_id" "text",
    "away_team" "text",
    "away_team_id" "text",
    "expected_value" numeric,
    "sharp_money" numeric,
    "line_movement" numeric,
    "player_form" numeric,
    "injury_impact" numeric,
    "steam_detected" boolean DEFAULT false,
    "best_available_line" numeric,
    "best_book" "text",
    "public_betting_percentage" numeric,
    "sharp_betting_percentage" numeric,
    "volatility" numeric DEFAULT 5,
    "correlation_risk" numeric,
    "bid_ask_spread" numeric DEFAULT 0.02,
    "weather_impact" numeric,
    "market_intelligence" numeric,
    "volume_profile" numeric,
    "closing_line_value" numeric,
    "predicted_closing_line" numeric,
    "optimal_betting_time" "text",
    "contrarian_opportunity" boolean DEFAULT false,
    "injury_timing_advantage" numeric,
    "cross_market_arbitrage" numeric,
    "player_fatigue" numeric,
    "venue_advantage" numeric,
    "referee_impact" numeric,
    "pace_impact" numeric,
    "motivational_factors" numeric,
    "data_completeness" numeric DEFAULT 0.95,
    "outlier_score" numeric DEFAULT 0.95,
    "consistency_score" numeric DEFAULT 0.95,
    "data_validation_score" numeric DEFAULT 0.95,
    "portfolio_impact" numeric,
    "metadata" "jsonb",
    "over" numeric,
    "under" numeric,
    "confidence" numeric(5,4) DEFAULT 0,
    "prop_category" character varying(10),
    "team_name" character varying(255),
    "standardized_sport" character varying(10),
    "standardized_stat" character varying(50),
    "data_quality_score" numeric(3,2) DEFAULT 0.0,
    "needs_review" boolean DEFAULT false,
    "processed_at" timestamp without time zone,
    "pro_attempts" integer DEFAULT 0,
    "processing_error" "text",
    "professional_score" numeric(4,3),
    "kelly_fraction" numeric(6,5),
    "clv_tracking_id" "uuid",
    "inserted_at" timestamp with time zone DEFAULT "now"(),
    "is_canary" boolean DEFAULT false NOT NULL,
    "settled_at" timestamp with time zone,
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "result" character varying(50),
    "actual_value" numeric,
    "external_prop_id" "text",
    CONSTRAINT "raw_props_prop_category_check" CHECK ((("prop_category")::"text" = ANY ((ARRAY['player'::character varying, 'team'::character varying, 'game'::character varying])::"text"[]))),
    CONSTRAINT "raw_props_standardized_sport_check" CHECK ((("standardized_sport")::"text" = ANY ((ARRAY['NFL'::character varying, 'NBA'::character varying, 'MLB'::character varying, 'NHL'::character varying, 'NCAAF'::character varying, 'NCAAB'::character varying])::"text"[])))
);


ALTER TABLE "public"."raw_props" OWNER TO "postgres";


COMMENT ON COLUMN "public"."raw_props"."confidence" IS 'ML confidence score (0-1) for this prop prediction';



CREATE OR REPLACE VIEW "public"."data_quality_summary" AS
 SELECT "raw_props"."standardized_sport",
    "raw_props"."prop_category",
    "count"(*) AS "record_count",
    "avg"("raw_props"."data_quality_score") AS "avg_quality_score",
    "count"(*) FILTER (WHERE ("raw_props"."needs_review" = true)) AS "needs_review_count",
    "count"(*) FILTER (WHERE ("raw_props"."data_quality_score" > 0.8)) AS "high_quality_count"
   FROM "public"."raw_props"
  GROUP BY "raw_props"."standardized_sport", "raw_props"."prop_category"
  ORDER BY ("count"(*)) DESC;


ALTER TABLE "public"."data_quality_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dfs_ownership" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "text" NOT NULL,
    "player_name" "text" NOT NULL,
    "date" "date" NOT NULL,
    "sport" "text" NOT NULL,
    "site" "text" NOT NULL,
    "contest_type" "text",
    "ownership_percentage" numeric,
    "projected" boolean DEFAULT false,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."dfs_ownership" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dfs_salaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "text" NOT NULL,
    "player_name" "text" NOT NULL,
    "date" "date" NOT NULL,
    "sport" "text" NOT NULL,
    "site" "text" NOT NULL,
    "salary" numeric,
    "position" "text",
    "team" "text",
    "opponent" "text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."dfs_salaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."discord_channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "text" NOT NULL,
    "guild_id" "text" NOT NULL,
    "channel_name" "text",
    "channel_type" "text",
    "purpose" "text",
    "is_active" boolean DEFAULT true,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."discord_channels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."discord_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "text" NOT NULL,
    "channel_id" "text" NOT NULL,
    "user_id" "uuid",
    "discord_user_id" "text",
    "content" "text",
    "message_type" "text" DEFAULT 'user'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."discord_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dvp_matchup_ranks" (
    "stat_type" "text",
    "team_id" "uuid",
    "dvp_rank" integer,
    "dvp_color" "text",
    "updated_at" timestamp without time zone,
    "sport" "text" DEFAULT 'MLB'::"text",
    "season" "text",
    "last_updated" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."dvp_matchup_ranks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ebooks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "author" "text",
    "source_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ebooks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."edge_config" (
    "key" "text" NOT NULL,
    "config" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."edge_config" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."enhanced_contests_summary" AS
 SELECT "c"."id",
    "c"."title",
    "c"."sport",
    "c"."status",
    "c"."start_date",
    "c"."end_date",
    "c"."prize_pool",
    "count"("cp"."user_id") AS "participant_count",
    "max"("cp"."score") AS "highest_score",
    "avg"("cp"."score") AS "average_score",
    "now"() AS "last_updated"
   FROM ("public"."contests" "c"
     LEFT JOIN "public"."contest_participants" "cp" ON (("c"."id" = "cp"."contest_id")))
  GROUP BY "c"."id", "c"."title", "c"."sport", "c"."status", "c"."start_date", "c"."end_date", "c"."prize_pool"
  WITH NO DATA;


ALTER TABLE "public"."enhanced_contests_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."error_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workflow_name" "text",
    "step" "text",
    "error_message" "text",
    "payload" "jsonb",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."error_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ev_modeling" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "text" NOT NULL,
    "player_name" "text" NOT NULL,
    "date" "date" NOT NULL,
    "sport" "text" NOT NULL,
    "site" "text",
    "bet_type" "text",
    "stat_type" "text",
    "line_value" numeric,
    "projected_value" numeric,
    "odds" numeric,
    "implied_probability" numeric,
    "ev_percentage" numeric,
    "edge_score" numeric,
    "result" "text",
    "actual_value" numeric,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "model_version" "text" DEFAULT '1.0'::"text",
    "last_updated" timestamp with time zone DEFAULT "now"(),
    "confidence" numeric(5,4) DEFAULT 0,
    "expected_value" numeric(8,6) DEFAULT 0
);


ALTER TABLE "public"."ev_modeling" OWNER TO "postgres";


COMMENT ON COLUMN "public"."ev_modeling"."confidence" IS 'ML model confidence score';



COMMENT ON COLUMN "public"."ev_modeling"."expected_value" IS 'Expected value calculation';



CREATE TABLE IF NOT EXISTS "public"."exposure_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ts" timestamp with time zone DEFAULT "now"() NOT NULL,
    "league" "text",
    "exposure_units" numeric,
    "kelly_at_risk" numeric,
    "by_market_json" "jsonb"
);


ALTER TABLE "public"."exposure_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feature_flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "flag_name" "text" NOT NULL,
    "enabled" boolean DEFAULT false,
    "rollout_percentage" integer DEFAULT 0,
    "target_users" "jsonb" DEFAULT '[]'::"jsonb",
    "target_tiers" "jsonb" DEFAULT '[]'::"jsonb",
    "target_environments" "jsonb" DEFAULT '["production"]'::"jsonb",
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "usage_count" integer DEFAULT 0,
    "success_rate" numeric DEFAULT 100,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "feature_flags_rollout_percentage_check" CHECK ((("rollout_percentage" >= 0) AND ("rollout_percentage" <= 100)))
);


ALTER TABLE "public"."feature_flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."features_daily_agg" (
    "dt" "date" NOT NULL,
    "league" "text" NOT NULL,
    "player_id" "uuid" NOT NULL,
    "market_id" "uuid" NOT NULL,
    "last_seen_line" numeric,
    "last_seen_price" integer,
    "mean_last5" numeric,
    "std_last5" numeric,
    "mean_last10" numeric,
    "dvp_score" numeric,
    "market_volatility" numeric,
    "resistance" numeric,
    "public_vs_sharp" numeric,
    "factor_version" "text" NOT NULL,
    "factor_scores" "jsonb" NOT NULL,
    "confidence_score" numeric DEFAULT 0.0,
    "computed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."features_daily_agg" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."final_picks" AS
 SELECT "up"."id",
    "u"."username" AS "capper",
    "u"."discord_id" AS "capper_id",
    "up"."game_id",
    "up"."selection" AS "stat_type",
    "up"."line",
    "up"."odds",
    "up"."stake" AS "unit_size",
    "up"."potential_payout" AS "payout",
        CASE
            WHEN ("up"."status" = 'won'::"text") THEN 'win'::"text"
            WHEN ("up"."status" = 'lost'::"text") THEN 'loss'::"text"
            WHEN ("up"."status" = 'push'::"text") THEN 'push'::"text"
            ELSE 'pending'::"text"
        END AS "result",
    "up"."actual_result" AS "actual_stat",
    "up"."tier_when_placed" AS "tier",
    "up"."pick_type" AS "ticket_type",
    "up"."confidence" AS "confidence_score",
    "up"."analysis" AS "pick_explainer",
    "up"."placed_at" AS "created_at",
    "up"."updated_at"
   FROM ("public"."unified_picks" "up"
     JOIN "public"."users" "u" ON (("up"."user_id" = "u"."id")))
  WHERE ("up"."pick_source" = 'promoted'::"text");


ALTER TABLE "public"."final_picks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."final_picks_backup_20250803" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_name" "text",
    "sport" "text",
    "team" "text",
    "stat_type" "text",
    "outcome" "text",
    "line" numeric,
    "odds" integer,
    "game_date" "date",
    "matchup" "text",
    "capper" "text",
    "unit_size" numeric,
    "play_tag" "text",
    "parlay_id" "text",
    "is_primary_leg" boolean DEFAULT true,
    "edge_score" integer,
    "tier_tag" "text",
    "photo_url" "text",
    "play_status" "text" DEFAULT 'Pending'::"text",
    "actual_stat" numeric,
    "final_result" "text",
    "result_value" numeric,
    "context_flag" boolean DEFAULT false,
    "steam_flag" boolean DEFAULT false,
    "recap_posted" boolean DEFAULT false,
    "approved_by" "text",
    "discord_post_id" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "has_alert" boolean DEFAULT false,
    "alert_type" "text",
    "posted_to_discord" boolean DEFAULT false,
    "tier" "text",
    "direction" character varying(10),
    "play_type" character varying(50),
    "ticket_type" "text",
    "result" "text",
    "trend_confidence" integer,
    "matchup_quality" integer,
    "line_value_score" integer,
    "role_stability" integer,
    "confidence_score" integer,
    "graded_at" timestamp without time zone,
    "was_impacted_by_injury" boolean DEFAULT false,
    "auto_approved" boolean DEFAULT false,
    "initial_line" numeric,
    "current_line" numeric,
    "initial_odds" integer,
    "current_odds" integer,
    "line_moved" boolean DEFAULT false,
    "odds_moved" boolean DEFAULT false,
    "movement_trigger" "text",
    "suppress_alert" boolean DEFAULT false,
    "hedge_flag" boolean DEFAULT false,
    "graded" boolean DEFAULT false,
    "injury_flag" boolean DEFAULT false,
    "game_id" "uuid",
    "daily_pick_id" "uuid",
    "tags" "text",
    "ai_tier" "text",
    "ai_confidence_score" numeric,
    "ai_win_prob" numeric,
    "ai_risk_flag" "text",
    "expected_value_score" numeric,
    "true_tier" "text",
    "pick_explainer" "text",
    "opponent" "text",
    "is_primary" boolean DEFAULT false,
    "ticket_id" "text",
    "bet_type" "text",
    "latest_line" numeric,
    "latest_odds" integer,
    "player_team" "text",
    "is_alt_line" boolean DEFAULT false,
    "start_time" "text",
    "ev_percent" numeric,
    "trend_score" integer,
    "matchup_score" integer,
    "player_slug" "text",
    "game_time" timestamp with time zone,
    "legs" "jsonb",
    "score_breakdown" "jsonb",
    "admin_override_tier" "text"
);


ALTER TABLE "public"."final_picks_backup_20250803" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."final_picks_legacy" AS
 SELECT "up"."id",
    "u"."username" AS "capper",
    "up"."game_id",
    "up"."selection" AS "stat_type",
    "up"."line",
    "up"."odds",
    "up"."stake" AS "unit_size",
    "up"."potential_payout" AS "payout",
        CASE
            WHEN ("up"."status" = 'won'::"text") THEN 'win'::"text"
            WHEN ("up"."status" = 'lost'::"text") THEN 'loss'::"text"
            WHEN ("up"."status" = 'push'::"text") THEN 'push'::"text"
            ELSE 'pending'::"text"
        END AS "result",
    "up"."actual_result" AS "actual_stat",
    "up"."tier_when_placed" AS "tier",
    "up"."pick_type" AS "ticket_type",
    "up"."confidence" AS "confidence_score",
    "up"."analysis" AS "pick_explainer",
    "up"."placed_at" AS "created_at",
    "up"."updated_at"
   FROM ("public"."unified_picks" "up"
     JOIN "public"."users" "u" ON (("up"."user_id" = "u"."id")))
  WHERE ("up"."pick_source" = 'promoted'::"text");


ALTER TABLE "public"."final_picks_legacy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."formations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "aliases" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."formations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."games" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sport" "text",
    "season" "text",
    "date" "date",
    "start_time" timestamp with time zone,
    "status" "text",
    "home_team" "text",
    "away_team" "text",
    "home_score" integer,
    "away_score" integer,
    "venue" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "matchup" "text",
    "game_date" "date",
    "event_id" "text",
    "source" "text",
    "home_odds" "text",
    "away_odds" "text",
    "spread" "text",
    "total" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "commence_time" timestamp without time zone,
    "sport_key" "text",
    "source_event_id" "text",
    "external_id" "text",
    "league" "text",
    "home_team_meta" "jsonb",
    "away_team_meta" "jsonb",
    "external_game_id" "text",
    "moneyline_home" "text",
    "moneyline_away" "text",
    "total_under_odds" "text",
    "spread_odds" "text",
    "total_over_odds" "text",
    "provider" character varying(50) DEFAULT 'sgo'::character varying,
    "external_data" "jsonb"
);


ALTER TABLE "public"."games" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hedge_alert_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parlay_id" "text" NOT NULL,
    "alert_time" timestamp without time zone DEFAULT "now"(),
    "hedge_amount" numeric,
    "stake" numeric,
    "parlay_decimal" numeric,
    "parlay_american" "text",
    "expected_profit_if_win" numeric,
    "expected_profit_if_hedged" numeric,
    "remaining_leg" "text",
    "capper" "text",
    "alert_posted" boolean DEFAULT true
);


ALTER TABLE "public"."hedge_alert_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."historical_config" (
    "id" bigint NOT NULL,
    "sport" "text" NOT NULL,
    "hot_window_days" integer DEFAULT 14,
    "archive_window_days" integer DEFAULT 365,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."historical_config" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."historical_config_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."historical_config_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."historical_config_id_seq" OWNED BY "public"."historical_config"."id";



CREATE TABLE IF NOT EXISTS "public"."historical_player_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sport" "text",
    "game_date" "date",
    "player_name" "text",
    "team" "text",
    "opponent" "text",
    "home_or_away" "text",
    "points" numeric,
    "rebounds" numeric,
    "assists" numeric,
    "threes_made" numeric,
    "steals" numeric,
    "blocks" numeric,
    "turnovers" numeric,
    "hits" numeric,
    "rbis" numeric,
    "runs" numeric,
    "home_runs" numeric,
    "strikeouts" numeric,
    "outs_recorded" numeric,
    "earned_runs" numeric,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."historical_player_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."idempotency_keys" (
    "tenant_id" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "idem_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."idempotency_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."injury_alert_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid" NOT NULL,
    "player_name" "text",
    "alert_text" "text",
    "injury_status" "text",
    "source" "text",
    "alert_time" timestamp without time zone DEFAULT "now"(),
    "discord_posted" boolean DEFAULT true
);


ALTER TABLE "public"."injury_alert_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leaderboards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "period" "text" NOT NULL,
    "metric_type" "text" NOT NULL,
    "value" numeric(15,4),
    "rank" integer,
    "period_start" timestamp with time zone,
    "period_end" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."leaderboards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."line_movement_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "final_pick_id" "uuid",
    "movement_type" "text",
    "movement_detail" "text",
    "previous_line" numeric,
    "current_line" numeric,
    "previous_odds" integer,
    "current_odds" integer,
    "triggered_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."line_movement_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."line_snapshots" (
    "id" bigint NOT NULL,
    "tenant_id" "text" NOT NULL,
    "event_id" "text" NOT NULL,
    "market_type" "text" NOT NULL,
    "selection" "text" NOT NULL,
    "offers" "jsonb" NOT NULL,
    "provider" "text" NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."line_snapshots" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."line_snapshots_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."line_snapshots_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."line_snapshots_id_seq" OWNED BY "public"."line_snapshots"."id";



CREATE TABLE IF NOT EXISTS "public"."unified_sports_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sport" "text" NOT NULL,
    "game_date" "date" NOT NULL,
    "player_name" "text",
    "player_id" "text",
    "opponent" "text",
    "result" "text",
    "stats" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "source_table" "text",
    "source" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."unified_sports_history" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."mlb_player_performance_summary" AS
 SELECT "unified_sports_history"."player_name",
    "unified_sports_history"."player_id",
    "count"(*) AS "games_played",
    "avg"((("unified_sports_history"."stats" ->> 'runs'::"text"))::numeric) AS "avg_runs",
    "avg"((("unified_sports_history"."stats" ->> 'hits'::"text"))::numeric) AS "avg_hits",
    "avg"((("unified_sports_history"."stats" ->> 'home_runs'::"text"))::numeric) AS "avg_home_runs",
    "avg"((("unified_sports_history"."stats" ->> 'walks'::"text"))::numeric) AS "avg_walks",
    "avg"((("unified_sports_history"."stats" ->> 'strikeouts'::"text"))::numeric) AS "avg_strikeouts",
    "avg"(
        CASE
            WHEN (("unified_sports_history"."stats" ->> 'rbi'::"text") IS NOT NULL) THEN (("unified_sports_history"."stats" ->> 'rbi'::"text"))::numeric
            ELSE NULL::numeric
        END) AS "avg_rbi",
    "count"(
        CASE
            WHEN (("unified_sports_history"."stats" ->> 'rbi'::"text") IS NOT NULL) THEN 1
            ELSE NULL::integer
        END) AS "games_with_rbi_data",
    "count"(
        CASE
            WHEN ((("unified_sports_history"."stats" ->> 'needs_rbi_backfill'::"text"))::boolean = true) THEN 1
            ELSE NULL::integer
        END) AS "games_needing_rbi_backfill",
    "max"("unified_sports_history"."game_date") AS "last_game_date",
    "now"() AS "last_updated"
   FROM "public"."unified_sports_history"
  WHERE (("unified_sports_history"."sport" = 'MLB'::"text") AND ("unified_sports_history"."stats" IS NOT NULL))
  GROUP BY "unified_sports_history"."player_name", "unified_sports_history"."player_id"
  WITH NO DATA;


ALTER TABLE "public"."mlb_player_performance_summary" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."mv_pipeline_lag_24h" AS
 SELECT "date_trunc"('minute'::"text", "up"."created_at") AS "minute_bucket",
    "up"."sport",
    "count"(*) AS "promoted_ct",
    "avg"(("up"."created_at" - ("rp"."processed_at")::timestamp with time zone)) AS "promotion_lag_avg",
    "percentile_cont"((0.50)::double precision) WITHIN GROUP (ORDER BY ("up"."created_at" - ("rp"."processed_at")::timestamp with time zone)) AS "promotion_lag_p50",
    "percentile_cont"((0.95)::double precision) WITHIN GROUP (ORDER BY ("up"."created_at" - ("rp"."processed_at")::timestamp with time zone)) AS "promotion_lag_p95"
   FROM ("public"."unified_picks" "up"
     JOIN "public"."raw_props" "rp" ON (("rp"."id" = "up"."prop_id")))
  WHERE (("up"."pick_source" = 'system'::"text") AND ("up"."created_at" > ("now"() - '24:00:00'::interval)))
  GROUP BY ("date_trunc"('minute'::"text", "up"."created_at")), "up"."sport"
  WITH NO DATA;


ALTER TABLE "public"."mv_pipeline_lag_24h" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."odds_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "player_id" "uuid",
    "stat_type" "text",
    "game_date" "date",
    "line" numeric,
    "odds" integer,
    "timestamp" timestamp without time zone,
    "source" "text"
);


ALTER TABLE "public"."odds_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."onboarding_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "welcome_channel_id" "text",
    "role_assignment_enabled" boolean DEFAULT true,
    "default_role_id" "text",
    "welcome_message" "text" DEFAULT 'Welcome to Unit Talk!'::"text",
    "onboarding_flow_id" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."onboarding_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orphaned_picks_backup" (
    "id" "uuid",
    "user_id" "uuid",
    "prop_id" "uuid",
    "game_id" "uuid",
    "pick_type" "text",
    "status" "text",
    "selection" "text",
    "line" numeric,
    "odds" numeric,
    "stake" numeric,
    "potential_payout" numeric,
    "actual_payout" numeric,
    "profit_loss" numeric,
    "confidence" integer,
    "analysis" "text",
    "reasoning" "text",
    "tier_when_placed" "text",
    "pick_source" "text",
    "workflow_stage" "text",
    "promotion_status" "text",
    "promotion_data" "jsonb",
    "placed_at" timestamp with time zone,
    "settled_at" timestamp with time zone,
    "game_start_time" timestamp with time zone,
    "settlement_source" "text",
    "settlement_details" "jsonb",
    "actual_result" numeric,
    "parlay_id" "uuid",
    "parlay_leg_number" integer,
    "parlay_total_legs" integer,
    "parlay_total_odds" numeric,
    "parlay_stake_allocation" numeric,
    "discord_thread_id" "text",
    "discord_message_id" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "metadata" "jsonb",
    "created_by" "uuid",
    "updated_by" "uuid",
    "backup_created_at" timestamp with time zone,
    "backup_reason" "text"
);


ALTER TABLE "public"."orphaned_picks_backup" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orphaned_props_backup" (
    "id" "uuid",
    "player_name" "text",
    "sport" "text",
    "team" "text",
    "stat_type" "text",
    "outcome" "text",
    "line" numeric,
    "odds" integer,
    "game_date" "date",
    "matchup" "text",
    "trend_confidence" integer,
    "matchup_quality" integer,
    "line_value_score" integer,
    "role_stability" integer,
    "confidence_score" integer,
    "edge_score" integer,
    "tier_tag" "text",
    "auto_approved" boolean,
    "context_flag" boolean,
    "created_at" timestamp without time zone,
    "source" "text",
    "promoted_to_picks" boolean,
    "game_id" "uuid",
    "bet_type" "text",
    "market_type" "text",
    "outcomes" "jsonb",
    "player_id" integer,
    "player_slug" "text",
    "external_game_id" "text",
    "sport_key" "text",
    "fair_odds" "text",
    "league" "text",
    "promoted_at" timestamp without time zone,
    "unit_size" numeric,
    "tier" "text",
    "promoted" boolean,
    "ev_percent" numeric,
    "trend_score" integer,
    "matchup_score" integer,
    "line_score" integer,
    "role_score" integer,
    "direction" "text",
    "unique_key" "text",
    "is_promoted" boolean,
    "event_id" "text",
    "book" "text",
    "updated_at" timestamp without time zone,
    "is_alt_line" boolean,
    "is_primary" boolean,
    "opponent" "text",
    "start_time" "text",
    "is_valid" boolean,
    "external_id" "text",
    "over_odds" numeric,
    "under_odds" numeric,
    "market" "text",
    "provider" "text",
    "game_time" timestamp with time zone,
    "scraped_at" timestamp with time zone,
    "home_team" "text",
    "home_team_id" "text",
    "away_team" "text",
    "away_team_id" "text",
    "expected_value" numeric,
    "sharp_money" numeric,
    "line_movement" numeric,
    "player_form" numeric,
    "injury_impact" numeric,
    "steam_detected" boolean,
    "best_available_line" numeric,
    "best_book" "text",
    "public_betting_percentage" numeric,
    "sharp_betting_percentage" numeric,
    "volatility" numeric,
    "correlation_risk" numeric,
    "bid_ask_spread" numeric,
    "weather_impact" numeric,
    "market_intelligence" numeric,
    "volume_profile" numeric,
    "closing_line_value" numeric,
    "predicted_closing_line" numeric,
    "optimal_betting_time" "text",
    "contrarian_opportunity" boolean,
    "injury_timing_advantage" numeric,
    "cross_market_arbitrage" numeric,
    "player_fatigue" numeric,
    "venue_advantage" numeric,
    "referee_impact" numeric,
    "pace_impact" numeric,
    "motivational_factors" numeric,
    "data_completeness" numeric,
    "outlier_score" numeric,
    "consistency_score" numeric,
    "data_validation_score" numeric,
    "portfolio_impact" numeric,
    "metadata" "jsonb",
    "over" numeric,
    "under" numeric,
    "backup_created_at" timestamp with time zone,
    "backup_reason" "text"
);


ALTER TABLE "public"."orphaned_props_backup" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."outbox_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."outbox_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."outbox_events_id_seq" OWNED BY "public"."outbox_events"."id";



CREATE TABLE IF NOT EXISTS "public"."parlay_tickets" (
    "ticket_id" "text" NOT NULL,
    "ticket_result" "text",
    "win_count" integer DEFAULT 0,
    "loss_count" integer DEFAULT 0,
    "push_count" integer DEFAULT 0
);


ALTER TABLE "public"."parlay_tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pick_grades" (
    "id" bigint NOT NULL,
    "tenant_id" "text" NOT NULL,
    "pick_id" "text" NOT NULL,
    "rule_version" "text" NOT NULL,
    "result" "text" NOT NULL,
    "settled_at" timestamp with time zone,
    "sources_used" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "result_set_id" bigint,
    "audit" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "grade_job_id" "text",
    CONSTRAINT "pick_grades_result_check" CHECK (("result" = ANY (ARRAY['win'::"text", 'loss'::"text", 'push'::"text", 'void'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."pick_grades" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."pick_grades_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."pick_grades_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."pick_grades_id_seq" OWNED BY "public"."pick_grades"."id";



CREATE TABLE IF NOT EXISTS "public"."picks" (
    "id" bigint NOT NULL,
    "tenant_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type" "text",
    "stake" numeric(12,2),
    "combined_odds" numeric(12,4),
    "selection" "text",
    "odds" numeric(12,4),
    "line" numeric(12,4),
    "book" "text",
    "market_type" "text",
    "event_id" "text",
    "legs" "jsonb",
    "insights" "jsonb",
    "status" "text",
    "result" "text",
    "settled_at" timestamp with time zone,
    "dedupe_hash" "text"
);


ALTER TABLE "public"."picks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."picks_backup_20250803" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "text" NOT NULL,
    "player_name" "text" NOT NULL,
    "date" "date" NOT NULL,
    "sport" "text" NOT NULL,
    "site" "text",
    "bet_type" "text",
    "stat_type" "text",
    "line_value" numeric,
    "odds" numeric,
    "projected_value" numeric,
    "implied_probability" numeric,
    "ev_percentage" numeric,
    "stake_units" numeric DEFAULT 1,
    "result" "text",
    "actual_value" numeric,
    "notes" "text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."picks_backup_20250803" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."picks_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."picks_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."picks_id_seq" OWNED BY "public"."picks"."id";



CREATE TABLE IF NOT EXISTS "public"."player_injuries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_name" "text" NOT NULL,
    "team_name" "text",
    "status" "text" NOT NULL,
    "source" "text" DEFAULT 'Twitter'::"text",
    "alert_type" "text",
    "impact_level" integer,
    "alert_time" timestamp without time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "player_injuries_impact_level_check" CHECK ((("impact_level" >= 1) AND ("impact_level" <= 5))),
    CONSTRAINT "player_injuries_status_check" CHECK (("status" = ANY (ARRAY['OUT'::"text", 'Q'::"text", 'GTD'::"text", 'ACTIVE'::"text"])))
);


ALTER TABLE "public"."player_injuries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sport" "text" NOT NULL,
    "player_name" "text" NOT NULL,
    "team" "text",
    "opponent" "text",
    "game_date" "date" NOT NULL,
    "stat_type" "text" NOT NULL,
    "result" numeric,
    "line" numeric,
    "outcome" "text",
    "source" "text" DEFAULT 'manual'::"text",
    "entry_type" "text" DEFAULT 'manual'::"text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."player_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_stat_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid",
    "game_id" "uuid",
    "stat_type" "text",
    "actual_value" numeric,
    "game_date" "date",
    "team_id" "uuid",
    "opponent_team_id" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "sport" "text" DEFAULT 'MLB'::"text"
);


ALTER TABLE "public"."player_stat_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_usage_trends" (
    "player_id" "uuid",
    "date" "date",
    "minutes" numeric,
    "usage_pct" numeric,
    "is_benched" boolean,
    "is_starter" boolean,
    "volatility_flag" boolean,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."player_usage_trends" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plays" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "ebook_id" "uuid",
    "formation_id" "uuid",
    "side" "text",
    "play_type" "text",
    "tags" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "key_points" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "reads" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "variants" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "video_links" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "playart_url" "text",
    "is_favorite" boolean DEFAULT false NOT NULL,
    "is_pro" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "search_tsv" "tsvector",
    CONSTRAINT "plays_play_type_check" CHECK (("play_type" = ANY (ARRAY['run'::"text", 'pass'::"text"]))),
    CONSTRAINT "plays_side_check" CHECK (("side" = ANY (ARRAY['left'::"text", 'right'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."plays" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."processing_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "processor" "text" NOT NULL,
    "summary" "jsonb",
    "processed_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."processing_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prop_ticks_hot" (
    "external_prop_id" "text" NOT NULL,
    "asof" timestamp with time zone NOT NULL,
    "game_id" "uuid",
    "player_id" "uuid",
    "market_id" "uuid",
    "book_id" "uuid",
    "line_num" numeric,
    "price_int" integer,
    "src" "text",
    "hash" "bytea",
    "inserted_at" timestamp with time zone DEFAULT "now"()
)
PARTITION BY RANGE ("asof");


ALTER TABLE "public"."prop_ticks_hot" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prop_ticks_hot_p20250911" (
    "external_prop_id" "text" NOT NULL,
    "asof" timestamp with time zone NOT NULL,
    "game_id" "uuid",
    "player_id" "uuid",
    "market_id" "uuid",
    "book_id" "uuid",
    "line_num" numeric,
    "price_int" integer,
    "src" "text",
    "hash" "bytea",
    "inserted_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."prop_ticks_hot_p20250911" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."raw_props_historical" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_name" "text",
    "sport" "text",
    "team" "text",
    "stat_type" "text",
    "outcome" "text",
    "line" numeric,
    "odds" integer,
    "game_date" "date",
    "matchup" "text",
    "trend_confidence" integer,
    "matchup_quality" integer,
    "line_value_score" integer,
    "role_stability" integer,
    "confidence_score" integer,
    "edge_score" integer,
    "tier_tag" "text",
    "auto_approved" boolean DEFAULT false,
    "context_flag" boolean DEFAULT false,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "source" "text",
    "promoted_to_picks" boolean DEFAULT false,
    "game_id" "uuid",
    "bet_type" "text",
    "market_type" "text",
    "outcomes" "jsonb",
    "player_id" integer,
    "player_slug" "text",
    "external_game_id" "text",
    "sport_key" "text",
    "fair_odds" "text",
    "league" "text",
    "promoted_at" timestamp without time zone,
    "unit_size" numeric DEFAULT 1,
    "tier" "text",
    "promoted" boolean DEFAULT false,
    "ev_percent" numeric,
    "trend_score" integer,
    "matchup_score" integer,
    "line_score" integer,
    "role_score" integer,
    "direction" "text",
    "unique_key" "text",
    "is_promoted" boolean DEFAULT false,
    "event_id" "text",
    "book" "text",
    "updated_at" timestamp without time zone,
    "is_alt_line" boolean DEFAULT false,
    "is_primary" boolean DEFAULT true,
    "opponent" "text",
    "start_time" "text",
    "is_valid" boolean DEFAULT true,
    "external_id" "text",
    "over_odds" numeric,
    "under_odds" numeric,
    "market" "text",
    "provider" "text",
    "game_time" timestamp with time zone,
    "scraped_at" timestamp with time zone,
    "home_team" "text",
    "home_team_id" "text",
    "away_team" "text",
    "away_team_id" "text",
    "expected_value" numeric,
    "sharp_money" numeric,
    "line_movement" numeric,
    "player_form" numeric,
    "injury_impact" numeric,
    "steam_detected" boolean DEFAULT false,
    "best_available_line" numeric,
    "best_book" "text",
    "public_betting_percentage" numeric,
    "sharp_betting_percentage" numeric,
    "volatility" numeric DEFAULT 5,
    "correlation_risk" numeric,
    "bid_ask_spread" numeric DEFAULT 0.02,
    "weather_impact" numeric,
    "market_intelligence" numeric,
    "volume_profile" numeric,
    "closing_line_value" numeric,
    "predicted_closing_line" numeric,
    "optimal_betting_time" "text",
    "contrarian_opportunity" boolean DEFAULT false,
    "injury_timing_advantage" numeric,
    "cross_market_arbitrage" numeric,
    "player_fatigue" numeric,
    "venue_advantage" numeric,
    "referee_impact" numeric,
    "pace_impact" numeric,
    "motivational_factors" numeric,
    "data_completeness" numeric DEFAULT 0.95,
    "outlier_score" numeric DEFAULT 0.95,
    "consistency_score" numeric DEFAULT 0.95,
    "data_validation_score" numeric DEFAULT 0.95,
    "portfolio_impact" numeric,
    "metadata" "jsonb",
    "over" numeric,
    "under" numeric,
    "confidence" numeric(5,4) DEFAULT 0
);


ALTER TABLE "public"."raw_props_historical" OWNER TO "postgres";


COMMENT ON TABLE "public"."raw_props_historical" IS 'Cold tier storage for props 30+ days old. Used for backtesting and historical analysis.';



COMMENT ON COLUMN "public"."raw_props_historical"."confidence" IS 'ML confidence score (0-1) for this prop prediction';



CREATE TABLE IF NOT EXISTS "public"."raw_props_hot" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "external_prop_id" "text" NOT NULL,
    "game_id" "uuid",
    "player_id" "uuid",
    "market_id" "uuid",
    "book_id" "uuid",
    "line_num" numeric,
    "price_int" integer,
    "status" "text",
    "src" "text",
    "last_change_at" timestamp with time zone,
    "asof" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."raw_props_hot" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."raw_props_recent" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_name" "text",
    "sport" "text",
    "team" "text",
    "stat_type" "text",
    "outcome" "text",
    "line" numeric,
    "odds" integer,
    "game_date" "date",
    "matchup" "text",
    "trend_confidence" integer,
    "matchup_quality" integer,
    "line_value_score" integer,
    "role_stability" integer,
    "confidence_score" integer,
    "edge_score" integer,
    "tier_tag" "text",
    "auto_approved" boolean DEFAULT false,
    "context_flag" boolean DEFAULT false,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "source" "text",
    "promoted_to_picks" boolean DEFAULT false,
    "game_id" "uuid",
    "bet_type" "text",
    "market_type" "text",
    "outcomes" "jsonb",
    "player_id" integer,
    "player_slug" "text",
    "external_game_id" "text",
    "sport_key" "text",
    "fair_odds" "text",
    "league" "text",
    "promoted_at" timestamp without time zone,
    "unit_size" numeric DEFAULT 1,
    "tier" "text",
    "promoted" boolean DEFAULT false,
    "ev_percent" numeric,
    "trend_score" integer,
    "matchup_score" integer,
    "line_score" integer,
    "role_score" integer,
    "direction" "text",
    "unique_key" "text",
    "is_promoted" boolean DEFAULT false,
    "event_id" "text",
    "book" "text",
    "updated_at" timestamp without time zone,
    "is_alt_line" boolean DEFAULT false,
    "is_primary" boolean DEFAULT true,
    "opponent" "text",
    "start_time" "text",
    "is_valid" boolean DEFAULT true,
    "external_id" "text",
    "over_odds" numeric,
    "under_odds" numeric,
    "market" "text",
    "provider" "text",
    "game_time" timestamp with time zone,
    "scraped_at" timestamp with time zone,
    "home_team" "text",
    "home_team_id" "text",
    "away_team" "text",
    "away_team_id" "text",
    "expected_value" numeric,
    "sharp_money" numeric,
    "line_movement" numeric,
    "player_form" numeric,
    "injury_impact" numeric,
    "steam_detected" boolean DEFAULT false,
    "best_available_line" numeric,
    "best_book" "text",
    "public_betting_percentage" numeric,
    "sharp_betting_percentage" numeric,
    "volatility" numeric DEFAULT 5,
    "correlation_risk" numeric,
    "bid_ask_spread" numeric DEFAULT 0.02,
    "weather_impact" numeric,
    "market_intelligence" numeric,
    "volume_profile" numeric,
    "closing_line_value" numeric,
    "predicted_closing_line" numeric,
    "optimal_betting_time" "text",
    "contrarian_opportunity" boolean DEFAULT false,
    "injury_timing_advantage" numeric,
    "cross_market_arbitrage" numeric,
    "player_fatigue" numeric,
    "venue_advantage" numeric,
    "referee_impact" numeric,
    "pace_impact" numeric,
    "motivational_factors" numeric,
    "data_completeness" numeric DEFAULT 0.95,
    "outlier_score" numeric DEFAULT 0.95,
    "consistency_score" numeric DEFAULT 0.95,
    "data_validation_score" numeric DEFAULT 0.95,
    "portfolio_impact" numeric,
    "metadata" "jsonb",
    "over" numeric,
    "under" numeric,
    "confidence" numeric(5,4) DEFAULT 0
);


ALTER TABLE "public"."raw_props_recent" OWNER TO "postgres";


COMMENT ON TABLE "public"."raw_props_recent" IS 'Warm tier storage for props 1-30 days old. Used for analytics and recent data queries.';



COMMENT ON COLUMN "public"."raw_props_recent"."confidence" IS 'ML confidence score (0-1) for this prop prediction';



CREATE TABLE IF NOT EXISTS "public"."rbi_backfill_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unified_history_id" "uuid" NOT NULL,
    "player_name" "text" NOT NULL,
    "player_id" "text",
    "game_date" "date" NOT NULL,
    "opponent" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "rbi_value" integer,
    "data_source" "text",
    "backfill_attempts" integer DEFAULT 0,
    "last_attempt_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "rbi_backfill_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."rbi_backfill_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recap_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recap_type" "text",
    "recap_date" "date",
    "recap_content" "text",
    "picks_included" integer,
    "wins" integer,
    "losses" integer,
    "pushes" integer,
    "net_units" numeric,
    "win_pct" numeric,
    "avg_edge_score" numeric,
    "top_capper" "text",
    "discord_channel_id" "text",
    "discord_message_id" "text",
    "posted_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."recap_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recap_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "run_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" NOT NULL,
    "summary" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "recap_runs_status_check" CHECK (("status" = ANY (ARRAY['started'::"text", 'success'::"text", 'failed'::"text"]))),
    CONSTRAINT "recap_runs_type_check" CHECK (("type" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text"])))
);


ALTER TABLE "public"."recap_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recap_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scope" "text" NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "window_end" timestamp with time zone NOT NULL,
    "summary_json" "jsonb" NOT NULL,
    "posted_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recap_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referral_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "inviter_id" "text" NOT NULL,
    "invitee_id" "text",
    "event_type" "text" NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "meta" "jsonb"
);


ALTER TABLE "public"."referral_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referral_rewards" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "referral_id" "uuid" NOT NULL,
    "reward_type" "text" NOT NULL,
    "value" numeric,
    "issued_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "meta" "jsonb",
    "status" "text" DEFAULT 'pending'::"text",
    CONSTRAINT "referral_rewards_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."referral_rewards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referrals" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "inviter_id" "text" NOT NULL,
    "invitee_id" "text",
    "referral_code" "text" NOT NULL,
    "channel" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "meta" "jsonb",
    "referred_user_id" "uuid",
    "reward_earned" numeric DEFAULT 0
);


ALTER TABLE "public"."referrals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."result_sets" (
    "id" bigint NOT NULL,
    "tenant_id" "text" NOT NULL,
    "event_id" "text" NOT NULL,
    "market_type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "sources" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "official_at" timestamp with time zone,
    "version" "text" DEFAULT 'v1'::"text" NOT NULL
);


ALTER TABLE "public"."result_sets" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."result_sets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."result_sets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."result_sets_id_seq" OWNED BY "public"."result_sets"."id";



CREATE TABLE IF NOT EXISTS "public"."runtime_config" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."runtime_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scoring_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pick_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "scoring_queue_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'PROCESSING'::"text", 'DONE'::"text", 'ERROR'::"text"])))
);


ALTER TABLE "public"."scoring_queue" OWNER TO "postgres";


COMMENT ON TABLE "public"."scoring_queue" IS 'Queue for real-time pick scoring - processes picks asynchronously after ingestion';



CREATE TABLE IF NOT EXISTS "public"."security_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" character varying(50) NOT NULL,
    "severity" character varying(20) DEFAULT 'low'::character varying NOT NULL,
    "description" "text" NOT NULL,
    "user_id" character varying(100),
    "ip_address" "inet",
    "user_agent" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."security_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settlement_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "raw_prop_id" "uuid" NOT NULL,
    "game_id" "uuid",
    "provider" "text",
    "league" "text",
    "market" "text",
    "direction" "text",
    "line" numeric,
    "actual_result" numeric,
    "result" "text",
    "graded_at" timestamp with time zone DEFAULT "now"(),
    "settlement_source" "text",
    "settlement_details" "jsonb"
);


ALTER TABLE "public"."settlement_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shadow_decisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "raw_prop_id" "text",
    "unified_pick_id" "text",
    "sport" "text" NOT NULL,
    "market" "text" NOT NULL,
    "player" "text" NOT NULL,
    "team" "text",
    "book" "text",
    "odds_open" integer,
    "odds_now" integer,
    "line" numeric(10,2),
    "event_time" timestamp with time zone,
    "tier" "text",
    "confidence" integer,
    "professional_score" numeric(5,2),
    "devigged_win_prob" numeric(5,4),
    "devigged_edge" numeric(5,4),
    "clv_pct" integer,
    "kelly_fraction" numeric(5,4),
    "risk" numeric(5,4),
    "chaos_muted" boolean,
    "steam_muted" boolean,
    "decided_action" "text" NOT NULL,
    "decision_type" "text" DEFAULT 'promotion'::"text",
    "reasons" "jsonb",
    "is_instant" boolean,
    "group_key" "text",
    "shadow_mode_enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "additional_data" "jsonb",
    "actual_result" numeric,
    "settled_at" timestamp with time zone,
    "settlement_source" "text",
    "settlement_details" "jsonb",
    "status" "text",
    "dataset_label" "text" DEFAULT 'unknown'::"text"
);


ALTER TABLE "public"."shadow_decisions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."smart_form_picks" AS
 SELECT "unified_picks"."id",
    "unified_picks"."user_id",
    "unified_picks"."pick_type",
    "unified_picks"."selection",
    "unified_picks"."line",
    "unified_picks"."odds",
    "unified_picks"."stake",
    "unified_picks"."potential_payout",
    "unified_picks"."sport",
    "unified_picks"."parlay_id",
    "unified_picks"."parlay_leg_number",
    "unified_picks"."parlay_total_legs",
    "unified_picks"."parlay_total_odds",
    "unified_picks"."parlay_stake_allocation",
    "unified_picks"."placed_at",
    "unified_picks"."status",
    "unified_picks"."published",
    "unified_picks"."workflow_stage",
    "unified_picks"."promotion_status",
    "unified_picks"."created_at",
    "unified_picks"."updated_at",
    "unified_picks"."metadata"
   FROM "public"."unified_picks"
  WHERE ("unified_picks"."pick_source" = 'manual'::"text");


ALTER TABLE "public"."smart_form_picks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sports_game_odds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "league" "text",
    "market" "text",
    "selection" "text",
    "line" numeric,
    "price" numeric,
    "book" "text",
    "event_time" timestamp with time zone,
    "raw" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sports_game_odds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "tenant_id" "text" NOT NULL,
    "plan" "text" NOT NULL,
    "status" "text" NOT NULL,
    "current_period_end" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_changelog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "source" "text",
    "impact_level" "text",
    "initiated_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."system_changelog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "category" "text" NOT NULL,
    "environment" "text" DEFAULT 'production'::"text",
    "version" "text",
    "validation_schema" "jsonb",
    "is_sensitive" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."system_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_incidents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kind" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "details_json" "jsonb"
);


ALTER TABLE "public"."system_incidents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unit_talk_alerts_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "alert_type" "text" NOT NULL,
    "bet_id" "uuid",
    "ticket_id" "uuid",
    "user_id" "uuid",
    "capper_id" "uuid",
    "advice_given" "text",
    "response" "text",
    "outcome" "text",
    "ev_change" double precision,
    "was_pos_ev_advice" boolean,
    "notes" "text",
    "feedback" "text",
    "entity_key" "text",
    "dedupe_hash" "bytea",
    "message_id" "text",
    "payload_json" "jsonb"
);


ALTER TABLE "public"."unit_talk_alerts_log" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."system_health_snapshot" AS
 WITH "hot" AS (
         SELECT 'HOT_PROPS'::"text" AS "section",
            "jsonb_build_object"('count_recent', "count"(*)) AS "payload"
           FROM "public"."prop_ticks_hot"
          WHERE ("prop_ticks_hot"."asof" > ("now"() - '00:10:00'::interval))
        ), "warm" AS (
         SELECT 'WARM_FEATURES'::"text" AS "section",
            "jsonb_build_object"('count_recent', "count"(*), 'avg_dvp', "avg"("features_daily_agg"."dvp_score"), 'avg_conf', "avg"("features_daily_agg"."confidence_score")) AS "payload"
           FROM "public"."features_daily_agg"
          WHERE ("features_daily_agg"."computed_at" > ("now"() - '01:00:00'::interval))
        ), "picks" AS (
         SELECT 'UNIFIED_PICKS'::"text" AS "section",
            "jsonb_agg"("jsonb_build_object"('id', "t"."id", 'selection', "t"."selection", 'score', "t"."professional_score", 'kelly', "t"."kelly_fraction", 'edge', "t"."devigged_edge", 'status', "t"."status", 'promotion_status', "t"."promotion_status", 'posted_at', "t"."posted_at")) AS "payload"
           FROM ( SELECT "unified_picks"."id",
                    "unified_picks"."user_id",
                    "unified_picks"."prop_id",
                    "unified_picks"."game_id",
                    "unified_picks"."pick_type",
                    "unified_picks"."status",
                    "unified_picks"."selection",
                    "unified_picks"."line",
                    "unified_picks"."odds",
                    "unified_picks"."stake",
                    "unified_picks"."potential_payout",
                    "unified_picks"."actual_payout",
                    "unified_picks"."profit_loss",
                    "unified_picks"."confidence",
                    "unified_picks"."analysis",
                    "unified_picks"."reasoning",
                    "unified_picks"."tier_when_placed",
                    "unified_picks"."pick_source",
                    "unified_picks"."workflow_stage",
                    "unified_picks"."promotion_status",
                    "unified_picks"."promotion_data",
                    "unified_picks"."placed_at",
                    "unified_picks"."settled_at",
                    "unified_picks"."game_start_time",
                    "unified_picks"."settlement_source",
                    "unified_picks"."settlement_details",
                    "unified_picks"."actual_result",
                    "unified_picks"."parlay_id",
                    "unified_picks"."parlay_leg_number",
                    "unified_picks"."parlay_total_legs",
                    "unified_picks"."parlay_total_odds",
                    "unified_picks"."parlay_stake_allocation",
                    "unified_picks"."discord_thread_id",
                    "unified_picks"."discord_message_id",
                    "unified_picks"."created_at",
                    "unified_picks"."updated_at",
                    "unified_picks"."metadata",
                    "unified_picks"."created_by",
                    "unified_picks"."updated_by",
                    "unified_picks"."sport",
                    "unified_picks"."published",
                    "unified_picks"."promotion_fingerprint",
                    "unified_picks"."approved_by",
                    "unified_picks"."approved_at",
                    "unified_picks"."publish_targets",
                    "unified_picks"."dry_run",
                    "unified_picks"."capper_id",
                    "unified_picks"."promoted_at",
                    "unified_picks"."raw_id",
                    "unified_picks"."kelly_fraction",
                    "unified_picks"."professional_score",
                    "unified_picks"."devigged_edge",
                    "unified_picks"."clv_tracking_id",
                    "unified_picks"."feature_contributions",
                    "unified_picks"."processing_time",
                    "unified_picks"."rule_compliance_score",
                    "unified_picks"."sharp_grading_version",
                    "unified_picks"."posted_at",
                    "unified_picks"."ticket_id",
                    "unified_picks"."clv_line",
                    "unified_picks"."clv_delta"
                   FROM "public"."unified_picks"
                  ORDER BY "unified_picks"."posted_at" DESC
                 LIMIT 5) "t"
        ), "alerts" AS (
         SELECT 'ALERTS'::"text" AS "section",
            "jsonb_agg"("jsonb_build_object"('event_at', "t"."event_at", 'type', "t"."alert_type", 'advice', "t"."advice_given", 'ev_change', "t"."ev_change")) AS "payload"
           FROM ( SELECT "unit_talk_alerts_log"."id",
                    "unit_talk_alerts_log"."event_at",
                    "unit_talk_alerts_log"."alert_type",
                    "unit_talk_alerts_log"."bet_id",
                    "unit_talk_alerts_log"."ticket_id",
                    "unit_talk_alerts_log"."user_id",
                    "unit_talk_alerts_log"."capper_id",
                    "unit_talk_alerts_log"."advice_given",
                    "unit_talk_alerts_log"."response",
                    "unit_talk_alerts_log"."outcome",
                    "unit_talk_alerts_log"."ev_change",
                    "unit_talk_alerts_log"."was_pos_ev_advice",
                    "unit_talk_alerts_log"."notes",
                    "unit_talk_alerts_log"."feedback",
                    "unit_talk_alerts_log"."entity_key",
                    "unit_talk_alerts_log"."dedupe_hash",
                    "unit_talk_alerts_log"."message_id",
                    "unit_talk_alerts_log"."payload_json"
                   FROM "public"."unit_talk_alerts_log"
                  ORDER BY "unit_talk_alerts_log"."event_at" DESC
                 LIMIT 5) "t"
        ), "jobs" AS (
         SELECT 'AGENT_JOBS'::"text" AS "section",
            "jsonb_agg"("jsonb_build_object"('agent', "t"."agent", 'job', "t"."job_name", 'status', "t"."status", 'started', "t"."started_at", 'finished', "t"."finished_at", 'duration_ms', "t"."duration_ms", 'meta', "t"."metadata")) AS "payload"
           FROM ( SELECT "agent_job_runs"."id",
                    "agent_job_runs"."agent",
                    "agent_job_runs"."workflow",
                    "agent_job_runs"."job_name",
                    "agent_job_runs"."status",
                    "agent_job_runs"."started_at",
                    "agent_job_runs"."finished_at",
                    "agent_job_runs"."duration_ms",
                    "agent_job_runs"."error_message",
                    "agent_job_runs"."metadata"
                   FROM "public"."agent_job_runs"
                  ORDER BY "agent_job_runs"."started_at" DESC
                 LIMIT 5) "t"
        ), "incidents" AS (
         SELECT 'INCIDENTS'::"text" AS "section",
            "jsonb_agg"("jsonb_build_object"('id', "t"."id", 'kind', "t"."kind", 'started', "t"."started_at", 'resolved', "t"."resolved_at", 'details', "t"."details_json")) AS "payload"
           FROM ( SELECT "system_incidents"."id",
                    "system_incidents"."kind",
                    "system_incidents"."started_at",
                    "system_incidents"."resolved_at",
                    "system_incidents"."details_json"
                   FROM "public"."system_incidents"
                  ORDER BY "system_incidents"."started_at" DESC
                 LIMIT 5) "t"
        ), "recaps" AS (
         SELECT 'RECAP_RUNS'::"text" AS "section",
            "jsonb_agg"("jsonb_build_object"('id', "t"."id", 'type', "t"."type", 'run_at', "t"."run_at", 'status', "t"."status", 'summary', "t"."summary")) AS "payload"
           FROM ( SELECT "recap_runs"."id",
                    "recap_runs"."type",
                    "recap_runs"."run_at",
                    "recap_runs"."status",
                    "recap_runs"."summary",
                    "recap_runs"."created_at"
                   FROM "public"."recap_runs"
                  ORDER BY "recap_runs"."run_at" DESC
                 LIMIT 3) "t"
        ), "archives" AS (
         SELECT 'ARCHIVED_PROPS'::"text" AS "section",
            "jsonb_agg"("jsonb_build_object"('id', "t"."id", 'player', "t"."player_name", 'sport', "t"."sport", 'stat_type', "t"."stat_type", 'line', "t"."line", 'odds', "t"."odds", 'matchup', "t"."matchup", 'archived', "t"."archive_date")) AS "payload"
           FROM ( SELECT "archived_props"."id",
                    "archived_props"."prop_id",
                    "archived_props"."player_name",
                    "archived_props"."sport",
                    "archived_props"."team",
                    "archived_props"."stat_type",
                    "archived_props"."line",
                    "archived_props"."odds",
                    "archived_props"."matchup",
                    "archived_props"."game_date",
                    "archived_props"."archived_at",
                    "archived_props"."archive_date"
                   FROM "public"."archived_props"
                  ORDER BY "archived_props"."archived_at" DESC
                 LIMIT 3) "t"
        )
 SELECT "hot"."section",
    "hot"."payload"
   FROM "hot"
UNION ALL
 SELECT "warm"."section",
    "warm"."payload"
   FROM "warm"
UNION ALL
 SELECT "picks"."section",
    "picks"."payload"
   FROM "picks"
UNION ALL
 SELECT "alerts"."section",
    "alerts"."payload"
   FROM "alerts"
UNION ALL
 SELECT "jobs"."section",
    "jobs"."payload"
   FROM "jobs"
UNION ALL
 SELECT "incidents"."section",
    "incidents"."payload"
   FROM "incidents"
UNION ALL
 SELECT "recaps"."section",
    "recaps"."payload"
   FROM "recaps"
UNION ALL
 SELECT "archives"."section",
    "archives"."payload"
   FROM "archives";


ALTER TABLE "public"."system_health_snapshot" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" integer,
    "team_name" "text",
    "abbreviation" "text",
    "city" "text",
    "sport" "text",
    "logo_url" "text"
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_memberships" (
    "tenant_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "roles" "text"[] DEFAULT ARRAY['viewer'::"text"] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tenant_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_quotas" (
    "tenant_id" "text" NOT NULL,
    "quota_key" "text" NOT NULL,
    "limit_value" bigint NOT NULL,
    "used_value" bigint DEFAULT 0 NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "window_end" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."tenant_quotas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "text" NOT NULL,
    "name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_legs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid",
    "leg_index" integer NOT NULL,
    "pick_id" "uuid",
    "state" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ticket_legs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_type" "text" NOT NULL,
    "legs_total" integer NOT NULL,
    "legs_hit" integer DEFAULT 0 NOT NULL,
    "exposure_units" numeric,
    "cashout_value" numeric,
    "state" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tickets" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."trend_hit_rate_view" AS
 SELECT "f"."player_name",
    "f"."stat_type",
    "count"(*) FILTER (WHERE ("f"."actual_stat" >= "f"."line")) AS "hits",
    "count"(*) AS "attempts",
    "round"(((100.0 * ("count"(*) FILTER (WHERE ("f"."actual_stat" >= "f"."line")))::numeric) / (NULLIF("count"(*), 0))::numeric), 1) AS "hit_rate",
    'L5'::"text" AS "window"
   FROM ( SELECT "final_picks_backup_20250803"."id",
            "final_picks_backup_20250803"."player_name",
            "final_picks_backup_20250803"."sport",
            "final_picks_backup_20250803"."team",
            "final_picks_backup_20250803"."stat_type",
            "final_picks_backup_20250803"."outcome",
            "final_picks_backup_20250803"."line",
            "final_picks_backup_20250803"."odds",
            "final_picks_backup_20250803"."game_date",
            "final_picks_backup_20250803"."matchup",
            "final_picks_backup_20250803"."capper",
            "final_picks_backup_20250803"."unit_size",
            "final_picks_backup_20250803"."play_tag",
            "final_picks_backup_20250803"."parlay_id",
            "final_picks_backup_20250803"."is_primary_leg",
            "final_picks_backup_20250803"."edge_score",
            "final_picks_backup_20250803"."tier_tag",
            "final_picks_backup_20250803"."photo_url",
            "final_picks_backup_20250803"."play_status",
            "final_picks_backup_20250803"."actual_stat",
            "final_picks_backup_20250803"."final_result",
            "final_picks_backup_20250803"."result_value",
            "final_picks_backup_20250803"."context_flag",
            "final_picks_backup_20250803"."steam_flag",
            "final_picks_backup_20250803"."recap_posted",
            "final_picks_backup_20250803"."approved_by",
            "final_picks_backup_20250803"."discord_post_id",
            "final_picks_backup_20250803"."created_at",
            "final_picks_backup_20250803"."has_alert",
            "final_picks_backup_20250803"."alert_type",
            "final_picks_backup_20250803"."posted_to_discord",
            "final_picks_backup_20250803"."tier",
            "final_picks_backup_20250803"."direction",
            "final_picks_backup_20250803"."play_type",
            "final_picks_backup_20250803"."ticket_type",
            "final_picks_backup_20250803"."result",
            "final_picks_backup_20250803"."trend_confidence",
            "final_picks_backup_20250803"."matchup_quality",
            "final_picks_backup_20250803"."line_value_score",
            "final_picks_backup_20250803"."role_stability",
            "final_picks_backup_20250803"."confidence_score",
            "final_picks_backup_20250803"."graded_at",
            "final_picks_backup_20250803"."was_impacted_by_injury",
            "final_picks_backup_20250803"."auto_approved",
            "final_picks_backup_20250803"."initial_line",
            "final_picks_backup_20250803"."current_line",
            "final_picks_backup_20250803"."initial_odds",
            "final_picks_backup_20250803"."current_odds",
            "final_picks_backup_20250803"."line_moved",
            "final_picks_backup_20250803"."odds_moved",
            "final_picks_backup_20250803"."movement_trigger",
            "final_picks_backup_20250803"."suppress_alert",
            "final_picks_backup_20250803"."hedge_flag",
            "final_picks_backup_20250803"."graded",
            "final_picks_backup_20250803"."injury_flag"
           FROM "public"."final_picks_backup_20250803"
          WHERE ("final_picks_backup_20250803"."actual_stat" IS NOT NULL)
          ORDER BY "final_picks_backup_20250803"."game_date" DESC) "f"
  GROUP BY "f"."player_name", "f"."stat_type"
 LIMIT 1000;


ALTER TABLE "public"."trend_hit_rate_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles_backup_20250803" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "discord_id" "text" NOT NULL,
    "username" "text",
    "display_name" "text",
    "email" "text",
    "subscription_tier" "text" DEFAULT 'free'::"text",
    "preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_profiles_backup_20250803" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_games_48h" AS
 SELECT "games"."id",
    "games"."game_id",
    "games"."sport",
    "games"."season",
    "games"."date",
    "games"."start_time",
    "games"."status",
    "games"."home_team",
    "games"."away_team",
    "games"."home_score",
    "games"."away_score",
    "games"."venue",
    "games"."created_at",
    "games"."matchup",
    "games"."game_date",
    "games"."event_id",
    "games"."source",
    "games"."home_odds",
    "games"."away_odds",
    "games"."spread",
    "games"."total",
    "games"."updated_at",
    "games"."commence_time",
    "games"."sport_key",
    "games"."source_event_id",
    "games"."external_id",
    "games"."league",
    "games"."home_team_meta",
    "games"."away_team_meta",
    "games"."external_game_id",
    "games"."moneyline_home",
    "games"."moneyline_away",
    "games"."total_under_odds",
    "games"."spread_odds",
    "games"."total_over_odds"
   FROM "public"."games"
  WHERE ((COALESCE(NULLIF("games"."start_time", '1970-01-01 00:00:00'::timestamp without time zone), "games"."created_at") >= ("now"() - '48:00:00'::interval)) AND (COALESCE(NULLIF("games"."start_time", '1970-01-01 00:00:00'::timestamp without time zone), "games"."created_at") <= ("now"() + '48:00:00'::interval)));


ALTER TABLE "public"."v_games_48h" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_games_48h" IS 'Operational view: games within ±48h of now for live dashboards';



CREATE OR REPLACE VIEW "public"."v_ingestion_health" AS
 SELECT "now"() AS "observed_at",
    ( SELECT "max"("raw_props"."created_at") AS "max"
           FROM "public"."raw_props") AS "raw_last_created",
    ( SELECT "max"("raw_props"."processed_at") AS "max"
           FROM "public"."raw_props") AS "raw_last_processed",
    ( SELECT "max"("raw_props"."promoted_at") AS "max"
           FROM "public"."raw_props") AS "raw_last_promoted",
    ( SELECT "count"(*) AS "count"
           FROM "public"."raw_props"
          WHERE ("raw_props"."processed_at" IS NULL)) AS "raw_unprocessed",
    ( SELECT "count"(*) AS "count"
           FROM "public"."raw_props"
          WHERE (("raw_props"."processed_at" IS NOT NULL) AND ("raw_props"."promoted_at" IS NULL))) AS "raw_processed_not_promoted",
    ( SELECT "count"(*) AS "count"
           FROM "public"."raw_props"
          WHERE ("raw_props"."created_at" >= ("now"() - '24:00:00'::interval))) AS "raw_24h";


ALTER TABLE "public"."v_ingestion_health" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_ops_health" AS
 SELECT "now"() AS "observed_at",
    ( SELECT "max"("agent_health"."created_at") AS "max"
           FROM "public"."agent_health") AS "last_agent_heartbeat",
    ( SELECT "count"(*) AS "count"
           FROM "public"."agent_health"
          WHERE ("agent_health"."created_at" >= ("now"() - '24:00:00'::interval))) AS "agent_heartbeats_24h",
    ( SELECT "count"(*) AS "count"
           FROM "public"."agent_metrics"
          WHERE ("agent_metrics"."created_at" >= ("now"() - '24:00:00'::interval))) AS "agent_metrics_24h",
    ( SELECT "count"(*) AS "count"
           FROM "public"."error_logs"
          WHERE ("error_logs"."created_at" >= ("now"() - '24:00:00'::interval))) AS "errors_24h";


ALTER TABLE "public"."v_ops_health" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_pipeline_blockers" AS
 SELECT 'raw_unprocessed'::"text" AS "blocker",
    "count"(*) AS "ct"
   FROM "public"."raw_props"
  WHERE ("raw_props"."processed_at" IS NULL)
UNION ALL
 SELECT 'processed_not_promoted'::"text" AS "blocker",
    "count"(*) AS "ct"
   FROM "public"."raw_props"
  WHERE (("raw_props"."processed_at" IS NOT NULL) AND ("raw_props"."promoted_at" IS NULL))
UNION ALL
 SELECT 'unified_pending'::"text" AS "blocker",
    "count"(*) AS "ct"
   FROM "public"."unified_picks"
  WHERE ("unified_picks"."status" = 'pending'::"text");


ALTER TABLE "public"."v_pipeline_blockers" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_promo_backlog" AS
 SELECT "rp"."id" AS "raw_prop_id",
    "rp"."sport",
    "rp"."market" AS "pick_type",
    "rp"."line",
    "rp"."odds",
    "rp"."tier",
    "rp"."processed_at"
   FROM ("public"."raw_props" "rp"
     LEFT JOIN "public"."unified_picks" "up" ON ((("up"."prop_id" = "rp"."id") AND ("up"."pick_source" = 'system'::"text"))))
  WHERE (("rp"."processed_at" IS NOT NULL) AND ("rp"."promoted_at" IS NULL) AND ("up"."id" IS NULL));


ALTER TABLE "public"."v_promo_backlog" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_raw_props_48h" AS
 SELECT "raw_props"."id",
    "raw_props"."player_name",
    "raw_props"."sport",
    "raw_props"."team",
    "raw_props"."stat_type",
    "raw_props"."outcome",
    "raw_props"."line",
    "raw_props"."odds",
    "raw_props"."game_date",
    "raw_props"."matchup",
    "raw_props"."trend_confidence",
    "raw_props"."matchup_quality",
    "raw_props"."line_value_score",
    "raw_props"."role_stability",
    "raw_props"."confidence_score",
    "raw_props"."edge_score",
    "raw_props"."tier_tag",
    "raw_props"."auto_approved",
    "raw_props"."context_flag",
    "raw_props"."created_at",
    "raw_props"."source",
    "raw_props"."promoted_to_picks",
    "raw_props"."game_id",
    "raw_props"."bet_type",
    "raw_props"."market_type",
    "raw_props"."outcomes",
    "raw_props"."player_id",
    "raw_props"."player_slug",
    "raw_props"."external_game_id",
    "raw_props"."sport_key",
    "raw_props"."fair_odds",
    "raw_props"."league",
    "raw_props"."promoted_at",
    "raw_props"."unit_size",
    "raw_props"."tier",
    "raw_props"."promoted",
    "raw_props"."ev_percent",
    "raw_props"."trend_score",
    "raw_props"."matchup_score",
    "raw_props"."line_score",
    "raw_props"."role_score",
    "raw_props"."direction",
    "raw_props"."unique_key",
    "raw_props"."is_promoted",
    "raw_props"."event_id",
    "raw_props"."book",
    "raw_props"."updated_at",
    "raw_props"."is_alt_line",
    "raw_props"."is_primary",
    "raw_props"."opponent",
    "raw_props"."start_time",
    "raw_props"."is_valid",
    "raw_props"."external_id",
    "raw_props"."over_odds",
    "raw_props"."under_odds",
    "raw_props"."market",
    "raw_props"."provider",
    "raw_props"."game_time",
    "raw_props"."scraped_at",
    "raw_props"."home_team",
    "raw_props"."home_team_id",
    "raw_props"."away_team",
    "raw_props"."away_team_id",
    "raw_props"."expected_value",
    "raw_props"."sharp_money",
    "raw_props"."line_movement",
    "raw_props"."player_form",
    "raw_props"."injury_impact",
    "raw_props"."steam_detected",
    "raw_props"."best_available_line",
    "raw_props"."best_book",
    "raw_props"."public_betting_percentage",
    "raw_props"."sharp_betting_percentage",
    "raw_props"."volatility",
    "raw_props"."correlation_risk",
    "raw_props"."bid_ask_spread",
    "raw_props"."weather_impact",
    "raw_props"."market_intelligence",
    "raw_props"."volume_profile",
    "raw_props"."closing_line_value",
    "raw_props"."predicted_closing_line",
    "raw_props"."optimal_betting_time",
    "raw_props"."contrarian_opportunity",
    "raw_props"."injury_timing_advantage",
    "raw_props"."cross_market_arbitrage",
    "raw_props"."player_fatigue",
    "raw_props"."venue_advantage",
    "raw_props"."referee_impact",
    "raw_props"."pace_impact",
    "raw_props"."motivational_factors",
    "raw_props"."data_completeness",
    "raw_props"."outlier_score",
    "raw_props"."consistency_score",
    "raw_props"."data_validation_score",
    "raw_props"."portfolio_impact",
    "raw_props"."metadata",
    "raw_props"."over",
    "raw_props"."under",
    "raw_props"."confidence",
    "raw_props"."prop_category",
    "raw_props"."team_name",
    "raw_props"."standardized_sport",
    "raw_props"."standardized_stat",
    "raw_props"."data_quality_score",
    "raw_props"."needs_review",
    "raw_props"."processed_at",
    "raw_props"."pro_attempts",
    "raw_props"."processing_error",
    "raw_props"."professional_score",
    "raw_props"."kelly_fraction",
    "raw_props"."clv_tracking_id"
   FROM "public"."raw_props"
  WHERE ((COALESCE(NULLIF("raw_props"."game_time", '1970-01-01 00:00:00'::timestamp without time zone), (
        CASE
            WHEN ("raw_props"."game_date" IS NULL) THEN NULL::timestamp without time zone
            ELSE ("raw_props"."game_date")::timestamp without time zone
        END)::timestamp with time zone, ("raw_props"."created_at")::timestamp with time zone) >= ("now"() - '48:00:00'::interval)) AND (COALESCE(NULLIF("raw_props"."game_time", '1970-01-01 00:00:00'::timestamp without time zone), (
        CASE
            WHEN ("raw_props"."game_date" IS NULL) THEN NULL::timestamp without time zone
            ELSE ("raw_props"."game_date")::timestamp without time zone
        END)::timestamp with time zone, ("raw_props"."created_at")::timestamp with time zone) <= ("now"() + '48:00:00'::interval)));


ALTER TABLE "public"."v_raw_props_48h" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_raw_props_48h" IS 'Operational view: props within ±48h of now for live UX and grading queues';



CREATE OR REPLACE VIEW "public"."v_recent_promotions_24h" AS
 SELECT "up"."id" AS "unified_pick_id",
    "up"."created_at" AS "promoted_at",
    "up"."pick_source",
    "up"."prop_id",
    "up"."sport",
    "up"."pick_type",
    "up"."selection",
    "up"."line",
    "up"."odds",
    "up"."tier_when_placed",
    "up"."promotion_status",
    "up"."game_start_time",
    "rp"."processed_at"
   FROM ("public"."unified_picks" "up"
     LEFT JOIN "public"."raw_props" "rp" ON (("rp"."id" = "up"."prop_id")))
  WHERE ("up"."created_at" > ("now"() - '24:00:00'::interval))
  ORDER BY "up"."created_at" DESC;


ALTER TABLE "public"."v_recent_promotions_24h" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_unified_health" AS
 SELECT "now"() AS "observed_at",
    ( SELECT "count"(*) AS "count"
           FROM "public"."unified_picks") AS "unified_total",
    ( SELECT "count"(*) AS "count"
           FROM "public"."unified_picks"
          WHERE ("unified_picks"."placed_at" >= ("now"() - '24:00:00'::interval))) AS "unified_placed_24h",
    ( SELECT "count"(*) AS "count"
           FROM "public"."unified_picks"
          WHERE ("unified_picks"."settled_at" >= ("now"() - '24:00:00'::interval))) AS "unified_settled_24h",
    ( SELECT "count"(*) AS "count"
           FROM "public"."unified_picks"
          WHERE ("unified_picks"."status" = 'pending'::"text")) AS "unified_pending",
    ( SELECT "count"(*) AS "count"
           FROM "public"."unified_picks"
          WHERE ("unified_picks"."status" = ANY (ARRAY['cancelled'::"text", 'void'::"text"]))) AS "unified_cancel_void",
    ( SELECT "count"(*) AS "count"
           FROM "public"."unified_picks"
          WHERE ("unified_picks"."parlay_id" IS NOT NULL)) AS "unified_parlay_legs";


ALTER TABLE "public"."v_unified_health" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_unified_picks_health_24h" AS
 WITH "base" AS (
         SELECT "unified_picks"."id",
            "unified_picks"."user_id",
            "unified_picks"."prop_id",
            "unified_picks"."game_id",
            "unified_picks"."pick_type",
            "unified_picks"."status",
            "unified_picks"."selection",
            "unified_picks"."line",
            "unified_picks"."odds",
            "unified_picks"."stake",
            "unified_picks"."potential_payout",
            "unified_picks"."actual_payout",
            "unified_picks"."profit_loss",
            "unified_picks"."confidence",
            "unified_picks"."analysis",
            "unified_picks"."reasoning",
            "unified_picks"."tier_when_placed",
            "unified_picks"."pick_source",
            "unified_picks"."workflow_stage",
            "unified_picks"."promotion_status",
            "unified_picks"."promotion_data",
            "unified_picks"."placed_at",
            "unified_picks"."settled_at",
            "unified_picks"."game_start_time",
            "unified_picks"."settlement_source",
            "unified_picks"."settlement_details",
            "unified_picks"."actual_result",
            "unified_picks"."parlay_id",
            "unified_picks"."parlay_leg_number",
            "unified_picks"."parlay_total_legs",
            "unified_picks"."parlay_total_odds",
            "unified_picks"."parlay_stake_allocation",
            "unified_picks"."discord_thread_id",
            "unified_picks"."discord_message_id",
            "unified_picks"."created_at",
            "unified_picks"."updated_at",
            "unified_picks"."metadata",
            "unified_picks"."created_by",
            "unified_picks"."updated_by",
            "unified_picks"."sport",
            "unified_picks"."published",
            "unified_picks"."promotion_fingerprint"
           FROM "public"."unified_picks"
          WHERE ("unified_picks"."created_at" > ("now"() - '24:00:00'::interval))
        ), "totals" AS (
         SELECT "count"(*) AS "total_24h",
            "count"(*) FILTER (WHERE ("base"."pick_source" = 'system'::"text")) AS "system_24h",
            "count"(*) FILTER (WHERE ("base"."pick_source" = 'manual'::"text")) AS "manual_24h"
           FROM "base"
        ), "dupes" AS (
         SELECT "count"(*) AS "dup_fingerprints_24h"
           FROM ( SELECT "base"."promotion_fingerprint"
                   FROM "base"
                  WHERE ("base"."promotion_fingerprint" IS NOT NULL)
                  GROUP BY "base"."promotion_fingerprint"
                 HAVING ("count"(*) > 1)) "d"
        ), "sys_missing_prop" AS (
         SELECT "count"(*) AS "system_rows_missing_prop_id_24h"
           FROM "base"
          WHERE (("base"."pick_source" = 'system'::"text") AND ("base"."prop_id" IS NULL))
        ), "writer_audit" AS (
         SELECT COALESCE("round"(((100.0 * ("sum"(
                CASE
                    WHEN (("base"."metadata" ->> 'writer'::"text") = 'GradingAgent'::"text") THEN 1
                    ELSE 0
                END))::numeric) / (NULLIF("count"(*), 0))::numeric), 2), (0)::numeric) AS "writer_gradingagent_pct"
           FROM "base"
        )
 SELECT "totals"."total_24h",
    "totals"."system_24h",
    "totals"."manual_24h",
    "dupes"."dup_fingerprints_24h",
    "sys_missing_prop"."system_rows_missing_prop_id_24h",
    "writer_audit"."writer_gradingagent_pct"
   FROM "totals",
    "dupes",
    "sys_missing_prop",
    "writer_audit";


ALTER TABLE "public"."v_unified_picks_health_24h" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_ai_training_set" AS
 SELECT "fp"."id",
    "fp"."player_name",
    "fp"."sport",
    "fp"."stat_type",
    "fp"."line",
    "fp"."odds",
    "fp"."edge_score",
    "fp"."expected_value_score",
    "fp"."tier_tag",
    "fp"."true_tier",
    "fp"."role_stability",
    "fp"."context_flag",
    "fp"."team",
    "fp"."opponent",
    "fp"."result",
        CASE
            WHEN ("fp"."result" = 'win'::"text") THEN 1
            WHEN ("fp"."result" = 'loss'::"text") THEN 0
            ELSE NULL::integer
        END AS "target",
    "fp"."game_date"
   FROM "public"."final_picks_backup_20250803" "fp"
  WHERE (("fp"."result" IS NOT NULL) AND ("fp"."edge_score" IS NOT NULL) AND ("fp"."expected_value_score" IS NOT NULL) AND ("fp"."role_stability" IS NOT NULL));


ALTER TABLE "public"."view_ai_training_set" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_alert_overlay" AS
 SELECT "fp"."id",
    "fp"."player_name",
    "fp"."stat_type",
    "fp"."outcome",
    "fp"."line",
    "fp"."odds",
    "fp"."edge_score",
    "fp"."tier",
    "fp"."context_flag",
    "fp"."has_alert",
    "fp"."play_status",
    "fp"."game_date",
    "al"."alert_type" AS "matched_alert_type",
    "al"."created_at" AS "alert_created_at"
   FROM ("public"."final_picks_backup_20250803" "fp"
     JOIN "public"."alerts_log" "al" ON ((("fp"."player_name" = "al"."player_name") AND ("fp"."sport" = "al"."sport") AND ("fp"."game_date" = "date"("al"."created_at")))))
  WHERE ("fp"."play_status" = 'Pending'::"text");


ALTER TABLE "public"."view_alert_overlay" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_alerted_picks" AS
 SELECT "daily_picks_backup_20250803"."id",
    "daily_picks_backup_20250803"."player_name",
    "daily_picks_backup_20250803"."sport",
    "daily_picks_backup_20250803"."team",
    "daily_picks_backup_20250803"."stat_type",
    "daily_picks_backup_20250803"."outcome",
    "daily_picks_backup_20250803"."line",
    "daily_picks_backup_20250803"."odds",
    "daily_picks_backup_20250803"."game_date",
    "daily_picks_backup_20250803"."matchup",
    "daily_picks_backup_20250803"."capper",
    "daily_picks_backup_20250803"."unit_size",
    "daily_picks_backup_20250803"."play_tag",
    "daily_picks_backup_20250803"."parlay_id",
    "daily_picks_backup_20250803"."is_primary_leg",
    "daily_picks_backup_20250803"."confidence_score",
    "daily_picks_backup_20250803"."role_stability",
    "daily_picks_backup_20250803"."line_value_score",
    "daily_picks_backup_20250803"."trend_confidence",
    "daily_picks_backup_20250803"."matchup_quality",
    "daily_picks_backup_20250803"."edge_score",
    "daily_picks_backup_20250803"."tier_tag",
    "daily_picks_backup_20250803"."auto_approved",
    "daily_picks_backup_20250803"."context_flag",
    "daily_picks_backup_20250803"."created_at",
    "daily_picks_backup_20250803"."promoted_to_final",
    "daily_picks_backup_20250803"."has_alert",
    "daily_picks_backup_20250803"."alert_type",
    "daily_picks_backup_20250803"."units",
    "daily_picks_backup_20250803"."rr_ticket_id"
   FROM "public"."daily_picks_backup_20250803"
  WHERE ("daily_picks_backup_20250803"."has_alert" = true);


ALTER TABLE "public"."view_alerted_picks" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_auto_tag_checklist" AS
 SELECT "final_picks_backup_20250803"."id",
    "final_picks_backup_20250803"."player_name",
    "final_picks_backup_20250803"."stat_type",
    "final_picks_backup_20250803"."direction",
    "final_picks_backup_20250803"."line",
    "final_picks_backup_20250803"."unit_size",
    "final_picks_backup_20250803"."capper",
    "final_picks_backup_20250803"."game_date"
   FROM "public"."final_picks_backup_20250803"
  WHERE (("final_picks_backup_20250803"."edge_score" IS NULL) OR ("final_picks_backup_20250803"."tier" IS NULL) OR ("final_picks_backup_20250803"."role_stability" IS NULL))
  ORDER BY "final_picks_backup_20250803"."game_date" DESC;


ALTER TABLE "public"."view_auto_tag_checklist" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_best_cappers_by_edge" AS
 SELECT "final_picks_backup_20250803"."capper",
    "round"("avg"("final_picks_backup_20250803"."edge_score"), 2) AS "avg_edge",
    "count"(*) AS "total",
    "round"("sum"("final_picks_backup_20250803"."result_value"), 2) AS "net_units",
    "round"((((100)::numeric * "sum"("final_picks_backup_20250803"."result_value")) / NULLIF("sum"("final_picks_backup_20250803"."unit_size"), (0)::numeric)), 2) AS "roi_percent"
   FROM "public"."final_picks_backup_20250803"
  GROUP BY "final_picks_backup_20250803"."capper"
 HAVING ("count"(*) >= 10)
  ORDER BY ("round"("avg"("final_picks_backup_20250803"."edge_score"), 2)) DESC;


ALTER TABLE "public"."view_best_cappers_by_edge" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_daily_final_recaps" AS
 SELECT "final_picks_backup_20250803"."game_date" AS "recap_date",
    "count"(*) AS "total_picks",
    "sum"(
        CASE
            WHEN ("final_picks_backup_20250803"."result" = 'Win'::"text") THEN 1
            ELSE 0
        END) AS "wins",
    "sum"(
        CASE
            WHEN ("final_picks_backup_20250803"."result" = 'Loss'::"text") THEN 1
            ELSE 0
        END) AS "losses",
    "sum"(
        CASE
            WHEN ("final_picks_backup_20250803"."result" = 'Push'::"text") THEN 1
            ELSE 0
        END) AS "pushes",
    "round"("sum"("final_picks_backup_20250803"."result_value"), 2) AS "units_won",
    "round"("sum"("final_picks_backup_20250803"."unit_size"), 2) AS "units_risked",
    "round"((((100)::numeric * "sum"("final_picks_backup_20250803"."result_value")) / NULLIF("sum"("final_picks_backup_20250803"."unit_size"), (0)::numeric)), 2) AS "roi_percent",
    "round"(((100.0 * ("sum"(
        CASE
            WHEN ("final_picks_backup_20250803"."result" = 'Win'::"text") THEN 1
            ELSE 0
        END))::numeric) / (NULLIF("count"(*), 0))::numeric), 1) AS "win_pct"
   FROM "public"."final_picks_backup_20250803"
  GROUP BY "final_picks_backup_20250803"."game_date"
  ORDER BY "final_picks_backup_20250803"."game_date" DESC;


ALTER TABLE "public"."view_daily_final_recaps" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_daily_highlights" AS
 SELECT "highlights"."type",
    "highlights"."id",
    "highlights"."capper",
    "highlights"."player_name",
    "highlights"."stat_type",
    "highlights"."direction",
    "highlights"."line",
    "highlights"."unit_size",
    "highlights"."edge_score",
    "highlights"."result",
    "highlights"."game_date"
   FROM (( SELECT 'Best Play'::"text" AS "type",
            "final_picks_backup_20250803"."id",
            "final_picks_backup_20250803"."capper",
            "final_picks_backup_20250803"."player_name",
            "final_picks_backup_20250803"."stat_type",
            "final_picks_backup_20250803"."direction",
            "final_picks_backup_20250803"."line",
            "final_picks_backup_20250803"."unit_size",
            "final_picks_backup_20250803"."edge_score",
            "final_picks_backup_20250803"."result",
            "final_picks_backup_20250803"."game_date"
           FROM "public"."final_picks_backup_20250803"
          WHERE (("final_picks_backup_20250803"."game_date" = CURRENT_DATE) AND ("final_picks_backup_20250803"."result" = 'Win'::"text"))
          ORDER BY "final_picks_backup_20250803"."edge_score" DESC
         LIMIT 1)
        UNION ALL
        ( SELECT 'Bad Beat'::"text" AS "type",
            "final_picks_backup_20250803"."id",
            "final_picks_backup_20250803"."capper",
            "final_picks_backup_20250803"."player_name",
            "final_picks_backup_20250803"."stat_type",
            "final_picks_backup_20250803"."direction",
            "final_picks_backup_20250803"."line",
            "final_picks_backup_20250803"."unit_size",
            "final_picks_backup_20250803"."edge_score",
            "final_picks_backup_20250803"."result",
            "final_picks_backup_20250803"."game_date"
           FROM "public"."final_picks_backup_20250803"
          WHERE (("final_picks_backup_20250803"."game_date" = CURRENT_DATE) AND ("final_picks_backup_20250803"."result" = 'Loss'::"text"))
          ORDER BY "final_picks_backup_20250803"."edge_score" DESC
         LIMIT 1)) "highlights";


ALTER TABLE "public"."view_daily_highlights" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_daily_posted_picks" AS
 SELECT "final_picks_backup_20250803"."id",
    "final_picks_backup_20250803"."player_name",
    "final_picks_backup_20250803"."stat_type",
    "final_picks_backup_20250803"."direction",
    "final_picks_backup_20250803"."line",
    "final_picks_backup_20250803"."odds",
    "final_picks_backup_20250803"."unit_size",
    "final_picks_backup_20250803"."capper",
    "final_picks_backup_20250803"."ticket_type",
    "final_picks_backup_20250803"."game_date",
    "final_picks_backup_20250803"."posted_to_discord",
    "final_picks_backup_20250803"."created_at"
   FROM "public"."final_picks_backup_20250803"
  WHERE (("final_picks_backup_20250803"."posted_to_discord" = true) AND ("date"("final_picks_backup_20250803"."created_at") = CURRENT_DATE))
  ORDER BY "final_picks_backup_20250803"."created_at" DESC;


ALTER TABLE "public"."view_daily_posted_picks" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_deduped_player_logs" AS
 SELECT "sub"."id",
    "sub"."sport",
    "sub"."player_name",
    "sub"."team",
    "sub"."opponent",
    "sub"."game_date",
    "sub"."stat_type",
    "sub"."result",
    "sub"."line",
    "sub"."outcome",
    "sub"."source",
    "sub"."entry_type",
    "sub"."created_at",
    "sub"."row_num"
   FROM ( SELECT "player_logs"."id",
            "player_logs"."sport",
            "player_logs"."player_name",
            "player_logs"."team",
            "player_logs"."opponent",
            "player_logs"."game_date",
            "player_logs"."stat_type",
            "player_logs"."result",
            "player_logs"."line",
            "player_logs"."outcome",
            "player_logs"."source",
            "player_logs"."entry_type",
            "player_logs"."created_at",
            "row_number"() OVER (PARTITION BY "player_logs"."player_name", "player_logs"."stat_type", "player_logs"."game_date" ORDER BY "player_logs"."created_at" DESC) AS "row_num"
           FROM "public"."player_logs") "sub"
  WHERE ("sub"."row_num" = 1);


ALTER TABLE "public"."view_deduped_player_logs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_duplicate_check" AS
 SELECT "final_picks_backup_20250803"."player_name",
    "final_picks_backup_20250803"."stat_type",
    "final_picks_backup_20250803"."direction",
    "final_picks_backup_20250803"."game_date",
    "count"(*) AS "count"
   FROM "public"."final_picks_backup_20250803"
  GROUP BY "final_picks_backup_20250803"."player_name", "final_picks_backup_20250803"."stat_type", "final_picks_backup_20250803"."direction", "final_picks_backup_20250803"."game_date"
 HAVING ("count"(*) > 1)
  ORDER BY ("count"(*)) DESC;


ALTER TABLE "public"."view_duplicate_check" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_scoring_summary" AS
 SELECT "base"."final_pick_id",
    "base"."player_name",
    "base"."stat_type",
    "base"."pick_line",
    "base"."trend_hit_rate",
    "base"."matchup_rank",
    "base"."matchup_color",
    "base"."initial_line",
    "base"."current_line",
    "base"."line_delta",
    "base"."context_flag",
    "base"."line_moved",
    "base"."odds_moved",
        CASE
            WHEN ("base"."trend_hit_rate" >= (85)::numeric) THEN 5
            WHEN ("base"."trend_hit_rate" >= (75)::numeric) THEN 4
            WHEN ("base"."trend_hit_rate" >= (65)::numeric) THEN 3
            WHEN ("base"."trend_hit_rate" >= (50)::numeric) THEN 2
            WHEN ("base"."trend_hit_rate" > (0)::numeric) THEN 1
            ELSE 0
        END AS "trend_score",
        CASE
            WHEN ("base"."matchup_rank" >= 26) THEN 5
            WHEN ("base"."matchup_rank" >= 21) THEN 4
            WHEN ("base"."matchup_rank" >= 11) THEN 3
            WHEN ("base"."matchup_rank" >= 6) THEN 2
            WHEN ("base"."matchup_rank" > 0) THEN 1
            ELSE 0
        END AS "matchup_score",
        CASE
            WHEN ("base"."line_delta" >= (1)::numeric) THEN 5
            WHEN (("base"."line_delta" >= '-0.5'::numeric) AND ("base"."line_delta" <= 0.5)) THEN 3
            WHEN ("base"."line_delta" < '-0.5'::numeric) THEN 1
            ELSE 0
        END AS "line_value_score",
        CASE
            WHEN ("base"."context_flag" = true) THEN 4
            WHEN ("base"."context_flag" = false) THEN 5
            ELSE 5
        END AS "role_stability_score",
        CASE
            WHEN (("base"."line_moved" = true) AND ("base"."odds_moved" = true)) THEN 5
            WHEN (("base"."line_moved" = false) AND ("base"."odds_moved" = false)) THEN 3
            WHEN (("base"."line_moved" = false) AND ("base"."odds_moved" = true)) THEN 2
            WHEN (("base"."line_moved" = true) AND ("base"."odds_moved" = false)) THEN 2
            ELSE 1
        END AS "confidence_score"
   FROM ( SELECT "f"."id" AS "final_pick_id",
            "f"."player_name",
            "f"."stat_type",
            "f"."line" AS "pick_line",
            "tr"."hit_rate" AS "trend_hit_rate",
            "d"."dvp_rank" AS "matchup_rank",
            "d"."dvp_color" AS "matchup_color",
            "f"."initial_line",
            "f"."current_line",
            "round"(("f"."initial_line" - "f"."current_line"), 2) AS "line_delta",
            "f"."context_flag",
            "f"."line_moved",
            "f"."odds_moved"
           FROM ((("public"."final_picks_backup_20250803" "f"
             LEFT JOIN "public"."trend_hit_rate_view" "tr" ON ((("tr"."player_name" = "f"."player_name") AND ("tr"."stat_type" = "f"."stat_type"))))
             LEFT JOIN "public"."teams" "opponent_team" ON (("opponent_team"."abbreviation" =
                CASE
                    WHEN ("split_part"("f"."matchup", ' vs '::"text", 1) = "f"."team") THEN "split_part"("f"."matchup", ' vs '::"text", 2)
                    WHEN ("split_part"("f"."matchup", ' vs '::"text", 2) = "f"."team") THEN "split_part"("f"."matchup", ' vs '::"text", 1)
                    ELSE NULL::"text"
                END)))
             LEFT JOIN "public"."dvp_matchup_ranks" "d" ON ((("d"."team_id" = "opponent_team"."id") AND ("d"."stat_type" = "f"."stat_type"))))) "base";


ALTER TABLE "public"."view_scoring_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_edge_score" AS
 SELECT "s"."final_pick_id",
    "s"."player_name",
    "s"."stat_type",
    "s"."pick_line",
    "s"."trend_hit_rate",
    "s"."matchup_rank",
    "s"."matchup_color",
    "s"."initial_line",
    "s"."current_line",
    "s"."line_delta",
    "s"."context_flag",
    "s"."line_moved",
    "s"."odds_moved",
    "s"."trend_score",
    "s"."matchup_score",
    "s"."line_value_score",
    "s"."role_stability_score",
    "s"."confidence_score",
    (((("s"."trend_score" + "s"."matchup_score") + "s"."line_value_score") + "s"."role_stability_score") + "s"."confidence_score") AS "edge_score",
        CASE
            WHEN ((((("s"."trend_score" + "s"."matchup_score") + "s"."line_value_score") + "s"."role_stability_score") + "s"."confidence_score") >= 23) THEN 'S+'::"text"
            WHEN ((((("s"."trend_score" + "s"."matchup_score") + "s"."line_value_score") + "s"."role_stability_score") + "s"."confidence_score") >= 20) THEN 'S'::"text"
            WHEN ((((("s"."trend_score" + "s"."matchup_score") + "s"."line_value_score") + "s"."role_stability_score") + "s"."confidence_score") >= 17) THEN 'A+'::"text"
            WHEN ((((("s"."trend_score" + "s"."matchup_score") + "s"."line_value_score") + "s"."role_stability_score") + "s"."confidence_score") >= 15) THEN 'A'::"text"
            WHEN ((((("s"."trend_score" + "s"."matchup_score") + "s"."line_value_score") + "s"."role_stability_score") + "s"."confidence_score") >= 10) THEN 'B'::"text"
            ELSE 'C'::"text"
        END AS "tier_tag",
        CASE
            WHEN ((((("s"."trend_score" + "s"."matchup_score") + "s"."line_value_score") + "s"."role_stability_score") + "s"."confidence_score") >= 15) THEN true
            ELSE false
        END AS "auto_approved"
   FROM "public"."view_scoring_summary" "s";


ALTER TABLE "public"."view_edge_score" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_edge_summary" AS
 SELECT "final_picks_backup_20250803"."sport",
    "final_picks_backup_20250803"."tier",
    "final_picks_backup_20250803"."context_flag",
    "final_picks_backup_20250803"."has_alert",
    "count"(*) AS "total_picks",
    "round"("avg"("final_picks_backup_20250803"."edge_score"), 2) AS "avg_edge_score"
   FROM "public"."final_picks_backup_20250803"
  GROUP BY "final_picks_backup_20250803"."sport", "final_picks_backup_20250803"."tier", "final_picks_backup_20250803"."context_flag", "final_picks_backup_20250803"."has_alert"
  ORDER BY "final_picks_backup_20250803"."sport", "final_picks_backup_20250803"."tier" DESC;


ALTER TABLE "public"."view_edge_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_edge_trends" AS
 SELECT "final_picks_backup_20250803"."game_date" AS "day",
    "round"("avg"("final_picks_backup_20250803"."edge_score"), 2) AS "avg_edge_score",
    "count"(*) AS "total_picks"
   FROM "public"."final_picks_backup_20250803"
  GROUP BY "final_picks_backup_20250803"."game_date"
  ORDER BY "final_picks_backup_20250803"."game_date" DESC;


ALTER TABLE "public"."view_edge_trends" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_enriched_daily_picks" AS
 SELECT "dp"."id",
    "dp"."player_name",
    "dp"."sport",
    "dp"."team",
    "dp"."stat_type",
    "dp"."outcome",
    "dp"."line",
    "dp"."odds",
    "dp"."game_date",
    "dp"."matchup",
    "dp"."capper",
    "dp"."unit_size",
    "dp"."play_tag",
    "dp"."parlay_id",
    "dp"."is_primary_leg",
    "dp"."confidence_score",
    "dp"."role_stability",
    "dp"."line_value_score",
    "dp"."trend_confidence",
    "dp"."matchup_quality",
    "dp"."edge_score",
    "dp"."tier_tag",
    "dp"."auto_approved",
    "dp"."context_flag",
    "dp"."created_at",
    "dp"."promoted_to_final",
    "dp"."has_alert",
    "dp"."alert_type",
    "p"."photo_url",
    "p"."team_name"
   FROM ("public"."daily_picks_backup_20250803" "dp"
     LEFT JOIN "public"."players" "p" ON (("dp"."player_name" = "p"."player_name")));


ALTER TABLE "public"."view_enriched_daily_picks" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_enriched_final_picks" AS
 SELECT "final_picks_backup_20250803"."id",
    "final_picks_backup_20250803"."player_name",
    "final_picks_backup_20250803"."stat_type",
    "final_picks_backup_20250803"."direction",
    "final_picks_backup_20250803"."game_date",
    "final_picks_backup_20250803"."capper",
    "final_picks_backup_20250803"."edge_score",
    "final_picks_backup_20250803"."unit_size",
    "final_picks_backup_20250803"."odds",
    "final_picks_backup_20250803"."line",
    "final_picks_backup_20250803"."result",
    "final_picks_backup_20250803"."ticket_type",
    "final_picks_backup_20250803"."parlay_id",
    "final_picks_backup_20250803"."is_primary_leg",
    "final_picks_backup_20250803"."created_at",
    "final_picks_backup_20250803"."actual_stat",
    "final_picks_backup_20250803"."play_status",
        CASE
            WHEN (("final_picks_backup_20250803"."edge_score" >= 20) AND ("final_picks_backup_20250803"."edge_score" <= 25)) THEN 'S'::"text"
            WHEN (("final_picks_backup_20250803"."edge_score" >= 15) AND ("final_picks_backup_20250803"."edge_score" <= 19)) THEN 'A'::"text"
            WHEN (("final_picks_backup_20250803"."edge_score" >= 10) AND ("final_picks_backup_20250803"."edge_score" <= 14)) THEN 'B'::"text"
            ELSE 'C'::"text"
        END AS "tier"
   FROM "public"."final_picks_backup_20250803";


ALTER TABLE "public"."view_enriched_final_picks" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_enriched_picks" AS
 SELECT "fp"."id",
    "fp"."player_name",
    "fp"."sport",
    "fp"."team",
    "fp"."stat_type",
    "fp"."outcome",
    "fp"."line",
    "fp"."odds",
    "fp"."unit_size",
    "fp"."capper",
    "fp"."play_tag",
    "fp"."parlay_id",
    "fp"."is_primary_leg",
    "fp"."edge_score",
    "fp"."tier_tag",
    COALESCE("fp"."photo_url", "pl"."photo_url", 'https://cdn.unit-talk.com/img/player-default.png'::"text") AS "image_url",
    "fp"."matchup",
    "fp"."game_date",
    "fp"."play_status",
    "fp"."actual_stat",
    "fp"."final_result",
    "fp"."result_value",
    "fp"."created_at",
    "fp"."context_flag",
    "fp"."steam_flag",
    "fp"."recap_posted",
    "fp"."approved_by",
    "fp"."discord_post_id"
   FROM ("public"."final_picks_backup_20250803" "fp"
     LEFT JOIN "public"."players" "pl" ON ((("lower"("fp"."player_name") = "lower"("pl"."player_name")) AND ("lower"("fp"."sport") = "lower"("pl"."sport")))));


ALTER TABLE "public"."view_enriched_picks" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_final_pick_queue" AS
 SELECT "up"."id",
    "up"."user_id",
    "u"."username" AS "capper",
    "up"."selection",
    "up"."line",
    "up"."odds",
    "up"."stake" AS "unit_size",
    "up"."potential_payout" AS "payout",
    "up"."status",
    "up"."pick_type" AS "ticket_type",
    "up"."confidence" AS "confidence_score",
    "up"."analysis" AS "pick_explainer",
    "up"."placed_at" AS "created_at",
    "up"."updated_at"
   FROM ("public"."unified_picks" "up"
     JOIN "public"."users" "u" ON (("up"."user_id" = "u"."id")))
  WHERE (("up"."pick_source" = 'promoted'::"text") AND ("up"."workflow_stage" = 'pending_review'::"text"));


ALTER TABLE "public"."view_final_pick_queue" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_final_picks_by_ticket_type" AS
 SELECT "final_picks_backup_20250803"."id",
    "final_picks_backup_20250803"."game_date",
    "final_picks_backup_20250803"."capper",
    "final_picks_backup_20250803"."player_name",
    "final_picks_backup_20250803"."stat_type",
    "final_picks_backup_20250803"."direction",
    "final_picks_backup_20250803"."line",
    "final_picks_backup_20250803"."odds",
    "final_picks_backup_20250803"."result",
    "final_picks_backup_20250803"."result_value",
    "final_picks_backup_20250803"."ticket_type",
    "final_picks_backup_20250803"."parlay_id",
    "final_picks_backup_20250803"."is_primary_leg",
    "final_picks_backup_20250803"."unit_size",
    "final_picks_backup_20250803"."edge_score",
    "final_picks_backup_20250803"."tier"
   FROM "public"."final_picks_backup_20250803"
  WHERE ("final_picks_backup_20250803"."game_date" = CURRENT_DATE)
  ORDER BY "final_picks_backup_20250803"."ticket_type", "final_picks_backup_20250803"."parlay_id", "final_picks_backup_20250803"."is_primary_leg" DESC, "final_picks_backup_20250803"."capper", "final_picks_backup_20250803"."game_date";


ALTER TABLE "public"."view_final_picks_by_ticket_type" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_graded_props" AS
 SELECT "up"."id",
    "up"."prop_id",
    "up"."selection",
    "up"."line",
    "up"."odds",
    "up"."status" AS "result",
    "up"."actual_result",
    "up"."settled_at" AS "graded_at",
    "up"."user_id",
    "u"."username" AS "capper"
   FROM ("public"."unified_picks" "up"
     JOIN "public"."users" "u" ON (("up"."user_id" = "u"."id")))
  WHERE ("up"."status" = ANY (ARRAY['won'::"text", 'lost'::"text", 'push'::"text"]));


ALTER TABLE "public"."view_graded_props" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_graded_vs_actual_errors" AS
 SELECT "final_picks_backup_20250803"."id",
    "final_picks_backup_20250803"."capper",
    "final_picks_backup_20250803"."player_name",
    "final_picks_backup_20250803"."stat_type",
    "final_picks_backup_20250803"."direction",
    "final_picks_backup_20250803"."line",
    "final_picks_backup_20250803"."actual_stat",
    "final_picks_backup_20250803"."result",
    "final_picks_backup_20250803"."result_value",
    "final_picks_backup_20250803"."edge_score"
   FROM "public"."final_picks_backup_20250803"
  WHERE (("final_picks_backup_20250803"."result" IS NOT NULL) AND ("final_picks_backup_20250803"."actual_stat" IS NOT NULL) AND (((("final_picks_backup_20250803"."direction")::"text" = 'Over'::"text") AND ("final_picks_backup_20250803"."result" = 'Loss'::"text") AND ("final_picks_backup_20250803"."actual_stat" > "final_picks_backup_20250803"."line")) OR ((("final_picks_backup_20250803"."direction")::"text" = 'Under'::"text") AND ("final_picks_backup_20250803"."result" = 'Loss'::"text") AND ("final_picks_backup_20250803"."actual_stat" < "final_picks_backup_20250803"."line")) OR ((("final_picks_backup_20250803"."direction")::"text" = 'Over'::"text") AND ("final_picks_backup_20250803"."result" = 'Win'::"text") AND ("final_picks_backup_20250803"."actual_stat" < "final_picks_backup_20250803"."line")) OR ((("final_picks_backup_20250803"."direction")::"text" = 'Under'::"text") AND ("final_picks_backup_20250803"."result" = 'Win'::"text") AND ("final_picks_backup_20250803"."actual_stat" > "final_picks_backup_20250803"."line"))))
  ORDER BY "final_picks_backup_20250803"."game_date" DESC;


ALTER TABLE "public"."view_graded_vs_actual_errors" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_hedge_opportunities" AS
 SELECT "sub"."parlay_id",
    "sub"."capper",
    "sub"."legs_hit",
    "sub"."total_legs",
    "sub"."final_leg_player",
    "sub"."final_leg_stat",
    "sub"."final_leg_direction",
    "sub"."final_leg_line",
    "sub"."final_leg_odds",
    "sub"."stake",
    "sub"."payout"
   FROM ( SELECT "final_picks_backup_20250803"."parlay_id",
            "final_picks_backup_20250803"."capper",
            "count"(*) FILTER (WHERE ("final_picks_backup_20250803"."result" = 'Win'::"text")) AS "legs_hit",
            "count"(*) AS "total_legs",
            "max"(
                CASE
                    WHEN "final_picks_backup_20250803"."is_primary_leg" THEN "final_picks_backup_20250803"."player_name"
                    ELSE NULL::"text"
                END) AS "final_leg_player",
            "max"(
                CASE
                    WHEN "final_picks_backup_20250803"."is_primary_leg" THEN "final_picks_backup_20250803"."stat_type"
                    ELSE NULL::"text"
                END) AS "final_leg_stat",
            "max"((
                CASE
                    WHEN "final_picks_backup_20250803"."is_primary_leg" THEN "final_picks_backup_20250803"."direction"
                    ELSE NULL::character varying
                END)::"text") AS "final_leg_direction",
            "max"(
                CASE
                    WHEN "final_picks_backup_20250803"."is_primary_leg" THEN "final_picks_backup_20250803"."line"
                    ELSE NULL::numeric
                END) AS "final_leg_line",
            "max"(
                CASE
                    WHEN "final_picks_backup_20250803"."is_primary_leg" THEN "final_picks_backup_20250803"."odds"
                    ELSE NULL::integer
                END) AS "final_leg_odds",
            "sum"("final_picks_backup_20250803"."unit_size") AS "stake",
            "round"("sum"(("final_picks_backup_20250803"."unit_size" * ("final_picks_backup_20250803"."odds")::numeric)), 2) AS "payout"
           FROM "public"."final_picks_backup_20250803"
          WHERE (("final_picks_backup_20250803"."ticket_type" = 'Parlay'::"text") AND ("final_picks_backup_20250803"."game_date" = CURRENT_DATE) AND ("final_picks_backup_20250803"."parlay_id" IS NOT NULL))
          GROUP BY "final_picks_backup_20250803"."parlay_id", "final_picks_backup_20250803"."capper") "sub"
  WHERE ("sub"."legs_hit" = ("sub"."total_legs" - 1));


ALTER TABLE "public"."view_hedge_opportunities" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_injury_alert_queue" AS
 SELECT "final_picks_backup_20250803"."id",
    "final_picks_backup_20250803"."player_name",
    "final_picks_backup_20250803"."stat_type",
    "final_picks_backup_20250803"."direction",
    "final_picks_backup_20250803"."context_flag",
    "final_picks_backup_20250803"."injury_flag",
    "final_picks_backup_20250803"."was_impacted_by_injury",
    "final_picks_backup_20250803"."game_date",
    "final_picks_backup_20250803"."capper"
   FROM "public"."final_picks_backup_20250803"
  WHERE ((("final_picks_backup_20250803"."context_flag" = true) OR ("final_picks_backup_20250803"."injury_flag" = true)) AND ("final_picks_backup_20250803"."result" IS NULL))
  ORDER BY "final_picks_backup_20250803"."game_date" DESC;


ALTER TABLE "public"."view_injury_alert_queue" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_line_movement_flags" AS
 SELECT "final_picks_backup_20250803"."id",
    "final_picks_backup_20250803"."player_name",
    "final_picks_backup_20250803"."stat_type",
    "final_picks_backup_20250803"."direction",
    "final_picks_backup_20250803"."initial_line",
    "final_picks_backup_20250803"."current_line",
    "abs"(("final_picks_backup_20250803"."current_line" - "final_picks_backup_20250803"."initial_line")) AS "line_delta",
        CASE
            WHEN ("final_picks_backup_20250803"."current_line" > "final_picks_backup_20250803"."initial_line") THEN '↑'::"text"
            WHEN ("final_picks_backup_20250803"."current_line" < "final_picks_backup_20250803"."initial_line") THEN '↓'::"text"
            ELSE '='::"text"
        END AS "line_move_direction",
        CASE
            WHEN ("abs"(("final_picks_backup_20250803"."current_line" - "final_picks_backup_20250803"."initial_line")) >= 1.0) THEN 'Major'::"text"
            WHEN ("abs"(("final_picks_backup_20250803"."current_line" - "final_picks_backup_20250803"."initial_line")) >= 0.5) THEN 'Moderate'::"text"
            WHEN ("abs"(("final_picks_backup_20250803"."current_line" - "final_picks_backup_20250803"."initial_line")) > (0)::numeric) THEN 'Minor'::"text"
            ELSE 'None'::"text"
        END AS "move_category",
    "final_picks_backup_20250803"."line_moved",
    "final_picks_backup_20250803"."odds_moved",
    "final_picks_backup_20250803"."movement_trigger",
    "final_picks_backup_20250803"."suppress_alert",
    "final_picks_backup_20250803"."game_date",
    "final_picks_backup_20250803"."capper"
   FROM "public"."final_picks_backup_20250803"
  WHERE (("final_picks_backup_20250803"."line_moved" = true) AND ("final_picks_backup_20250803"."result" IS NULL) AND ("final_picks_backup_20250803"."suppress_alert" = false))
  ORDER BY "final_picks_backup_20250803"."game_date" DESC;


ALTER TABLE "public"."view_line_movement_flags" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_manual_override_needed" AS
 SELECT "final_picks_backup_20250803"."id",
    "final_picks_backup_20250803"."player_name",
    "final_picks_backup_20250803"."stat_type",
    "final_picks_backup_20250803"."direction",
    "final_picks_backup_20250803"."line",
    "final_picks_backup_20250803"."unit_size",
    "final_picks_backup_20250803"."capper",
    "final_picks_backup_20250803"."game_date",
    "final_picks_backup_20250803"."context_flag",
    "final_picks_backup_20250803"."steam_flag",
    "final_picks_backup_20250803"."injury_flag"
   FROM "public"."final_picks_backup_20250803"
  WHERE ((("final_picks_backup_20250803"."context_flag" = true) OR ("final_picks_backup_20250803"."steam_flag" = true) OR ("final_picks_backup_20250803"."injury_flag" = true)) AND ("final_picks_backup_20250803"."result" IS NULL) AND ("final_picks_backup_20250803"."approved_by" IS NULL))
  ORDER BY "final_picks_backup_20250803"."game_date" DESC;


ALTER TABLE "public"."view_manual_override_needed" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_missed_predictions" AS
 SELECT "final_picks_backup_20250803"."id",
    "final_picks_backup_20250803"."capper",
    "final_picks_backup_20250803"."player_name",
    "final_picks_backup_20250803"."stat_type",
    "final_picks_backup_20250803"."direction",
    "final_picks_backup_20250803"."line",
    "final_picks_backup_20250803"."actual_stat",
    "final_picks_backup_20250803"."edge_score",
    "final_picks_backup_20250803"."result",
    "final_picks_backup_20250803"."result_value"
   FROM "public"."final_picks_backup_20250803"
  WHERE (("final_picks_backup_20250803"."result" = 'Loss'::"text") AND ("final_picks_backup_20250803"."edge_score" >= 20))
  ORDER BY "final_picks_backup_20250803"."game_date" DESC;


ALTER TABLE "public"."view_missed_predictions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_monthly_cappers" AS
 SELECT "final_picks_backup_20250803"."capper",
    "date_trunc"('month'::"text", ("final_picks_backup_20250803"."game_date")::timestamp with time zone) AS "month",
    "count"(*) AS "total",
    "sum"(
        CASE
            WHEN ("final_picks_backup_20250803"."result" = 'Win'::"text") THEN 1
            ELSE 0
        END) AS "wins",
    "round"("sum"("final_picks_backup_20250803"."unit_size"), 2) AS "units_risked",
    "round"("sum"("final_picks_backup_20250803"."result_value"), 2) AS "units_won",
    "round"((((100)::numeric * "sum"("final_picks_backup_20250803"."result_value")) / NULLIF("sum"("final_picks_backup_20250803"."unit_size"), (0)::numeric)), 2) AS "roi_percent"
   FROM "public"."final_picks_backup_20250803"
  GROUP BY "final_picks_backup_20250803"."capper", ("date_trunc"('month'::"text", ("final_picks_backup_20250803"."game_date")::timestamp with time zone))
  ORDER BY ("date_trunc"('month'::"text", ("final_picks_backup_20250803"."game_date")::timestamp with time zone)) DESC, ("round"((((100)::numeric * "sum"("final_picks_backup_20250803"."result_value")) / NULLIF("sum"("final_picks_backup_20250803"."unit_size"), (0)::numeric)), 2)) DESC;


ALTER TABLE "public"."view_monthly_cappers" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_parlay_tickets" AS
 SELECT "daily_picks_backup_20250803"."parlay_id",
    "count"(*) AS "leg_count",
    "sum"("daily_picks_backup_20250803"."units") AS "total_units",
    "min"("daily_picks_backup_20250803"."created_at") AS "created_at"
   FROM "public"."daily_picks_backup_20250803"
  WHERE ("daily_picks_backup_20250803"."parlay_id" IS NOT NULL)
  GROUP BY "daily_picks_backup_20250803"."parlay_id";


ALTER TABLE "public"."view_parlay_tickets" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_pending_grades" AS
 SELECT "final_picks_backup_20250803"."id",
    "final_picks_backup_20250803"."capper",
    "final_picks_backup_20250803"."player_name",
    "final_picks_backup_20250803"."stat_type",
    "final_picks_backup_20250803"."direction",
    "final_picks_backup_20250803"."line",
    "final_picks_backup_20250803"."actual_stat",
    "final_picks_backup_20250803"."result",
    "final_picks_backup_20250803"."result_value",
    "final_picks_backup_20250803"."edge_score",
    "final_picks_backup_20250803"."unit_size",
    "final_picks_backup_20250803"."game_date"
   FROM "public"."final_picks_backup_20250803"
  WHERE (("final_picks_backup_20250803"."result" IS NULL) AND ("final_picks_backup_20250803"."graded" = false))
  ORDER BY "final_picks_backup_20250803"."game_date" DESC;


ALTER TABLE "public"."view_pending_grades" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_pick_conflict_flags" AS
 SELECT "fp1"."id" AS "id_1",
    "fp2"."id" AS "id_2",
    "fp1"."player_name",
    "fp1"."direction" AS "direction_1",
    "fp2"."direction" AS "direction_2",
    "fp1"."game_date",
    "fp1"."capper" AS "capper_1",
    "fp2"."capper" AS "capper_2"
   FROM ("public"."final_picks_backup_20250803" "fp1"
     JOIN "public"."final_picks_backup_20250803" "fp2" ON ((("fp1"."player_name" = "fp2"."player_name") AND ("fp1"."game_date" = "fp2"."game_date") AND ("fp1"."id" <> "fp2"."id"))))
  WHERE (("fp1"."result" IS NULL) AND ("fp2"."result" IS NULL) AND (("fp1"."direction")::"text" <> ("fp2"."direction")::"text"))
  ORDER BY "fp1"."game_date" DESC;


ALTER TABLE "public"."view_pick_conflict_flags" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_pick_lifecycle_tracker" AS
 SELECT "fp"."id" AS "final_pick_id",
    "fp"."player_name",
    "fp"."stat_type",
    "fp"."direction",
    "fp"."game_date",
    "fp"."created_at" AS "final_created_at",
    "fp"."posted_to_discord",
    "fp"."graded",
    "fp"."result",
    "dp"."id" AS "daily_pick_id",
    "dp"."created_at" AS "daily_created_at",
    "rp"."id" AS "raw_prop_id",
    "rp"."created_at" AS "raw_created_at"
   FROM (("public"."final_picks_backup_20250803" "fp"
     LEFT JOIN "public"."daily_picks_backup_20250803" "dp" ON ((("fp"."player_name" = "dp"."player_name") AND ("fp"."stat_type" = "dp"."stat_type") AND ("fp"."game_date" = "dp"."game_date"))))
     LEFT JOIN "public"."raw_props" "rp" ON ((("fp"."player_name" = "rp"."player_name") AND ("fp"."stat_type" = "rp"."stat_type") AND ("fp"."game_date" = "rp"."game_date"))));


ALTER TABLE "public"."view_pick_lifecycle_tracker" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_player_stats" AS
 SELECT "final_picks_backup_20250803"."player_name",
    "final_picks_backup_20250803"."sport",
    "count"(*) AS "total_picks",
    "sum"(
        CASE
            WHEN ("final_picks_backup_20250803"."final_result" = 'Win'::"text") THEN 1
            ELSE 0
        END) AS "wins",
    "sum"(
        CASE
            WHEN ("final_picks_backup_20250803"."final_result" = 'Loss'::"text") THEN 1
            ELSE 0
        END) AS "losses",
    "sum"(
        CASE
            WHEN ("final_picks_backup_20250803"."final_result" = 'Push'::"text") THEN 1
            ELSE 0
        END) AS "pushes",
    "sum"("final_picks_backup_20250803"."result_value") AS "net_units",
    "round"("avg"("final_picks_backup_20250803"."edge_score"), 2) AS "avg_edge_score",
    "round"(((100.0 * ("sum"(
        CASE
            WHEN ("final_picks_backup_20250803"."final_result" = 'Win'::"text") THEN 1
            ELSE 0
        END))::numeric) / (NULLIF("count"(*), 0))::numeric), 1) AS "win_pct",
    "min"("final_picks_backup_20250803"."game_date") AS "first_appearance",
    "max"("final_picks_backup_20250803"."game_date") AS "last_appearance"
   FROM "public"."final_picks_backup_20250803"
  WHERE ("final_picks_backup_20250803"."play_status" = 'Graded'::"text")
  GROUP BY "final_picks_backup_20250803"."player_name", "final_picks_backup_20250803"."sport"
  ORDER BY ("sum"("final_picks_backup_20250803"."result_value")) DESC;


ALTER TABLE "public"."view_player_stats" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_postable_final_picks" AS
 SELECT "final_picks_backup_20250803"."id",
    "final_picks_backup_20250803"."player_name",
    "final_picks_backup_20250803"."sport",
    "final_picks_backup_20250803"."team",
    "final_picks_backup_20250803"."stat_type",
    "final_picks_backup_20250803"."outcome",
    "final_picks_backup_20250803"."line",
    "final_picks_backup_20250803"."odds",
    "final_picks_backup_20250803"."game_date",
    "final_picks_backup_20250803"."matchup",
    "final_picks_backup_20250803"."capper",
    "final_picks_backup_20250803"."unit_size",
    "final_picks_backup_20250803"."play_tag",
    "final_picks_backup_20250803"."parlay_id",
    "final_picks_backup_20250803"."is_primary_leg",
    "final_picks_backup_20250803"."edge_score",
    "final_picks_backup_20250803"."tier_tag",
    "final_picks_backup_20250803"."photo_url",
    "final_picks_backup_20250803"."play_status",
    "final_picks_backup_20250803"."actual_stat",
    "final_picks_backup_20250803"."final_result",
    "final_picks_backup_20250803"."result_value",
    "final_picks_backup_20250803"."context_flag",
    "final_picks_backup_20250803"."steam_flag",
    "final_picks_backup_20250803"."recap_posted",
    "final_picks_backup_20250803"."approved_by",
    "final_picks_backup_20250803"."discord_post_id",
    "final_picks_backup_20250803"."created_at",
    "final_picks_backup_20250803"."has_alert",
    "final_picks_backup_20250803"."alert_type",
    "final_picks_backup_20250803"."posted_to_discord",
    "final_picks_backup_20250803"."tier"
   FROM "public"."final_picks_backup_20250803"
  WHERE (("final_picks_backup_20250803"."posted_to_discord" = false) AND ("final_picks_backup_20250803"."tier" = ANY (ARRAY['S'::"text", 'S+'::"text", 'A+'::"text"])) AND ("final_picks_backup_20250803"."has_alert" = false));


ALTER TABLE "public"."view_postable_final_picks" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_recap_summaries" AS
 SELECT CURRENT_DATE AS "summary_date",
    "count"(*) AS "total",
    "round"("sum"("final_picks_backup_20250803"."result_value"), 2) AS "units_won",
    "round"("sum"("final_picks_backup_20250803"."unit_size"), 2) AS "units_risked",
    "round"(((100.0 * ("sum"(
        CASE
            WHEN ("final_picks_backup_20250803"."result" = 'Win'::"text") THEN 1
            ELSE 0
        END))::numeric) / (NULLIF("count"(*), 0))::numeric), 1) AS "win_pct",
    "round"((((100)::numeric * "sum"("final_picks_backup_20250803"."result_value")) / NULLIF("sum"("final_picks_backup_20250803"."unit_size"), (0)::numeric)), 2) AS "roi_percent"
   FROM "public"."final_picks_backup_20250803"
  WHERE ("final_picks_backup_20250803"."game_date" = CURRENT_DATE);


ALTER TABLE "public"."view_recap_summaries" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_result_distribution" AS
 SELECT "final_picks_backup_20250803"."stat_type",
    "count"(*) FILTER (WHERE ("final_picks_backup_20250803"."result" = 'Win'::"text")) AS "wins",
    "count"(*) FILTER (WHERE ("final_picks_backup_20250803"."result" = 'Loss'::"text")) AS "losses",
    "count"(*) FILTER (WHERE ("final_picks_backup_20250803"."result" = 'Push'::"text")) AS "pushes",
    "count"(*) AS "total"
   FROM "public"."final_picks_backup_20250803"
  WHERE ("final_picks_backup_20250803"."result" IS NOT NULL)
  GROUP BY "final_picks_backup_20250803"."stat_type"
  ORDER BY ("count"(*)) DESC;


ALTER TABLE "public"."view_result_distribution" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_roi_by_ticket_type" AS
 SELECT "final_picks_backup_20250803"."ticket_type",
    "count"(*) AS "total",
    "round"("sum"("final_picks_backup_20250803"."result_value"), 2) AS "units_won",
    "round"("sum"("final_picks_backup_20250803"."unit_size"), 2) AS "units_risked",
    "round"((((100)::numeric * "sum"("final_picks_backup_20250803"."result_value")) / NULLIF("sum"("final_picks_backup_20250803"."unit_size"), (0)::numeric)), 2) AS "roi_percent",
    "round"(((100.0 * ("sum"(
        CASE
            WHEN ("final_picks_backup_20250803"."result" = 'Win'::"text") THEN 1
            ELSE 0
        END))::numeric) / (NULLIF("count"(*), 0))::numeric), 1) AS "win_pct"
   FROM "public"."final_picks_backup_20250803"
  GROUP BY "final_picks_backup_20250803"."ticket_type"
  ORDER BY ("round"((((100)::numeric * "sum"("final_picks_backup_20250803"."result_value")) / NULLIF("sum"("final_picks_backup_20250803"."unit_size"), (0)::numeric)), 2)) DESC;


ALTER TABLE "public"."view_roi_by_ticket_type" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_roi_by_tier" AS
 SELECT "left"("final_picks_backup_20250803"."tier", 1) AS "tier_group",
    "count"(*) AS "total",
    "round"("sum"("final_picks_backup_20250803"."result_value"), 2) AS "units_won",
    "round"("sum"("final_picks_backup_20250803"."unit_size"), 2) AS "units_risked",
    "round"((((100)::numeric * "sum"("final_picks_backup_20250803"."result_value")) / NULLIF("sum"("final_picks_backup_20250803"."unit_size"), (0)::numeric)), 2) AS "roi_percent",
    "round"(((100.0 * ("sum"(
        CASE
            WHEN ("final_picks_backup_20250803"."result" = 'Win'::"text") THEN 1
            ELSE 0
        END))::numeric) / (NULLIF("count"(*), 0))::numeric), 1) AS "win_pct"
   FROM "public"."final_picks_backup_20250803"
  GROUP BY ("left"("final_picks_backup_20250803"."tier", 1))
  ORDER BY ("round"((((100)::numeric * "sum"("final_picks_backup_20250803"."result_value")) / NULLIF("sum"("final_picks_backup_20250803"."unit_size"), (0)::numeric)), 2)) DESC;


ALTER TABLE "public"."view_roi_by_tier" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_rr_tickets" AS
 SELECT "daily_picks_backup_20250803"."rr_ticket_id",
    "count"(*) AS "leg_count",
    "sum"("daily_picks_backup_20250803"."units") AS "total_units",
    "min"("daily_picks_backup_20250803"."created_at") AS "created_at"
   FROM "public"."daily_picks_backup_20250803"
  WHERE ("daily_picks_backup_20250803"."rr_ticket_id" IS NOT NULL)
  GROUP BY "daily_picks_backup_20250803"."rr_ticket_id";


ALTER TABLE "public"."view_rr_tickets" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_scored_raw_props" AS
 SELECT "rp"."id",
    "rp"."player_name",
    "rp"."sport",
    "rp"."team",
    "rp"."stat_type",
    "rp"."outcome",
    "rp"."line",
    "rp"."odds",
    "rp"."fair_odds",
    "rp"."market_type",
    "rp"."context_flag",
    "rp"."created_at",
    "rp"."source",
    "rp"."game_id",
    "rp"."external_game_id",
    "rp"."bet_type",
    "rp"."matchup",
    "rp"."promoted_to_picks",
    3 AS "trend_confidence",
    3 AS "matchup_quality",
        CASE
            WHEN (("rp"."fair_odds" IS NULL) OR ("rp"."odds" IS NULL)) THEN 3
            WHEN ("abs"((("rp"."fair_odds")::integer - "rp"."odds")) >= 30) THEN 5
            WHEN ("abs"((("rp"."fair_odds")::integer - "rp"."odds")) >= 20) THEN 4
            WHEN ("abs"((("rp"."fair_odds")::integer - "rp"."odds")) >= 10) THEN 3
            ELSE 2
        END AS "line_value_score",
        CASE
            WHEN ("rp"."odds" <= '-150'::integer) THEN 5
            WHEN (("rp"."odds" >= '-149'::integer) AND ("rp"."odds" <= '-120'::integer)) THEN 4
            WHEN (("rp"."odds" >= '-119'::integer) AND ("rp"."odds" <= '-105'::integer)) THEN 3
            WHEN (("rp"."odds" >= '-104'::integer) AND ("rp"."odds" <= 120)) THEN 2
            ELSE 1
        END AS "confidence_score",
        CASE
            WHEN ("rp"."context_flag" IS TRUE) THEN 3
            ELSE 5
        END AS "role_stability",
    ((((3 + 3) +
        CASE
            WHEN (("rp"."fair_odds" IS NULL) OR ("rp"."odds" IS NULL)) THEN 3
            WHEN ("abs"((("rp"."fair_odds")::integer - "rp"."odds")) >= 30) THEN 5
            WHEN ("abs"((("rp"."fair_odds")::integer - "rp"."odds")) >= 20) THEN 4
            WHEN ("abs"((("rp"."fair_odds")::integer - "rp"."odds")) >= 10) THEN 3
            ELSE 2
        END) +
        CASE
            WHEN ("rp"."odds" <= '-150'::integer) THEN 5
            WHEN (("rp"."odds" >= '-149'::integer) AND ("rp"."odds" <= '-120'::integer)) THEN 4
            WHEN (("rp"."odds" >= '-119'::integer) AND ("rp"."odds" <= '-105'::integer)) THEN 3
            WHEN (("rp"."odds" >= '-104'::integer) AND ("rp"."odds" <= 120)) THEN 2
            ELSE 1
        END) +
        CASE
            WHEN ("rp"."context_flag" IS TRUE) THEN 3
            ELSE 5
        END) AS "edge_score",
        CASE
            WHEN (((((3 + 3) +
            CASE
                WHEN (("rp"."fair_odds" IS NULL) OR ("rp"."odds" IS NULL)) THEN 3
                WHEN ("abs"((("rp"."fair_odds")::integer - "rp"."odds")) >= 30) THEN 5
                WHEN ("abs"((("rp"."fair_odds")::integer - "rp"."odds")) >= 20) THEN 4
                WHEN ("abs"((("rp"."fair_odds")::integer - "rp"."odds")) >= 10) THEN 3
                ELSE 2
            END) +
            CASE
                WHEN ("rp"."odds" <= '-150'::integer) THEN 5
                WHEN (("rp"."odds" >= '-149'::integer) AND ("rp"."odds" <= '-120'::integer)) THEN 4
                WHEN (("rp"."odds" >= '-119'::integer) AND ("rp"."odds" <= '-105'::integer)) THEN 3
                WHEN (("rp"."odds" >= '-104'::integer) AND ("rp"."odds" <= 120)) THEN 2
                ELSE 1
            END) +
            CASE
                WHEN ("rp"."context_flag" IS TRUE) THEN 3
                ELSE 5
            END) >= 23) THEN 'S+'::"text"
            WHEN (((((3 + 3) +
            CASE
                WHEN (("rp"."fair_odds" IS NULL) OR ("rp"."odds" IS NULL)) THEN 3
                WHEN ("abs"((("rp"."fair_odds")::integer - "rp"."odds")) >= 30) THEN 5
                WHEN ("abs"((("rp"."fair_odds")::integer - "rp"."odds")) >= 20) THEN 4
                WHEN ("abs"((("rp"."fair_odds")::integer - "rp"."odds")) >= 10) THEN 3
                ELSE 2
            END) +
            CASE
                WHEN ("rp"."odds" <= '-150'::integer) THEN 5
                WHEN (("rp"."odds" >= '-149'::integer) AND ("rp"."odds" <= '-120'::integer)) THEN 4
                WHEN (("rp"."odds" >= '-119'::integer) AND ("rp"."odds" <= '-105'::integer)) THEN 3
                WHEN (("rp"."odds" >= '-104'::integer) AND ("rp"."odds" <= 120)) THEN 2
                ELSE 1
            END) +
            CASE
                WHEN ("rp"."context_flag" IS TRUE) THEN 3
                ELSE 5
            END) >= 20) THEN 'S'::"text"
            WHEN (((((3 + 3) +
            CASE
                WHEN (("rp"."fair_odds" IS NULL) OR ("rp"."odds" IS NULL)) THEN 3
                WHEN ("abs"((("rp"."fair_odds")::integer - "rp"."odds")) >= 30) THEN 5
                WHEN ("abs"((("rp"."fair_odds")::integer - "rp"."odds")) >= 20) THEN 4
                WHEN ("abs"((("rp"."fair_odds")::integer - "rp"."odds")) >= 10) THEN 3
                ELSE 2
            END) +
            CASE
                WHEN ("rp"."odds" <= '-150'::integer) THEN 5
                WHEN (("rp"."odds" >= '-149'::integer) AND ("rp"."odds" <= '-120'::integer)) THEN 4
                WHEN (("rp"."odds" >= '-119'::integer) AND ("rp"."odds" <= '-105'::integer)) THEN 3
                WHEN (("rp"."odds" >= '-104'::integer) AND ("rp"."odds" <= 120)) THEN 2
                ELSE 1
            END) +
            CASE
                WHEN ("rp"."context_flag" IS TRUE) THEN 3
                ELSE 5
            END) >= 17) THEN 'A+'::"text"
            WHEN (((((3 + 3) +
            CASE
                WHEN (("rp"."fair_odds" IS NULL) OR ("rp"."odds" IS NULL)) THEN 3
                WHEN ("abs"((("rp"."fair_odds")::integer - "rp"."odds")) >= 30) THEN 5
                WHEN ("abs"((("rp"."fair_odds")::integer - "rp"."odds")) >= 20) THEN 4
                WHEN ("abs"((("rp"."fair_odds")::integer - "rp"."odds")) >= 10) THEN 3
                ELSE 2
            END) +
            CASE
                WHEN ("rp"."odds" <= '-150'::integer) THEN 5
                WHEN (("rp"."odds" >= '-149'::integer) AND ("rp"."odds" <= '-120'::integer)) THEN 4
                WHEN (("rp"."odds" >= '-119'::integer) AND ("rp"."odds" <= '-105'::integer)) THEN 3
                WHEN (("rp"."odds" >= '-104'::integer) AND ("rp"."odds" <= 120)) THEN 2
                ELSE 1
            END) +
            CASE
                WHEN ("rp"."context_flag" IS TRUE) THEN 3
                ELSE 5
            END) >= 15) THEN 'A'::"text"
            WHEN (((((3 + 3) +
            CASE
                WHEN (("rp"."fair_odds" IS NULL) OR ("rp"."odds" IS NULL)) THEN 3
                WHEN ("abs"((("rp"."fair_odds")::integer - "rp"."odds")) >= 30) THEN 5
                WHEN ("abs"((("rp"."fair_odds")::integer - "rp"."odds")) >= 20) THEN 4
                WHEN ("abs"((("rp"."fair_odds")::integer - "rp"."odds")) >= 10) THEN 3
                ELSE 2
            END) +
            CASE
                WHEN ("rp"."odds" <= '-150'::integer) THEN 5
                WHEN (("rp"."odds" >= '-149'::integer) AND ("rp"."odds" <= '-120'::integer)) THEN 4
                WHEN (("rp"."odds" >= '-119'::integer) AND ("rp"."odds" <= '-105'::integer)) THEN 3
                WHEN (("rp"."odds" >= '-104'::integer) AND ("rp"."odds" <= 120)) THEN 2
                ELSE 1
            END) +
            CASE
                WHEN ("rp"."context_flag" IS TRUE) THEN 3
                ELSE 5
            END) >= 10) THEN 'B'::"text"
            ELSE 'C'::"text"
        END AS "tier_tag",
        CASE
            WHEN (((((3 + 3) +
            CASE
                WHEN (("rp"."fair_odds" IS NULL) OR ("rp"."odds" IS NULL)) THEN 3
                WHEN ("abs"((("rp"."fair_odds")::integer - "rp"."odds")) >= 30) THEN 5
                WHEN ("abs"((("rp"."fair_odds")::integer - "rp"."odds")) >= 20) THEN 4
                WHEN ("abs"((("rp"."fair_odds")::integer - "rp"."odds")) >= 10) THEN 3
                ELSE 2
            END) +
            CASE
                WHEN ("rp"."odds" <= '-150'::integer) THEN 5
                WHEN (("rp"."odds" >= '-149'::integer) AND ("rp"."odds" <= '-120'::integer)) THEN 4
                WHEN (("rp"."odds" >= '-119'::integer) AND ("rp"."odds" <= '-105'::integer)) THEN 3
                WHEN (("rp"."odds" >= '-104'::integer) AND ("rp"."odds" <= 120)) THEN 2
                ELSE 1
            END) +
            CASE
                WHEN ("rp"."context_flag" IS TRUE) THEN 3
                ELSE 5
            END) >= 17) THEN true
            ELSE false
        END AS "auto_approved"
   FROM "public"."raw_props" "rp";


ALTER TABLE "public"."view_scored_raw_props" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_stat_grading_summary" AS
 SELECT "final_picks_backup_20250803"."stat_type",
    "round"("avg"("final_picks_backup_20250803"."edge_score"), 2) AS "avg_edge",
    "round"("sum"("final_picks_backup_20250803"."result_value"), 2) AS "units_won",
    "round"("sum"("final_picks_backup_20250803"."unit_size"), 2) AS "units_risked",
    "round"((((100)::numeric * "sum"("final_picks_backup_20250803"."result_value")) / NULLIF("sum"("final_picks_backup_20250803"."unit_size"), (0)::numeric)), 2) AS "roi_percent",
    "count"(*) AS "total"
   FROM "public"."final_picks_backup_20250803"
  WHERE ("final_picks_backup_20250803"."result" IS NOT NULL)
  GROUP BY "final_picks_backup_20250803"."stat_type"
  ORDER BY ("round"((((100)::numeric * "sum"("final_picks_backup_20250803"."result_value")) / NULLIF("sum"("final_picks_backup_20250803"."unit_size"), (0)::numeric)), 2)) DESC;


ALTER TABLE "public"."view_stat_grading_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_steam_moves_today" AS
 SELECT "final_picks_backup_20250803"."id",
    "final_picks_backup_20250803"."player_name",
    "final_picks_backup_20250803"."stat_type",
    "final_picks_backup_20250803"."direction",
    "final_picks_backup_20250803"."initial_odds",
    "final_picks_backup_20250803"."current_odds",
    "final_picks_backup_20250803"."odds_moved",
    "final_picks_backup_20250803"."movement_trigger",
    "final_picks_backup_20250803"."game_date",
    "final_picks_backup_20250803"."capper"
   FROM "public"."final_picks_backup_20250803"
  WHERE (("final_picks_backup_20250803"."odds_moved" = true) AND ("final_picks_backup_20250803"."game_date" = CURRENT_DATE))
  ORDER BY ("abs"(("final_picks_backup_20250803"."current_odds" - "final_picks_backup_20250803"."initial_odds"))) DESC;


ALTER TABLE "public"."view_steam_moves_today" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_tier_distribution" AS
 SELECT "final_picks_backup_20250803"."game_date" AS "day",
    "left"("final_picks_backup_20250803"."tier", 1) AS "tier_group",
    "count"(*) AS "count"
   FROM "public"."final_picks_backup_20250803"
  GROUP BY "final_picks_backup_20250803"."game_date", ("left"("final_picks_backup_20250803"."tier", 1))
  ORDER BY "final_picks_backup_20250803"."game_date" DESC, ("left"("final_picks_backup_20250803"."tier", 1));


ALTER TABLE "public"."view_tier_distribution" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_tier_result_distribution" AS
 SELECT "left"("final_picks_backup_20250803"."tier", 1) AS "tier_group",
    "count"(*) FILTER (WHERE ("final_picks_backup_20250803"."result" = 'Win'::"text")) AS "wins",
    "count"(*) FILTER (WHERE ("final_picks_backup_20250803"."result" = 'Loss'::"text")) AS "losses",
    "count"(*) FILTER (WHERE ("final_picks_backup_20250803"."result" = 'Push'::"text")) AS "pushes",
    "count"(*) AS "total",
    "round"(((100.0 * ("count"(*) FILTER (WHERE ("final_picks_backup_20250803"."result" = 'Win'::"text")))::numeric) / (NULLIF("count"(*), 0))::numeric), 1) AS "win_pct"
   FROM "public"."final_picks_backup_20250803"
  WHERE ("final_picks_backup_20250803"."result" IS NOT NULL)
  GROUP BY ("left"("final_picks_backup_20250803"."tier", 1))
  ORDER BY ("left"("final_picks_backup_20250803"."tier", 1));


ALTER TABLE "public"."view_tier_result_distribution" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_top_streaks" AS
 WITH "win_rows" AS (
         SELECT "final_picks_backup_20250803"."capper",
            "final_picks_backup_20250803"."game_date",
            "row_number"() OVER (PARTITION BY "final_picks_backup_20250803"."capper" ORDER BY "final_picks_backup_20250803"."game_date") AS "rn"
           FROM "public"."final_picks_backup_20250803"
          WHERE (("final_picks_backup_20250803"."result" = 'Win'::"text") AND ("final_picks_backup_20250803"."game_date" > (CURRENT_DATE - '30 days'::interval)))
        ), "streaks" AS (
         SELECT "win_rows"."capper",
            "win_rows"."game_date",
            "win_rows"."rn",
            ("win_rows"."game_date" - (("win_rows"."rn" || ' days'::"text"))::interval) AS "streak_group"
           FROM "win_rows"
        ), "grouped" AS (
         SELECT "streaks"."capper",
            "min"("streaks"."game_date") AS "start_date",
            "max"("streaks"."game_date") AS "end_date",
            "count"(*) AS "win_streak"
           FROM "streaks"
          GROUP BY "streaks"."capper", "streaks"."streak_group"
        )
 SELECT "grouped"."capper",
    "grouped"."start_date",
    "grouped"."end_date",
    "grouped"."win_streak"
   FROM "grouped"
  ORDER BY "grouped"."win_streak" DESC
 LIMIT 10;


ALTER TABLE "public"."view_top_streaks" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_ungraded_but_has_result" AS
 SELECT "final_picks_backup_20250803"."id",
    "final_picks_backup_20250803"."player_name",
    "final_picks_backup_20250803"."stat_type",
    "final_picks_backup_20250803"."direction",
    "final_picks_backup_20250803"."result",
    "final_picks_backup_20250803"."result_value",
    "final_picks_backup_20250803"."graded",
    "final_picks_backup_20250803"."game_date"
   FROM "public"."final_picks_backup_20250803"
  WHERE (("final_picks_backup_20250803"."result" IS NOT NULL) AND ("final_picks_backup_20250803"."graded" = false))
  ORDER BY "final_picks_backup_20250803"."game_date" DESC;


ALTER TABLE "public"."view_ungraded_but_has_result" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_unposted_final_picks" AS
 SELECT "final_picks_backup_20250803"."id",
    "final_picks_backup_20250803"."player_name",
    "final_picks_backup_20250803"."stat_type",
    "final_picks_backup_20250803"."direction",
    "final_picks_backup_20250803"."line",
    "final_picks_backup_20250803"."odds",
    "final_picks_backup_20250803"."unit_size",
    "final_picks_backup_20250803"."game_date",
    "final_picks_backup_20250803"."capper"
   FROM "public"."final_picks_backup_20250803"
  WHERE (("final_picks_backup_20250803"."approved_by" IS NOT NULL) AND ("final_picks_backup_20250803"."posted_to_discord" = false) AND ("final_picks_backup_20250803"."result" IS NULL))
  ORDER BY "final_picks_backup_20250803"."game_date" DESC;


ALTER TABLE "public"."view_unposted_final_picks" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_valid_raw_props" AS
 SELECT "raw_props"."id",
    "raw_props"."player_name",
    "raw_props"."sport",
    "raw_props"."team",
    "raw_props"."stat_type",
    "raw_props"."outcome",
    "raw_props"."line",
    "raw_props"."odds",
    "raw_props"."game_date",
    "raw_props"."matchup",
    "raw_props"."trend_confidence",
    "raw_props"."matchup_quality",
    "raw_props"."line_value_score",
    "raw_props"."role_stability",
    "raw_props"."confidence_score",
    "raw_props"."edge_score",
    "raw_props"."tier_tag",
    "raw_props"."auto_approved",
    "raw_props"."context_flag",
    "raw_props"."created_at",
    "raw_props"."source",
    "raw_props"."promoted_to_picks",
    "raw_props"."game_id",
    "raw_props"."bet_type",
    "raw_props"."market_type",
    "raw_props"."outcomes",
    "raw_props"."player_id",
    "raw_props"."player_slug"
   FROM "public"."raw_props"
  WHERE (("raw_props"."player_name" IS NOT NULL) AND ("raw_props"."game_id" IS NOT NULL) AND ("raw_props"."stat_type" IS NOT NULL) AND ("raw_props"."outcome" IS NOT NULL) AND ("raw_props"."line" IS NOT NULL) AND ("raw_props"."odds" IS NOT NULL) AND ("raw_props"."market_type" IS NOT NULL) AND ("length"("raw_props"."player_name") > 2));


ALTER TABLE "public"."view_valid_raw_props" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_weekly_cappers" AS
 SELECT "final_picks_backup_20250803"."capper",
    "date_trunc"('week'::"text", ("final_picks_backup_20250803"."game_date")::timestamp with time zone) AS "week",
    "count"(*) AS "total",
    "sum"(
        CASE
            WHEN ("final_picks_backup_20250803"."result" = 'Win'::"text") THEN 1
            ELSE 0
        END) AS "wins",
    "round"("sum"("final_picks_backup_20250803"."unit_size"), 2) AS "units_risked",
    "round"("sum"("final_picks_backup_20250803"."result_value"), 2) AS "units_won",
    "round"((((100)::numeric * "sum"("final_picks_backup_20250803"."result_value")) / NULLIF("sum"("final_picks_backup_20250803"."unit_size"), (0)::numeric)), 2) AS "roi_percent"
   FROM "public"."final_picks_backup_20250803"
  GROUP BY "final_picks_backup_20250803"."capper", ("date_trunc"('week'::"text", ("final_picks_backup_20250803"."game_date")::timestamp with time zone))
  ORDER BY ("date_trunc"('week'::"text", ("final_picks_backup_20250803"."game_date")::timestamp with time zone)) DESC, ("round"((((100)::numeric * "sum"("final_picks_backup_20250803"."result_value")) / NULLIF("sum"("final_picks_backup_20250803"."unit_size"), (0)::numeric)), 2)) DESC;


ALTER TABLE "public"."view_weekly_cappers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."xwalk_games" (
    "provider" "text" NOT NULL,
    "external_game_id" "text" NOT NULL,
    "league" "text" NOT NULL,
    "league_game_id" "text" NOT NULL,
    "start_time" timestamp with time zone,
    "home_team" "text",
    "away_team" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."xwalk_games" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."xwalk_players" (
    "provider" "text" NOT NULL,
    "provider_player_id" "text" NOT NULL,
    "league" "text" NOT NULL,
    "league_player_id" "text" NOT NULL,
    "full_name" "text",
    "team" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."xwalk_players" OWNER TO "postgres";


ALTER TABLE ONLY "public"."prop_ticks_hot" ATTACH PARTITION "public"."prop_ticks_hot_p20250911" FOR VALUES FROM ('2025-09-11 00:00:00+00') TO ('2025-09-12 00:00:00+00');



ALTER TABLE ONLY "ops"."credit_usage" ALTER COLUMN "id" SET DEFAULT "nextval"('"ops"."credit_usage_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."_migrations" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."_migrations_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."historical_config" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."historical_config_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."line_snapshots" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."line_snapshots_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."outbox_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."outbox_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."pick_grades" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."pick_grades_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."picks" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."picks_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."result_sets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."result_sets_id_seq"'::"regclass");



ALTER TABLE ONLY "archive"."raw_props"
    ADD CONSTRAINT "raw_props_event_id_stat_type_player_name_source_key" UNIQUE ("event_id", "stat_type", "player_name", "source");



ALTER TABLE ONLY "archive"."raw_props"
    ADD CONSTRAINT "raw_props_external_game_id_player_name_stat_type_outcome_li_key" UNIQUE ("external_game_id", "player_name", "stat_type", "outcome", "line");



ALTER TABLE ONLY "archive"."raw_props"
    ADD CONSTRAINT "raw_props_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "archive"."raw_props"
    ADD CONSTRAINT "raw_props_player_id_stat_type_direction_external_game_id_bo_key" UNIQUE ("player_id", "stat_type", "direction", "external_game_id", "book");



ALTER TABLE ONLY "ops"."credit_usage"
    ADD CONSTRAINT "credit_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "Players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."_migrations"
    ADD CONSTRAINT "_migrations_filename_key" UNIQUE ("filename");



ALTER TABLE ONLY "public"."_migrations"
    ADD CONSTRAINT "_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_controls"
    ADD CONSTRAINT "agent_controls_pkey" PRIMARY KEY ("name");



ALTER TABLE ONLY "public"."agent_health"
    ADD CONSTRAINT "agent_health_agent_key" UNIQUE ("agent");



ALTER TABLE ONLY "public"."agent_health"
    ADD CONSTRAINT "agent_health_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_job_runs"
    ADD CONSTRAINT "agent_job_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_metrics"
    ADD CONSTRAINT "agent_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_tasks"
    ADD CONSTRAINT "agent_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_alerts_log"
    ADD CONSTRAINT "ai_alerts_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alerts_log"
    ADD CONSTRAINT "alerts_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_summary"
    ADD CONSTRAINT "analytics_summary_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."annotations"
    ADD CONSTRAINT "annotations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_quota_configs"
    ADD CONSTRAINT "api_quota_configs_pkey" PRIMARY KEY ("provider");



ALTER TABLE ONLY "public"."archived_props"
    ADD CONSTRAINT "archived_props_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."box_scores"
    ADD CONSTRAINT "box_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bridge_outbox"
    ADD CONSTRAINT "bridge_outbox_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."capper_channels"
    ADD CONSTRAINT "capper_channels_pkey" PRIMARY KEY ("capper_id");



ALTER TABLE ONLY "public"."cappers_backup_20250803"
    ADD CONSTRAINT "cappers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clv_tracking"
    ADD CONSTRAINT "clv_tracking_id_unique" UNIQUE ("clv_tracking_id");



ALTER TABLE ONLY "public"."clv_tracking"
    ADD CONSTRAINT "clv_tracking_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contest_participants"
    ADD CONSTRAINT "contest_participants_contest_id_user_id_key" UNIQUE ("contest_id", "user_id");



ALTER TABLE ONLY "public"."contest_participants"
    ADD CONSTRAINT "contest_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contests"
    ADD CONSTRAINT "contests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_picks_backup_20250803"
    ADD CONSTRAINT "daily_picks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dfs_ownership"
    ADD CONSTRAINT "dfs_ownership_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dfs_salaries"
    ADD CONSTRAINT "dfs_salaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."discord_channels"
    ADD CONSTRAINT "discord_channels_channel_id_key" UNIQUE ("channel_id");



ALTER TABLE ONLY "public"."discord_channels"
    ADD CONSTRAINT "discord_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."discord_messages"
    ADD CONSTRAINT "discord_messages_message_id_key" UNIQUE ("message_id");



ALTER TABLE ONLY "public"."discord_messages"
    ADD CONSTRAINT "discord_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ebooks"
    ADD CONSTRAINT "ebooks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."edge_config"
    ADD CONSTRAINT "edge_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."error_logs"
    ADD CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ev_modeling"
    ADD CONSTRAINT "ev_modeling_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exposure_snapshots"
    ADD CONSTRAINT "exposure_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_flag_name_key" UNIQUE ("flag_name");



ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."features_daily_agg"
    ADD CONSTRAINT "features_daily_agg_pkey" PRIMARY KEY ("dt", "league", "player_id", "market_id");



ALTER TABLE ONLY "public"."final_picks_backup_20250803"
    ADD CONSTRAINT "final_picks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."formations"
    ADD CONSTRAINT "formations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_event_id_key" UNIQUE ("event_id");



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_external_game_id_unique" UNIQUE ("external_game_id");



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_external_id_key" UNIQUE ("external_id");



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_game_id_key" UNIQUE ("game_id");



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_id_unique" UNIQUE ("id");



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_pkey" PRIMARY KEY ("game_id");



ALTER TABLE ONLY "public"."hedge_alert_log"
    ADD CONSTRAINT "hedge_alert_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historical_config"
    ADD CONSTRAINT "historical_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historical_player_logs"
    ADD CONSTRAINT "historical_player_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."idempotency_keys"
    ADD CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("tenant_id", "scope", "idem_key");



ALTER TABLE ONLY "public"."injury_alert_log"
    ADD CONSTRAINT "injury_alert_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leaderboards"
    ADD CONSTRAINT "leaderboards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leaderboards"
    ADD CONSTRAINT "leaderboards_user_id_period_metric_type_key" UNIQUE ("user_id", "period", "metric_type");



ALTER TABLE ONLY "public"."line_movement_log"
    ADD CONSTRAINT "line_movement_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."line_snapshots"
    ADD CONSTRAINT "line_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_config"
    ADD CONSTRAINT "onboarding_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outbox_events"
    ADD CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parlay_tickets"
    ADD CONSTRAINT "parlay_tickets_pkey" PRIMARY KEY ("ticket_id");



ALTER TABLE ONLY "public"."pick_grades"
    ADD CONSTRAINT "pick_grades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."picks_backup_20250803"
    ADD CONSTRAINT "picks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."picks"
    ADD CONSTRAINT "picks_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_injuries"
    ADD CONSTRAINT "player_injuries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_logs"
    ADD CONSTRAINT "player_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_stat_logs"
    ADD CONSTRAINT "player_stat_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plays"
    ADD CONSTRAINT "plays_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."processing_logs"
    ADD CONSTRAINT "processing_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prop_ticks_hot"
    ADD CONSTRAINT "prop_ticks_hot_pkey" PRIMARY KEY ("external_prop_id", "asof");



ALTER TABLE ONLY "public"."prop_ticks_hot_p20250911"
    ADD CONSTRAINT "prop_ticks_hot_p20250911_pkey" PRIMARY KEY ("external_prop_id", "asof");



ALTER TABLE ONLY "public"."raw_props_historical"
    ADD CONSTRAINT "raw_props_historical_event_id_stat_type_player_name_source_key" UNIQUE ("event_id", "stat_type", "player_name", "source");



ALTER TABLE ONLY "public"."raw_props_historical"
    ADD CONSTRAINT "raw_props_historical_external_game_id_player_name_stat_type_key" UNIQUE ("external_game_id", "player_name", "stat_type", "outcome", "line");



ALTER TABLE ONLY "public"."raw_props_historical"
    ADD CONSTRAINT "raw_props_historical_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."raw_props_historical"
    ADD CONSTRAINT "raw_props_historical_player_id_stat_type_direction_external_key" UNIQUE ("player_id", "stat_type", "direction", "external_game_id", "book");



ALTER TABLE ONLY "public"."raw_props_hot"
    ADD CONSTRAINT "raw_props_hot_external_prop_id_key" UNIQUE ("external_prop_id");



ALTER TABLE ONLY "public"."raw_props_hot"
    ADD CONSTRAINT "raw_props_hot_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."raw_props"
    ADD CONSTRAINT "raw_props_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."raw_props_recent"
    ADD CONSTRAINT "raw_props_recent_event_id_stat_type_player_name_source_key" UNIQUE ("event_id", "stat_type", "player_name", "source");



ALTER TABLE ONLY "public"."raw_props_recent"
    ADD CONSTRAINT "raw_props_recent_external_game_id_player_name_stat_type_out_key" UNIQUE ("external_game_id", "player_name", "stat_type", "outcome", "line");



ALTER TABLE ONLY "public"."raw_props_recent"
    ADD CONSTRAINT "raw_props_recent_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."raw_props_recent"
    ADD CONSTRAINT "raw_props_recent_player_id_stat_type_direction_external_gam_key" UNIQUE ("player_id", "stat_type", "direction", "external_game_id", "book");



ALTER TABLE ONLY "public"."raw_props"
    ADD CONSTRAINT "raw_props_unique" UNIQUE ("player_id", "stat_type", "direction", "external_game_id", "book");



ALTER TABLE ONLY "public"."raw_props"
    ADD CONSTRAINT "raw_props_unique_event_stat_player_book" UNIQUE ("event_id", "stat_type", "player_name", "source");



ALTER TABLE ONLY "public"."rbi_backfill_queue"
    ADD CONSTRAINT "rbi_backfill_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recap_log"
    ADD CONSTRAINT "recap_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recap_runs"
    ADD CONSTRAINT "recap_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recap_snapshots"
    ADD CONSTRAINT "recap_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referral_events"
    ADD CONSTRAINT "referral_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referral_rewards"
    ADD CONSTRAINT "referral_rewards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."result_sets"
    ADD CONSTRAINT "result_sets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."runtime_config"
    ADD CONSTRAINT "runtime_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."scoring_queue"
    ADD CONSTRAINT "scoring_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_events"
    ADD CONSTRAINT "security_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settlement_results"
    ADD CONSTRAINT "settlement_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settlement_results"
    ADD CONSTRAINT "settlement_results_raw_prop_id_key" UNIQUE ("raw_prop_id");



ALTER TABLE ONLY "public"."shadow_decisions"
    ADD CONSTRAINT "shadow_decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sports_game_odds"
    ADD CONSTRAINT "sports_game_odds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("tenant_id");



ALTER TABLE ONLY "public"."system_changelog"
    ADD CONSTRAINT "system_changelog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_config"
    ADD CONSTRAINT "system_config_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."system_config"
    ADD CONSTRAINT "system_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_incidents"
    ADD CONSTRAINT "system_incidents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_memberships"
    ADD CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("tenant_id", "user_id");



ALTER TABLE ONLY "public"."tenant_quotas"
    ADD CONSTRAINT "tenant_quotas_pkey" PRIMARY KEY ("tenant_id", "quota_key", "window_start");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_legs"
    ADD CONSTRAINT "ticket_legs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_legs"
    ADD CONSTRAINT "ticket_legs_ticket_id_leg_index_key" UNIQUE ("ticket_id", "leg_index");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."unified_picks"
    ADD CONSTRAINT "unified_picks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."unified_sports_history"
    ADD CONSTRAINT "unified_sports_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "unique_player_sport" UNIQUE ("player_id", "sport");



ALTER TABLE ONLY "public"."raw_props"
    ADD CONSTRAINT "unique_prop_constraint" UNIQUE ("external_game_id", "player_name", "stat_type", "outcome", "line");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "unique_team_sport" UNIQUE ("team_id", "sport");



ALTER TABLE ONLY "public"."unit_talk_alerts_log"
    ADD CONSTRAINT "unit_talk_alerts_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles_backup_20250803"
    ADD CONSTRAINT "user_profiles_discord_id_key" UNIQUE ("discord_id");



ALTER TABLE ONLY "public"."user_profiles_backup_20250803"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_discord_id_key" UNIQUE ("discord_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."xwalk_games"
    ADD CONSTRAINT "xwalk_games_pkey" PRIMARY KEY ("provider", "external_game_id");



ALTER TABLE ONLY "public"."xwalk_players"
    ADD CONSTRAINT "xwalk_players_pkey" PRIMARY KEY ("provider", "provider_player_id");



CREATE INDEX "idx_archive_raw_props_created_at" ON "archive"."raw_props" USING "btree" ("created_at" DESC NULLS LAST);



CREATE INDEX "raw_props_confidence_idx" ON "archive"."raw_props" USING "btree" ("confidence" DESC) WHERE ("confidence" > (0)::numeric);



CREATE INDEX "raw_props_created_at_idx" ON "archive"."raw_props" USING "btree" ("created_at");



CREATE INDEX "raw_props_created_at_idx1" ON "archive"."raw_props" USING "btree" ("created_at" DESC);



CREATE INDEX "raw_props_created_at_idx2" ON "archive"."raw_props" USING "btree" ("created_at") WHERE ("processed_at" IS NULL);



CREATE INDEX "raw_props_expected_value_idx" ON "archive"."raw_props" USING "btree" ("expected_value");



CREATE INDEX "raw_props_external_game_id_idx" ON "archive"."raw_props" USING "btree" ("external_game_id");



CREATE INDEX "raw_props_external_game_id_idx1" ON "archive"."raw_props" USING "btree" ("external_game_id");



CREATE INDEX "raw_props_external_id_idx" ON "archive"."raw_props" USING "btree" ("external_id");



CREATE INDEX "raw_props_game_date_idx" ON "archive"."raw_props" USING "btree" ("game_date" DESC);



CREATE INDEX "raw_props_game_id_idx" ON "archive"."raw_props" USING "btree" ("game_id");



CREATE INDEX "raw_props_game_id_stat_type_idx" ON "archive"."raw_props" USING "btree" ("game_id", "stat_type");



CREATE INDEX "raw_props_game_time_idx" ON "archive"."raw_props" USING "btree" ("game_time");



CREATE INDEX "raw_props_id_idx" ON "archive"."raw_props" USING "btree" ("id") WHERE ("processed_at" IS NULL);



CREATE INDEX "raw_props_inserted_at_idx" ON "archive"."raw_props" USING "btree" ("inserted_at");



CREATE INDEX "raw_props_is_canary_idx" ON "archive"."raw_props" USING "btree" ("is_canary");



CREATE INDEX "raw_props_lower_sport_stat_type_idx" ON "archive"."raw_props" USING "btree" ("lower"("player_name"), "sport", "stat_type") WHERE (("player_name" IS NOT NULL) AND ("line" IS NOT NULL));



CREATE INDEX "raw_props_matchup_game_date_idx" ON "archive"."raw_props" USING "btree" ("matchup", "game_date") WHERE ("game_id" IS NULL);



CREATE INDEX "raw_props_needs_review_idx" ON "archive"."raw_props" USING "btree" ("needs_review");



CREATE INDEX "raw_props_outcome_idx" ON "archive"."raw_props" USING "btree" ("outcome");



CREATE INDEX "raw_props_player_name_idx" ON "archive"."raw_props" USING "btree" ("player_name");



CREATE INDEX "raw_props_player_name_idx1" ON "archive"."raw_props" USING "gin" ("player_name" "public"."gin_trgm_ops") WHERE ("player_name" IS NOT NULL);



CREATE INDEX "raw_props_player_name_stat_type_idx" ON "archive"."raw_props" USING "btree" ("player_name", "stat_type");



CREATE INDEX "raw_props_processed_at_idx" ON "archive"."raw_props" USING "btree" ("processed_at");



CREATE INDEX "raw_props_professional_score_stat_type_idx" ON "archive"."raw_props" USING "btree" ("professional_score" DESC, "stat_type") WHERE ("professional_score" IS NOT NULL);



CREATE INDEX "raw_props_promoted_to_picks_idx" ON "archive"."raw_props" USING "btree" ("promoted_to_picks");



CREATE INDEX "raw_props_prop_category_idx" ON "archive"."raw_props" USING "btree" ("prop_category");



CREATE INDEX "raw_props_settled_at_idx" ON "archive"."raw_props" USING "btree" ("settled_at");



CREATE INDEX "raw_props_sharp_money_idx" ON "archive"."raw_props" USING "btree" ("sharp_money");



CREATE INDEX "raw_props_source_created_at_idx" ON "archive"."raw_props" USING "btree" ("source", "created_at" DESC NULLS LAST);



CREATE UNIQUE INDEX "raw_props_source_external_game_id_external_prop_id_idx" ON "archive"."raw_props" USING "btree" ("source", "external_game_id", "external_prop_id");



CREATE INDEX "raw_props_sport_game_time_idx" ON "archive"."raw_props" USING "btree" ("sport", "game_time") WHERE ("game_time" IS NOT NULL);



CREATE INDEX "raw_props_sport_idx" ON "archive"."raw_props" USING "btree" ("sport");



CREATE INDEX "raw_props_standardized_sport_idx" ON "archive"."raw_props" USING "btree" ("standardized_sport");



CREATE INDEX "raw_props_stat_type_idx" ON "archive"."raw_props" USING "btree" ("stat_type");



CREATE INDEX "raw_props_status_idx" ON "archive"."raw_props" USING "btree" ("status");



CREATE INDEX "raw_props_team_name_idx" ON "archive"."raw_props" USING "btree" ("team_name");



CREATE UNIQUE INDEX "raw_props_unique_key_idx" ON "archive"."raw_props" USING "btree" ("unique_key");



CREATE UNIQUE INDEX "raw_props_unique_key_idx1" ON "archive"."raw_props" USING "btree" ("unique_key");



CREATE INDEX "idx_credit_usage_bucket_hour" ON "ops"."credit_usage" USING "btree" ("bucket_hour");



CREATE INDEX "idx_credit_usage_provider" ON "ops"."credit_usage" USING "btree" ("provider", "bucket_hour");



CREATE INDEX "idx_credit_usage_provider_hour" ON "ops"."credit_usage" USING "btree" ("provider", "bucket_hour");



CREATE INDEX "idx_agent_health_agent" ON "public"."agent_health" USING "btree" ("agent");



CREATE INDEX "idx_agent_health_created_at" ON "public"."agent_health" USING "btree" ("created_at");



CREATE INDEX "idx_agent_health_status" ON "public"."agent_health" USING "btree" ("status");



CREATE INDEX "idx_agent_job_runs_agent_time" ON "public"."agent_job_runs" USING "btree" ("agent", "started_at" DESC);



CREATE INDEX "idx_agent_metrics_agent" ON "public"."agent_metrics" USING "btree" ("agent");



CREATE INDEX "idx_agent_metrics_timestamp" ON "public"."agent_metrics" USING "btree" ("logged_at");



CREATE INDEX "idx_agents_status" ON "public"."agents" USING "btree" ("status");



CREATE INDEX "idx_agents_type" ON "public"."agents" USING "btree" ("type");



CREATE INDEX "idx_alerts_event_at" ON "public"."unit_talk_alerts_log" USING "btree" ("event_at" DESC);



CREATE INDEX "idx_analytics_date_type" ON "public"."analytics_summary" USING "btree" ("date", "metric_type");



CREATE INDEX "idx_api_keys_tenant" ON "public"."api_keys" USING "btree" ("tenant_id");



CREATE INDEX "idx_archived_props_date" ON "public"."archived_props" USING "btree" ("archive_date");



CREATE INDEX "idx_archived_props_player" ON "public"."archived_props" USING "btree" ("player_name");



CREATE INDEX "idx_audit_entity" ON "public"."audit_logs" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_audit_tenant" ON "public"."audit_logs" USING "btree" ("tenant_id");



CREATE INDEX "idx_bridge_outbox_bet_slip_id" ON "public"."bridge_outbox" USING "btree" ("bet_slip_id");



CREATE INDEX "idx_bridge_outbox_created" ON "public"."bridge_outbox" USING "btree" ("created_at");



CREATE INDEX "idx_bridge_outbox_event_type" ON "public"."bridge_outbox" USING "btree" ("event_type");



CREATE INDEX "idx_bridge_outbox_status" ON "public"."bridge_outbox" USING "btree" ("status");



CREATE INDEX "idx_changelog_created_at" ON "public"."system_changelog" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_changelog_initiated_by" ON "public"."system_changelog" USING "btree" ("initiated_by");



CREATE INDEX "idx_changelog_type" ON "public"."system_changelog" USING "btree" ("type");



CREATE INDEX "idx_clv_prop_id" ON "public"."clv_tracking" USING "btree" ("prop_id");



CREATE INDEX "idx_clv_tracking_id" ON "public"."clv_tracking" USING "btree" ("clv_tracking_id");



CREATE INDEX "idx_contest_participants_contest_score" ON "public"."contest_participants" USING "btree" ("contest_id", "score" DESC);



CREATE INDEX "idx_contest_participants_user_contest" ON "public"."contest_participants" USING "btree" ("user_id", "contest_id");



CREATE INDEX "idx_contests_sport" ON "public"."contests" USING "btree" ("sport");



CREATE INDEX "idx_contests_sport_status" ON "public"."contests" USING "btree" ("sport", "status");



CREATE INDEX "idx_contests_status_dates" ON "public"."contests" USING "btree" ("status", "start_date", "end_date");



CREATE INDEX "idx_contests_type_sport" ON "public"."contests" USING "btree" ("contest_type", "sport");



CREATE INDEX "idx_dvp_matchup_ranks_sport" ON "public"."dvp_matchup_ranks" USING "btree" ("sport");



CREATE INDEX "idx_ev_modeling_sport" ON "public"."ev_modeling" USING "btree" ("sport");



CREATE INDEX "idx_feature_flags_name" ON "public"."feature_flags" USING "btree" ("flag_name");



CREATE INDEX "idx_features_daily_agg_computed_at" ON "public"."features_daily_agg" USING "btree" ("computed_at" DESC);



CREATE INDEX "idx_final_picks_capper" ON "public"."final_picks_backup_20250803" USING "btree" ("capper");



CREATE INDEX "idx_final_picks_game_date" ON "public"."final_picks_backup_20250803" USING "btree" ("game_date");



CREATE INDEX "idx_final_picks_tier_tag" ON "public"."final_picks_backup_20250803" USING "btree" ("tier_tag");



CREATE INDEX "idx_games_away_team" ON "public"."games" USING "btree" ("away_team");



CREATE INDEX "idx_games_created_at" ON "public"."games" USING "btree" ("created_at");



CREATE INDEX "idx_games_date" ON "public"."games" USING "btree" ("date");



CREATE INDEX "idx_games_external_id" ON "public"."games" USING "btree" ("external_id");



CREATE INDEX "idx_games_game_date" ON "public"."games" USING "btree" ("game_date" DESC);



CREATE INDEX "idx_games_home_team" ON "public"."games" USING "btree" ("home_team");



CREATE INDEX "idx_games_provider" ON "public"."games" USING "btree" ("provider");



CREATE INDEX "idx_games_sport_date" ON "public"."games" USING "btree" ("sport", "game_date");



CREATE INDEX "idx_games_status_date" ON "public"."games" USING "btree" ("status", "date");



CREATE INDEX "idx_games_teams_date" ON "public"."games" USING "btree" ("home_team", "away_team", "game_date");



CREATE INDEX "idx_historical_player_logs_sport_player" ON "public"."historical_player_logs" USING "btree" ("sport", "player_name", "game_date" DESC);



CREATE INDEX "idx_incidents_started" ON "public"."system_incidents" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_job_runs_started" ON "public"."agent_job_runs" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_line_snapshots_event" ON "public"."line_snapshots" USING "btree" ("event_id");



CREATE INDEX "idx_line_snapshots_key" ON "public"."line_snapshots" USING "btree" ("market_type", "selection");



CREATE INDEX "idx_line_snapshots_offers_gin" ON "public"."line_snapshots" USING "gin" ("offers" "jsonb_path_ops");



CREATE INDEX "idx_line_snapshots_received_at" ON "public"."line_snapshots" USING "btree" ("received_at");



CREATE INDEX "idx_line_snapshots_tenant" ON "public"."line_snapshots" USING "btree" ("tenant_id");



CREATE INDEX "idx_logs_by_sport_player_stat" ON "public"."player_logs" USING "btree" ("sport", "player_name", "stat_type", "game_date");



CREATE INDEX "idx_memberships_tenant" ON "public"."tenant_memberships" USING "btree" ("tenant_id");



CREATE INDEX "idx_memberships_user" ON "public"."tenant_memberships" USING "btree" ("user_id");



CREATE INDEX "idx_outbox_status" ON "public"."outbox_events" USING "btree" ("status", "available_at");



CREATE INDEX "idx_outbox_tenant" ON "public"."outbox_events" USING "btree" ("tenant_id");



CREATE INDEX "idx_outbox_tenant_status_available" ON "public"."outbox_events" USING "btree" ("tenant_id", "status", "available_at");



CREATE INDEX "idx_outbox_updated_at" ON "public"."outbox_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_pick_grades_pick" ON "public"."pick_grades" USING "btree" ("pick_id");



CREATE INDEX "idx_pick_grades_tenant" ON "public"."pick_grades" USING "btree" ("tenant_id");



CREATE INDEX "idx_picks_legs_gin" ON "public"."picks" USING "gin" ("legs" "jsonb_path_ops");



CREATE INDEX "idx_picks_result" ON "public"."picks" USING "btree" ("result");



CREATE INDEX "idx_picks_status" ON "public"."picks" USING "btree" ("status");



CREATE INDEX "idx_picks_tenant" ON "public"."picks" USING "btree" ("tenant_id");



CREATE INDEX "idx_plays_created_at" ON "public"."plays" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_plays_formation_id" ON "public"."plays" USING "btree" ("formation_id");



CREATE INDEX "idx_plays_name_trgm" ON "public"."plays" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_plays_play_type" ON "public"."plays" USING "btree" ("play_type");



CREATE INDEX "idx_plays_search_tsv" ON "public"."plays" USING "gin" ("search_tsv");



CREATE INDEX "idx_plays_tags_coverage" ON "public"."plays" USING "btree" ((("tags" ->> 'coverage'::"text")));



CREATE INDEX "idx_plays_tags_down_distance" ON "public"."plays" USING "btree" ((("tags" ->> 'downDistance'::"text")));



CREATE INDEX "idx_plays_tags_gin" ON "public"."plays" USING "gin" ("tags");



CREATE INDEX "idx_plays_tags_hash" ON "public"."plays" USING "btree" ((("tags" ->> 'hash'::"text")));



CREATE INDEX "idx_processing_logs_processed_at" ON "public"."processing_logs" USING "btree" ("processed_at");



CREATE INDEX "idx_processing_logs_processor" ON "public"."processing_logs" USING "btree" ("processor");



CREATE INDEX "idx_prop_ticks_hot_asof" ON ONLY "public"."prop_ticks_hot" USING "btree" ("asof" DESC);



CREATE INDEX "idx_quotas_tenant" ON "public"."tenant_quotas" USING "btree" ("tenant_id");



CREATE INDEX "idx_raw_props_confidence" ON "public"."raw_props" USING "btree" ("confidence" DESC) WHERE ("confidence" > (0)::numeric);



CREATE INDEX "idx_raw_props_created" ON "public"."raw_props" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_raw_props_created_at" ON "public"."raw_props" USING "btree" ("created_at");



CREATE INDEX "idx_raw_props_expected_value" ON "public"."raw_props" USING "btree" ("expected_value");



CREATE INDEX "idx_raw_props_external_game_id" ON "public"."raw_props" USING "btree" ("external_game_id");



CREATE INDEX "idx_raw_props_external_id" ON "public"."raw_props" USING "btree" ("external_id");



CREATE INDEX "idx_raw_props_game_date" ON "public"."raw_props" USING "btree" ("game_date" DESC);



CREATE INDEX "idx_raw_props_game_id" ON "public"."raw_props" USING "btree" ("game_id");



CREATE INDEX "idx_raw_props_game_player_market" ON "public"."raw_props_hot" USING "btree" ("game_id", "player_id", "market_id", "book_id");



CREATE INDEX "idx_raw_props_game_stat" ON "public"."raw_props" USING "btree" ("game_id", "stat_type");



CREATE INDEX "idx_raw_props_game_time" ON "public"."raw_props" USING "btree" ("game_time");



CREATE INDEX "idx_raw_props_game_time_sport" ON "public"."raw_props" USING "btree" ("sport", "game_time") WHERE ("game_time" IS NOT NULL);



CREATE INDEX "idx_raw_props_historical_analytics" ON "public"."raw_props_historical" USING "btree" ("sport", "stat_type", "game_date" DESC);



CREATE INDEX "idx_raw_props_historical_game_date" ON "public"."raw_props_historical" USING "btree" ("game_date" DESC);



CREATE INDEX "idx_raw_props_historical_player_name" ON "public"."raw_props_historical" USING "btree" ("player_name");



CREATE INDEX "idx_raw_props_historical_sport_date" ON "public"."raw_props_historical" USING "btree" ("sport", "game_date" DESC);



CREATE INDEX "idx_raw_props_inserted_at" ON "public"."raw_props" USING "btree" ("inserted_at");



CREATE INDEX "idx_raw_props_is_canary" ON "public"."raw_props" USING "btree" ("is_canary");



CREATE INDEX "idx_raw_props_matchup_date" ON "public"."raw_props" USING "btree" ("matchup", "game_date") WHERE ("game_id" IS NULL);



CREATE INDEX "idx_raw_props_needs_review" ON "public"."raw_props" USING "btree" ("needs_review");



CREATE INDEX "idx_raw_props_outcome" ON "public"."raw_props" USING "btree" ("outcome");



CREATE INDEX "idx_raw_props_player_name" ON "public"."raw_props" USING "btree" ("player_name");



CREATE INDEX "idx_raw_props_player_sport" ON "public"."raw_props" USING "btree" ("lower"("player_name"), "sport", "stat_type") WHERE (("player_name" IS NOT NULL) AND ("line" IS NOT NULL));



CREATE INDEX "idx_raw_props_player_stat" ON "public"."raw_props" USING "btree" ("player_name", "stat_type");



CREATE INDEX "idx_raw_props_player_trgm" ON "public"."raw_props" USING "gin" ("player_name" "public"."gin_trgm_ops") WHERE ("player_name" IS NOT NULL);



CREATE INDEX "idx_raw_props_processed_at" ON "public"."raw_props" USING "btree" ("processed_at");



CREATE INDEX "idx_raw_props_processed_null" ON "public"."raw_props" USING "btree" ("id") WHERE ("processed_at" IS NULL);



CREATE INDEX "idx_raw_props_professional_score" ON "public"."raw_props" USING "btree" ("professional_score" DESC, "stat_type") WHERE ("professional_score" IS NOT NULL);



CREATE INDEX "idx_raw_props_promoted_to_picks" ON "public"."raw_props" USING "btree" ("promoted_to_picks");



CREATE INDEX "idx_raw_props_prop_category" ON "public"."raw_props" USING "btree" ("prop_category");



CREATE INDEX "idx_raw_props_recent_game_date" ON "public"."raw_props_recent" USING "btree" ("game_date" DESC);



CREATE INDEX "idx_raw_props_recent_player_sport" ON "public"."raw_props_recent" USING "btree" ("player_name", "sport");



CREATE INDEX "idx_raw_props_recent_scraped_at" ON "public"."raw_props_recent" USING "btree" ("scraped_at" DESC);



CREATE INDEX "idx_raw_props_settled_at" ON "public"."raw_props" USING "btree" ("settled_at");



CREATE INDEX "idx_raw_props_sharp_money" ON "public"."raw_props" USING "btree" ("sharp_money");



CREATE INDEX "idx_raw_props_source_created_at" ON "public"."raw_props" USING "btree" ("source", "created_at" DESC NULLS LAST);



CREATE INDEX "idx_raw_props_sport" ON "public"."raw_props" USING "btree" ("sport");



CREATE INDEX "idx_raw_props_standardized_sport" ON "public"."raw_props" USING "btree" ("standardized_sport");



CREATE INDEX "idx_raw_props_stat_type" ON "public"."raw_props" USING "btree" ("stat_type");



CREATE INDEX "idx_raw_props_status" ON "public"."raw_props" USING "btree" ("status");



CREATE INDEX "idx_raw_props_team_name" ON "public"."raw_props" USING "btree" ("team_name");



CREATE UNIQUE INDEX "idx_raw_props_unique_key" ON "public"."raw_props" USING "btree" ("unique_key");



CREATE INDEX "idx_raw_props_unprocessed" ON "public"."raw_props" USING "btree" ("created_at") WHERE ("processed_at" IS NULL);



CREATE INDEX "idx_rbi_backfill_queue_player_date" ON "public"."rbi_backfill_queue" USING "btree" ("player_name", "game_date");



CREATE INDEX "idx_rbi_backfill_queue_status" ON "public"."rbi_backfill_queue" USING "btree" ("status");



CREATE INDEX "idx_recap_runs_type_run" ON "public"."recap_runs" USING "btree" ("type", "run_at" DESC);



CREATE INDEX "idx_recap_type_date" ON "public"."recap_log" USING "btree" ("recap_type", "recap_date");



CREATE INDEX "idx_referral_rewards_referral_status" ON "public"."referral_rewards" USING "btree" ("referral_id", "status");



CREATE INDEX "idx_referral_rewards_status" ON "public"."referral_rewards" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_referrals_code" ON "public"."referrals" USING "btree" ("referral_code");



CREATE INDEX "idx_referrals_invitee" ON "public"."referrals" USING "btree" ("invitee_id");



CREATE INDEX "idx_referrals_inviter" ON "public"."referrals" USING "btree" ("inviter_id");



CREATE INDEX "idx_referrals_status_created" ON "public"."referrals" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_result_sets_official_at" ON "public"."result_sets" USING "btree" ("official_at" DESC);



CREATE INDEX "idx_result_sets_payload_gin" ON "public"."result_sets" USING "gin" ("payload" "jsonb_path_ops");



CREATE INDEX "idx_result_sets_tenant_event_market" ON "public"."result_sets" USING "btree" ("tenant_id", "event_id", "market_type");



CREATE INDEX "idx_scoring_queue_status_created" ON "public"."scoring_queue" USING "btree" ("status", "created_at") WHERE ("status" = ANY (ARRAY['PENDING'::"text", 'PROCESSING'::"text"]));



CREATE INDEX "idx_security_events_created_at" ON "public"."security_events" USING "btree" ("created_at");



CREATE INDEX "idx_security_events_severity" ON "public"."security_events" USING "btree" ("severity");



CREATE INDEX "idx_security_events_type" ON "public"."security_events" USING "btree" ("type");



CREATE INDEX "idx_sgo_created_at" ON "public"."sports_game_odds" USING "btree" ("created_at");



CREATE INDEX "idx_sgo_game" ON "public"."sports_game_odds" USING "btree" ("game_id");



CREATE INDEX "idx_sgo_provider_market" ON "public"."sports_game_odds" USING "btree" ("provider", "market");



CREATE INDEX "idx_shadow_decisions_created_at" ON "public"."shadow_decisions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_shadow_decisions_decided_action" ON "public"."shadow_decisions" USING "btree" ("decided_action");



CREATE INDEX "idx_shadow_decisions_decision_type" ON "public"."shadow_decisions" USING "btree" ("decision_type");



CREATE INDEX "idx_shadow_decisions_sport" ON "public"."shadow_decisions" USING "btree" ("sport");



CREATE INDEX "idx_shadow_decisions_tier" ON "public"."shadow_decisions" USING "btree" ("tier");



CREATE INDEX "idx_shadow_decisions_unified_pick_id" ON "public"."shadow_decisions" USING "btree" ("unified_pick_id");



CREATE INDEX "idx_system_config_key" ON "public"."system_config" USING "btree" ("key");



CREATE INDEX "idx_system_incidents_status" ON "public"."system_incidents" USING "btree" ("resolved_at");



CREATE INDEX "idx_ticket_legs_ticket" ON "public"."ticket_legs" USING "btree" ("ticket_id", "leg_index");



CREATE INDEX "idx_tickets_state" ON "public"."tickets" USING "btree" ("state", "updated_at");



CREATE INDEX "idx_ticks_asof" ON ONLY "public"."prop_ticks_hot" USING "brin" ("asof");



CREATE INDEX "idx_ticks_game_player_market" ON ONLY "public"."prop_ticks_hot" USING "btree" ("game_id", "player_id", "market_id", "book_id");



CREATE INDEX "idx_unified_picks_bookmaker" ON "public"."unified_picks" USING "btree" ((("metadata" ->> 'bookmaker_key'::"text")));



CREATE INDEX "idx_unified_picks_confidence" ON "public"."unified_picks" USING "btree" ("confidence" DESC) WHERE ("confidence" > 0);



CREATE INDEX "idx_unified_picks_created" ON "public"."unified_picks" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_unified_picks_external_game_id" ON "public"."unified_picks" USING "btree" ("external_game_id");



CREATE INDEX "idx_unified_picks_game_id" ON "public"."unified_picks" USING "btree" ("game_id");



CREATE INDEX "idx_unified_picks_game_market" ON "public"."unified_picks" USING "btree" ("external_game_id", "market");



CREATE INDEX "idx_unified_picks_game_posted" ON "public"."unified_picks" USING "btree" ("game_id", "posted_at");



CREATE INDEX "idx_unified_picks_market" ON "public"."unified_picks" USING "btree" ("market");



CREATE INDEX "idx_unified_picks_parlay" ON "public"."unified_picks" USING "btree" ("parlay_id") WHERE ("parlay_id" IS NOT NULL);



CREATE INDEX "idx_unified_picks_placed_at" ON "public"."unified_picks" USING "btree" ("placed_at" DESC);



CREATE INDEX "idx_unified_picks_posted_at" ON "public"."unified_picks" USING "btree" ("posted_at" DESC);



CREATE INDEX "idx_unified_picks_promoted_at" ON "public"."unified_picks" USING "btree" ("promoted_at");



CREATE INDEX "idx_unified_picks_prop_id" ON "public"."unified_picks" USING "btree" ("prop_id");



CREATE INDEX "idx_unified_picks_published_created" ON "public"."unified_picks" USING "btree" ("published", "created_at" DESC);



CREATE INDEX "idx_unified_picks_raw_id" ON "public"."unified_picks" USING "btree" ("raw_id");



CREATE INDEX "idx_unified_picks_source" ON "public"."unified_picks" USING "btree" ("source");



CREATE INDEX "idx_unified_picks_source_created_at" ON "public"."unified_picks" USING "btree" ("pick_source", "created_at" DESC);



CREATE INDEX "idx_unified_picks_sport" ON "public"."unified_picks" USING "btree" ("sport");



CREATE INDEX "idx_unified_picks_sport_gametime" ON "public"."unified_picks" USING "btree" ("sport", "game_start_time");



CREATE INDEX "idx_unified_picks_status" ON "public"."unified_picks" USING "btree" ("status");



CREATE INDEX "idx_unified_picks_user_id" ON "public"."unified_picks" USING "btree" ("user_id");



CREATE INDEX "idx_unified_picks_user_placed_at" ON "public"."unified_picks" USING "btree" ("user_id", "placed_at" DESC);



CREATE INDEX "idx_unified_picks_user_status" ON "public"."unified_picks" USING "btree" ("user_id", "status");



CREATE INDEX "idx_unified_picks_workflow" ON "public"."unified_picks" USING "btree" ("workflow_stage", "promotion_status");



CREATE INDEX "idx_unified_sports_history_player" ON "public"."unified_sports_history" USING "btree" ("player_name", "sport");



CREATE INDEX "idx_unified_sports_history_player_id" ON "public"."unified_sports_history" USING "btree" ("player_id", "sport");



CREATE INDEX "idx_unified_sports_history_sport_date" ON "public"."unified_sports_history" USING "btree" ("sport", "game_date" DESC);



CREATE UNIQUE INDEX "idx_unique_alert" ON "public"."player_injuries" USING "btree" ("player_name", "alert_time");



CREATE INDEX "idx_user_profiles_discord_id" ON "public"."user_profiles_backup_20250803" USING "btree" ("discord_id");



CREATE INDEX "idx_users_capper" ON "public"."users" USING "btree" ("is_capper") WHERE ("is_capper" = true);



CREATE INDEX "idx_users_discord_id" ON "public"."users" USING "btree" ("discord_id");



CREATE INDEX "idx_users_is_capper" ON "public"."users" USING "btree" ("is_capper") WHERE ("is_capper" = true);



CREATE INDEX "idx_users_performance" ON "public"."users" USING "btree" ("win_rate" DESC, "roi" DESC);



CREATE INDEX "idx_users_tier_status" ON "public"."users" USING "btree" ("tier", "subscription_status");



CREATE INDEX "idx_users_username" ON "public"."users" USING "btree" ("username");



CREATE INDEX "ix_games_external_id" ON "public"."games" USING "btree" ("external_game_id");



CREATE INDEX "ix_games_start_time" ON "public"."games" USING "btree" ("start_time");



CREATE INDEX "ix_raw_props_external_game_id" ON "public"."raw_props" USING "btree" ("external_game_id");



CREATE INDEX "ix_settlement_results_game" ON "public"."settlement_results" USING "btree" ("game_id");



CREATE INDEX "ix_settlement_results_graded_at" ON "public"."settlement_results" USING "btree" ("graded_at");



CREATE INDEX "prop_ticks_hot_p20250911_asof_idx" ON "public"."prop_ticks_hot_p20250911" USING "brin" ("asof");



CREATE INDEX "prop_ticks_hot_p20250911_asof_idx1" ON "public"."prop_ticks_hot_p20250911" USING "btree" ("asof" DESC);



CREATE INDEX "prop_ticks_hot_p20250911_game_id_player_id_market_id_book_i_idx" ON "public"."prop_ticks_hot_p20250911" USING "btree" ("game_id", "player_id", "market_id", "book_id");



CREATE INDEX "raw_props_historical_confidence_idx" ON "public"."raw_props_historical" USING "btree" ("confidence" DESC) WHERE ("confidence" > (0)::numeric);



CREATE INDEX "raw_props_historical_expected_value_idx" ON "public"."raw_props_historical" USING "btree" ("expected_value");



CREATE INDEX "raw_props_historical_game_date_idx" ON "public"."raw_props_historical" USING "btree" ("game_date" DESC);



CREATE INDEX "raw_props_historical_game_id_idx" ON "public"."raw_props_historical" USING "btree" ("game_id");



CREATE INDEX "raw_props_historical_game_id_stat_type_idx" ON "public"."raw_props_historical" USING "btree" ("game_id", "stat_type");



CREATE INDEX "raw_props_historical_matchup_game_date_idx" ON "public"."raw_props_historical" USING "btree" ("matchup", "game_date") WHERE ("game_id" IS NULL);



CREATE INDEX "raw_props_historical_outcome_idx" ON "public"."raw_props_historical" USING "btree" ("outcome");



CREATE INDEX "raw_props_historical_player_name_idx" ON "public"."raw_props_historical" USING "btree" ("player_name");



CREATE INDEX "raw_props_historical_player_name_stat_type_idx" ON "public"."raw_props_historical" USING "btree" ("player_name", "stat_type");



CREATE INDEX "raw_props_historical_promoted_to_picks_idx" ON "public"."raw_props_historical" USING "btree" ("promoted_to_picks");



CREATE INDEX "raw_props_historical_sharp_money_idx" ON "public"."raw_props_historical" USING "btree" ("sharp_money");



CREATE INDEX "raw_props_historical_sport_idx" ON "public"."raw_props_historical" USING "btree" ("sport");



CREATE INDEX "raw_props_historical_stat_type_idx" ON "public"."raw_props_historical" USING "btree" ("stat_type");



CREATE UNIQUE INDEX "raw_props_historical_unique_key_idx" ON "public"."raw_props_historical" USING "btree" ("unique_key");



CREATE UNIQUE INDEX "raw_props_historical_unique_key_idx1" ON "public"."raw_props_historical" USING "btree" ("unique_key");



CREATE INDEX "raw_props_recent_confidence_idx" ON "public"."raw_props_recent" USING "btree" ("confidence" DESC) WHERE ("confidence" > (0)::numeric);



CREATE INDEX "raw_props_recent_expected_value_idx" ON "public"."raw_props_recent" USING "btree" ("expected_value");



CREATE INDEX "raw_props_recent_game_date_idx" ON "public"."raw_props_recent" USING "btree" ("game_date" DESC);



CREATE INDEX "raw_props_recent_game_id_idx" ON "public"."raw_props_recent" USING "btree" ("game_id");



CREATE INDEX "raw_props_recent_game_id_stat_type_idx" ON "public"."raw_props_recent" USING "btree" ("game_id", "stat_type");



CREATE INDEX "raw_props_recent_matchup_game_date_idx" ON "public"."raw_props_recent" USING "btree" ("matchup", "game_date") WHERE ("game_id" IS NULL);



CREATE INDEX "raw_props_recent_outcome_idx" ON "public"."raw_props_recent" USING "btree" ("outcome");



CREATE INDEX "raw_props_recent_player_name_idx" ON "public"."raw_props_recent" USING "btree" ("player_name");



CREATE INDEX "raw_props_recent_player_name_stat_type_idx" ON "public"."raw_props_recent" USING "btree" ("player_name", "stat_type");



CREATE INDEX "raw_props_recent_promoted_to_picks_idx" ON "public"."raw_props_recent" USING "btree" ("promoted_to_picks");



CREATE INDEX "raw_props_recent_sharp_money_idx" ON "public"."raw_props_recent" USING "btree" ("sharp_money");



CREATE INDEX "raw_props_recent_sport_idx" ON "public"."raw_props_recent" USING "btree" ("sport");



CREATE INDEX "raw_props_recent_stat_type_idx" ON "public"."raw_props_recent" USING "btree" ("stat_type");



CREATE UNIQUE INDEX "raw_props_recent_unique_key_idx" ON "public"."raw_props_recent" USING "btree" ("unique_key");



CREATE UNIQUE INDEX "raw_props_recent_unique_key_idx1" ON "public"."raw_props_recent" USING "btree" ("unique_key");



CREATE UNIQUE INDEX "raw_props_sgo_unique" ON "public"."raw_props" USING "btree" ("source", "external_game_id", "external_prop_id");



CREATE UNIQUE INDEX "raw_props_unique_key_idx" ON "public"."raw_props" USING "btree" ("unique_key");



CREATE UNIQUE INDEX "uq_mv_pipeline_lag_24h" ON "public"."mv_pipeline_lag_24h" USING "btree" ("minute_bucket", "sport");



CREATE UNIQUE INDEX "uq_pick_grades_idem" ON "public"."pick_grades" USING "btree" ("tenant_id", "pick_id", "rule_version");



CREATE UNIQUE INDEX "uq_picks_dedupe" ON "public"."picks" USING "btree" ("tenant_id", "dedupe_hash") WHERE ("dedupe_hash" IS NOT NULL);



CREATE UNIQUE INDEX "uq_result_sets_key" ON "public"."result_sets" USING "btree" ("tenant_id", "event_id", "market_type", "version");



CREATE UNIQUE INDEX "uq_unified_picks_fingerprint" ON "public"."unified_picks" USING "btree" ("promotion_fingerprint") WHERE ("promotion_fingerprint" IS NOT NULL);



CREATE UNIQUE INDEX "uq_unified_picks_system_prop" ON "public"."unified_picks" USING "btree" ("prop_id") WHERE ("pick_source" = 'system'::"text");



CREATE UNIQUE INDEX "ux_games_external_game_id" ON "public"."games" USING "btree" ("external_game_id");



ALTER INDEX "public"."idx_ticks_asof" ATTACH PARTITION "public"."prop_ticks_hot_p20250911_asof_idx";



ALTER INDEX "public"."idx_prop_ticks_hot_asof" ATTACH PARTITION "public"."prop_ticks_hot_p20250911_asof_idx1";



ALTER INDEX "public"."idx_ticks_game_player_market" ATTACH PARTITION "public"."prop_ticks_hot_p20250911_game_id_player_id_market_id_book_i_idx";



ALTER INDEX "public"."prop_ticks_hot_pkey" ATTACH PARTITION "public"."prop_ticks_hot_p20250911_pkey";



CREATE OR REPLACE TRIGGER "agent_health_update_timestamp" BEFORE UPDATE ON "public"."agent_health" FOR EACH ROW EXECUTE FUNCTION "public"."update_agent_health_timestamp"();



CREATE OR REPLACE TRIGGER "smart_form_picks_insert_trg" INSTEAD OF INSERT ON "public"."smart_form_picks" FOR EACH ROW EXECUTE FUNCTION "public"."smart_form_picks_insert"();



CREATE OR REPLACE TRIGGER "trg_enforce_processed_at_only" BEFORE UPDATE OF "processed_at" ON "public"."raw_props" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_update_processed_at_only"();



CREATE OR REPLACE TRIGGER "trg_enforce_single_writer" BEFORE INSERT OR UPDATE ON "public"."unified_picks" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_single_writer"();



CREATE OR REPLACE TRIGGER "trg_pick_grades_outbox" AFTER INSERT OR UPDATE ON "public"."pick_grades" FOR EACH ROW EXECUTE FUNCTION "public"."trg_pick_grades_outbox"();



CREATE OR REPLACE TRIGGER "trg_pick_grades_writeback" AFTER INSERT OR UPDATE ON "public"."pick_grades" FOR EACH ROW EXECUTE FUNCTION "public"."trg_pick_grades_writeback"();



CREATE OR REPLACE TRIGGER "trg_picks_outbox" AFTER INSERT OR UPDATE ON "public"."picks" FOR EACH ROW EXECUTE FUNCTION "public"."trg_picks_outbox"();



CREATE OR REPLACE TRIGGER "trg_plays_search_tsv" BEFORE INSERT OR UPDATE OF "name", "reads", "key_points" ON "public"."plays" FOR EACH ROW EXECUTE FUNCTION "public"."plays_update_search_tsv"();



CREATE OR REPLACE TRIGGER "trg_quota_updated_at" BEFORE UPDATE ON "public"."api_quota_configs" FOR EACH ROW EXECUTE FUNCTION "public"."touch_quota_updated_at"();



CREATE OR REPLACE TRIGGER "trg_set_unified_picks_fingerprint" BEFORE INSERT OR UPDATE ON "public"."unified_picks" FOR EACH ROW EXECUTE FUNCTION "public"."set_unified_picks_fingerprint"();



CREATE OR REPLACE TRIGGER "trg_unified_picks_updated_at" BEFORE UPDATE ON "public"."unified_picks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_auto_fill_created_at_games" BEFORE INSERT ON "public"."games" FOR EACH ROW EXECUTE FUNCTION "public"."auto_fill_created_at"();



CREATE OR REPLACE TRIGGER "trigger_auto_fill_created_at_players" BEFORE INSERT ON "public"."players" FOR EACH ROW EXECUTE FUNCTION "public"."auto_fill_created_at"();



CREATE OR REPLACE TRIGGER "trigger_auto_fill_created_at_props" BEFORE INSERT ON "public"."raw_props" FOR EACH ROW EXECUTE FUNCTION "public"."auto_fill_created_at"();



CREATE OR REPLACE TRIGGER "trigger_auto_fill_created_at_teams" BEFORE INSERT ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."auto_fill_created_at"();



CREATE OR REPLACE TRIGGER "trigger_auto_generate_player_slug" BEFORE INSERT ON "public"."players" FOR EACH ROW EXECUTE FUNCTION "public"."auto_generate_player_slug"();



CREATE OR REPLACE TRIGGER "trigger_auto_generate_team_slug" BEFORE INSERT ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."auto_generate_team_slug"();



CREATE OR REPLACE TRIGGER "trigger_scoring_queue_updated_at" BEFORE UPDATE ON "public"."scoring_queue" FOR EACH ROW EXECUTE FUNCTION "public"."update_scoring_queue_updated_at"();



ALTER TABLE ONLY "public"."alerts_log"
    ADD CONSTRAINT "alerts_log_final_pick_id_fkey" FOREIGN KEY ("final_pick_id") REFERENCES "public"."final_picks_backup_20250803"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."annotations"
    ADD CONSTRAINT "annotations_play_id_fkey" FOREIGN KEY ("play_id") REFERENCES "public"."plays"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles_backup_20250803"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contest_participants"
    ADD CONSTRAINT "contest_participants_contest_id_fkey" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contest_participants"
    ADD CONSTRAINT "contest_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles_backup_20250803"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."discord_messages"
    ADD CONSTRAINT "discord_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles_backup_20250803"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."box_scores"
    ADD CONSTRAINT "fk_box_scores_game_id" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."box_scores"
    ADD CONSTRAINT "fk_box_scores_player_id" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contest_participants"
    ADD CONSTRAINT "fk_contest_participants_contest_id" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id");



ALTER TABLE ONLY "public"."contest_participants"
    ADD CONSTRAINT "fk_contest_participants_user_id" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."raw_props"
    ADD CONSTRAINT "fk_raw_props_game_id" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id");



ALTER TABLE ONLY "public"."raw_props"
    ADD CONSTRAINT "fk_raw_props_games" FOREIGN KEY ("external_game_id") REFERENCES "public"."games"("external_game_id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "fk_referrals_referred_user_id" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."unified_picks"
    ADD CONSTRAINT "fk_unified_picks_prop" FOREIGN KEY ("prop_id") REFERENCES "public"."raw_props"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."unified_picks"
    ADD CONSTRAINT "fk_unified_picks_prop_id" FOREIGN KEY ("prop_id") REFERENCES "public"."raw_props"("id");



ALTER TABLE ONLY "public"."unified_picks"
    ADD CONSTRAINT "fk_unified_picks_user_id" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."leaderboards"
    ADD CONSTRAINT "leaderboards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles_backup_20250803"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."line_movement_log"
    ADD CONSTRAINT "line_movement_log_final_pick_id_fkey" FOREIGN KEY ("final_pick_id") REFERENCES "public"."final_picks_backup_20250803"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pick_grades"
    ADD CONSTRAINT "pick_grades_result_set_id_fkey" FOREIGN KEY ("result_set_id") REFERENCES "public"."result_sets"("id");



ALTER TABLE ONLY "public"."plays"
    ADD CONSTRAINT "plays_ebook_id_fkey" FOREIGN KEY ("ebook_id") REFERENCES "public"."ebooks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."plays"
    ADD CONSTRAINT "plays_formation_id_fkey" FOREIGN KEY ("formation_id") REFERENCES "public"."formations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rbi_backfill_queue"
    ADD CONSTRAINT "rbi_backfill_queue_unified_history_id_fkey" FOREIGN KEY ("unified_history_id") REFERENCES "public"."unified_sports_history"("id");



ALTER TABLE ONLY "public"."referral_rewards"
    ADD CONSTRAINT "referral_rewards_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "public"."referrals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_memberships"
    ADD CONSTRAINT "tenant_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_memberships"
    ADD CONSTRAINT "tenant_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_quotas"
    ADD CONSTRAINT "tenant_quotas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_legs"
    ADD CONSTRAINT "ticket_legs_pick_id_fkey" FOREIGN KEY ("pick_id") REFERENCES "public"."unified_picks"("id");



ALTER TABLE ONLY "public"."ticket_legs"
    ADD CONSTRAINT "ticket_legs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unified_picks"
    ADD CONSTRAINT "unified_picks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."unified_picks"
    ADD CONSTRAINT "unified_picks_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."unified_picks"
    ADD CONSTRAINT "unified_picks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Enable insert access for all users" ON "public"."shadow_decisions" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable read access for all users" ON "public"."shadow_decisions" FOR SELECT USING (true);



CREATE POLICY "Users can update own profile" ON "public"."user_profiles_backup_20250803" FOR UPDATE USING ((("auth"."uid"())::"text" = "discord_id"));



CREATE POLICY "Users can view own profile" ON "public"."user_profiles_backup_20250803" FOR SELECT USING ((("auth"."uid"())::"text" = "discord_id"));



ALTER TABLE "public"."agent_health" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."annotations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "anon_all_raw_props" ON "public"."raw_props" USING (true);



CREATE POLICY "anon_all_unified_picks" ON "public"."unified_picks" USING (true);



CREATE POLICY "anon_insert_agent_health" ON "public"."agent_health" FOR INSERT WITH CHECK (true);



CREATE POLICY "anon_insert_agent_metrics" ON "public"."agent_metrics" FOR INSERT WITH CHECK (true);



CREATE POLICY "anon_read_agent_health" ON "public"."agent_health" FOR SELECT USING (true);



CREATE POLICY "anon_read_agent_metrics" ON "public"."agent_metrics" FOR SELECT USING (true);



CREATE POLICY "anon_read_games" ON "public"."games" FOR SELECT USING (true);



CREATE POLICY "anon_read_players" ON "public"."players" FOR SELECT USING (true);



CREATE POLICY "anon_read_raw_props" ON "public"."raw_props" FOR SELECT USING (true);



CREATE POLICY "anon_read_security_events" ON "public"."security_events" FOR SELECT USING (true);



CREATE POLICY "anon_read_unified_picks" ON "public"."unified_picks" FOR SELECT USING (true);



CREATE POLICY "anon_read_users" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "anon_update_agent_health" ON "public"."agent_health" FOR UPDATE USING (true);



ALTER TABLE "public"."api_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auth_all_agent_health" ON "public"."agent_health" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_all_agent_metrics" ON "public"."agent_metrics" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_all_security_events" ON "public"."security_events" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write_annotations" ON "public"."annotations" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write_ebooks" ON "public"."ebooks" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write_formations" ON "public"."formations" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "auth_write_plays" ON "public"."plays" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."ebooks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."formations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."games" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."idempotency_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."line_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."outbox_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pick_grades" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."picks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."players" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plays" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_read_annotations" ON "public"."annotations" FOR SELECT USING (true);



CREATE POLICY "public_read_ebooks" ON "public"."ebooks" FOR SELECT USING (true);



CREATE POLICY "public_read_formations" ON "public"."formations" FOR SELECT USING (true);



CREATE POLICY "public_read_plays" ON "public"."plays" FOR SELECT USING (true);



ALTER TABLE "public"."raw_props" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "raw_props_processor_update" ON "public"."raw_props" FOR UPDATE TO "processor_rw" USING (true) WITH CHECK (true);



CREATE POLICY "raw_props_select" ON "public"."raw_props" FOR SELECT TO "authenticated", "ro_user" USING (true);



ALTER TABLE "public"."result_sets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_all_agent_health" ON "public"."agent_health" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_all_agent_metrics" ON "public"."agent_metrics" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_all_security_events" ON "public"."security_events" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."shadow_decisions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_isolation" ON "public"."api_keys" USING (("tenant_id" = ("auth"."jwt"() ->> 'tenant_id'::"text"))) WITH CHECK (("tenant_id" = ("auth"."jwt"() ->> 'tenant_id'::"text")));



CREATE POLICY "tenant_isolation" ON "public"."audit_logs" USING (("tenant_id" = ("auth"."jwt"() ->> 'tenant_id'::"text"))) WITH CHECK (("tenant_id" = ("auth"."jwt"() ->> 'tenant_id'::"text")));



CREATE POLICY "tenant_isolation" ON "public"."idempotency_keys" USING (("tenant_id" = ("auth"."jwt"() ->> 'tenant_id'::"text"))) WITH CHECK (("tenant_id" = ("auth"."jwt"() ->> 'tenant_id'::"text")));



CREATE POLICY "tenant_isolation" ON "public"."line_snapshots" USING (("tenant_id" = ("auth"."jwt"() ->> 'tenant_id'::"text"))) WITH CHECK (("tenant_id" = ("auth"."jwt"() ->> 'tenant_id'::"text")));



CREATE POLICY "tenant_isolation" ON "public"."outbox_events" USING (("tenant_id" = ("auth"."jwt"() ->> 'tenant_id'::"text"))) WITH CHECK (("tenant_id" = ("auth"."jwt"() ->> 'tenant_id'::"text")));



CREATE POLICY "tenant_isolation" ON "public"."pick_grades" USING (("tenant_id" = ("auth"."jwt"() ->> 'tenant_id'::"text"))) WITH CHECK (("tenant_id" = ("auth"."jwt"() ->> 'tenant_id'::"text")));



CREATE POLICY "tenant_isolation" ON "public"."result_sets" USING (("tenant_id" = ("auth"."jwt"() ->> 'tenant_id'::"text"))) WITH CHECK (("tenant_id" = ("auth"."jwt"() ->> 'tenant_id'::"text")));



CREATE POLICY "tenant_isolation" ON "public"."subscriptions" USING (("tenant_id" = ("auth"."jwt"() ->> 'tenant_id'::"text"))) WITH CHECK (("tenant_id" = ("auth"."jwt"() ->> 'tenant_id'::"text")));



CREATE POLICY "tenant_isolation" ON "public"."tenant_memberships" USING (("tenant_id" = ("auth"."jwt"() ->> 'tenant_id'::"text"))) WITH CHECK (("tenant_id" = ("auth"."jwt"() ->> 'tenant_id'::"text")));



CREATE POLICY "tenant_isolation" ON "public"."tenant_quotas" USING (("tenant_id" = ("auth"."jwt"() ->> 'tenant_id'::"text"))) WITH CHECK (("tenant_id" = ("auth"."jwt"() ->> 'tenant_id'::"text")));



CREATE POLICY "tenant_isolation" ON "public"."tenants" USING (("id" = ("auth"."jwt"() ->> 'tenant_id'::"text"))) WITH CHECK (("id" = ("auth"."jwt"() ->> 'tenant_id'::"text")));



CREATE POLICY "tenant_isolation_mod" ON "public"."picks" USING (("tenant_id" = ("auth"."jwt"() ->> 'tenant_id'::"text"))) WITH CHECK (("tenant_id" = ("auth"."jwt"() ->> 'tenant_id'::"text")));



CREATE POLICY "tenant_isolation_select" ON "public"."picks" FOR SELECT USING (("tenant_id" = ("auth"."jwt"() ->> 'tenant_id'::"text")));



ALTER TABLE "public"."tenant_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_quotas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."unified_picks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "up_delete" ON "public"."unified_picks" FOR DELETE TO "promoter_rw" USING (false);



CREATE POLICY "up_select" ON "public"."unified_picks" FOR SELECT TO "authenticated", "ro_user" USING (true);



CREATE POLICY "up_update" ON "public"."unified_picks" FOR UPDATE TO "promoter_rw" USING (true) WITH CHECK (true);



CREATE POLICY "up_write" ON "public"."unified_picks" FOR INSERT TO "promoter_rw" WITH CHECK (true);



ALTER TABLE "public"."user_profiles_backup_20250803" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "ro_user";
GRANT USAGE ON SCHEMA "public" TO "processor_rw";
GRANT USAGE ON SCHEMA "public" TO "promoter_rw";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."auto_fill_created_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_fill_created_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_fill_created_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_fill_matchup"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_fill_matchup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_fill_matchup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_generate_player_slug"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_generate_player_slug"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_generate_player_slug"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_generate_team_slug"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_generate_team_slug"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_generate_team_slug"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dequeue_scoring_job"("batch_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."dequeue_scoring_job"("batch_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dequeue_scoring_job"("batch_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_single_writer"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_single_writer"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_single_writer"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_update_processed_at_only"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_update_processed_at_only"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_update_processed_at_only"() TO "service_role";



GRANT ALL ON FUNCTION "public"."find_missing_games"() TO "anon";
GRANT ALL ON FUNCTION "public"."find_missing_games"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_missing_games"() TO "service_role";



GRANT ALL ON TABLE "public"."outbox_events" TO "anon";
GRANT ALL ON TABLE "public"."outbox_events" TO "authenticated";
GRANT ALL ON TABLE "public"."outbox_events" TO "service_role";
GRANT SELECT ON TABLE "public"."outbox_events" TO "ro_user";



GRANT ALL ON FUNCTION "public"."fn_claim_outbox"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_claim_outbox"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_claim_outbox"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_enqueue_event"("p_tenant_id" "text", "p_event_type" "text", "p_entity_type" "text", "p_entity_id" "text", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_enqueue_event"("p_tenant_id" "text", "p_event_type" "text", "p_entity_type" "text", "p_entity_id" "text", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_enqueue_event"("p_tenant_id" "text", "p_event_type" "text", "p_entity_type" "text", "p_entity_id" "text", "p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_credit_usage_summary"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_credit_usage_summary"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_credit_usage_summary"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_credit_usage_summary"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_recent_games_today"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_recent_games_today"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_recent_games_today"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_recent_raw_props_48h"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_recent_raw_props_48h"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_recent_raw_props_48h"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_recent_unified_picks"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_recent_unified_picks"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_recent_unified_picks"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_today_sports_breakdown"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_today_sports_breakdown"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_today_sports_breakdown"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_top_performers_by_volume_today"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_top_performers_by_volume_today"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_top_performers_by_volume_today"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."grade_all_raw_props"() TO "anon";
GRANT ALL ON FUNCTION "public"."grade_all_raw_props"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."grade_all_raw_props"() TO "service_role";



GRANT ALL ON FUNCTION "public"."grade_next_100_props"() TO "anon";
GRANT ALL ON FUNCTION "public"."grade_next_100_props"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."grade_next_100_props"() TO "service_role";



GRANT ALL ON FUNCTION "public"."grade_raw_prop"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."grade_raw_prop"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."grade_raw_prop"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_credit_usage"("p_provider" "text", "p_credits" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_credit_usage"("p_provider" "text", "p_credits" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."log_credit_usage"("p_provider" "text", "p_credits" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_credit_usage"("p_provider" "text", "p_credits" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."pipeline_snapshot_json"() TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_snapshot_json"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_snapshot_json"() TO "service_role";



GRANT ALL ON FUNCTION "public"."pipeline_snapshot_pretty"() TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_snapshot_pretty"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_snapshot_pretty"() TO "service_role";



GRANT ALL ON FUNCTION "public"."plays_update_search_tsv"() TO "anon";
GRANT ALL ON FUNCTION "public"."plays_update_search_tsv"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."plays_update_search_tsv"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_unified_picks_fingerprint"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_unified_picks_fingerprint"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_unified_picks_fingerprint"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."smart_form_picks_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."smart_form_picks_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."smart_form_picks_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_quota_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_quota_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_quota_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_pick_grades_outbox"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_pick_grades_outbox"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_pick_grades_outbox"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_pick_grades_writeback"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_pick_grades_writeback"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_pick_grades_writeback"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_picks_outbox"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_picks_outbox"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_picks_outbox"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_agent_health_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_agent_health_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_agent_health_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_rbi_data"("p_unified_history_id" "uuid", "p_rbi_value" integer, "p_data_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_rbi_data"("p_unified_history_id" "uuid", "p_rbi_value" integer, "p_data_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_rbi_data"("p_unified_history_id" "uuid", "p_rbi_value" integer, "p_data_source" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_scoring_queue_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_scoring_queue_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_scoring_queue_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_system_health"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_system_health"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_system_health"() TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";


















GRANT ALL ON TABLE "public"."players" TO "anon";
GRANT ALL ON TABLE "public"."players" TO "authenticated";
GRANT ALL ON TABLE "public"."players" TO "service_role";
GRANT SELECT ON TABLE "public"."players" TO "ro_user";



GRANT ALL ON SEQUENCE "public"."Players_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."Players_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."Players_id_seq" TO "service_role";
GRANT USAGE ON SEQUENCE "public"."Players_id_seq" TO "ro_user";



GRANT ALL ON TABLE "public"."_migrations" TO "anon";
GRANT ALL ON TABLE "public"."_migrations" TO "authenticated";
GRANT ALL ON TABLE "public"."_migrations" TO "service_role";
GRANT SELECT ON TABLE "public"."_migrations" TO "ro_user";



GRANT ALL ON SEQUENCE "public"."_migrations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."_migrations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."_migrations_id_seq" TO "service_role";
GRANT USAGE ON SEQUENCE "public"."_migrations_id_seq" TO "ro_user";



GRANT ALL ON TABLE "public"."agent_controls" TO "anon";
GRANT ALL ON TABLE "public"."agent_controls" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_controls" TO "service_role";
GRANT SELECT ON TABLE "public"."agent_controls" TO "ro_user";



GRANT ALL ON TABLE "public"."agent_health" TO "anon";
GRANT ALL ON TABLE "public"."agent_health" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_health" TO "service_role";
GRANT SELECT ON TABLE "public"."agent_health" TO "ro_user";



GRANT ALL ON TABLE "public"."agent_job_runs" TO "anon";
GRANT ALL ON TABLE "public"."agent_job_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_job_runs" TO "service_role";
GRANT SELECT ON TABLE "public"."agent_job_runs" TO "ro_user";



GRANT ALL ON TABLE "public"."agent_metrics" TO "anon";
GRANT ALL ON TABLE "public"."agent_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_metrics" TO "service_role";
GRANT SELECT ON TABLE "public"."agent_metrics" TO "ro_user";



GRANT ALL ON TABLE "public"."agent_metrics_compat" TO "anon";
GRANT ALL ON TABLE "public"."agent_metrics_compat" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_metrics_compat" TO "service_role";
GRANT SELECT ON TABLE "public"."agent_metrics_compat" TO "ro_user";



GRANT ALL ON TABLE "public"."agent_tasks" TO "anon";
GRANT ALL ON TABLE "public"."agent_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_tasks" TO "service_role";
GRANT SELECT ON TABLE "public"."agent_tasks" TO "ro_user";



GRANT ALL ON TABLE "public"."agents" TO "anon";
GRANT ALL ON TABLE "public"."agents" TO "authenticated";
GRANT ALL ON TABLE "public"."agents" TO "service_role";
GRANT SELECT ON TABLE "public"."agents" TO "ro_user";



GRANT ALL ON TABLE "public"."ai_alerts_log" TO "anon";
GRANT ALL ON TABLE "public"."ai_alerts_log" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_alerts_log" TO "service_role";
GRANT SELECT ON TABLE "public"."ai_alerts_log" TO "ro_user";



GRANT ALL ON TABLE "public"."alerts_log" TO "anon";
GRANT ALL ON TABLE "public"."alerts_log" TO "authenticated";
GRANT ALL ON TABLE "public"."alerts_log" TO "service_role";
GRANT SELECT ON TABLE "public"."alerts_log" TO "ro_user";



GRANT ALL ON TABLE "public"."analytics_summary" TO "anon";
GRANT ALL ON TABLE "public"."analytics_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_summary" TO "service_role";
GRANT SELECT ON TABLE "public"."analytics_summary" TO "ro_user";



GRANT ALL ON TABLE "public"."annotations" TO "anon";
GRANT ALL ON TABLE "public"."annotations" TO "authenticated";
GRANT ALL ON TABLE "public"."annotations" TO "service_role";
GRANT SELECT ON TABLE "public"."annotations" TO "ro_user";



GRANT ALL ON TABLE "public"."api_keys" TO "anon";
GRANT ALL ON TABLE "public"."api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."api_keys" TO "service_role";
GRANT SELECT ON TABLE "public"."api_keys" TO "ro_user";



GRANT ALL ON TABLE "public"."api_quota_configs" TO "anon";
GRANT ALL ON TABLE "public"."api_quota_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."api_quota_configs" TO "service_role";
GRANT SELECT ON TABLE "public"."api_quota_configs" TO "ro_user";



GRANT ALL ON TABLE "public"."archived_props" TO "anon";
GRANT ALL ON TABLE "public"."archived_props" TO "authenticated";
GRANT ALL ON TABLE "public"."archived_props" TO "service_role";
GRANT SELECT ON TABLE "public"."archived_props" TO "ro_user";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";
GRANT SELECT ON TABLE "public"."audit_logs" TO "ro_user";



GRANT ALL ON TABLE "public"."box_scores" TO "anon";
GRANT ALL ON TABLE "public"."box_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."box_scores" TO "service_role";
GRANT SELECT ON TABLE "public"."box_scores" TO "ro_user";



GRANT ALL ON TABLE "public"."bridge_outbox" TO "anon";
GRANT ALL ON TABLE "public"."bridge_outbox" TO "authenticated";
GRANT ALL ON TABLE "public"."bridge_outbox" TO "service_role";
GRANT SELECT ON TABLE "public"."bridge_outbox" TO "ro_user";



GRANT ALL ON TABLE "public"."capper_channels" TO "anon";
GRANT ALL ON TABLE "public"."capper_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."capper_channels" TO "service_role";
GRANT SELECT ON TABLE "public"."capper_channels" TO "ro_user";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";
GRANT SELECT ON TABLE "public"."users" TO "ro_user";



GRANT ALL ON TABLE "public"."cappers" TO "anon";
GRANT ALL ON TABLE "public"."cappers" TO "authenticated";
GRANT ALL ON TABLE "public"."cappers" TO "service_role";
GRANT SELECT ON TABLE "public"."cappers" TO "ro_user";



GRANT ALL ON TABLE "public"."cappers_backup_20250803" TO "anon";
GRANT ALL ON TABLE "public"."cappers_backup_20250803" TO "authenticated";
GRANT ALL ON TABLE "public"."cappers_backup_20250803" TO "service_role";
GRANT SELECT ON TABLE "public"."cappers_backup_20250803" TO "ro_user";



GRANT ALL ON TABLE "public"."cappers_legacy" TO "anon";
GRANT ALL ON TABLE "public"."cappers_legacy" TO "authenticated";
GRANT ALL ON TABLE "public"."cappers_legacy" TO "service_role";
GRANT SELECT ON TABLE "public"."cappers_legacy" TO "ro_user";



GRANT ALL ON TABLE "public"."clv_tracking" TO "anon";
GRANT ALL ON TABLE "public"."clv_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."clv_tracking" TO "service_role";
GRANT SELECT ON TABLE "public"."clv_tracking" TO "ro_user";



GRANT ALL ON TABLE "public"."contest_participants" TO "anon";
GRANT ALL ON TABLE "public"."contest_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."contest_participants" TO "service_role";
GRANT SELECT ON TABLE "public"."contest_participants" TO "ro_user";



GRANT ALL ON TABLE "public"."contests" TO "anon";
GRANT ALL ON TABLE "public"."contests" TO "authenticated";
GRANT ALL ON TABLE "public"."contests" TO "service_role";
GRANT SELECT ON TABLE "public"."contests" TO "ro_user";



GRANT ALL ON TABLE "public"."daily_picks_backup_20250803" TO "anon";
GRANT ALL ON TABLE "public"."daily_picks_backup_20250803" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_picks_backup_20250803" TO "service_role";
GRANT SELECT ON TABLE "public"."daily_picks_backup_20250803" TO "ro_user";



GRANT ALL ON TABLE "public"."unified_picks" TO "anon";
GRANT ALL ON TABLE "public"."unified_picks" TO "authenticated";
GRANT ALL ON TABLE "public"."unified_picks" TO "service_role";
GRANT SELECT ON TABLE "public"."unified_picks" TO "ro_user";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."unified_picks" TO "promoter_rw";



GRANT ALL ON TABLE "public"."daily_picks_legacy" TO "anon";
GRANT ALL ON TABLE "public"."daily_picks_legacy" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_picks_legacy" TO "service_role";
GRANT SELECT ON TABLE "public"."daily_picks_legacy" TO "ro_user";



GRANT ALL ON TABLE "public"."raw_props" TO "anon";
GRANT ALL ON TABLE "public"."raw_props" TO "authenticated";
GRANT ALL ON TABLE "public"."raw_props" TO "service_role";
GRANT SELECT ON TABLE "public"."raw_props" TO "ro_user";
GRANT SELECT ON TABLE "public"."raw_props" TO "processor_rw";



GRANT UPDATE("processed_at") ON TABLE "public"."raw_props" TO "processor_rw";



GRANT ALL ON TABLE "public"."data_quality_summary" TO "anon";
GRANT ALL ON TABLE "public"."data_quality_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."data_quality_summary" TO "service_role";
GRANT SELECT ON TABLE "public"."data_quality_summary" TO "ro_user";



GRANT ALL ON TABLE "public"."dfs_ownership" TO "anon";
GRANT ALL ON TABLE "public"."dfs_ownership" TO "authenticated";
GRANT ALL ON TABLE "public"."dfs_ownership" TO "service_role";
GRANT SELECT ON TABLE "public"."dfs_ownership" TO "ro_user";



GRANT ALL ON TABLE "public"."dfs_salaries" TO "anon";
GRANT ALL ON TABLE "public"."dfs_salaries" TO "authenticated";
GRANT ALL ON TABLE "public"."dfs_salaries" TO "service_role";
GRANT SELECT ON TABLE "public"."dfs_salaries" TO "ro_user";



GRANT ALL ON TABLE "public"."discord_channels" TO "anon";
GRANT ALL ON TABLE "public"."discord_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."discord_channels" TO "service_role";
GRANT SELECT ON TABLE "public"."discord_channels" TO "ro_user";



GRANT ALL ON TABLE "public"."discord_messages" TO "anon";
GRANT ALL ON TABLE "public"."discord_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."discord_messages" TO "service_role";
GRANT SELECT ON TABLE "public"."discord_messages" TO "ro_user";



GRANT ALL ON TABLE "public"."dvp_matchup_ranks" TO "anon";
GRANT ALL ON TABLE "public"."dvp_matchup_ranks" TO "authenticated";
GRANT ALL ON TABLE "public"."dvp_matchup_ranks" TO "service_role";
GRANT SELECT ON TABLE "public"."dvp_matchup_ranks" TO "ro_user";



GRANT ALL ON TABLE "public"."ebooks" TO "anon";
GRANT ALL ON TABLE "public"."ebooks" TO "authenticated";
GRANT ALL ON TABLE "public"."ebooks" TO "service_role";
GRANT SELECT ON TABLE "public"."ebooks" TO "ro_user";



GRANT ALL ON TABLE "public"."edge_config" TO "anon";
GRANT ALL ON TABLE "public"."edge_config" TO "authenticated";
GRANT ALL ON TABLE "public"."edge_config" TO "service_role";
GRANT SELECT ON TABLE "public"."edge_config" TO "ro_user";



GRANT ALL ON TABLE "public"."enhanced_contests_summary" TO "anon";
GRANT ALL ON TABLE "public"."enhanced_contests_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."enhanced_contests_summary" TO "service_role";
GRANT SELECT ON TABLE "public"."enhanced_contests_summary" TO "ro_user";



GRANT ALL ON TABLE "public"."error_logs" TO "anon";
GRANT ALL ON TABLE "public"."error_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."error_logs" TO "service_role";
GRANT SELECT ON TABLE "public"."error_logs" TO "ro_user";



GRANT ALL ON TABLE "public"."ev_modeling" TO "anon";
GRANT ALL ON TABLE "public"."ev_modeling" TO "authenticated";
GRANT ALL ON TABLE "public"."ev_modeling" TO "service_role";
GRANT SELECT ON TABLE "public"."ev_modeling" TO "ro_user";



GRANT ALL ON TABLE "public"."exposure_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."exposure_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."exposure_snapshots" TO "service_role";
GRANT SELECT ON TABLE "public"."exposure_snapshots" TO "ro_user";



GRANT ALL ON TABLE "public"."feature_flags" TO "anon";
GRANT ALL ON TABLE "public"."feature_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_flags" TO "service_role";
GRANT SELECT ON TABLE "public"."feature_flags" TO "ro_user";



GRANT ALL ON TABLE "public"."features_daily_agg" TO "anon";
GRANT ALL ON TABLE "public"."features_daily_agg" TO "authenticated";
GRANT ALL ON TABLE "public"."features_daily_agg" TO "service_role";
GRANT SELECT ON TABLE "public"."features_daily_agg" TO "ro_user";



GRANT ALL ON TABLE "public"."final_picks" TO "anon";
GRANT ALL ON TABLE "public"."final_picks" TO "authenticated";
GRANT ALL ON TABLE "public"."final_picks" TO "service_role";
GRANT SELECT ON TABLE "public"."final_picks" TO "ro_user";



GRANT ALL ON TABLE "public"."final_picks_backup_20250803" TO "anon";
GRANT ALL ON TABLE "public"."final_picks_backup_20250803" TO "authenticated";
GRANT ALL ON TABLE "public"."final_picks_backup_20250803" TO "service_role";
GRANT SELECT ON TABLE "public"."final_picks_backup_20250803" TO "ro_user";



GRANT ALL ON TABLE "public"."final_picks_legacy" TO "anon";
GRANT ALL ON TABLE "public"."final_picks_legacy" TO "authenticated";
GRANT ALL ON TABLE "public"."final_picks_legacy" TO "service_role";
GRANT SELECT ON TABLE "public"."final_picks_legacy" TO "ro_user";



GRANT ALL ON TABLE "public"."formations" TO "anon";
GRANT ALL ON TABLE "public"."formations" TO "authenticated";
GRANT ALL ON TABLE "public"."formations" TO "service_role";
GRANT SELECT ON TABLE "public"."formations" TO "ro_user";



GRANT ALL ON TABLE "public"."games" TO "anon";
GRANT ALL ON TABLE "public"."games" TO "authenticated";
GRANT ALL ON TABLE "public"."games" TO "service_role";
GRANT SELECT ON TABLE "public"."games" TO "ro_user";



GRANT ALL ON TABLE "public"."hedge_alert_log" TO "anon";
GRANT ALL ON TABLE "public"."hedge_alert_log" TO "authenticated";
GRANT ALL ON TABLE "public"."hedge_alert_log" TO "service_role";
GRANT SELECT ON TABLE "public"."hedge_alert_log" TO "ro_user";



GRANT ALL ON TABLE "public"."historical_config" TO "anon";
GRANT ALL ON TABLE "public"."historical_config" TO "authenticated";
GRANT ALL ON TABLE "public"."historical_config" TO "service_role";
GRANT SELECT ON TABLE "public"."historical_config" TO "ro_user";



GRANT ALL ON SEQUENCE "public"."historical_config_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."historical_config_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."historical_config_id_seq" TO "service_role";
GRANT USAGE ON SEQUENCE "public"."historical_config_id_seq" TO "ro_user";



GRANT ALL ON TABLE "public"."historical_player_logs" TO "anon";
GRANT ALL ON TABLE "public"."historical_player_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."historical_player_logs" TO "service_role";
GRANT SELECT ON TABLE "public"."historical_player_logs" TO "ro_user";



GRANT ALL ON TABLE "public"."idempotency_keys" TO "anon";
GRANT ALL ON TABLE "public"."idempotency_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."idempotency_keys" TO "service_role";
GRANT SELECT ON TABLE "public"."idempotency_keys" TO "ro_user";



GRANT ALL ON TABLE "public"."injury_alert_log" TO "anon";
GRANT ALL ON TABLE "public"."injury_alert_log" TO "authenticated";
GRANT ALL ON TABLE "public"."injury_alert_log" TO "service_role";
GRANT SELECT ON TABLE "public"."injury_alert_log" TO "ro_user";



GRANT ALL ON TABLE "public"."leaderboards" TO "anon";
GRANT ALL ON TABLE "public"."leaderboards" TO "authenticated";
GRANT ALL ON TABLE "public"."leaderboards" TO "service_role";
GRANT SELECT ON TABLE "public"."leaderboards" TO "ro_user";



GRANT ALL ON TABLE "public"."line_movement_log" TO "anon";
GRANT ALL ON TABLE "public"."line_movement_log" TO "authenticated";
GRANT ALL ON TABLE "public"."line_movement_log" TO "service_role";
GRANT SELECT ON TABLE "public"."line_movement_log" TO "ro_user";



GRANT ALL ON TABLE "public"."line_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."line_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."line_snapshots" TO "service_role";
GRANT SELECT ON TABLE "public"."line_snapshots" TO "ro_user";



GRANT ALL ON SEQUENCE "public"."line_snapshots_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."line_snapshots_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."line_snapshots_id_seq" TO "service_role";
GRANT USAGE ON SEQUENCE "public"."line_snapshots_id_seq" TO "ro_user";



GRANT ALL ON TABLE "public"."unified_sports_history" TO "anon";
GRANT ALL ON TABLE "public"."unified_sports_history" TO "authenticated";
GRANT ALL ON TABLE "public"."unified_sports_history" TO "service_role";
GRANT SELECT ON TABLE "public"."unified_sports_history" TO "ro_user";



GRANT ALL ON TABLE "public"."mlb_player_performance_summary" TO "anon";
GRANT ALL ON TABLE "public"."mlb_player_performance_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."mlb_player_performance_summary" TO "service_role";
GRANT SELECT ON TABLE "public"."mlb_player_performance_summary" TO "ro_user";



GRANT ALL ON TABLE "public"."mv_pipeline_lag_24h" TO "anon";
GRANT ALL ON TABLE "public"."mv_pipeline_lag_24h" TO "authenticated";
GRANT ALL ON TABLE "public"."mv_pipeline_lag_24h" TO "service_role";
GRANT SELECT ON TABLE "public"."mv_pipeline_lag_24h" TO "ro_user";



GRANT ALL ON TABLE "public"."odds_history" TO "anon";
GRANT ALL ON TABLE "public"."odds_history" TO "authenticated";
GRANT ALL ON TABLE "public"."odds_history" TO "service_role";
GRANT SELECT ON TABLE "public"."odds_history" TO "ro_user";



GRANT ALL ON TABLE "public"."onboarding_config" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_config" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_config" TO "service_role";
GRANT SELECT ON TABLE "public"."onboarding_config" TO "ro_user";



GRANT ALL ON TABLE "public"."orphaned_picks_backup" TO "anon";
GRANT ALL ON TABLE "public"."orphaned_picks_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."orphaned_picks_backup" TO "service_role";
GRANT SELECT ON TABLE "public"."orphaned_picks_backup" TO "ro_user";



GRANT ALL ON TABLE "public"."orphaned_props_backup" TO "anon";
GRANT ALL ON TABLE "public"."orphaned_props_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."orphaned_props_backup" TO "service_role";
GRANT SELECT ON TABLE "public"."orphaned_props_backup" TO "ro_user";



GRANT ALL ON SEQUENCE "public"."outbox_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."outbox_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."outbox_events_id_seq" TO "service_role";
GRANT USAGE ON SEQUENCE "public"."outbox_events_id_seq" TO "ro_user";



GRANT ALL ON TABLE "public"."parlay_tickets" TO "anon";
GRANT ALL ON TABLE "public"."parlay_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."parlay_tickets" TO "service_role";
GRANT SELECT ON TABLE "public"."parlay_tickets" TO "ro_user";



GRANT ALL ON TABLE "public"."pick_grades" TO "anon";
GRANT ALL ON TABLE "public"."pick_grades" TO "authenticated";
GRANT ALL ON TABLE "public"."pick_grades" TO "service_role";
GRANT SELECT ON TABLE "public"."pick_grades" TO "ro_user";



GRANT ALL ON SEQUENCE "public"."pick_grades_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pick_grades_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pick_grades_id_seq" TO "service_role";
GRANT USAGE ON SEQUENCE "public"."pick_grades_id_seq" TO "ro_user";



GRANT ALL ON TABLE "public"."picks" TO "anon";
GRANT ALL ON TABLE "public"."picks" TO "authenticated";
GRANT ALL ON TABLE "public"."picks" TO "service_role";
GRANT SELECT ON TABLE "public"."picks" TO "ro_user";



GRANT ALL ON TABLE "public"."picks_backup_20250803" TO "anon";
GRANT ALL ON TABLE "public"."picks_backup_20250803" TO "authenticated";
GRANT ALL ON TABLE "public"."picks_backup_20250803" TO "service_role";
GRANT SELECT ON TABLE "public"."picks_backup_20250803" TO "ro_user";



GRANT ALL ON SEQUENCE "public"."picks_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."picks_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."picks_id_seq" TO "service_role";
GRANT USAGE ON SEQUENCE "public"."picks_id_seq" TO "ro_user";



GRANT ALL ON TABLE "public"."player_injuries" TO "anon";
GRANT ALL ON TABLE "public"."player_injuries" TO "authenticated";
GRANT ALL ON TABLE "public"."player_injuries" TO "service_role";
GRANT SELECT ON TABLE "public"."player_injuries" TO "ro_user";



GRANT ALL ON TABLE "public"."player_logs" TO "anon";
GRANT ALL ON TABLE "public"."player_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."player_logs" TO "service_role";
GRANT SELECT ON TABLE "public"."player_logs" TO "ro_user";



GRANT ALL ON TABLE "public"."player_stat_logs" TO "anon";
GRANT ALL ON TABLE "public"."player_stat_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."player_stat_logs" TO "service_role";
GRANT SELECT ON TABLE "public"."player_stat_logs" TO "ro_user";



GRANT ALL ON TABLE "public"."player_usage_trends" TO "anon";
GRANT ALL ON TABLE "public"."player_usage_trends" TO "authenticated";
GRANT ALL ON TABLE "public"."player_usage_trends" TO "service_role";
GRANT SELECT ON TABLE "public"."player_usage_trends" TO "ro_user";



GRANT ALL ON TABLE "public"."plays" TO "anon";
GRANT ALL ON TABLE "public"."plays" TO "authenticated";
GRANT ALL ON TABLE "public"."plays" TO "service_role";
GRANT SELECT ON TABLE "public"."plays" TO "ro_user";



GRANT ALL ON TABLE "public"."processing_logs" TO "anon";
GRANT ALL ON TABLE "public"."processing_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."processing_logs" TO "service_role";
GRANT SELECT ON TABLE "public"."processing_logs" TO "ro_user";



GRANT ALL ON TABLE "public"."prop_ticks_hot" TO "anon";
GRANT ALL ON TABLE "public"."prop_ticks_hot" TO "authenticated";
GRANT ALL ON TABLE "public"."prop_ticks_hot" TO "service_role";
GRANT SELECT ON TABLE "public"."prop_ticks_hot" TO "ro_user";



GRANT ALL ON TABLE "public"."prop_ticks_hot_p20250911" TO "anon";
GRANT ALL ON TABLE "public"."prop_ticks_hot_p20250911" TO "authenticated";
GRANT ALL ON TABLE "public"."prop_ticks_hot_p20250911" TO "service_role";
GRANT SELECT ON TABLE "public"."prop_ticks_hot_p20250911" TO "ro_user";



GRANT ALL ON TABLE "public"."raw_props_historical" TO "anon";
GRANT ALL ON TABLE "public"."raw_props_historical" TO "authenticated";
GRANT ALL ON TABLE "public"."raw_props_historical" TO "service_role";
GRANT SELECT ON TABLE "public"."raw_props_historical" TO "ro_user";



GRANT ALL ON TABLE "public"."raw_props_hot" TO "anon";
GRANT ALL ON TABLE "public"."raw_props_hot" TO "authenticated";
GRANT ALL ON TABLE "public"."raw_props_hot" TO "service_role";
GRANT SELECT ON TABLE "public"."raw_props_hot" TO "ro_user";



GRANT ALL ON TABLE "public"."raw_props_recent" TO "anon";
GRANT ALL ON TABLE "public"."raw_props_recent" TO "authenticated";
GRANT ALL ON TABLE "public"."raw_props_recent" TO "service_role";
GRANT SELECT ON TABLE "public"."raw_props_recent" TO "ro_user";



GRANT ALL ON TABLE "public"."rbi_backfill_queue" TO "anon";
GRANT ALL ON TABLE "public"."rbi_backfill_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."rbi_backfill_queue" TO "service_role";
GRANT SELECT ON TABLE "public"."rbi_backfill_queue" TO "ro_user";



GRANT ALL ON TABLE "public"."recap_log" TO "anon";
GRANT ALL ON TABLE "public"."recap_log" TO "authenticated";
GRANT ALL ON TABLE "public"."recap_log" TO "service_role";
GRANT SELECT ON TABLE "public"."recap_log" TO "ro_user";



GRANT ALL ON TABLE "public"."recap_runs" TO "anon";
GRANT ALL ON TABLE "public"."recap_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."recap_runs" TO "service_role";
GRANT SELECT ON TABLE "public"."recap_runs" TO "ro_user";



GRANT ALL ON TABLE "public"."recap_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."recap_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."recap_snapshots" TO "service_role";
GRANT SELECT ON TABLE "public"."recap_snapshots" TO "ro_user";



GRANT ALL ON TABLE "public"."referral_events" TO "anon";
GRANT ALL ON TABLE "public"."referral_events" TO "authenticated";
GRANT ALL ON TABLE "public"."referral_events" TO "service_role";
GRANT SELECT ON TABLE "public"."referral_events" TO "ro_user";



GRANT ALL ON TABLE "public"."referral_rewards" TO "anon";
GRANT ALL ON TABLE "public"."referral_rewards" TO "authenticated";
GRANT ALL ON TABLE "public"."referral_rewards" TO "service_role";
GRANT SELECT ON TABLE "public"."referral_rewards" TO "ro_user";



GRANT ALL ON TABLE "public"."referrals" TO "anon";
GRANT ALL ON TABLE "public"."referrals" TO "authenticated";
GRANT ALL ON TABLE "public"."referrals" TO "service_role";
GRANT SELECT ON TABLE "public"."referrals" TO "ro_user";



GRANT ALL ON TABLE "public"."result_sets" TO "anon";
GRANT ALL ON TABLE "public"."result_sets" TO "authenticated";
GRANT ALL ON TABLE "public"."result_sets" TO "service_role";
GRANT SELECT ON TABLE "public"."result_sets" TO "ro_user";



GRANT ALL ON SEQUENCE "public"."result_sets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."result_sets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."result_sets_id_seq" TO "service_role";
GRANT USAGE ON SEQUENCE "public"."result_sets_id_seq" TO "ro_user";



GRANT ALL ON TABLE "public"."runtime_config" TO "anon";
GRANT ALL ON TABLE "public"."runtime_config" TO "authenticated";
GRANT ALL ON TABLE "public"."runtime_config" TO "service_role";
GRANT SELECT ON TABLE "public"."runtime_config" TO "ro_user";



GRANT ALL ON TABLE "public"."scoring_queue" TO "anon";
GRANT ALL ON TABLE "public"."scoring_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."scoring_queue" TO "service_role";
GRANT SELECT ON TABLE "public"."scoring_queue" TO "ro_user";



GRANT ALL ON TABLE "public"."security_events" TO "anon";
GRANT ALL ON TABLE "public"."security_events" TO "authenticated";
GRANT ALL ON TABLE "public"."security_events" TO "service_role";
GRANT SELECT ON TABLE "public"."security_events" TO "ro_user";



GRANT ALL ON TABLE "public"."settlement_results" TO "anon";
GRANT ALL ON TABLE "public"."settlement_results" TO "authenticated";
GRANT ALL ON TABLE "public"."settlement_results" TO "service_role";
GRANT SELECT ON TABLE "public"."settlement_results" TO "ro_user";



GRANT ALL ON TABLE "public"."shadow_decisions" TO "anon";
GRANT ALL ON TABLE "public"."shadow_decisions" TO "authenticated";
GRANT ALL ON TABLE "public"."shadow_decisions" TO "service_role";
GRANT SELECT ON TABLE "public"."shadow_decisions" TO "ro_user";



GRANT ALL ON TABLE "public"."smart_form_picks" TO "anon";
GRANT ALL ON TABLE "public"."smart_form_picks" TO "authenticated";
GRANT ALL ON TABLE "public"."smart_form_picks" TO "service_role";
GRANT SELECT ON TABLE "public"."smart_form_picks" TO "ro_user";



GRANT ALL ON TABLE "public"."sports_game_odds" TO "anon";
GRANT ALL ON TABLE "public"."sports_game_odds" TO "authenticated";
GRANT ALL ON TABLE "public"."sports_game_odds" TO "service_role";
GRANT SELECT ON TABLE "public"."sports_game_odds" TO "ro_user";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";
GRANT SELECT ON TABLE "public"."subscriptions" TO "ro_user";



GRANT ALL ON TABLE "public"."system_changelog" TO "anon";
GRANT ALL ON TABLE "public"."system_changelog" TO "authenticated";
GRANT ALL ON TABLE "public"."system_changelog" TO "service_role";
GRANT SELECT ON TABLE "public"."system_changelog" TO "ro_user";



GRANT ALL ON TABLE "public"."system_config" TO "anon";
GRANT ALL ON TABLE "public"."system_config" TO "authenticated";
GRANT ALL ON TABLE "public"."system_config" TO "service_role";
GRANT SELECT ON TABLE "public"."system_config" TO "ro_user";



GRANT ALL ON TABLE "public"."system_incidents" TO "anon";
GRANT ALL ON TABLE "public"."system_incidents" TO "authenticated";
GRANT ALL ON TABLE "public"."system_incidents" TO "service_role";
GRANT SELECT ON TABLE "public"."system_incidents" TO "ro_user";



GRANT ALL ON TABLE "public"."unit_talk_alerts_log" TO "anon";
GRANT ALL ON TABLE "public"."unit_talk_alerts_log" TO "authenticated";
GRANT ALL ON TABLE "public"."unit_talk_alerts_log" TO "service_role";
GRANT SELECT ON TABLE "public"."unit_talk_alerts_log" TO "ro_user";



GRANT ALL ON TABLE "public"."system_health_snapshot" TO "anon";
GRANT ALL ON TABLE "public"."system_health_snapshot" TO "authenticated";
GRANT ALL ON TABLE "public"."system_health_snapshot" TO "service_role";
GRANT SELECT ON TABLE "public"."system_health_snapshot" TO "ro_user";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";
GRANT SELECT ON TABLE "public"."teams" TO "ro_user";



GRANT ALL ON TABLE "public"."tenant_memberships" TO "anon";
GRANT ALL ON TABLE "public"."tenant_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_memberships" TO "service_role";
GRANT SELECT ON TABLE "public"."tenant_memberships" TO "ro_user";



GRANT ALL ON TABLE "public"."tenant_quotas" TO "anon";
GRANT ALL ON TABLE "public"."tenant_quotas" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_quotas" TO "service_role";
GRANT SELECT ON TABLE "public"."tenant_quotas" TO "ro_user";



GRANT ALL ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";
GRANT SELECT ON TABLE "public"."tenants" TO "ro_user";



GRANT ALL ON TABLE "public"."ticket_legs" TO "anon";
GRANT ALL ON TABLE "public"."ticket_legs" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_legs" TO "service_role";
GRANT SELECT ON TABLE "public"."ticket_legs" TO "ro_user";



GRANT ALL ON TABLE "public"."tickets" TO "anon";
GRANT ALL ON TABLE "public"."tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."tickets" TO "service_role";
GRANT SELECT ON TABLE "public"."tickets" TO "ro_user";



GRANT ALL ON TABLE "public"."trend_hit_rate_view" TO "anon";
GRANT ALL ON TABLE "public"."trend_hit_rate_view" TO "authenticated";
GRANT ALL ON TABLE "public"."trend_hit_rate_view" TO "service_role";
GRANT SELECT ON TABLE "public"."trend_hit_rate_view" TO "ro_user";



GRANT ALL ON TABLE "public"."user_profiles_backup_20250803" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles_backup_20250803" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles_backup_20250803" TO "service_role";
GRANT SELECT ON TABLE "public"."user_profiles_backup_20250803" TO "ro_user";



GRANT ALL ON TABLE "public"."v_games_48h" TO "anon";
GRANT ALL ON TABLE "public"."v_games_48h" TO "authenticated";
GRANT ALL ON TABLE "public"."v_games_48h" TO "service_role";
GRANT SELECT ON TABLE "public"."v_games_48h" TO "ro_user";



GRANT ALL ON TABLE "public"."v_ingestion_health" TO "anon";
GRANT ALL ON TABLE "public"."v_ingestion_health" TO "authenticated";
GRANT ALL ON TABLE "public"."v_ingestion_health" TO "service_role";
GRANT SELECT ON TABLE "public"."v_ingestion_health" TO "ro_user";



GRANT ALL ON TABLE "public"."v_ops_health" TO "anon";
GRANT ALL ON TABLE "public"."v_ops_health" TO "authenticated";
GRANT ALL ON TABLE "public"."v_ops_health" TO "service_role";
GRANT SELECT ON TABLE "public"."v_ops_health" TO "ro_user";



GRANT ALL ON TABLE "public"."v_pipeline_blockers" TO "anon";
GRANT ALL ON TABLE "public"."v_pipeline_blockers" TO "authenticated";
GRANT ALL ON TABLE "public"."v_pipeline_blockers" TO "service_role";
GRANT SELECT ON TABLE "public"."v_pipeline_blockers" TO "ro_user";



GRANT ALL ON TABLE "public"."v_promo_backlog" TO "anon";
GRANT ALL ON TABLE "public"."v_promo_backlog" TO "authenticated";
GRANT ALL ON TABLE "public"."v_promo_backlog" TO "service_role";
GRANT SELECT ON TABLE "public"."v_promo_backlog" TO "ro_user";



GRANT ALL ON TABLE "public"."v_raw_props_48h" TO "anon";
GRANT ALL ON TABLE "public"."v_raw_props_48h" TO "authenticated";
GRANT ALL ON TABLE "public"."v_raw_props_48h" TO "service_role";
GRANT SELECT ON TABLE "public"."v_raw_props_48h" TO "ro_user";



GRANT ALL ON TABLE "public"."v_recent_promotions_24h" TO "anon";
GRANT ALL ON TABLE "public"."v_recent_promotions_24h" TO "authenticated";
GRANT ALL ON TABLE "public"."v_recent_promotions_24h" TO "service_role";
GRANT SELECT ON TABLE "public"."v_recent_promotions_24h" TO "ro_user";



GRANT ALL ON TABLE "public"."v_unified_health" TO "anon";
GRANT ALL ON TABLE "public"."v_unified_health" TO "authenticated";
GRANT ALL ON TABLE "public"."v_unified_health" TO "service_role";
GRANT SELECT ON TABLE "public"."v_unified_health" TO "ro_user";



GRANT ALL ON TABLE "public"."v_unified_picks_health_24h" TO "anon";
GRANT ALL ON TABLE "public"."v_unified_picks_health_24h" TO "authenticated";
GRANT ALL ON TABLE "public"."v_unified_picks_health_24h" TO "service_role";
GRANT SELECT ON TABLE "public"."v_unified_picks_health_24h" TO "ro_user";



GRANT ALL ON TABLE "public"."view_ai_training_set" TO "anon";
GRANT ALL ON TABLE "public"."view_ai_training_set" TO "authenticated";
GRANT ALL ON TABLE "public"."view_ai_training_set" TO "service_role";
GRANT SELECT ON TABLE "public"."view_ai_training_set" TO "ro_user";



GRANT ALL ON TABLE "public"."view_alert_overlay" TO "anon";
GRANT ALL ON TABLE "public"."view_alert_overlay" TO "authenticated";
GRANT ALL ON TABLE "public"."view_alert_overlay" TO "service_role";
GRANT SELECT ON TABLE "public"."view_alert_overlay" TO "ro_user";



GRANT ALL ON TABLE "public"."view_alerted_picks" TO "anon";
GRANT ALL ON TABLE "public"."view_alerted_picks" TO "authenticated";
GRANT ALL ON TABLE "public"."view_alerted_picks" TO "service_role";
GRANT SELECT ON TABLE "public"."view_alerted_picks" TO "ro_user";



GRANT ALL ON TABLE "public"."view_auto_tag_checklist" TO "anon";
GRANT ALL ON TABLE "public"."view_auto_tag_checklist" TO "authenticated";
GRANT ALL ON TABLE "public"."view_auto_tag_checklist" TO "service_role";
GRANT SELECT ON TABLE "public"."view_auto_tag_checklist" TO "ro_user";



GRANT ALL ON TABLE "public"."view_best_cappers_by_edge" TO "anon";
GRANT ALL ON TABLE "public"."view_best_cappers_by_edge" TO "authenticated";
GRANT ALL ON TABLE "public"."view_best_cappers_by_edge" TO "service_role";
GRANT SELECT ON TABLE "public"."view_best_cappers_by_edge" TO "ro_user";



GRANT ALL ON TABLE "public"."view_daily_final_recaps" TO "anon";
GRANT ALL ON TABLE "public"."view_daily_final_recaps" TO "authenticated";
GRANT ALL ON TABLE "public"."view_daily_final_recaps" TO "service_role";
GRANT SELECT ON TABLE "public"."view_daily_final_recaps" TO "ro_user";



GRANT ALL ON TABLE "public"."view_daily_highlights" TO "anon";
GRANT ALL ON TABLE "public"."view_daily_highlights" TO "authenticated";
GRANT ALL ON TABLE "public"."view_daily_highlights" TO "service_role";
GRANT SELECT ON TABLE "public"."view_daily_highlights" TO "ro_user";



GRANT ALL ON TABLE "public"."view_daily_posted_picks" TO "anon";
GRANT ALL ON TABLE "public"."view_daily_posted_picks" TO "authenticated";
GRANT ALL ON TABLE "public"."view_daily_posted_picks" TO "service_role";
GRANT SELECT ON TABLE "public"."view_daily_posted_picks" TO "ro_user";



GRANT ALL ON TABLE "public"."view_deduped_player_logs" TO "anon";
GRANT ALL ON TABLE "public"."view_deduped_player_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."view_deduped_player_logs" TO "service_role";
GRANT SELECT ON TABLE "public"."view_deduped_player_logs" TO "ro_user";



GRANT ALL ON TABLE "public"."view_duplicate_check" TO "anon";
GRANT ALL ON TABLE "public"."view_duplicate_check" TO "authenticated";
GRANT ALL ON TABLE "public"."view_duplicate_check" TO "service_role";
GRANT SELECT ON TABLE "public"."view_duplicate_check" TO "ro_user";



GRANT ALL ON TABLE "public"."view_scoring_summary" TO "anon";
GRANT ALL ON TABLE "public"."view_scoring_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."view_scoring_summary" TO "service_role";
GRANT SELECT ON TABLE "public"."view_scoring_summary" TO "ro_user";



GRANT ALL ON TABLE "public"."view_edge_score" TO "anon";
GRANT ALL ON TABLE "public"."view_edge_score" TO "authenticated";
GRANT ALL ON TABLE "public"."view_edge_score" TO "service_role";
GRANT SELECT ON TABLE "public"."view_edge_score" TO "ro_user";



GRANT ALL ON TABLE "public"."view_edge_summary" TO "anon";
GRANT ALL ON TABLE "public"."view_edge_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."view_edge_summary" TO "service_role";
GRANT SELECT ON TABLE "public"."view_edge_summary" TO "ro_user";



GRANT ALL ON TABLE "public"."view_edge_trends" TO "anon";
GRANT ALL ON TABLE "public"."view_edge_trends" TO "authenticated";
GRANT ALL ON TABLE "public"."view_edge_trends" TO "service_role";
GRANT SELECT ON TABLE "public"."view_edge_trends" TO "ro_user";



GRANT ALL ON TABLE "public"."view_enriched_daily_picks" TO "anon";
GRANT ALL ON TABLE "public"."view_enriched_daily_picks" TO "authenticated";
GRANT ALL ON TABLE "public"."view_enriched_daily_picks" TO "service_role";
GRANT SELECT ON TABLE "public"."view_enriched_daily_picks" TO "ro_user";



GRANT ALL ON TABLE "public"."view_enriched_final_picks" TO "anon";
GRANT ALL ON TABLE "public"."view_enriched_final_picks" TO "authenticated";
GRANT ALL ON TABLE "public"."view_enriched_final_picks" TO "service_role";
GRANT SELECT ON TABLE "public"."view_enriched_final_picks" TO "ro_user";



GRANT ALL ON TABLE "public"."view_enriched_picks" TO "anon";
GRANT ALL ON TABLE "public"."view_enriched_picks" TO "authenticated";
GRANT ALL ON TABLE "public"."view_enriched_picks" TO "service_role";
GRANT SELECT ON TABLE "public"."view_enriched_picks" TO "ro_user";



GRANT ALL ON TABLE "public"."view_final_pick_queue" TO "anon";
GRANT ALL ON TABLE "public"."view_final_pick_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."view_final_pick_queue" TO "service_role";
GRANT SELECT ON TABLE "public"."view_final_pick_queue" TO "ro_user";



GRANT ALL ON TABLE "public"."view_final_picks_by_ticket_type" TO "anon";
GRANT ALL ON TABLE "public"."view_final_picks_by_ticket_type" TO "authenticated";
GRANT ALL ON TABLE "public"."view_final_picks_by_ticket_type" TO "service_role";
GRANT SELECT ON TABLE "public"."view_final_picks_by_ticket_type" TO "ro_user";



GRANT ALL ON TABLE "public"."view_graded_props" TO "anon";
GRANT ALL ON TABLE "public"."view_graded_props" TO "authenticated";
GRANT ALL ON TABLE "public"."view_graded_props" TO "service_role";
GRANT SELECT ON TABLE "public"."view_graded_props" TO "ro_user";



GRANT ALL ON TABLE "public"."view_graded_vs_actual_errors" TO "anon";
GRANT ALL ON TABLE "public"."view_graded_vs_actual_errors" TO "authenticated";
GRANT ALL ON TABLE "public"."view_graded_vs_actual_errors" TO "service_role";
GRANT SELECT ON TABLE "public"."view_graded_vs_actual_errors" TO "ro_user";



GRANT ALL ON TABLE "public"."view_hedge_opportunities" TO "anon";
GRANT ALL ON TABLE "public"."view_hedge_opportunities" TO "authenticated";
GRANT ALL ON TABLE "public"."view_hedge_opportunities" TO "service_role";
GRANT SELECT ON TABLE "public"."view_hedge_opportunities" TO "ro_user";



GRANT ALL ON TABLE "public"."view_injury_alert_queue" TO "anon";
GRANT ALL ON TABLE "public"."view_injury_alert_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."view_injury_alert_queue" TO "service_role";
GRANT SELECT ON TABLE "public"."view_injury_alert_queue" TO "ro_user";



GRANT ALL ON TABLE "public"."view_line_movement_flags" TO "anon";
GRANT ALL ON TABLE "public"."view_line_movement_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."view_line_movement_flags" TO "service_role";
GRANT SELECT ON TABLE "public"."view_line_movement_flags" TO "ro_user";



GRANT ALL ON TABLE "public"."view_manual_override_needed" TO "anon";
GRANT ALL ON TABLE "public"."view_manual_override_needed" TO "authenticated";
GRANT ALL ON TABLE "public"."view_manual_override_needed" TO "service_role";
GRANT SELECT ON TABLE "public"."view_manual_override_needed" TO "ro_user";



GRANT ALL ON TABLE "public"."view_missed_predictions" TO "anon";
GRANT ALL ON TABLE "public"."view_missed_predictions" TO "authenticated";
GRANT ALL ON TABLE "public"."view_missed_predictions" TO "service_role";
GRANT SELECT ON TABLE "public"."view_missed_predictions" TO "ro_user";



GRANT ALL ON TABLE "public"."view_monthly_cappers" TO "anon";
GRANT ALL ON TABLE "public"."view_monthly_cappers" TO "authenticated";
GRANT ALL ON TABLE "public"."view_monthly_cappers" TO "service_role";
GRANT SELECT ON TABLE "public"."view_monthly_cappers" TO "ro_user";



GRANT ALL ON TABLE "public"."view_parlay_tickets" TO "anon";
GRANT ALL ON TABLE "public"."view_parlay_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."view_parlay_tickets" TO "service_role";
GRANT SELECT ON TABLE "public"."view_parlay_tickets" TO "ro_user";



GRANT ALL ON TABLE "public"."view_pending_grades" TO "anon";
GRANT ALL ON TABLE "public"."view_pending_grades" TO "authenticated";
GRANT ALL ON TABLE "public"."view_pending_grades" TO "service_role";
GRANT SELECT ON TABLE "public"."view_pending_grades" TO "ro_user";



GRANT ALL ON TABLE "public"."view_pick_conflict_flags" TO "anon";
GRANT ALL ON TABLE "public"."view_pick_conflict_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."view_pick_conflict_flags" TO "service_role";
GRANT SELECT ON TABLE "public"."view_pick_conflict_flags" TO "ro_user";



GRANT ALL ON TABLE "public"."view_pick_lifecycle_tracker" TO "anon";
GRANT ALL ON TABLE "public"."view_pick_lifecycle_tracker" TO "authenticated";
GRANT ALL ON TABLE "public"."view_pick_lifecycle_tracker" TO "service_role";
GRANT SELECT ON TABLE "public"."view_pick_lifecycle_tracker" TO "ro_user";



GRANT ALL ON TABLE "public"."view_player_stats" TO "anon";
GRANT ALL ON TABLE "public"."view_player_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."view_player_stats" TO "service_role";
GRANT SELECT ON TABLE "public"."view_player_stats" TO "ro_user";



GRANT ALL ON TABLE "public"."view_postable_final_picks" TO "anon";
GRANT ALL ON TABLE "public"."view_postable_final_picks" TO "authenticated";
GRANT ALL ON TABLE "public"."view_postable_final_picks" TO "service_role";
GRANT SELECT ON TABLE "public"."view_postable_final_picks" TO "ro_user";



GRANT ALL ON TABLE "public"."view_recap_summaries" TO "anon";
GRANT ALL ON TABLE "public"."view_recap_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."view_recap_summaries" TO "service_role";
GRANT SELECT ON TABLE "public"."view_recap_summaries" TO "ro_user";



GRANT ALL ON TABLE "public"."view_result_distribution" TO "anon";
GRANT ALL ON TABLE "public"."view_result_distribution" TO "authenticated";
GRANT ALL ON TABLE "public"."view_result_distribution" TO "service_role";
GRANT SELECT ON TABLE "public"."view_result_distribution" TO "ro_user";



GRANT ALL ON TABLE "public"."view_roi_by_ticket_type" TO "anon";
GRANT ALL ON TABLE "public"."view_roi_by_ticket_type" TO "authenticated";
GRANT ALL ON TABLE "public"."view_roi_by_ticket_type" TO "service_role";
GRANT SELECT ON TABLE "public"."view_roi_by_ticket_type" TO "ro_user";



GRANT ALL ON TABLE "public"."view_roi_by_tier" TO "anon";
GRANT ALL ON TABLE "public"."view_roi_by_tier" TO "authenticated";
GRANT ALL ON TABLE "public"."view_roi_by_tier" TO "service_role";
GRANT SELECT ON TABLE "public"."view_roi_by_tier" TO "ro_user";



GRANT ALL ON TABLE "public"."view_rr_tickets" TO "anon";
GRANT ALL ON TABLE "public"."view_rr_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."view_rr_tickets" TO "service_role";
GRANT SELECT ON TABLE "public"."view_rr_tickets" TO "ro_user";



GRANT ALL ON TABLE "public"."view_scored_raw_props" TO "anon";
GRANT ALL ON TABLE "public"."view_scored_raw_props" TO "authenticated";
GRANT ALL ON TABLE "public"."view_scored_raw_props" TO "service_role";
GRANT SELECT ON TABLE "public"."view_scored_raw_props" TO "ro_user";



GRANT ALL ON TABLE "public"."view_stat_grading_summary" TO "anon";
GRANT ALL ON TABLE "public"."view_stat_grading_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."view_stat_grading_summary" TO "service_role";
GRANT SELECT ON TABLE "public"."view_stat_grading_summary" TO "ro_user";



GRANT ALL ON TABLE "public"."view_steam_moves_today" TO "anon";
GRANT ALL ON TABLE "public"."view_steam_moves_today" TO "authenticated";
GRANT ALL ON TABLE "public"."view_steam_moves_today" TO "service_role";
GRANT SELECT ON TABLE "public"."view_steam_moves_today" TO "ro_user";



GRANT ALL ON TABLE "public"."view_tier_distribution" TO "anon";
GRANT ALL ON TABLE "public"."view_tier_distribution" TO "authenticated";
GRANT ALL ON TABLE "public"."view_tier_distribution" TO "service_role";
GRANT SELECT ON TABLE "public"."view_tier_distribution" TO "ro_user";



GRANT ALL ON TABLE "public"."view_tier_result_distribution" TO "anon";
GRANT ALL ON TABLE "public"."view_tier_result_distribution" TO "authenticated";
GRANT ALL ON TABLE "public"."view_tier_result_distribution" TO "service_role";
GRANT SELECT ON TABLE "public"."view_tier_result_distribution" TO "ro_user";



GRANT ALL ON TABLE "public"."view_top_streaks" TO "anon";
GRANT ALL ON TABLE "public"."view_top_streaks" TO "authenticated";
GRANT ALL ON TABLE "public"."view_top_streaks" TO "service_role";
GRANT SELECT ON TABLE "public"."view_top_streaks" TO "ro_user";



GRANT ALL ON TABLE "public"."view_ungraded_but_has_result" TO "anon";
GRANT ALL ON TABLE "public"."view_ungraded_but_has_result" TO "authenticated";
GRANT ALL ON TABLE "public"."view_ungraded_but_has_result" TO "service_role";
GRANT SELECT ON TABLE "public"."view_ungraded_but_has_result" TO "ro_user";



GRANT ALL ON TABLE "public"."view_unposted_final_picks" TO "anon";
GRANT ALL ON TABLE "public"."view_unposted_final_picks" TO "authenticated";
GRANT ALL ON TABLE "public"."view_unposted_final_picks" TO "service_role";
GRANT SELECT ON TABLE "public"."view_unposted_final_picks" TO "ro_user";



GRANT ALL ON TABLE "public"."view_valid_raw_props" TO "anon";
GRANT ALL ON TABLE "public"."view_valid_raw_props" TO "authenticated";
GRANT ALL ON TABLE "public"."view_valid_raw_props" TO "service_role";
GRANT SELECT ON TABLE "public"."view_valid_raw_props" TO "ro_user";



GRANT ALL ON TABLE "public"."view_weekly_cappers" TO "anon";
GRANT ALL ON TABLE "public"."view_weekly_cappers" TO "authenticated";
GRANT ALL ON TABLE "public"."view_weekly_cappers" TO "service_role";
GRANT SELECT ON TABLE "public"."view_weekly_cappers" TO "ro_user";



GRANT ALL ON TABLE "public"."xwalk_games" TO "anon";
GRANT ALL ON TABLE "public"."xwalk_games" TO "authenticated";
GRANT ALL ON TABLE "public"."xwalk_games" TO "service_role";
GRANT SELECT ON TABLE "public"."xwalk_games" TO "ro_user";



GRANT ALL ON TABLE "public"."xwalk_players" TO "anon";
GRANT ALL ON TABLE "public"."xwalk_players" TO "authenticated";
GRANT ALL ON TABLE "public"."xwalk_players" TO "service_role";
GRANT SELECT ON TABLE "public"."xwalk_players" TO "ro_user";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT USAGE ON SEQUENCES  TO "ro_user";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT ON TABLES  TO "ro_user";






























RESET ALL;
