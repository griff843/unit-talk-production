-- supabase/overlay/30_rpcs.sql
-- Idempotent RPC functions for pick approval workflow

-- approve_pick: Approve a pick from promotion queue
create or replace function public.approve_pick(
  p_queue_id uuid,
  p_approved_by uuid,
  p_reason text
)
returns boolean
language plpgsql
as $$
begin
  update public.promotion_queue
     set status='approved',
         approved_by=p_approved_by,
         approved_at=now(),
         reason=coalesce(p_reason, reason)
   where id=p_queue_id
     and status='pending';
  return found;
end;
$$;

-- deny_pick: Deny/reject a pick from promotion queue
create or replace function public.deny_pick(
  p_queue_id uuid,
  p_denied_by uuid,
  p_reason text
)
returns boolean
language plpgsql
as $$
begin
  update public.promotion_queue
     set status='rejected',
         denied_by=p_denied_by,
         denied_at=now(),
         reason=coalesce(p_reason, reason)
   where id=p_queue_id
     and status='pending';
  return found;
end;
$$;

-- submit_pick: Submit a pick to the promotion queue
create or replace function public.submit_pick(
  p_prop_ref uuid,
  p_submitted_by uuid,
  p_publish_at timestamptz default null,
  p_reason text default null
)
returns uuid
language plpgsql
as $$
declare
  v_queue_id uuid;
begin
  insert into public.promotion_queue (prop_ref, status, submitted_by, submitted_at, publish_at, reason)
  values (p_prop_ref, 'pending', p_submitted_by, now(), p_publish_at, p_reason)
  returning id into v_queue_id;

  return v_queue_id;
end;
$$;
