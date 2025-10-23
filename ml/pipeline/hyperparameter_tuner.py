"""
Optuna-based Hyperparameter Tuning for ML Pipeline
Adaptive hyperparameter optimization with 100 trials
"""

import optuna
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Callable
from sklearn.model_selection import cross_val_score, StratifiedKFold
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score, accuracy_score, precision_score, recall_score, f1_score
import xgboost as xgb
import lightgbm as lgb
import logging
from dataclasses import dataclass
import time
import json

logger = logging.getLogger(__name__)

@dataclass
class OptimizationResult:
    """Result of hyperparameter optimization"""
    best_params: Dict[str, Any]
    best_score: float
    best_trial: optuna.Trial
    study: optuna.Study
    optimization_time: float
    n_trials: int
    model_type: str

class OptunaHyperparameterTuner:
    """
    Advanced hyperparameter tuning using Optuna
    
    Features:
    - Multi-objective optimization
    - Pruning for early stopping
    - Adaptive search strategies
    - Model-specific parameter spaces
    """
    
    def __init__(
        self,
        n_trials: int = 100,
        timeout_minutes: Optional[int] = None,
        cv_folds: int = 5,
        random_state: int = 42,
        pruning: bool = True
    ):
        self.n_trials = n_trials
        self.timeout_seconds = timeout_minutes * 60 if timeout_minutes else None
        self.cv_folds = cv_folds
        self.random_state = random_state
        self.pruning = pruning
        
        # Configure Optuna logging
        optuna.logging.set_verbosity(optuna.logging.WARNING)
    
    def optimize(
        self,
        dataset: pd.DataFrame,
        target_column: str = 'target',
        target_metric: str = 'auc',
        model_type: str = 'xgboost'
    ) -> Dict[str, Any]:
        """
        Optimize hyperparameters for specified model type
        
        Args:
            dataset: Training dataset
            target_column: Name of target column
            target_metric: Metric to optimize ('auc', 'accuracy', 'f1')
            model_type: Model type ('xgboost', 'lightgbm', 'random_forest')
            
        Returns:
            Best hyperparameters and optimization results
        """
        start_time = time.time()
        
        logger.info(f"Starting hyperparameter optimization for {model_type}")
        logger.info(f"Dataset shape: {dataset.shape}")
        logger.info(f"Target metric: {target_metric}")
        
        # Prepare data
        X = dataset.drop(columns=[target_column])
        y = dataset[target_column]
        
        # Validate target
        if y.nunique() < 2:
            raise ValueError("Target must have at least 2 unique values")
        
        # Configure study
        study_name = f"{model_type}_{target_metric}_{int(time.time())}"
        direction = 'maximize' if target_metric in ['auc', 'accuracy', 'f1', 'precision', 'recall'] else 'minimize'
        
        # Pruner for early stopping
        pruner = optuna.pruners.MedianPruner(n_startup_trials=5, n_warmup_steps=10) if self.pruning else None
        
        study = optuna.create_study(
            study_name=study_name,
            direction=direction,
            pruner=pruner,
            sampler=optuna.samplers.TPESampler(seed=self.random_state)
        )
        
        # Define objective function
        def objective(trial: optuna.Trial) -> float:
            return self._objective_function(
                trial=trial,
                X=X,
                y=y,
                model_type=model_type,
                target_metric=target_metric
            )
        
        # Optimize
        study.optimize(
            objective,
            n_trials=self.n_trials,
            timeout=self.timeout_seconds,
            n_jobs=1  # Use single thread to avoid memory issues
        )
        
        optimization_time = time.time() - start_time
        
        logger.info(f"Optimization completed in {optimization_time:.2f} seconds")
        logger.info(f"Best score: {study.best_value:.4f}")
        logger.info(f"Best params: {study.best_params}")
        
        return {
            'best_params': study.best_params,
            'best_score': study.best_value,
            'optimization_time': optimization_time,
            'n_trials': len(study.trials),
            'model_type': model_type,
            'target_metric': target_metric,
            'study_summary': self._get_study_summary(study)
        }
    
    def _objective_function(
        self,
        trial: optuna.Trial,
        X: pd.DataFrame,
        y: pd.Series,
        model_type: str,
        target_metric: str
    ) -> float:
        """Objective function for Optuna optimization"""
        
        # Get model-specific parameters
        params = self._get_model_params(trial, model_type)
        
        # Create model
        model = self._create_model(model_type, params)
        
        # Cross-validation
        cv = StratifiedKFold(n_splits=self.cv_folds, shuffle=True, random_state=self.random_state)
        
        try:
            if target_metric == 'auc':
                scores = cross_val_score(model, X, y, cv=cv, scoring='roc_auc', n_jobs=1)
            elif target_metric == 'accuracy':
                scores = cross_val_score(model, X, y, cv=cv, scoring='accuracy', n_jobs=1)
            elif target_metric == 'f1':
                scores = cross_val_score(model, X, y, cv=cv, scoring='f1', n_jobs=1)
            elif target_metric == 'precision':
                scores = cross_val_score(model, X, y, cv=cv, scoring='precision', n_jobs=1)
            elif target_metric == 'recall':
                scores = cross_val_score(model, X, y, cv=cv, scoring='recall', n_jobs=1)
            else:
                scores = cross_val_score(model, X, y, cv=cv, scoring='roc_auc', n_jobs=1)
            
            mean_score = np.mean(scores)
            
            # Report intermediate value for pruning
            trial.report(mean_score, step=0)
            
            # Check if trial should be pruned
            if trial.should_prune():
                raise optuna.TrialPruned()
            
            return mean_score
            
        except Exception as e:
            logger.warning(f"Trial failed: {e}")
            return 0.0 if target_metric in ['auc', 'accuracy', 'f1', 'precision', 'recall'] else float('inf')
    
    def _get_model_params(self, trial: optuna.Trial, model_type: str) -> Dict[str, Any]:
        """Get model-specific hyperparameter suggestions"""
        
        if model_type == 'xgboost':
            return {
                'n_estimators': trial.suggest_int('n_estimators', 50, 300),
                'max_depth': trial.suggest_int('max_depth', 3, 10),
                'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.3, log=True),
                'subsample': trial.suggest_float('subsample', 0.6, 1.0),
                'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
                'reg_alpha': trial.suggest_float('reg_alpha', 1e-8, 10.0, log=True),
                'reg_lambda': trial.suggest_float('reg_lambda', 1e-8, 10.0, log=True),
                'min_child_weight': trial.suggest_int('min_child_weight', 1, 10),
                'gamma': trial.suggest_float('gamma', 1e-8, 1.0, log=True),
                'random_state': self.random_state,
                'n_jobs': 1,
                'verbosity': 0
            }
        
        elif model_type == 'lightgbm':
            return {
                'n_estimators': trial.suggest_int('n_estimators', 50, 300),
                'max_depth': trial.suggest_int('max_depth', 3, 10),
                'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.3, log=True),
                'subsample': trial.suggest_float('subsample', 0.6, 1.0),
                'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
                'reg_alpha': trial.suggest_float('reg_alpha', 1e-8, 10.0, log=True),
                'reg_lambda': trial.suggest_float('reg_lambda', 1e-8, 10.0, log=True),
                'min_child_samples': trial.suggest_int('min_child_samples', 5, 100),
                'num_leaves': trial.suggest_int('num_leaves', 10, 300),
                'random_state': self.random_state,
                'n_jobs': 1,
                'verbosity': -1
            }
        
        elif model_type == 'random_forest':
            return {
                'n_estimators': trial.suggest_int('n_estimators', 50, 300),
                'max_depth': trial.suggest_int('max_depth', 3, 20),
                'min_samples_split': trial.suggest_int('min_samples_split', 2, 20),
                'min_samples_leaf': trial.suggest_int('min_samples_leaf', 1, 20),
                'max_features': trial.suggest_categorical('max_features', ['auto', 'sqrt', 'log2']),
                'bootstrap': trial.suggest_categorical('bootstrap', [True, False]),
                'random_state': self.random_state,
                'n_jobs': 1
            }
        
        else:
            raise ValueError(f"Unsupported model type: {model_type}")
    
    def _create_model(self, model_type: str, params: Dict[str, Any]):
        """Create model instance with specified parameters"""
        
        if model_type == 'xgboost':
            return xgb.XGBClassifier(**params)
        elif model_type == 'lightgbm':
            return lgb.LGBMClassifier(**params)
        elif model_type == 'random_forest':
            return RandomForestClassifier(**params)
        else:
            raise ValueError(f"Unsupported model type: {model_type}")
    
    def _get_study_summary(self, study: optuna.Study) -> Dict[str, Any]:
        """Generate summary of optimization study"""
        
        trials_df = study.trials_dataframe()
        
        return {
            'n_trials': len(study.trials),
            'best_value': study.best_value,
            'best_trial_number': study.best_trial.number,
            'best_params': study.best_params,
            'value_statistics': {
                'mean': trials_df['value'].mean(),
                'std': trials_df['value'].std(),
                'min': trials_df['value'].min(),
                'max': trials_df['value'].max(),
                'median': trials_df['value'].median()
            },
            'optimization_history': [
                {'trial': i, 'value': trial.value}
                for i, trial in enumerate(study.trials)
                if trial.value is not None
            ]
        }
    
    def multi_model_optimization(
        self,
        dataset: pd.DataFrame,
        target_column: str = 'target',
        target_metric: str = 'auc',
        model_types: List[str] = None
    ) -> Dict[str, Dict[str, Any]]:
        """
        Optimize hyperparameters for multiple model types
        
        Returns:
            Dictionary with results for each model type
        """
        if model_types is None:
            model_types = ['xgboost', 'lightgbm', 'random_forest']
        
        results = {}
        
        for model_type in model_types:
            logger.info(f"Optimizing {model_type}...")
            
            try:
                result = self.optimize(
                    dataset=dataset,
                    target_column=target_column,
                    target_metric=target_metric,
                    model_type=model_type
                )
                results[model_type] = result
                
            except Exception as e:
                logger.error(f"Failed to optimize {model_type}: {e}")
                results[model_type] = {
                    'error': str(e),
                    'best_score': 0.0,
                    'best_params': {}
                }
        
        # Find best overall model
        best_model = max(
            results.keys(),
            key=lambda k: results[k].get('best_score', 0.0)
        )
        
        return {
            'results': results,
            'best_model': best_model,
            'best_overall_score': results[best_model].get('best_score', 0.0),
            'summary': {
                'models_optimized': len(results),
                'successful_optimizations': len([r for r in results.values() if 'error' not in r]),
                'best_model': best_model
            }
        }

def main():
    """Test hyperparameter tuning functionality"""
    from sklearn.datasets import make_classification
    
    # Generate sample dataset
    X, y = make_classification(
        n_samples=1000,
        n_features=20,
        n_informative=10,
        n_redundant=5,
        random_state=42
    )
    
    dataset = pd.DataFrame(X, columns=[f'feature_{i}' for i in range(X.shape[1])])
    dataset['target'] = y
    
    # Initialize tuner
    tuner = OptunaHyperparameterTuner(
        n_trials=20,  # Reduced for testing
        timeout_minutes=5
    )
    
    # Single model optimization
    print("Testing single model optimization...")
    result = tuner.optimize(
        dataset=dataset,
        target_metric='auc',
        model_type='xgboost'
    )
    
    print(f"Best score: {result['best_score']:.4f}")
    print(f"Best params: {result['best_params']}")
    
    # Multi-model optimization
    print("\nTesting multi-model optimization...")
    multi_results = tuner.multi_model_optimization(
        dataset=dataset,
        target_metric='auc'
    )
    
    print(f"Best model: {multi_results['best_model']}")
    print(f"Best score: {multi_results['best_overall_score']:.4f}")

if __name__ == "__main__":
    main()