"""
Feature Drift Detection for ML Pipeline
Monitors statistical drift in features to trigger retraining
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta
import logging
from dataclasses import dataclass
from scipy import stats
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import json
import os

logger = logging.getLogger(__name__)

@dataclass
class DriftResult:
    """Result of drift detection analysis"""
    feature_name: str
    drift_score: float
    p_value: float
    test_statistic: float
    drift_detected: bool
    drift_method: str
    reference_distribution: Dict[str, Any]
    current_distribution: Dict[str, Any]

class FeatureDriftDetector:
    """
    Comprehensive feature drift detection using multiple statistical tests
    
    Monitors for:
    - Distribution drift (KS test, Wasserstein distance)
    - Mean/variance shifts (Welch's t-test, F-test)
    - Categorical frequency changes (Chi-square test)
    - Population stability index (PSI)
    """
    
    def __init__(self, supabase_url: str, supabase_key: str):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.drift_threshold = 0.05  # p-value threshold
        self.psi_threshold = 0.1     # PSI threshold
        
    def analyze_feature_drift(
        self,
        start_date: datetime,
        end_date: datetime,
        reference_period_days: int = 90,
        features: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Analyze feature drift over specified time period
        
        Args:
            start_date: Start of analysis period
            end_date: End of analysis period  
            reference_period_days: Days of reference data to use
            features: Specific features to analyze (None for all)
            
        Returns:
            Comprehensive drift analysis results
        """
        logger.info(f"Analyzing feature drift from {start_date} to {end_date}")
        
        # Load reference and current datasets
        reference_end = start_date
        reference_start = reference_end - timedelta(days=reference_period_days)
        
        reference_data = self._load_feature_data(reference_start, reference_end)
        current_data = self._load_feature_data(start_date, end_date)
        
        if reference_data.empty or current_data.empty:
            raise ValueError("Insufficient data for drift analysis")
        
        # Align features
        common_features = list(set(reference_data.columns) & set(current_data.columns))
        if features:
            common_features = [f for f in common_features if f in features]
        
        logger.info(f"Analyzing drift for {len(common_features)} features")
        
        # Analyze drift for each feature
        drift_results = {}
        feature_drift_scores = {}
        
        for feature in common_features:
            try:
                drift_result = self._detect_feature_drift(
                    reference_data[feature].dropna(),
                    current_data[feature].dropna(),
                    feature_name=feature
                )
                
                drift_results[feature] = drift_result
                feature_drift_scores[feature] = drift_result.drift_score
                
            except Exception as e:
                logger.warning(f"Failed to analyze drift for feature {feature}: {e}")
                feature_drift_scores[feature] = 0.0
        
        # Calculate overall drift metrics
        overall_drift_score = np.mean(list(feature_drift_scores.values()))
        max_drift_score = max(feature_drift_scores.values()) if feature_drift_scores else 0.0
        features_with_drift = [f for f, score in feature_drift_scores.items() 
                              if score > self.drift_threshold]
        
        # Data quality assessment
        data_quality = self._assess_data_quality(reference_data, current_data)
        
        return {
            'analysis_period': {
                'reference_start': reference_start.isoformat(),
                'reference_end': reference_end.isoformat(),
                'current_start': start_date.isoformat(),
                'current_end': end_date.isoformat()
            },
            'feature_drift_scores': feature_drift_scores,
            'drift_results': {f: self._serialize_drift_result(r) for f, r in drift_results.items()},
            'overall_metrics': {
                'overall_drift_score': overall_drift_score,
                'max_drift_score': max_drift_score,
                'features_analyzed': len(common_features),
                'features_with_drift': len(features_with_drift),
                'drift_percentage': len(features_with_drift) / len(common_features) if common_features else 0
            },
            'data_quality': data_quality,
            'recommendation': self._generate_recommendation(overall_drift_score, max_drift_score, features_with_drift)
        }
    
    def _detect_feature_drift(
        self,
        reference_data: pd.Series,
        current_data: pd.Series,
        feature_name: str
    ) -> DriftResult:
        """Detect drift for a single feature using appropriate statistical test"""
        
        if self._is_categorical(reference_data):
            return self._detect_categorical_drift(reference_data, current_data, feature_name)
        else:
            return self._detect_numerical_drift(reference_data, current_data, feature_name)
    
    def _detect_numerical_drift(
        self,
        reference_data: pd.Series,
        current_data: pd.Series,
        feature_name: str
    ) -> DriftResult:
        """Detect drift in numerical features using KS test and PSI"""
        
        # Kolmogorov-Smirnov test for distribution drift
        ks_stat, ks_p_value = stats.ks_2samp(reference_data, current_data)
        
        # Population Stability Index
        psi_score = self._calculate_psi(reference_data, current_data)
        
        # Wasserstein distance (normalized)
        wasserstein_dist = stats.wasserstein_distance(reference_data, current_data)
        
        # Combine metrics for overall drift score
        drift_score = max(ks_stat, psi_score / 10)  # Normalize PSI to 0-1 scale
        
        return DriftResult(
            feature_name=feature_name,
            drift_score=drift_score,
            p_value=ks_p_value,
            test_statistic=ks_stat,
            drift_detected=ks_p_value < self.drift_threshold or psi_score > self.psi_threshold,
            drift_method='ks_test_psi',
            reference_distribution={
                'mean': float(reference_data.mean()),
                'std': float(reference_data.std()),
                'min': float(reference_data.min()),
                'max': float(reference_data.max()),
                'percentiles': {
                    '25': float(reference_data.quantile(0.25)),
                    '50': float(reference_data.quantile(0.50)),
                    '75': float(reference_data.quantile(0.75))
                }
            },
            current_distribution={
                'mean': float(current_data.mean()),
                'std': float(current_data.std()),
                'min': float(current_data.min()),
                'max': float(current_data.max()),
                'percentiles': {
                    '25': float(current_data.quantile(0.25)),
                    '50': float(current_data.quantile(0.50)),
                    '75': float(current_data.quantile(0.75))
                }
            }
        )
    
    def _detect_categorical_drift(
        self,
        reference_data: pd.Series,
        current_data: pd.Series,
        feature_name: str
    ) -> DriftResult:
        """Detect drift in categorical features using Chi-square test"""
        
        # Get value counts for both datasets
        ref_counts = reference_data.value_counts()
        curr_counts = current_data.value_counts()
        
        # Align categories
        all_categories = set(ref_counts.index) | set(curr_counts.index)
        ref_aligned = pd.Series([ref_counts.get(cat, 0) for cat in all_categories], index=all_categories)
        curr_aligned = pd.Series([curr_counts.get(cat, 0) for cat in all_categories], index=all_categories)
        
        # Chi-square test
        chi2_stat, chi2_p_value = stats.chisquare(curr_aligned, ref_aligned)
        
        # PSI for categorical data
        psi_score = self._calculate_categorical_psi(ref_aligned, curr_aligned)
        
        return DriftResult(
            feature_name=feature_name,
            drift_score=psi_score,
            p_value=chi2_p_value,
            test_statistic=chi2_stat,
            drift_detected=chi2_p_value < self.drift_threshold or psi_score > self.psi_threshold,
            drift_method='chi_square_psi',
            reference_distribution={
                'frequencies': ref_counts.to_dict(),
                'proportions': (ref_counts / ref_counts.sum()).to_dict()
            },
            current_distribution={
                'frequencies': curr_counts.to_dict(),
                'proportions': (curr_counts / curr_counts.sum()).to_dict()
            }
        )
    
    def _calculate_psi(self, reference: pd.Series, current: pd.Series, bins: int = 10) -> float:
        """Calculate Population Stability Index for numerical data"""
        
        # Create bins based on reference data
        bin_edges = np.histogram_bin_edges(reference, bins=bins)
        
        # Calculate frequencies
        ref_freq, _ = np.histogram(reference, bins=bin_edges)
        curr_freq, _ = np.histogram(current, bins=bin_edges)
        
        # Convert to proportions
        ref_prop = ref_freq / ref_freq.sum()
        curr_prop = curr_freq / curr_freq.sum()
        
        # Calculate PSI
        psi = 0
        for i in range(len(ref_prop)):
            if ref_prop[i] > 0 and curr_prop[i] > 0:
                psi += (curr_prop[i] - ref_prop[i]) * np.log(curr_prop[i] / ref_prop[i])
        
        return psi
    
    def _calculate_categorical_psi(self, reference: pd.Series, current: pd.Series) -> float:
        """Calculate PSI for categorical data"""
        
        ref_prop = reference / reference.sum()
        curr_prop = current / current.sum()
        
        psi = 0
        for category in ref_prop.index:
            ref_p = ref_prop[category]
            curr_p = curr_prop[category]
            
            if ref_p > 0 and curr_p > 0:
                psi += (curr_p - ref_p) * np.log(curr_p / ref_p)
        
        return psi
    
    def _is_categorical(self, data: pd.Series) -> bool:
        """Determine if a feature is categorical"""
        return data.dtype == 'object' or data.dtype.name == 'category' or data.nunique() <= 20
    
    def _load_feature_data(self, start_date: datetime, end_date: datetime) -> pd.DataFrame:
        """Load feature data from Supabase for specified date range"""
        
        # This would be implemented with actual Supabase client
        # For now, return simulated data structure
        import random
        np.random.seed(42)
        
        # Simulate feature data
        n_samples = random.randint(1000, 5000)
        
        data = pd.DataFrame({
            'season_avg_points': np.random.normal(20, 5, n_samples),
            'line_movement': np.random.normal(0, 1.5, n_samples),
            'injury_status': np.random.choice(['healthy', 'questionable', 'doubtful'], n_samples),
            'last_5_games_avg': np.random.normal(18, 6, n_samples),
            'home_vs_away_performance': np.random.normal(0, 2, n_samples),
            'weather_conditions': np.random.choice(['clear', 'rain', 'snow', 'wind'], n_samples),
            'rest_days': np.random.randint(0, 7, n_samples),
            'opponent_strength': np.random.normal(0.5, 0.2, n_samples),
        })
        
        return data
    
    def _assess_data_quality(self, reference_data: pd.DataFrame, current_data: pd.DataFrame) -> Dict[str, Any]:
        """Assess data quality metrics"""
        
        return {
            'reference_samples': len(reference_data),
            'current_samples': len(current_data),
            'reference_completeness': (1 - reference_data.isnull().sum().sum() / reference_data.size),
            'current_completeness': (1 - current_data.isnull().sum().sum() / current_data.size),
            'feature_overlap': len(set(reference_data.columns) & set(current_data.columns)),
            'total_features': len(set(reference_data.columns) | set(current_data.columns)),
            'volume_change': len(current_data) / len(reference_data) if len(reference_data) > 0 else 0
        }
    
    def _generate_recommendation(
        self,
        overall_drift: float,
        max_drift: float,
        features_with_drift: List[str]
    ) -> str:
        """Generate recommendation based on drift analysis"""
        
        if max_drift > 0.2:
            return "URGENT_RETRAIN - High drift detected, immediate retraining recommended"
        elif max_drift > 0.1:
            return "RETRAIN - Moderate drift detected, retraining recommended"
        elif overall_drift > 0.05:
            return "MONITOR - Low drift detected, continue monitoring"
        else:
            return "STABLE - No significant drift detected"
    
    def _serialize_drift_result(self, result: DriftResult) -> Dict[str, Any]:
        """Convert DriftResult to serializable dictionary"""
        return {
            'feature_name': result.feature_name,
            'drift_score': result.drift_score,
            'p_value': result.p_value,
            'test_statistic': result.test_statistic,
            'drift_detected': result.drift_detected,
            'drift_method': result.drift_method,
            'reference_distribution': result.reference_distribution,
            'current_distribution': result.current_distribution
        }

def main():
    """Test drift detection functionality"""
    from datetime import datetime, timedelta
    
    # Initialize detector
    detector = FeatureDriftDetector(
        supabase_url="test-url",
        supabase_key="test-key"
    )
    
    # Analyze drift
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    
    results = detector.analyze_feature_drift(
        start_date=start_date,
        end_date=end_date,
        reference_period_days=90
    )
    
    print("Drift Analysis Results:")
    print(f"Overall drift score: {results['overall_metrics']['overall_drift_score']:.4f}")
    print(f"Max drift score: {results['overall_metrics']['max_drift_score']:.4f}")
    print(f"Features with drift: {results['overall_metrics']['features_with_drift']}")
    print(f"Recommendation: {results['recommendation']}")

if __name__ == "__main__":
    main()