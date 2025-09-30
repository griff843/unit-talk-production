#!/usr/bin/env python3
"""
Baseline Feature Testing Script
Tests our 150+ syndicate-level features against the 80,329 training samples
"""

import pandas as pd
import numpy as np
import os
import sys
from datetime import datetime
import json

# Add features directory to path
sys.path.append('/app/features')
from feature_engine import SyndicateFeatureEngine

def load_training_data():
    """Load the training data from Unit Talk API export"""
    data_path = '/app/data/all_training_data.csv'

    if os.path.exists(data_path):
        print(f"📊 Loading Unit Talk training data from {data_path}")
        data = pd.read_csv(data_path)
        print(f"✅ Loaded {len(data):,} training samples")

        # Display basic statistics
        print(f"\n📈 Training Data Overview:")
        print(f"  Shape: {data.shape}")
        print(f"  Sports: {data['sport'].unique()}")
        print(f"  Results: {data['result'].value_counts()}")

        return data
    else:
        print(f"⚠️ Training data not found at {data_path}")
        print("📊 Creating sample data for testing...")

        # Create comprehensive sample data
        np.random.seed(42)
        n_samples = 10000

        data = pd.DataFrame({
            'prop_id': range(n_samples),
            'game_id': [f'game_{i//20}' for i in range(n_samples)],
            'sport': np.random.choice(['NBA', 'NFL', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'WNBA'], n_samples),
            'stat_type': np.random.choice(['points', 'rebounds', 'assists', 'rushing_yards', 'receiving_yards'], n_samples),
            'player_name': [f'Player_{i%1000}' for i in range(n_samples)],
            'line': np.random.uniform(15, 35, n_samples),
            'over_odds': np.random.randint(-120, -90, n_samples),
            'under_odds': np.random.randint(-120, -90, n_samples),
            'actual_value': np.random.uniform(10, 40, n_samples),
            'result': np.random.choice(['won', 'lost'], n_samples, p=[0.352, 0.648]),  # 35.2% baseline
            'start_time': pd.date_range('2024-01-01', periods=n_samples, freq='3H'),
            'day_of_week': np.random.randint(0, 7, n_samples),
            'hour_of_day': np.random.randint(12, 23, n_samples),
            'month': np.random.randint(1, 13, n_samples),
            'days_until_game': np.random.randint(0, 7, n_samples),
            'is_primetime': np.random.binomial(1, 0.3, n_samples),
            'is_weekend': np.random.binomial(1, 0.3, n_samples)
        })

        print(f"✅ Created {len(data):,} sample training records")
        return data

def test_feature_engineering(data):
    """Test the syndicate feature engineering pipeline"""
    print(f"\n🔧 Testing Syndicate Feature Engineering Pipeline")
    print("=" * 55)

    # Initialize feature engine
    engine = SyndicateFeatureEngine(data)

    # Create all features
    print("⚡ Creating all 150+ syndicate-level features...")
    features = engine.create_all_features()

    # Analyze results
    feature_cols = [col for col in features.columns if col not in ['prop_id', 'sport', 'stat_type', 'player_name', 'result']]

    print(f"\n✅ FEATURE ENGINEERING RESULTS:")
    print(f"  Original features: {data.shape[1]}")
    print(f"  New features created: {len(feature_cols)}")
    print(f"  Total features: {features.shape[1]}")
    print(f"  Total samples: {len(features):,}")

    return features, feature_cols

def baseline_model_test(features, feature_cols):
    """Test baseline model performance with our features"""
    print(f"\n🤖 BASELINE MODEL TESTING")
    print("=" * 35)

    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import train_test_split, cross_val_score
    from sklearn.metrics import classification_report, accuracy_score

    # Prepare data
    X = features[feature_cols].fillna(0)
    y = (features['result'] == 'won').astype(int)

    print(f"📊 Model training data:")
    print(f"  Features shape: {X.shape}")
    print(f"  Target distribution: {y.value_counts()}")
    print(f"  Baseline win rate: {y.mean():.3f} ({y.mean()*100:.1f}%)")

    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    # Train model
    print(f"\n🌲 Training Random Forest baseline...")
    rf_model = RandomForestClassifier(
        n_estimators=200,
        max_depth=10,
        min_samples_split=20,
        random_state=42,
        n_jobs=-1
    )
    rf_model.fit(X_train, y_train)

    # Evaluate
    train_acc = rf_model.score(X_train, y_train)
    test_acc = rf_model.score(X_test, y_test)

    # Cross-validation
    cv_scores = cross_val_score(rf_model, X_train, y_train, cv=5, scoring='accuracy')

    print(f"\n📊 BASELINE MODEL RESULTS:")
    print(f"  Training accuracy: {train_acc:.3f} ({train_acc*100:.1f}%)")
    print(f"  Testing accuracy: {test_acc:.3f} ({test_acc*100:.1f}%)")
    print(f"  CV accuracy: {cv_scores.mean():.3f} ± {cv_scores.std():.3f}")
    print(f"  Improvement needed: {55 - test_acc*100:.1f}% points to reach 55% target")

    # Feature importance
    feature_importance = pd.DataFrame({
        'feature': feature_cols,
        'importance': rf_model.feature_importances_
    }).sort_values('importance', ascending=False)

    print(f"\n🔥 TOP 15 MOST IMPORTANT FEATURES:")
    for i, (_, row) in enumerate(feature_importance.head(15).iterrows()):
        print(f"  {i+1:2d}. {row['feature']:30s} ({row['importance']:.4f})")

    return {
        'train_accuracy': train_acc,
        'test_accuracy': test_acc,
        'cv_mean': cv_scores.mean(),
        'cv_std': cv_scores.std(),
        'improvement_needed': 55 - test_acc*100,
        'feature_importance': feature_importance.to_dict('records')
    }

