"""
Modular Training Pipeline for Unit Talk ML
Phase 7A - Offline ML Prep

Implements modular training with support for multiple model types,
cross-validation, and hyperparameter tuning.
"""

import os
import json
import yaml
import pickle
import joblib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Union
import pandas as pd
import numpy as np
from sklearn.model_selection import TimeSeriesSplit, train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import (
    roc_auc_score, precision_recall_curve, auc, accuracy_score,
    precision_score, recall_score, f1_score, log_loss, brier_score_loss,
    confusion_matrix, classification_report
)
import xgboost as xgb
import lightgbm as lgb
import tensorflow as tf
from tensorflow import keras
import optuna
import logging
import warnings

warnings.filterwarnings('ignore')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FeatureProcessor:
    """Handles feature preprocessing and transformation"""
    
    def __init__(self, config_path: str = "ml/configs/pipeline_config.yml"):
        with open(config_path, 'r') as f:
            self.config = yaml.safe_load(f)
            
        self.scaler = StandardScaler()
        self.label_encoders = {}
        self.feature_names = None
        
    def fit_transform(self, X: pd.DataFrame, y: pd.Series) -> Tuple[np.ndarray, np.ndarray]:
        """Fit preprocessors and transform features"""
        logger.info(f"Processing {len(X)} samples with {len(X.columns)} features")
        
        # Separate numeric and categorical columns
        numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()
        categorical_cols = X.select_dtypes(include=['object', 'category']).columns.tolist()
        
        # Remove target-related columns if present
        exclude_cols = ['status', 'profit_loss', 'actual_value', 'settlement_result']
        numeric_cols = [col for col in numeric_cols if col not in exclude_cols]
        categorical_cols = [col for col in categorical_cols if col not in exclude_cols]
        
        # Process numeric features
        X_numeric = X[numeric_cols].fillna(0)
        X_numeric_scaled = self.scaler.fit_transform(X_numeric)
        
        # Process categorical features
        X_categorical_encoded = []
        for col in categorical_cols:
            le = LabelEncoder()
            X[col] = X[col].fillna('missing')
            encoded = le.fit_transform(X[col])
            X_categorical_encoded.append(encoded.reshape(-1, 1))
            self.label_encoders[col] = le
            
        # Combine features
        if X_categorical_encoded:
            X_categorical_array = np.hstack(X_categorical_encoded)
            X_processed = np.hstack([X_numeric_scaled, X_categorical_array])
            self.feature_names = numeric_cols + categorical_cols
        else:
            X_processed = X_numeric_scaled
            self.feature_names = numeric_cols
            
        # Process target
        if y.dtype == 'object':
            y_processed = (y == 'won').astype(int)
        else:
            y_processed = y.values
            
        logger.info(f"Processed features shape: {X_processed.shape}")
        return X_processed, y_processed
    
    def transform(self, X: pd.DataFrame) -> np.ndarray:
        """Transform features using fitted preprocessors"""
        numeric_cols = [col for col in self.feature_names if col not in self.label_encoders]
        categorical_cols = [col for col in self.feature_names if col in self.label_encoders]
        
        # Process numeric features
        X_numeric = X[numeric_cols].fillna(0)
        X_numeric_scaled = self.scaler.transform(X_numeric)
        
        # Process categorical features
        X_categorical_encoded = []
        for col in categorical_cols:
            X[col] = X[col].fillna('missing')
            le = self.label_encoders[col]
            # Handle unseen categories
            X[col] = X[col].apply(lambda x: x if x in le.classes_ else 'missing')
            encoded = le.transform(X[col])
            X_categorical_encoded.append(encoded.reshape(-1, 1))
            
        # Combine features
        if X_categorical_encoded:
            X_categorical_array = np.hstack(X_categorical_encoded)
            X_processed = np.hstack([X_numeric_scaled, X_categorical_array])
        else:
            X_processed = X_numeric_scaled
            
        return X_processed
    
    def get_feature_importance(self, model, model_type: str) -> Dict[str, float]:
        """Extract feature importance from trained model"""
        if model_type in ['xgboost', 'lightgbm']:
            if model_type == 'xgboost':
                importance = model.feature_importances_
            else:
                importance = model.feature_importance(importance_type='gain')
            
            return dict(zip(self.feature_names, importance))
        else:
            # For neural networks, use permutation importance or return None
            return {}


