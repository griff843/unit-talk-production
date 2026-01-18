/**
 * Preflight endpoint for schema verification
 *
 * Validates that critical tables and columns are visible to PostgREST.
 * Automatically triggers schema reload if visibility issues detected.
 *
 * GET /api/domain/picks/preflight
 */

import { Request, Response } from 'express';
import { getSchemaProbe } from '../../lib/schema-probe';
import { forcePostgrestReload, getPgRestState } from '../../lib/pgrest-reload';
import { logger } from '../../shared/logger';
import { createClient } from '@supabase/supabase-js';
import { env } from '../../config/env';

const SELF_HEAL_SCHEMA = process.env.SELF_HEAL_SCHEMA !== 'false'; // Default true

/**
 * Check if specific columns are visible in a table
 */
async function checkColumnsVisible(
  tableName: string,
  columns: string[]
): Promise<{ visible: boolean; columnsVisible: string[] }> {
  try {
    const supabase = createClient(env.supabase.url, env.supabase.serviceRoleKey);

    // Try to select the specified columns
    const { data, error } = await supabase
      .from(tableName)
      .select(columns.join(','))
      .limit(0); // Don't fetch data, just check column existence

    if (error) {
      // Parse error to determine which columns are missing
      const errorMessage = error.message || '';
      const missingColumns = columns.filter(col =>
        errorMessage.includes(`column`) && errorMessage.includes(col)
      );

      logger.debug('Column visibility check failed', {
        tableName,
        requestedColumns: columns,
        error: errorMessage,
        missingColumns,
      });

      return {
        visible: false,
        columnsVisible: columns.filter(col => !missingColumns.includes(col)),
      };
    }

    // All columns visible
    return {
      visible: true,
      columnsVisible: columns,
    };
  } catch (error) {
    logger.error('Error checking column visibility', {
      tableName,
      columns,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      visible: false,
      columnsVisible: [],
    };
  }
}

/**
 * Preflight handler - Verify schema visibility with self-healing
 */
export async function preflightHandler(req: Request, res: Response) {
  try {
    logger.info('Preflight schema check initiated', {
      event: 'preflight_check_start',
      selfHeal: SELF_HEAL_SCHEMA,
    });

    const probe = getSchemaProbe();
    let reloaded = false;

    // Check table existence first
    const [hasPicks, hasPickPublish, hasUnifiedPicks] = await Promise.all([
      probe.hasTable('picks'),
      probe.hasTable('pick_publish'),
      probe.hasTable('unified_picks'),
    ]);

    // Check critical columns visibility
    const [picksColumns, pickPublishColumns, unifiedPicksColumns] = await Promise.all([
      hasPicks
        ? checkColumnsVisible('picks', [
            'id',
            'tenant_id',
            'user_id',
            'selection',
            'confidence',
            'created_at',
          ])
        : { visible: false, columnsVisible: [] },
      hasPickPublish
        ? checkColumnsVisible('pick_publish', [
            'id',
            'pick_id',
            'external_message_id',
            'status',
            'created_at',
          ])
        : { visible: false, columnsVisible: [] },
      hasUnifiedPicks
        ? checkColumnsVisible('unified_picks', [
            'id',
            'user_id',
            'sport',
            'side',
            'created_at',
          ])
        : { visible: false, columnsVisible: [] },
    ]);

    // Determine if reload needed
    const needsReload =
      !hasPicks ||
      !hasPickPublish ||
      !picksColumns.visible ||
      !pickPublishColumns.visible;

    // Trigger reload if self-heal enabled and needed
    if (needsReload && SELF_HEAL_SCHEMA) {
      logger.info('Schema visibility issues detected, triggering reload', {
        event: 'preflight_reload_triggered',
        hasPicks,
        hasPickPublish,
        picksColumnsVisible: picksColumns.visible,
        pickPublishColumnsVisible: pickPublishColumns.visible,
      });

      const reloadResult = await forcePostgrestReload({ reason: 'preflight' });
      reloaded = reloadResult.success;

      if (reloaded) {
        // Recheck after reload
        const [
          hasPicksAfter,
          hasPickPublishAfter,
          picksColumnsAfter,
          pickPublishColumnsAfter,
        ] = await Promise.all([
          probe.hasTable('picks'),
          probe.hasTable('pick_publish'),
          checkColumnsVisible('picks', [
            'id',
            'tenant_id',
            'user_id',
            'selection',
            'confidence',
            'created_at',
          ]),
          checkColumnsVisible('pick_publish', [
            'id',
            'pick_id',
            'external_message_id',
            'status',
            'created_at',
          ]),
        ]);

        logger.info('Preflight recheck after reload', {
          event: 'preflight_after_reload',
          hasPicksAfter,
          hasPickPublishAfter,
          picksColumnsVisibleAfter: picksColumnsAfter.visible,
          pickPublishColumnsVisibleAfter: pickPublishColumnsAfter.visible,
        });

        // Update results with post-reload checks
        return res.status(200).json({
          ok: hasPicksAfter && hasPickPublishAfter && picksColumnsAfter.visible && pickPublishColumnsAfter.visible,
          tables: {
            picks: {
              visible: hasPicksAfter,
              columnsVisible: picksColumnsAfter.columnsVisible,
            },
            pick_publish: {
              visible: hasPickPublishAfter,
              columnsVisible: pickPublishColumnsAfter.columnsVisible,
            },
            unified_picks: {
              visible: hasUnifiedPicks,
              columnsVisible: unifiedPicksColumns.columnsVisible,
            },
          },
          reloaded: true,
          lastReloadAt: getPgRestState().lastReloadAt,
          selfHealEnabled: SELF_HEAL_SCHEMA,
        });
      }
    }

    // Return status
    const ok = hasPicks && hasPickPublish && picksColumns.visible && pickPublishColumns.visible;

    logger.info('Preflight check completed', {
      event: 'preflight_check_complete',
      ok,
      reloaded,
      hasPicks,
      hasPickPublish,
      picksColumnsVisible: picksColumns.visible,
      pickPublishColumnsVisible: pickPublishColumns.visible,
    });

    res.status(200).json({
      ok,
      tables: {
        picks: {
          visible: hasPicks,
          columnsVisible: picksColumns.columnsVisible,
        },
        pick_publish: {
          visible: hasPickPublish,
          columnsVisible: pickPublishColumns.columnsVisible,
        },
        unified_picks: {
          visible: hasUnifiedPicks,
          columnsVisible: unifiedPicksColumns.columnsVisible,
        },
      },
      reloaded,
      lastReloadAt: getPgRestState().lastReloadAt,
      selfHealEnabled: SELF_HEAL_SCHEMA,
    });
  } catch (error) {
    logger.error('Preflight check failed', {
      event: 'preflight_check_error',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      ok: false,
      error: 'Preflight check failed',
      message: error instanceof Error ? error.message : String(error),
      reloaded: false,
      lastReloadAt: getPgRestState().lastReloadAt,
      selfHealEnabled: SELF_HEAL_SCHEMA,
    });
  }
}
