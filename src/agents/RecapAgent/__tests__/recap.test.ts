import { RecapAgent } from './index.js';

(async () => {
  try {
    const res = await RecapAgent({ date: '2025-05-27' }); // or omit date for yesterday
    console.log('\n📈 UNIT TALK DAILY RECAP\n');
    console.log(res.dollarLine + '\n');
    console.log(`🏆 MVP: ${res.mvp.capper} (+${res.mvp.units}u, ${res.mvp.win}-${res.mvp.loss})\n`);
    res.capperStatsArr.forEach(s => {
      console.log(
        `${s.capper}: ${s.win}-${s.loss} (${s.units >= 0 ? '🟢 ▲' : '🔴 ▼'}${s.units}u, ROI: ${s.roi}%) | L3: ${s.l3} | L5: ${s.l5} | L10: ${s.l10} | Streak: ${s.streak}`
      );
      s.pickLines.forEach(line => console.log('  ', line));
      console.log('');
    });
    console.log('Summary:');
    res.capperStatsArr.forEach(s => {
      console.log(`  ${s.capper}: ${s.pickLines.join(' | ')}`);
    });
    console.log('\nFull results:', res.fullResultsLink);
  } catch (err) {
    console.error('Error:', err.message || err);
  }
})();