class ModelTrainer:
    """Handles model training with different algorithms"""
    
    def __init__(self, config_path: str = "ml/configs/pipeline_config.yml"):
        with open(config_path, 'r') as f:
            self.config = yaml.safe_load(f)
            
        self.models = {}
        self.best_params = {}
        
    def train_xgboost(
        self, 
        X_train: np.ndarray, 
        y_train: np.ndarray,
        X_val: np.ndarray,
        y_val: np.ndarray,
        params: Optional[Dict] = None
    ) -> xgb.XGBClassifier:
        """Train XGBoost model"""
        logger.info("Training XGBoost model...")
        
        default_params = self.config['models']['xgboost'].copy()
        default_params.pop('type', None)
        
        if params:
            default_params.update(params)
            
        model = xgb.XGBClassifier(
            **default_params,
            random_state=self.config['pipeline']['random_seed']
        )
        
        # Train with early stopping
        model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            early_stopping_rounds=self.config['training']['early_stopping']['patience'],
            verbose=False
        )
        
        return model
    
    def train_lightgbm(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: np.ndarray,
        y_val: np.ndarray,
        params: Optional[Dict] = None
    ) -> lgb.LGBMClassifier:
        """Train LightGBM model"""
        logger.info("Training LightGBM model...")
        
        default_params = self.config['models']['lightgbm'].copy()
        default_params.pop('type', None)
        
        if params:
            default_params.update(params)
            
        model = lgb.LGBMClassifier(
            **default_params,
            random_state=self.config['pipeline']['random_seed'],
            verbosity=-1
        )
        
        # Train with early stopping
        model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            callbacks=[lgb.early_stopping(self.config['training']['early_stopping']['patience'])],
            eval_metric='logloss'
        )
        
        return model
    
    def train_neural_network(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: np.ndarray,
        y_val: np.ndarray,
        params: Optional[Dict] = None
    ) -> keras.Model:
        """Train neural network model"""
        logger.info("Training neural network model...")
        
        nn_config = self.config['models']['neural_net']
        
        # Build model architecture
        model = keras.Sequential()
        
        for i, layer_config in enumerate(nn_config['architecture']):
            if i == 0:
                # First layer needs input shape
                model.add(keras.layers.Dense(
                    layer_config['units'],
                    activation=layer_config['activation'],
                    input_shape=(X_train.shape[1],)
                ))
            else:
                model.add(keras.layers.Dense(
                    layer_config['units'],
                    activation=layer_config['activation']
                ))
                
            if 'dropout' in layer_config and layer_config['dropout'] > 0:
                model.add(keras.layers.Dropout(layer_config['dropout']))
                
        # Compile model
        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=nn_config['learning_rate']),
            loss='binary_crossentropy',
            metrics=['accuracy', keras.metrics.AUC()]
        )
        
        # Callbacks
        callbacks = [
            keras.callbacks.EarlyStopping(
                patience=nn_config['early_stopping_patience'],
                restore_best_weights=True,
                monitor='val_loss'
            ),
            keras.callbacks.ReduceLROnPlateau(
                factor=0.5,
                patience=3,
                min_lr=1e-6
            )
        ]
        
        # Train model
        history = model.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=nn_config['epochs'],
            batch_size=nn_config['batch_size'],
            callbacks=callbacks,
            verbose=0
        )
        
        return model
    
    def optimize_hyperparameters(
        self,
        model_type: str,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: np.ndarray,
        y_val: np.ndarray,
        n_trials: int = 50
    ) -> Dict[str, Any]:
        """Optimize hyperparameters using Optuna"""
        logger.info(f"Optimizing hyperparameters for {model_type}...")
        
        def objective(trial):
            if model_type == 'xgboost':
                params = {
                    'n_estimators': trial.suggest_int('n_estimators', 50, 300),
                    'max_depth': trial.suggest_int('max_depth', 3, 10),
                    'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.3, log=True),
                    'subsample': trial.suggest_float('subsample', 0.6, 1.0),
                    'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
                }
                model = self.train_xgboost(X_train, y_train, X_val, y_val, params)
                
            elif model_type == 'lightgbm':
                params = {
                    'n_estimators': trial.suggest_int('n_estimators', 50, 300),
                    'num_leaves': trial.suggest_int('num_leaves', 20, 100),
                    'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.3, log=True),
                    'feature_fraction': trial.suggest_float('feature_fraction', 0.6, 1.0),
                    'bagging_fraction': trial.suggest_float('bagging_fraction', 0.6, 1.0),
                }
                model = self.train_lightgbm(X_train, y_train, X_val, y_val, params)
                
            else:
                raise ValueError(f"Hyperparameter optimization not implemented for {model_type}")
                
            # Evaluate model
            if hasattr(model, 'predict_proba'):
                y_pred_proba = model.predict_proba(X_val)[:, 1]
            else:
                y_pred_proba = model.predict(X_val)
                
            return roc_auc_score(y_val, y_pred_proba)
        
        # Create study
        study = optuna.create_study(direction='maximize', sampler=optuna.samplers.TPESampler())
        study.optimize(objective, n_trials=n_trials, timeout=3600)
        
        logger.info(f"Best parameters: {study.best_params}")
        logger.info(f"Best AUC: {study.best_value:.4f}")
        
        return study.best_params


