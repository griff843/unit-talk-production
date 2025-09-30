#!/usr/bin/env python3
"""
Phase 4: Meta-Model Ensemble System
==================================

Combines all 7 sport-specific models into a unified prediction engine.
Implements stacking ensemble with XGBoost meta-learner to achieve 55%+ win rate.

Architecture:
1. Sport-specific models provide base predictions
2. Meta-model learns optimal combination weights
3. Confidence-based filtering improves final predictions
4. Unified interface routes predictions by sport

Phase 4 of 10-phase syndicate-level betting system
"""

import pandas as pd
import numpy as np
import os
import json
import pickle
import joblib
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Any, Optional, Union
import warnings
warnings.filterwarnings('ignore')

# ML Libraries
import xgboost as xgb
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import StandardScaler, RobustScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    classification_report, confusion_matrix, roc_auc_score, log_loss
)
from sklearn.ensemble import StackingClassifier, VotingClassifier
from sklearn.linear_model import LogisticRegression

# Hyperparameter Optimization
import optuna
from optuna.samplers import TPESampler

# Progress & Logging
from tqdm import tqdm
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/app/apps/api/ml/ensemble_training.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class MetaModelEnsemble:
    """
    Phase 4: Meta-Model Ensemble System

    Combines predictions from all 7 sport-specific models using:
    - Stacking ensemble with XGBoost meta-learner
    - Weighted voting based on individual model performance
    - Confidence-based prediction filtering
    - Sport-specific weight optimization

    Goals:
    - Achieve 55%+ overall win rate
    - Outperform individual sport models
    - Production-ready prediction pipeline
    """

    def __init__(self, models_dir: str = '/app/apps/api/ml-models'):
        self.models_dir = models_dir
        self.sport_models = {}
        self.sport_scalers = {}
        self.meta_model = None
        self.meta_scaler = None
        self.ensemble_weights = {}
        self.performance_stats = {}

        # Sports configuration
        self.sports = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'WNBA']
        self.target_accuracy = 0.55
        self.confidence_threshold = 0.6

        # Performance tracking
        self.individual_performances = {}
        self.ensemble_performance = {}

        logger.info("🎯 Phase 4: Meta-Model Ensemble Initialized")
        logger.info(f"📊 Target: {self.target_accuracy*100:.1f}% win rate")
        logger.info(f"🏆 Sports: {len(self.sports)} sport-specific models")

    def load_sport_models(self) -> bool:
        """Load all trained sport-specific models and scalers"""
        logger.info("📥 Loading sport-specific models...")

        loaded_count = 0
        for sport in self.sports:
            try:
                # Model paths
                model_path = os.path.join(self.models_dir, f'{sport.lower()}_model.pkl')
                scaler_path = os.path.join(self.models_dir, f'{sport.lower()}_scaler.pkl')

                if os.path.exists(model_path) and os.path.exists(scaler_path):
                    # Load model and scaler
                    self.sport_models[sport] = joblib.load(model_path)
                    self.sport_scalers[sport] = joblib.load(scaler_path)
                    loaded_count += 1
                    logger.info(f"  ✅ {sport}: Model and scaler loaded")
                else:
                    logger.warning(f"  ⚠️ {sport}: Model files not found, will train placeholder")
                    # Create placeholder model for development
                    self._create_placeholder_model(sport)
                    loaded_count += 1

            except Exception as e:
                logger.error(f"  ❌ {sport}: Error loading model - {e}")
                continue

        logger.info(f"✅ Loaded {loaded_count}/{len(self.sports)} sport models")
        return loaded_count > 0

    def _create_placeholder_model(self, sport: str):
        """Create placeholder model for development/testing"""
        from sklearn.ensemble import RandomForestClassifier

        # Simple placeholder model
        model = RandomForestClassifier(n_estimators=50, random_state=42)
        scaler = StandardScaler()

        # Train on dummy data
        X_dummy = np.random.randn(1000, 20)
        y_dummy = np.random.binomial(1, 0.4, 1000)  # 40% win rate

        scaler.fit(X_dummy)
        X_scaled = scaler.transform(X_dummy)
        model.fit(X_scaled, y_dummy)

        self.sport_models[sport] = model
        self.sport_scalers[sport] = scaler

        logger.info(f"  🔧 {sport}: Placeholder model created")

    def create_ensemble_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """Create meta-features from individual sport model predictions"""
        logger.info("🔧 Creating ensemble meta-features...")

        # Prepare data by sport
        ensemble_data = []

        for sport in self.sports:
            sport_data = data[data['sport'] == sport].copy()
            if len(sport_data) == 0:
                continue

            logger.info(f"  📊 {sport}: {len(sport_data):,} samples")

            # Get base features (assuming they exist)
            feature_cols = [col for col in sport_data.columns
                          if col not in ['prop_id', 'sport', 'stat_type', 'player_name', 'result', 'target']]

            if len(feature_cols) == 0:
                # Create basic features if none exist
                feature_cols = self._create_basic_features(sport_data)

            # Prepare features for sport model
            X = sport_data[feature_cols].fillna(0)

            # Scale features
            X_scaled = self.sport_scalers[sport].transform(X)

            # Get predictions from sport model
            predictions = self.sport_models[sport].predict_proba(X_scaled)[:, 1]
            predictions_binary = self.sport_models[sport].predict(X_scaled)

            # Create meta-features for this sport
            sport_data_enhanced = sport_data.copy()
            sport_data_enhanced[f'{sport}_prediction'] = predictions
            sport_data_enhanced[f'{sport}_binary_pred'] = predictions_binary
            sport_data_enhanced[f'{sport}_confidence'] = np.abs(predictions - 0.5) * 2

            ensemble_data.append(sport_data_enhanced)

        # Combine all sports data
        if ensemble_data:
            combined_data = pd.concat(ensemble_data, ignore_index=True)
        else:
            # Create sample data if no real data available
            combined_data = self._create_sample_ensemble_data()

        logger.info(f"✅ Ensemble features created: {len(combined_data):,} total samples")
        return combined_data

    def _create_basic_features(self, sport_data: pd.DataFrame) -> List[str]:
        """Create basic features if none exist"""
        # Line-based features
        sport_data['line_normalized'] = sport_data.get('line', 20.0) / 50.0
        sport_data['odds_ratio'] = sport_data.get('over_odds', -110) / sport_data.get('under_odds', -110)

        # Temporal features
        sport_data['hour_sin'] = np.sin(2 * np.pi * sport_data.get('hour_of_day', 19) / 24)
        sport_data['hour_cos'] = np.cos(2 * np.pi * sport_data.get('hour_of_day', 19) / 24)
        sport_data['day_sin'] = np.sin(2 * np.pi * sport_data.get('day_of_week', 3) / 7)
        sport_data['day_cos'] = np.cos(2 * np.pi * sport_data.get('day_of_week', 3) / 7)

        # Basic categorical encoding
        sport_data['stat_type_encoded'] = sport_data.get('stat_type', 'points').astype('category').cat.codes
        sport_data['is_primetime'] = sport_data.get('is_primetime', 0)
        sport_data['is_weekend'] = sport_data.get('is_weekend', 0)

        feature_cols = [
            'line_normalized', 'odds_ratio', 'hour_sin', 'hour_cos',
            'day_sin', 'day_cos', 'stat_type_encoded', 'is_primetime', 'is_weekend'
        ]

        return feature_cols

    def _create_sample_ensemble_data(self) -> pd.DataFrame:
        """Create sample data for ensemble training and testing"""
        logger.info("📊 Creating sample ensemble data for development...")

        np.random.seed(42)
        n_samples = 5000

        sample_data = pd.DataFrame({
            'prop_id': range(n_samples),
            'sport': np.random.choice(self.sports, n_samples),
            'stat_type': np.random.choice(['points', 'rebounds', 'assists', 'rushing_yards'], n_samples),
            'player_name': [f'Player_{i%500}' for i in range(n_samples)],
            'line': np.random.uniform(15, 35, n_samples),
            'over_odds': np.random.randint(-120, -90, n_samples),
            'under_odds': np.random.randint(-120, -90, n_samples),
            'actual_value': np.random.uniform(10, 40, n_samples),
            'result': np.random.choice(['won', 'lost'], n_samples, p=[0.45, 0.55]),
            'hour_of_day': np.random.randint(12, 23, n_samples),
            'day_of_week': np.random.randint(0, 7, n_samples),
            'is_primetime': np.random.binomial(1, 0.3, n_samples),
            'is_weekend': np.random.binomial(1, 0.3, n_samples)
        })

        # Add target variable
        sample_data['target'] = (sample_data['result'] == 'won').astype(int)

        # Create ensemble features for each sport
        for sport in self.sports:
            sport_mask = sample_data['sport'] == sport
            sample_data.loc[sport_mask, f'{sport}_prediction'] = np.random.beta(2, 3, sport_mask.sum())
            sample_data.loc[sport_mask, f'{sport}_binary_pred'] = np.random.binomial(1, 0.45, sport_mask.sum())
            sample_data.loc[sport_mask, f'{sport}_confidence'] = np.random.uniform(0.5, 0.9, sport_mask.sum())

        # Fill NaN values for other sports
        for sport in self.sports:
            sample_data[f'{sport}_prediction'] = sample_data[f'{sport}_prediction'].fillna(0.5)
            sample_data[f'{sport}_binary_pred'] = sample_data[f'{sport}_binary_pred'].fillna(0)
            sample_data[f'{sport}_confidence'] = sample_data[f'{sport}_confidence'].fillna(0.5)

        return sample_data

    def train_meta_model(self, ensemble_data: pd.DataFrame) -> Dict[str, Any]:
        """Train the meta-model using stacking ensemble approach"""
        logger.info("🚀 Training meta-model ensemble...")

        # Prepare meta-features
        meta_feature_cols = []
        for sport in self.sports:
            meta_feature_cols.extend([
                f'{sport}_prediction',
                f'{sport}_binary_pred',
                f'{sport}_confidence'
            ])

        # Add additional meta-features
        ensemble_data['avg_prediction'] = ensemble_data[[f'{sport}_prediction' for sport in self.sports]].mean(axis=1)
        ensemble_data['max_prediction'] = ensemble_data[[f'{sport}_prediction' for sport in self.sports]].max(axis=1)
        ensemble_data['min_prediction'] = ensemble_data[[f'{sport}_prediction' for sport in self.sports]].min(axis=1)
        ensemble_data['prediction_std'] = ensemble_data[[f'{sport}_prediction' for sport in self.sports]].std(axis=1)
        ensemble_data['avg_confidence'] = ensemble_data[[f'{sport}_confidence' for sport in self.sports]].mean(axis=1)

        meta_feature_cols.extend([
            'avg_prediction', 'max_prediction', 'min_prediction',
            'prediction_std', 'avg_confidence'
        ])

        # Prepare training data
        X = ensemble_data[meta_feature_cols].fillna(0)
        y = ensemble_data['target']

        logger.info(f"📊 Meta-model training data:")
        logger.info(f"  Samples: {len(X):,}")
        logger.info(f"  Features: {len(meta_feature_cols)}")
        logger.info(f"  Positive rate: {y.mean()*100:.1f}%")

        # Train/validation split
        X_train, X_val, y_train, y_val = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        # Scale meta-features
        self.meta_scaler = RobustScaler()
        X_train_scaled = self.meta_scaler.fit_transform(X_train)
        X_val_scaled = self.meta_scaler.transform(X_val)

        # Convert back to DataFrame
        X_train_scaled = pd.DataFrame(X_train_scaled, columns=meta_feature_cols, index=X_train.index)
        X_val_scaled = pd.DataFrame(X_val_scaled, columns=meta_feature_cols, index=X_val.index)

        # Hyperparameter optimization for meta-model
        best_params = self._optimize_meta_model(X_train_scaled, y_train)

        # Train final meta-model
        logger.info("🎯 Training final meta-model...")
        self.meta_model = xgb.XGBClassifier(**best_params)
        self.meta_model.fit(X_train_scaled, y_train)

        # Evaluate meta-model
        train_pred = self.meta_model.predict(X_train_scaled)
        val_pred = self.meta_model.predict(X_val_scaled)
        val_prob = self.meta_model.predict_proba(X_val_scaled)[:, 1]

        # Calculate metrics
        train_acc = accuracy_score(y_train, train_pred)
        val_acc = accuracy_score(y_val, val_pred)
        val_precision = precision_score(y_val, val_pred)
        val_recall = recall_score(y_val, val_pred)
        val_f1 = f1_score(y_val, val_pred)
        val_auc = roc_auc_score(y_val, val_prob)

        # Cross-validation
        cv_scores = cross_val_score(
            self.meta_model, X_train_scaled, y_train,
            cv=5, scoring='accuracy'
        )

        # Feature importance
        feature_importance = pd.DataFrame({
            'feature': meta_feature_cols,
            'importance': self.meta_model.feature_importances_
        }).sort_values('importance', ascending=False)

        # Store ensemble performance
        self.ensemble_performance = {
            'train_accuracy': train_acc,
            'val_accuracy': val_acc,
            'val_precision': val_precision,
            'val_recall': val_recall,
            'val_f1': val_f1,
            'val_auc': val_auc,
            'cv_mean': cv_scores.mean(),
            'cv_std': cv_scores.std(),
            'target_met': val_acc >= self.target_accuracy,
            'improvement_needed': max(0, self.target_accuracy - val_acc),
            'feature_count': len(meta_feature_cols),
            'best_params': best_params
        }

        # Log results
        logger.info("\n" + "="*60)
        logger.info("🏆 META-MODEL ENSEMBLE TRAINING COMPLETE")
        logger.info("="*60)
        logger.info(f"📊 Training Accuracy: {train_acc*100:.2f}%")
        logger.info(f"📊 Validation Accuracy: {val_acc*100:.2f}%")
        logger.info(f"🎯 Target Met: {'✅ YES' if val_acc >= self.target_accuracy else '❌ NO'}")
        logger.info(f"📈 Improvement Needed: {(self.target_accuracy - val_acc)*100:.1f}% points")
        logger.info(f"🔧 Meta-Features: {len(meta_feature_cols)}")
        logger.info(f"💫 AUC Score: {val_auc:.4f}")

        logger.info("\n🏆 Top 10 Meta-Features:")
        for i, (_, row) in enumerate(feature_importance.head(10).iterrows()):
            logger.info(f"  {i+1:2d}. {row['feature']}: {row['importance']:.4f}")

        return {
            'ensemble_stats': self.ensemble_performance,
            'feature_importance': feature_importance.to_dict('records'),
            'validation_predictions': {
                'y_true': y_val.tolist(),
                'y_pred': val_pred.tolist(),
                'y_prob': val_prob.tolist()
            }
        }

    def _optimize_meta_model(self, X_train: pd.DataFrame, y_train: pd.Series) -> Dict:
        """Optimize meta-model hyperparameters using Optuna"""
        logger.info("🎯 Optimizing meta-model hyperparameters...")

        def objective(trial):
            params = {
                'objective': 'binary:logistic',
                'eval_metric': 'logloss',
                'booster': 'gbtree',
                'n_estimators': trial.suggest_int('n_estimators', 100, 500),
                'max_depth': trial.suggest_int('max_depth', 3, 8),
                'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.3),
                'subsample': trial.suggest_float('subsample', 0.7, 1.0),
                'colsample_bytree': trial.suggest_float('colsample_bytree', 0.7, 1.0),
                'reg_alpha': trial.suggest_float('reg_alpha', 0, 5),
                'reg_lambda': trial.suggest_float('reg_lambda', 0, 5),
                'min_child_weight': trial.suggest_int('min_child_weight', 1, 5),
                'random_state': 42,
                'n_jobs': -1
            }

            model = xgb.XGBClassifier(**params)
            scores = cross_val_score(
                model, X_train, y_train,
                cv=5, scoring='accuracy', n_jobs=-1
            )
            return scores.mean()

        sampler = TPESampler(seed=42)
        study = optuna.create_study(direction='maximize', sampler=sampler)
        study.optimize(objective, n_trials=50, timeout=900)  # 15 minutes max

        logger.info(f"✅ Best meta-model accuracy: {study.best_value:.4f}")
        return study.best_params

    def create_weighted_ensemble(self, validation_data: pd.DataFrame) -> Dict[str, float]:
        """Create weighted ensemble based on individual sport model performance"""
        logger.info("⚖️ Creating weighted ensemble based on performance...")

        sport_weights = {}
        sport_performances = {}

        for sport in self.sports:
            sport_data = validation_data[validation_data['sport'] == sport]
            if len(sport_data) == 0:
                sport_weights[sport] = 1.0 / len(self.sports)  # Equal weight
                sport_performances[sport] = 0.5  # Default performance
                continue

            # Get sport model predictions
            y_true = sport_data['target']
            y_pred = sport_data[f'{sport}_binary_pred']

            # Calculate performance metrics
            accuracy = accuracy_score(y_true, y_pred)
            precision = precision_score(y_true, y_pred, zero_division=0)

            # Weight based on accuracy with precision bonus
            weight = accuracy + (precision * 0.1)
            sport_weights[sport] = weight
            sport_performances[sport] = accuracy

            logger.info(f"  {sport}: Accuracy={accuracy:.3f}, Weight={weight:.3f}")

        # Normalize weights
        total_weight = sum(sport_weights.values())
        sport_weights = {sport: weight/total_weight for sport, weight in sport_weights.items()}

        self.ensemble_weights = sport_weights
        self.individual_performances = sport_performances

        logger.info("✅ Weighted ensemble created")
        return sport_weights

    def predict(self, prop_data: Dict[str, Any]) -> Dict[str, Any]:
        """Make unified prediction for any sport prop"""
        try:
            sport = prop_data.get('sport', 'NBA')

            # Route to appropriate sport model
            if sport not in self.sport_models:
                raise ValueError(f"Model not available for sport: {sport}")

            # Prepare features (simplified for demo)
            features = self._extract_features(prop_data)

            # Scale features
            features_scaled = self.sport_scalers[sport].transform([features])

            # Get sport model prediction
            sport_prob = self.sport_models[sport].predict_proba(features_scaled)[0, 1]
            sport_pred = self.sport_models[sport].predict(features_scaled)[0]

            # Confidence calculation
            confidence = abs(sport_prob - 0.5) * 2

            # Create meta-features for ensemble
            meta_features = [0.0] * (len(self.sports) * 3 + 5)  # Initialize with zeros
            sport_idx = self.sports.index(sport)

            # Set sport-specific features
            meta_features[sport_idx * 3] = sport_prob  # prediction
            meta_features[sport_idx * 3 + 1] = sport_pred  # binary pred
            meta_features[sport_idx * 3 + 2] = confidence  # confidence

            # Set aggregate features
            meta_features[-5] = sport_prob  # avg_prediction
            meta_features[-4] = sport_prob  # max_prediction
            meta_features[-3] = sport_prob  # min_prediction
            meta_features[-2] = 0.0  # prediction_std
            meta_features[-1] = confidence  # avg_confidence

            # Meta-model prediction
            if self.meta_model and self.meta_scaler:
                meta_features_scaled = self.meta_scaler.transform([meta_features])
                ensemble_prob = self.meta_model.predict_proba(meta_features_scaled)[0, 1]
                ensemble_pred = self.meta_model.predict(meta_features_scaled)[0]
                ensemble_confidence = abs(ensemble_prob - 0.5) * 2
            else:
                ensemble_prob = sport_prob
                ensemble_pred = sport_pred
                ensemble_confidence = confidence

            # Apply confidence filtering
            final_prediction = ensemble_pred if ensemble_confidence >= self.confidence_threshold else None

            return {
                'sport': sport,
                'sport_prediction': {
                    'probability': float(sport_prob),
                    'binary': int(sport_pred),
                    'confidence': float(confidence)
                },
                'ensemble_prediction': {
                    'probability': float(ensemble_prob),
                    'binary': int(ensemble_pred),
                    'confidence': float(ensemble_confidence)
                },
                'final_prediction': final_prediction,
                'meets_confidence_threshold': ensemble_confidence >= self.confidence_threshold,
                'recommendation': self._generate_recommendation(ensemble_prob, ensemble_confidence),
                'metadata': {
                    'model_version': 'phase_4_ensemble_v1.0',
                    'timestamp': datetime.now().isoformat(),
                    'confidence_threshold': self.confidence_threshold
                }
            }

        except Exception as e:
            logger.error(f"Prediction error: {e}")
            return {
                'error': str(e),
                'sport': prop_data.get('sport', 'unknown'),
                'timestamp': datetime.now().isoformat()
            }

    def _extract_features(self, prop_data: Dict[str, Any]) -> List[float]:
        """Extract features from prop data"""
        # Simplified feature extraction
        features = [
            prop_data.get('line', 20.0) / 50.0,  # normalized line
            prop_data.get('over_odds', -110) / prop_data.get('under_odds', -110),  # odds ratio
            np.sin(2 * np.pi * prop_data.get('hour_of_day', 19) / 24),  # hour_sin
            np.cos(2 * np.pi * prop_data.get('hour_of_day', 19) / 24),  # hour_cos
            np.sin(2 * np.pi * prop_data.get('day_of_week', 3) / 7),  # day_sin
            np.cos(2 * np.pi * prop_data.get('day_of_week', 3) / 7),  # day_cos
            hash(prop_data.get('stat_type', 'points')) % 100,  # stat_type_encoded
            float(prop_data.get('is_primetime', 0)),  # is_primetime
            float(prop_data.get('is_weekend', 0))  # is_weekend
        ]
        return features

    def _generate_recommendation(self, probability: float, confidence: float) -> str:
        """Generate betting recommendation based on prediction"""
        if confidence < self.confidence_threshold:
            return "PASS - Low confidence"
        elif probability > 0.6:
            return "STRONG BET - High probability"
        elif probability > 0.55:
            return "BET - Good probability"
        elif probability < 0.4:
            return "FADE - Low probability"
        else:
            return "PASS - Neutral probability"

    def save_ensemble_system(self, output_dir: str = '/app/apps/api/ml-models/ensemble'):
        """Save complete ensemble system for production"""
        logger.info("💾 Saving ensemble system for production...")

        os.makedirs(output_dir, exist_ok=True)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        # Save meta-model
        if self.meta_model:
            meta_model_path = os.path.join(output_dir, f'meta_model_{timestamp}.pkl')
            joblib.dump(self.meta_model, meta_model_path)

            meta_scaler_path = os.path.join(output_dir, f'meta_scaler_{timestamp}.pkl')
            joblib.dump(self.meta_scaler, meta_scaler_path)

        # Save ensemble configuration
        ensemble_config = {
            'ensemble_version': 'phase_4_v1.0',
            'sports': self.sports,
            'ensemble_weights': self.ensemble_weights,
            'confidence_threshold': self.confidence_threshold,
            'target_accuracy': self.target_accuracy,
            'performance_stats': self.ensemble_performance,
            'individual_performances': self.individual_performances,
            'timestamp': datetime.now().isoformat()
        }

        config_path = os.path.join(output_dir, f'ensemble_config_{timestamp}.json')
        with open(config_path, 'w') as f:
            json.dump(ensemble_config, f, indent=2)

        # Create production manifest
        manifest = {
            'ensemble_name': f'phase_4_ensemble_{timestamp}',
            'version': '1.0.0',
            'description': 'Phase 4 Meta-Model Ensemble System',
            'sports_supported': self.sports,
            'target_accuracy': self.target_accuracy,
            'achieved_accuracy': self.ensemble_performance.get('val_accuracy', 0),
            'confidence_threshold': self.confidence_threshold,
            'deployment_ready': self.ensemble_performance.get('target_met', False),
            'files': {
                'meta_model': f'meta_model_{timestamp}.pkl',
                'meta_scaler': f'meta_scaler_{timestamp}.pkl',
                'config': f'ensemble_config_{timestamp}.json'
            },
            'timestamp': datetime.now().isoformat()
        }

        manifest_path = os.path.join(output_dir, f'ensemble_manifest_{timestamp}.json')
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f, indent=2)

        logger.info(f"✅ Ensemble system saved to: {output_dir}")
        logger.info(f"🚀 Production manifest: {manifest_path}")

        return {
            'output_dir': output_dir,
            'manifest_path': manifest_path,
            'deployment_ready': manifest['deployment_ready']
        }

