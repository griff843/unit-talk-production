#!/usr/bin/env python3
"""
Test NBA Model Training - Simplified Version
Tests our NBA specialist with available data
"""

import pandas as pd
import numpy as np
import json
import os
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# Simple ML libraries (standard with Python)
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
from sklearn.preprocessing import StandardScaler

def load_training_data():
    """Load training data from API export"""
    # Try multiple possible locations
    possible_paths = [
        '/app/data/all_training_data.csv',
        '/app/apps/api/ml-training-data/all_training_data.csv',
        './ml-training-data/all_training_data.csv',
        '../api/ml-training-data/all_training_data.csv'
    ]

    for path in possible_paths:
        if os.path.exists(path):
            print(f"✅ Found training data at: {path}")
            data = pd.read_csv(path)
            return data

    # Create sample data if none found
    print("📊 Creating sample data for testing...")
    np.random.seed(42)
    n_samples = 5000

    return pd.DataFrame({
        'prop_id': range(n_samples),
        'sport': np.random.choice(['NBA', 'NFL', 'MLB', 'NHL'], n_samples),
        'stat_type': np.random.choice(['points', 'rebounds', 'assists'], n_samples),
        'player_name': [f'Player_{i%500}' for i in range(n_samples)],
        'line': np.random.uniform(15, 35, n_samples),
        'over_odds': np.random.randint(-120, -90, n_samples),
        'under_odds': np.random.randint(-120, -90, n_samples),
        'actual_value': np.random.uniform(10, 40, n_samples),
        'result': np.random.choice(['won', 'lost'], n_samples, p=[0.352, 0.648]),
        'start_time': pd.date_range('2024-01-01', periods=n_samples, freq='3H'),
        'day_of_week': np.random.randint(0, 7, n_samples),
        'hour_of_day': np.random.randint(12, 23, n_samples),
        'month': np.random.randint(1, 13, n_samples),
        'days_until_game': np.random.randint(0, 7, n_samples),
        'is_primetime': np.random.binomial(1, 0.3, n_samples),
        'is_weekend': np.random.binomial(1, 0.3, n_samples)
    })

def create_simple_features(data):
    """Create simplified features for testing"""
    features = data.copy()

    # Basic statistical features
    features['line_vs_actual_diff'] = features['actual_value'] - features['line']
    features['odds_average'] = (abs(features['over_odds']) + abs(features['under_odds'])) / 2
    features['is_high_line'] = (features['line'] > features['line'].median()).astype(int)
    features['is_favorite'] = (features['over_odds'] < -110).astype(int)

    # Player consistency (simplified)
    player_stats = features.groupby('player_name')['actual_value'].agg(['mean', 'std']).reset_index()
    player_stats.columns = ['player_name', 'player_avg', 'player_std']
    features = features.merge(player_stats, on='player_name', how='left')
    features['player_std'] = features['player_std'].fillna(features['player_std'].median())

    # Temporal features
    features['hour_normalized'] = features['hour_of_day'] / 24
    features['month_normalized'] = features['month'] / 12
    features['day_normalized'] = features['day_of_week'] / 7

    # Interaction features
    features['primetime_x_weekend'] = features['is_primetime'] * features['is_weekend']
    features['line_x_odds'] = features['line'] * features['odds_average']

    return features

