import { supabaseServer } from '@/lib/supabase';
import { createComponentLogger } from '@/lib/logger';
import type { Database } from '@/types/supabase';

const log = createComponentLogger('smart-form-bridge');

export interface TicketSubmissionEvent {
  bet_slip_id: string;
  capper_id: string;
  selection_count: number;
  sport?: string;
  ticket_type?: string;
  is_live?: boolean;
}

/**
 * Publishes a ticket submission event to the bridge outbox for processing
 * by external Bridge worker systems.
 * 
 * Uses idempotency key (bet_slip_id) to prevent duplicate processing.
 */
export async function publishTicketSubmitted(eventData: TicketSubmissionEvent): Promise<boolean> {
  try {
    const supabase = supabaseServer();
    
    const outboxEntry = {
      event_type: 'ticket_submitted',
      payload: eventData as any, // Type assertion for Supabase JSON field
      unique_key: eventData.bet_slip_id, // Idempotency key
      status: 'pending',
      attempts: 0,
      max_attempts: 3,
      next_attempt_at: new Date(Date.now() + 5000).toISOString(), // Try in 5 seconds
    };

    const { error } = await supabase
      .from('bridge_outbox')
      .insert(outboxEntry as any);

    if (error) {
      // Check if it's a duplicate key error (already exists)
      if (error.code === '23505') {
        log.info({
          bet_slip_id: eventData.bet_slip_id,
        }, 'Ticket submission event already exists (idempotent)');
        return true;
      }

      log.error({
        error: error.message,
        code: error.code,
        bet_slip_id: eventData.bet_slip_id,
      }, 'Failed to publish ticket submission event');
      return false;
    }

    log.info({
      bet_slip_id: eventData.bet_slip_id,
      capper_id: eventData.capper_id,
      selection_count: eventData.selection_count,
    }, 'Ticket submission event published successfully');

    return true;

  } catch (error) {
    log.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      bet_slip_id: eventData.bet_slip_id,
    }, 'Error publishing ticket submission event');
    return false;
  }
}

/**
 * Publishes a ticket status update event to the bridge outbox.
 */
export async function publishTicketStatusUpdate(
  betSlipId: string, 
  status: string, 
  metadata?: Record<string, any>
): Promise<boolean> {
  try {
    const supabase = supabaseServer();
    
    const eventData = {
      bet_slip_id: betSlipId,
      status,
      updated_at: new Date().toISOString(),
      ...metadata,
    };
    
    const statusUpdateEntry = {
      event_type: 'ticket_status_updated',
      payload: eventData as any, // Type assertion for Supabase JSON field
      unique_key: `${betSlipId}_status_${status}_${Date.now()}`, // Allow multiple status updates
      status: 'pending',
      attempts: 0,
      max_attempts: 3,
      next_attempt_at: new Date(Date.now() + 1000).toISOString(), // Try in 1 second
    };

    const { error } = await supabase
      .from('bridge_outbox')
      .insert(statusUpdateEntry as any);

    if (error) {
      log.error({
        error: error.message,
        bet_slip_id: betSlipId,
        status,
      }, 'Failed to publish ticket status update event');
      return false;
    }

    log.info({
      bet_slip_id: betSlipId,
      status,
    }, 'Ticket status update event published successfully');

    return true;

  } catch (error) {
    log.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      bet_slip_id: betSlipId,
      status,
    }, 'Error publishing ticket status update event');
    return false;
  }
}

/**
 * Development/Testing helper to simulate bridge event processing
 */
export async function simulateBridgeProcessing(betSlipId: string): Promise<{ success: boolean; message: string }> {
  const isDev = process.env.NODE_ENV === 'development';
  
  if (!isDev) {
    return {
      success: false,
      message: 'Bridge simulation only available in development mode',
    };
  }

  try {
    const supabase = supabaseServer();
    
    // Mark outbox events as processed
    const updateData = {
      status: 'completed',
      processed_at: new Date().toISOString(),
      attempts: 1,
    };

    const { error } = await (supabase
      .from('bridge_outbox') as any)
      .update(updateData)
      .eq('unique_key', betSlipId)
      .eq('status', 'pending');

    if (error) {
      return {
        success: false,
        message: `Failed to simulate processing: ${error.message}`,
      };
    }

    log.info({
      bet_slip_id: betSlipId,
    }, 'Bridge processing simulated successfully');

    return {
      success: true,
      message: 'Bridge processing simulated successfully',
    };

  } catch (error) {
    return {
      success: false,
      message: `Simulation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}