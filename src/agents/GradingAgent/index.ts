import { gradeAndPromoteFinalPicks } from './gradeForFinalPicks';
import { startMetricsServer } from '../../services/metricsServer';
import { gradePick } from './scoring/edgeScore';

startMetricsServer(9002);

gradeAndPromoteFinalPicks().then(() => {
  console.log('GradingAgent complete');
});