class CrossValidator:
    """Handles cross-validation and rolling window validation"""
    
    def __init__(self, config_path: str = "ml/configs/pipeline_config.yml"):
        with open(config_path, 'r') as f:
            self.config = yaml.safe_load(f)
            
    def time_series_cross_validation(
        self,
        X: np.ndarray,
        y: np.ndarray,
        model_trainer: ModelTrainer,
        model_type: str,
        n_splits: int = 5
    ) -> Dict[str, List[float]]:
        """Perform time series cross-validation"""
        logger.info(f"Performing {n_splits}-fold time series cross-validation...")
        
        tscv = TimeSeriesSplit(n_splits=n_splits)
        results = {
            'auc': [],
            'precision': [],
            'recall': [],
            'f1': [],
            'log_loss': []
        }
        
        for fold, (train_idx, val_idx) in enumerate(tscv.split(X)):
            logger.info(f"Fold {fold + 1}/{n_splits}")
            
            X_train, X_val = X[train_idx], X[val_idx]
            y_train, y_val = y[train_idx], y[val_idx]
            
            # Train model
            if model_type == 'xgboost':
                model = model_trainer.train_xgboost(X_train, y_train, X_val, y_val)
            elif model_type == 'lightgbm':
                model = model_trainer.train_lightgbm(X_train, y_train, X_val, y_val)
            elif model_type == 'neural_net':
                model = model_trainer.train_neural_network(X_train, y_train, X_val, y_val)
                
            # Evaluate
            if hasattr(model, 'predict_proba'):
                y_pred_proba = model.predict_proba(X_val)[:, 1]
            else:
                y_pred_proba = model.predict(X_val)
                
            y_pred = (y_pred_proba > 0.5).astype(int)
            
            results['auc'].append(roc_auc_score(y_val, y_pred_proba))
            results['precision'].append(precision_score(y_val, y_pred))
            results['recall'].append(recall_score(y_val, y_pred))
            results['f1'].append(f1_score(y_val, y_pred))
            results['log_loss'].append(log_loss(y_val, y_pred_proba))
            
        # Calculate mean and std
        results_summary = {}
        for metric, values in results.items():
            results_summary[f"{metric}_mean"] = np.mean(values)
            results_summary[f"{metric}_std"] = np.std(values)
            
        return results_summary
    
    def rolling_window_validation(
        self,
        df: pd.DataFrame,
        feature_processor: FeatureProcessor,
        model_trainer: ModelTrainer,
        model_type: str,
        target_col: str = 'status'
    ) -> List[Dict[str, Any]]:
        """Perform rolling window validation"""
        logger.info("Performing rolling window validation...")
        
        config = self.config['training']['rolling_window']
        window_size = config['window_size']
        step_size = config['step_size']
        min_train_size = config['min_train_size']
        
        # Sort by time
        df = df.sort_values('placed_at')
        
        results = []
        start_date = df['placed_at'].min()
        end_date = df['placed_at'].max()
        
        current_train_end = start_date + pd.Timedelta(days=min_train_size)
        
        while current_train_end < end_date - pd.Timedelta(days=window_size):
            val_start = current_train_end
            val_end = val_start + pd.Timedelta(days=window_size)
            
            # Split data
            train_data = df[df['placed_at'] < current_train_end]
            val_data = df[(df['placed_at'] >= val_start) & (df['placed_at'] < val_end)]
            
            if len(train_data) < 100 or len(val_data) < 50:
                current_train_end += pd.Timedelta(days=step_size)
                continue
                
            # Prepare features
            X_train = train_data.drop(columns=[target_col, 'placed_at', 'settled_at'], errors='ignore')
            y_train = train_data[target_col]
            X_val = val_data.drop(columns=[target_col, 'placed_at', 'settled_at'], errors='ignore')
            y_val = val_data[target_col]
            
            # Process features
            X_train_processed, y_train_processed = feature_processor.fit_transform(X_train, y_train)
            X_val_processed = feature_processor.transform(X_val)
            y_val_processed = (y_val == 'won').astype(int) if y_val.dtype == 'object' else y_val.values
            
            # Train model
            if model_type == 'xgboost':
                model = model_trainer.train_xgboost(
                    X_train_processed, y_train_processed,
                    X_val_processed, y_val_processed
                )
            elif model_type == 'lightgbm':
                model = model_trainer.train_lightgbm(
                    X_train_processed, y_train_processed,
                    X_val_processed, y_val_processed
                )
                
            # Evaluate
            if hasattr(model, 'predict_proba'):
                y_pred_proba = model.predict_proba(X_val_processed)[:, 1]
            else:
                y_pred_proba = model.predict(X_val_processed)
                
            window_result = {
                'train_end': current_train_end,
                'val_start': val_start,
                'val_end': val_end,
                'train_samples': len(train_data),
                'val_samples': len(val_data),
                'auc': roc_auc_score(y_val_processed, y_pred_proba),
                'log_loss': log_loss(y_val_processed, y_pred_proba)
            }
            
            results.append(window_result)
            current_train_end += pd.Timedelta(days=step_size)
            
        return results


