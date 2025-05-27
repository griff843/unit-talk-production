import { promoteToDailyPicks } from './promoteToDailyPicks';
import { startMetricsServer, ingestedCounter, errorCounter, durationHistogram } from '../../services/metricsServer';

startMetricsServer(9001); // Dedicated port for promotion agent metrics

async function runPromotionAgent() {
  const stopTimer = durationHistogram.startTimer({ phase: 'promotion' });
  try {
    await promoteToDailyPicks();
    ingestedCounter.inc();
  } catch (err) {
    errorCounter.inc();
    console.error('PromotionAgent error:', err);
  }
  stopTimer();
  console.log('PromotionAgent complete');
}

runPromotionAgent();