def analyze_sport_performance(features):
    """Analyze performance by sport"""
    print(f"\n🏆 SPORT-SPECIFIC ANALYSIS")
    print("=" * 30)

    sport_analysis = {}

    for sport in features['sport'].unique():
        sport_data = features[features['sport'] == sport]
        win_rate = (sport_data['result'] == 'won').mean()
        sample_count = len(sport_data)

        sport_analysis[sport] = {
            'samples': sample_count,
            'win_rate': win_rate,
            'improvement_needed': 55 - win_rate*100
        }

        print(f"  {sport:6s}: {sample_count:5,} samples, {win_rate:.3f} ({win_rate*100:.1f}%) win rate")

    return sport_analysis

def save_results(features, feature_cols, model_results, sport_analysis):
    """Save feature engineering and baseline results"""
    print(f"\n💾 SAVING RESULTS")
    print("=" * 20)

    # Save feature dataset
    output_path = '/app/data/syndicate_features_baseline.csv'
    features.to_csv(output_path, index=False)
    print(f"✅ Features saved to: {output_path}")

    # Save comprehensive metadata
    metadata = {
        'experiment': 'syndicate_baseline_feature_test',
        'timestamp': datetime.now().isoformat(),
        'data_info': {
            'total_samples': len(features),
            'total_features': len(feature_cols),
            'sports_covered': list(features['sport'].unique()),
            'sport_distribution': features['sport'].value_counts().to_dict()
        },
        'feature_categories': {
            'player_features': len([f for f in feature_cols if f.startswith('player_')]),
            'team_features': len([f for f in feature_cols if f.startswith('team_')]),
            'market_features': len([f for f in feature_cols if any(x in f for x in ['line_', 'market_', 'closing_', 'sharp_', 'public_'])]),
            'temporal_features': len([f for f in feature_cols if any(x in f for x in ['day_', 'hour_', 'month_', 'season_', 'is_'])]),
            'matchup_features': len([f for f in feature_cols if any(x in f for x in ['h2h_', 'position_', 'style_', 'opponent_'])]),
            'environmental_features': len([f for f in feature_cols if any(x in f for x in ['game_', 'stakes_', 'pressure_', 'injury_', 'weather_'])])
        },
        'baseline_performance': model_results,
        'sport_analysis': sport_analysis,
        'syndicate_targets': {
            'target_win_rate': 55,
            'target_roi': 5,
            'target_sharpe': 1.5,
            'current_baseline': model_results['test_accuracy'] * 100,
            'syndicate_gap': 55 - model_results['test_accuracy'] * 100
        },
        'next_steps': [
            'Phase 3: Train 7 sport-specific models',
            'Phase 4: Create ensemble meta-model',
            'Phase 5: Add professional capper features',
            'Phase 6: Backtest on historical data',
            'Target: 55-58% win rate to rival syndicate groups'
        ]
    }

    metadata_path = '/app/data/syndicate_baseline_metadata.json'
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"✅ Metadata saved to: {metadata_path}")

def main():
    """Main feature testing pipeline"""
    print("🎯 SYNDICATE FEATURE ENGINEERING BASELINE TEST")
    print("=" * 55)
    print("Goal: Test 150+ features on Unit Talk's 80,329 training samples")
    print("Target: Build foundation for 55-58% win rate (rival syndicate groups)")
    print("")

    try:
        # Load training data
        data = load_training_data()

        # Test feature engineering
        features, feature_cols = test_feature_engineering(data)

        # Test baseline model
        model_results = baseline_model_test(features, feature_cols)

        # Analyze by sport
        sport_analysis = analyze_sport_performance(features)

        # Save results
        save_results(features, feature_cols, model_results, sport_analysis)

        print(f"\n🎯 BASELINE TEST COMPLETE")
        print("=" * 30)
        print(f"✅ Features created: {len(feature_cols)}")
        print(f"📊 Baseline accuracy: {model_results['test_accuracy']*100:.1f}%")
        print(f"🎪 Syndicate gap: {model_results['improvement_needed']:.1f}% points")
        print(f"🚀 Ready for Phase 3: Sport-specific model training")
        print(f"🏆 Target: 55-58% win rate to compete with best human cappers")

    except Exception as e:
        print(f"❌ Error in baseline testing: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()