def main():
    """Main execution function for Phase 4 Ensemble System"""
    print("🎯 PHASE 4: META-MODEL ENSEMBLE SYSTEM")
    print("=" * 60)
    print("🏆 Goal: Combine all 7 sport models for 55%+ win rate")
    print("🤖 Method: Stacking ensemble with XGBoost meta-learner")
    print("⚖️ Features: Weighted voting + confidence filtering")
    print("=" * 60)

    try:
        # Initialize ensemble system
        ensemble = MetaModelEnsemble()

        # Load sport-specific models
        if not ensemble.load_sport_models():
            logger.error("❌ Failed to load sport models")
            return None

        # Create sample ensemble data (in production, use real training data)
        ensemble_data = ensemble._create_sample_ensemble_data()
        ensemble_data = ensemble.create_ensemble_features(ensemble_data)

        # Train meta-model
        training_results = ensemble.train_meta_model(ensemble_data)

        # Create weighted ensemble
        weights = ensemble.create_weighted_ensemble(ensemble_data)

        # Save ensemble system
        save_info = ensemble.save_ensemble_system()

        # Generate performance report
        performance_report = {
            'phase': 4,
            'ensemble_type': 'meta_model_stacking',
            'sports_count': len(ensemble.sports),
            'target_accuracy': ensemble.target_accuracy,
            'achieved_accuracy': ensemble.ensemble_performance.get('val_accuracy', 0),
            'target_met': ensemble.ensemble_performance.get('target_met', False),
            'sport_weights': weights,
            'individual_performances': ensemble.individual_performances,
            'meta_model_performance': ensemble.ensemble_performance,
            'deployment_ready': save_info['deployment_ready']
        }

        print("\n🏆 PHASE 4 ENSEMBLE SYSTEM COMPLETE!")
        print("=" * 50)
        print(f"✅ Meta-Model Accuracy: {ensemble.ensemble_performance.get('val_accuracy', 0)*100:.2f}%")
        print(f"🎯 Target Met: {'YES' if ensemble.ensemble_performance.get('target_met', False) else 'NO'}")
        print(f"⚖️ Sport Weights: {len(weights)} sports balanced")
        print(f"🚀 Deployment Ready: {'YES' if save_info['deployment_ready'] else 'NO'}")
        print(f"💾 Saved to: {save_info['output_dir']}")

        return performance_report

    except Exception as e:
        logger.error(f"❌ Phase 4 ensemble training failed: {e}")
        raise

if __name__ == "__main__":
    main()