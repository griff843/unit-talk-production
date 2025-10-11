import { supabaseClient } from './src/services/supabaseClient';
import { FeatureStoreService } from './src/services/FeatureStoreService';
import { FeatureStoreIntegration } from './src/agents/ScoringAgent/scoring/FeatureStoreIntegration';
import { MaterialChangeDetector } from './src/agents/ScoringAgent/scoring/MaterialChangeDetector';
import { Enhanced45FactorEngine } from './src/agents/ScoringAgent/scoring/Enhanced45FactorEngine';

async function debug() {
  try {
    console.log('1. Initializing scoring engine...');
    const featureStoreService = new FeatureStoreService();
    const featureStore = new FeatureStoreIntegration(featureStoreService);
    const changeDetector = new MaterialChangeDetector(featureStore);
    const scoringEngine = new Enhanced45FactorEngine(featureStore, changeDetector);
    console.log('✅ Engine initialized');

    console.log('\n2. Getting a prop with features...');
    const { data: featureRecords } = await supabaseClient!
      .from('feature_values')
      .select('entity_id')
      .limit(1);
    
    const propId = featureRecords![0].entity_id;
    console.log('Prop ID:', propId);

    console.log('\n3. Retrieving features for prop...');
    const features = await featureStore.retrieveFeatures(propId);
    console.log('Features retrieved:', {
      completeness: features.completeness,
      freshness: features.freshness,
      retrievalTimeMs: features.retrievalTimeMs
    });

    console.log('\n4. Calculating score...');
    const result = await scoringEngine.calculate45FactorScore(features);
    console.log('✅ Score calculated:', result);

  } catch (error: any) {
    console.error('\n❌ ERROR:', error);
    console.error('Stack:', error.stack);
    console.error('Message:', error.message);
    console.error('Full error:', JSON.stringify(error, null, 2));
  }
}

debug().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