class TrainingPipeline:
    """Main training pipeline orchestrator"""
    
    def __init__(self, config_path: str = "ml/configs/pipeline_config.yml"):
        with open(config_path, 'r') as f:
            self.config = yaml.safe_load(f)
            
        self.feature_processor = FeatureProcessor(config_path)
        self.model_trainer = ModelTrainer(config_path)
        self.cross_validator = CrossValidator(config_path)
        
    def load_dataset(self, dataset_id: str) -> Dict[str, pd.DataFrame]:
        """Load dataset splits"""
        dataset_path = Path(self.config['infrastructure']['storage']['datasets']) / dataset_id
        
        splits = {}
        for split in ['train', 'validation', 'test']:
            file_path = dataset_path / f"{split}.parquet"
            if file_path.exists():
                splits[split] = pd.read_parquet(file_path)
                logger.info(f"Loaded {split} split: {len(splits[split])} samples")
                
        return splits
    
    def train_model(
        self,
        model_type: str,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: np.ndarray,
        y_val: np.ndarray,
        optimize_hyperparams: bool = True
    ) -> Any:
        """Train a single model with optional hyperparameter optimization"""
        
        if optimize_hyperparams and model_type in ['xgboost', 'lightgbm']:
            best_params = self.model_trainer.optimize_hyperparameters(
                model_type, X_train, y_train, X_val, y_val
            )
            self.model_trainer.best_params[model_type] = best_params
        
        if model_type == 'xgboost':
            params = self.model_trainer.best_params.get('xgboost')
            return self.model_trainer.train_xgboost(X_train, y_train, X_val, y_val, params)
        elif model_type == 'lightgbm':
            params = self.model_trainer.best_params.get('lightgbm')
            return self.model_trainer.train_lightgbm(X_train, y_train, X_val, y_val, params)
        elif model_type == 'neural_net':
            return self.model_trainer.train_neural_network(X_train, y_train, X_val, y_val)
        else:
            raise ValueError(f"Unknown model type: {model_type}")
            
    def train_ensemble(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: np.ndarray,
        y_val: np.ndarray
    ) -> Dict[str, Any]:
        """Train ensemble of models"""
        logger.info("Training ensemble models...")
        
        models = {}
        
        # Train individual models
        for model_type in ['xgboost', 'lightgbm', 'neural_net']:
            logger.info(f"Training {model_type}...")
            model = self.train_model(
                model_type, X_train, y_train, X_val, y_val,
                optimize_hyperparams=(model_type != 'neural_net')
            )
            models[model_type] = model
            
        return models
    
    def save_model(
        self,
        model: Any,
        model_type: str,
        dataset_id: str,
        metrics: Dict[str, float]
    ):
        """Save trained model and metadata"""
        model_dir = Path(self.config['infrastructure']['storage']['models']) / dataset_id / model_type
        model_dir.mkdir(parents=True, exist_ok=True)
        
        # Save model
        if model_type == 'neural_net':
            model.save(model_dir / 'model.keras')
        else:
            joblib.dump(model, model_dir / 'model.joblib')
            
        # Save metadata
        metadata = {
            'model_type': model_type,
            'dataset_id': dataset_id,
            'trained_at': datetime.now().isoformat(),
            'metrics': metrics,
            'best_params': self.model_trainer.best_params.get(model_type, {}),
            'feature_names': self.feature_processor.feature_names
        }
        
        with open(model_dir / 'metadata.json', 'w') as f:
            json.dump(metadata, f, indent=2)
            
        # Save feature processor
        joblib.dump(self.feature_processor, model_dir / 'feature_processor.joblib')
        
        logger.info(f"Saved {model_type} model to {model_dir}")
        
    def run_training_pipeline(
        self,
        dataset_id: str,
        target_column: str = 'status',
        train_ensemble: bool = True
    ) -> Dict[str, Any]:
        """Run complete training pipeline"""
        logger.info(f"Starting training pipeline for dataset: {dataset_id}")
        
        # Load dataset
        splits = self.load_dataset(dataset_id)
        
        # Prepare features
        X_train = splits['train'].drop(columns=[target_column, 'placed_at', 'settled_at'], errors='ignore')
        y_train = splits['train'][target_column]
        X_val = splits['validation'].drop(columns=[target_column, 'placed_at', 'settled_at'], errors='ignore')
        y_val = splits['validation'][target_column]
        
        # Process features
        X_train_processed, y_train_processed = self.feature_processor.fit_transform(X_train, y_train)
        X_val_processed = self.feature_processor.transform(X_val)
        y_val_processed = (y_val == 'won').astype(int) if y_val.dtype == 'object' else y_val.values
        
        if train_ensemble:
            # Train ensemble
            models = self.train_ensemble(
                X_train_processed, y_train_processed,
                X_val_processed, y_val_processed
            )
            
            # Evaluate each model
            results = {}
            for model_type, model in models.items():
                if hasattr(model, 'predict_proba'):
                    y_pred_proba = model.predict_proba(X_val_processed)[:, 1]
                else:
                    y_pred_proba = model.predict(X_val_processed)
                    
                metrics = {
                    'auc': roc_auc_score(y_val_processed, y_pred_proba),
                    'log_loss': log_loss(y_val_processed, y_pred_proba)
                }
                
                results[model_type] = metrics
                self.save_model(model, model_type, dataset_id, metrics)
                
        else:
            # Train single XGBoost model
            model = self.train_model(
                'xgboost',
                X_train_processed, y_train_processed,
                X_val_processed, y_val_processed,
                optimize_hyperparams=True
            )
            
            y_pred_proba = model.predict_proba(X_val_processed)[:, 1]
            metrics = {
                'auc': roc_auc_score(y_val_processed, y_pred_proba),
                'log_loss': log_loss(y_val_processed, y_pred_proba)
            }
            
            results = {'xgboost': metrics}
            self.save_model(model, 'xgboost', dataset_id, metrics)
            
        return results


def main():
    """Example usage"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Train ML models")
    parser.add_argument("--dataset-id", required=True, help="Dataset ID to train on")
    parser.add_argument("--target", default="status", help="Target column name")
    parser.add_argument("--ensemble", action="store_true", help="Train ensemble of models")
    args = parser.parse_args()
    
    # Run training
    pipeline = TrainingPipeline()
    results = pipeline.run_training_pipeline(
        args.dataset_id,
        target_column=args.target,
        train_ensemble=args.ensemble
    )
    
    # Print results
    print("\nTraining Results:")
    print("=" * 50)
    for model_type, metrics in results.items():
        print(f"\n{model_type}:")
        for metric, value in metrics.items():
            print(f"  {metric}: {value:.4f}")


if __name__ == "__main__":
    main()