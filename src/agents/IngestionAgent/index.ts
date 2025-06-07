import { BaseAgentConfig, BaseAgentDependencies, AgentStatus, HealthStatus, BaseMetrics } from '../BaseAgent/types';
import { fetchRawProps } from './fetchRawProps';
import { validateRawProp } from './validateRawProp';
import { isDuplicateRawProp } from './isDuplicate';
import { normalizeRawProp } from './normalize';
import { supabase } from '../../services/supabaseClient';
import { logger } from '../../services/logging';
import { handleError } from '../../utils/errorHandler';
import { 
  startMetricsServer,
  ingestedCounter,
  skippedCounter,
  errorCounter,
  durationHistogram
} from '../../services/metricsServer';

startMetricsServer(9000); // Start metrics exporter server for IngestionAgent

async function runIngestionAgent() {
  const stopTimer = durationHistogram.startTimer({ phase: 'ingestion' }); // Start timer

  logger.info('🚀 IngestionAgent started');

  let rawProps;
  try {
    rawProps = await fetchRawProps();
    logger.info(`Fetched ${rawProps.length} props from provider`);
  } catch (error) {
    handleError(error, 'Fetching raw props');
    errorCounter.inc();
    stopTimer(); // End timer on error
    return;
  }

  for (const prop of rawProps) {
    try {
      if (!validateRawProp(prop)) {
        logger.warn({ prop }, 'Invalid prop shape—skipping');
        skippedCounter.inc();
        continue;
      }
      if (await isDuplicateRawProp(prop)) {
        logger.info({ prop }, 'Duplicate prop—skipping');
        skippedCounter.inc();
        continue;
      }
      const normalized = normalizeRawProp(prop);
      const { error } = await supabase.from('raw_props').insert([normalized]);
      if (error) {
        handleError(error, 'Supabase insert');
        errorCounter.inc();
      } else {
        logger.info({ player: normalized.player_name, stat: normalized.stat_type }, 'Inserted raw prop');
        ingestedCounter.inc();
      }
    } catch (error) {
      handleError(error, 'Ingestion loop');
      errorCounter.inc();
    }
  }

  logger.info('✅ IngestionAgent complete');
  stopTimer(); // End timer on success
}

runIngestionAgent();
