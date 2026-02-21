-- Fix mark_discord_outbox_posted variable type
CREATE OR REPLACE FUNCTION mark_discord_outbox_posted(
  p_outbox_id UUID,
  p_discord_message_id TEXT,
  p_discord_channel_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_row_count INTEGER;
BEGIN
  UPDATE ticket_discord_outbox
  SET
    status = 'posted',
    posted_at = NOW(),
    discord_message_id = p_discord_message_id,
    discord_channel_id = p_discord_channel_id,
    error = NULL
  WHERE id = p_outbox_id
    AND status IN ('pending', 'failed');

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Fix mark_discord_outbox_failed variable type
CREATE OR REPLACE FUNCTION mark_discord_outbox_failed(
  p_outbox_id UUID,
  p_error TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_row_count INTEGER;
BEGIN
  UPDATE ticket_discord_outbox
  SET
    status = 'failed',
    error = p_error,
    retry_count = retry_count + 1
  WHERE id = p_outbox_id
    AND status IN ('pending', 'failed');

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$ LANGUAGE plpgsql;