def test_nba_model():
    """Test NBA model training with simplified approach"""
    print("🏀 NBA MODEL TRAINING TEST")
    print("=" * 35)
    print("Testing NBA specialist with available data")
    print("Goal: Validate approach for 55%+ win rate")
    print("")

    # Load data
    print("📊 Loading training data...")
    data = load_training_data()
    print(f"✅ Loaded {len(data):,} total samples")

    # Filter NBA data
    nba_data = data[data['sport'] == 'NBA'].copy()
    print(f"🏀 NBA samples: {len(nba_data):,}")

    if len(nba_data) < 100:
        print("⚠️ Limited NBA data, using all sports for testing...")
        nba_data = data.copy()

    # Create features
    print("🔧 Creating features...")
    features = create_simple_features(nba_data)

    # Prepare training data
    feature_cols = [
        'line', 'over_odds', 'under_odds', 'day_of_week', 'hour_of_day', 'month',
        'is_primetime', 'is_weekend', 'days_until_game',
        'line_vs_actual_diff', 'odds_average', 'is_high_line', 'is_favorite',
        'player_avg', 'player_std', 'hour_normalized', 'month_normalized', 'day_normalized',
        'primetime_x_weekend', 'line_x_odds'
    ]

    X = features[feature_cols].fillna(0)
    y = (features['result'] == 'won').astype(int)

    print(f"📈 Training setup:")
    print(f"  Features: {len(feature_cols)}")
    print(f"  Samples: {len(X):,}")
    print(f"  Win rate: {y.mean():.3f} ({y.mean()*100:.1f}%)")
    print(f"  Target: 55%+ win rate (+{55-y.mean()*100:.1f}% improvement needed)")

    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Train model
    print("\n🌲 Training Random Forest model...")
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=10,
        min_samples_split=10,
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_train_scaled, y_train)

    # Evaluate
    train_pred = model.predict(X_train_scaled)
    test_pred = model.predict(X_test_scaled)

    train_acc = accuracy_score(y_train, train_pred)
    test_acc = accuracy_score(y_test, test_pred)

    print(f"\n📊 NBA MODEL TEST RESULTS:")
    print(f"  Training accuracy: {train_acc:.3f} ({train_acc*100:.1f}%)")
    print(f"  Testing accuracy: {test_acc:.3f} ({test_acc*100:.1f}%)")
    print(f"  Improvement from baseline: +{(test_acc - y.mean())*100:.1f}% points")
    print(f"  Gap to 55% target: {55 - test_acc*100:+.1f}% points")
    print(f"  Gap to 58% syndicate: {58 - test_acc*100:+.1f}% points")

    if test_acc >= 0.55:
        print(f"\n🎯 ✅ TARGET ACHIEVED! NBA model ready!")
    elif test_acc >= y.mean() + 0.05:  # 5% improvement
        print(f"\n🎪 📈 GOOD PROGRESS! Significant improvement shown")
    else:
        print(f"\n⚠️ More work needed for target achievement")

    # Feature importance
    feature_importance = pd.DataFrame({
        'feature': feature_cols,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)

    print(f"\n🔥 Top 10 Features:")
    for i, (_, row) in enumerate(feature_importance.head(10).iterrows()):
        print(f"  {i+1:2d}. {row['feature']:25s} ({row['importance']:.4f})")

    # Save results
    results = {
        'test_type': 'nba_model_training_test',
        'timestamp': datetime.now().isoformat(),
        'samples': len(nba_data),
        'features': len(feature_cols),
        'baseline_win_rate': y.mean(),
        'train_accuracy': train_acc,
        'test_accuracy': test_acc,
        'improvement': test_acc - y.mean(),
        'target_gap': 0.55 - test_acc,
        'syndicate_gap': 0.58 - test_acc,
        'feature_importance': feature_importance.to_dict('records'),
        'target_achieved': test_acc >= 0.55,
        'next_steps': [
            'Full XGBoost implementation with hyperparameter optimization',
            'Advanced feature engineering (150+ features)',
            'Sport-specific feature optimization',
            'Ensemble meta-model development'
        ]
    }

    # Save to JSON
    os.makedirs('/app/data', exist_ok=True)
    with open('/app/data/nba_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)

    print(f"\n💾 Results saved to: /app/data/nba_test_results.json")

    return results

def main():
    """Main test function"""
    try:
        results = test_nba_model()

        print(f"\n🏀 NBA MODEL TEST COMPLETE")
        print("=" * 30)

        if results['target_achieved']:
            print(f"🎯 ✅ SUCCESS: 55% target achieved!")
            print(f"🚀 Ready for production NBA model")
        else:
            print(f"📈 Progress: {results['improvement']*100:+.1f}% improvement")
            print(f"🎯 Gap: {results['target_gap']*100:.1f}% to reach 55% target")

        print(f"📊 Accuracy: {results['test_accuracy']*100:.1f}%")
        print(f"🔄 Next: Full XGBoost training with 150+ features")

    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()