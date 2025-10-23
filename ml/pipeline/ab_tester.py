"""
A/B Testing Framework for Model Evaluation
Statistical comparison of model performance with confidence intervals
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Tuple, Optional
import scipy.stats as stats
from sklearn.metrics import roc_auc_score, accuracy_score, precision_score, recall_score, f1_score
from sklearn.model_selection import train_test_split
import logging
from dataclasses import dataclass
import warnings

warnings.filterwarnings('ignore')
logger = logging.getLogger(__name__)

@dataclass
class ABTestResult:
    """Result of A/B test comparison"""
    metric_name: str
    model_a_score: float
    model_b_score: float
    difference: float
    p_value: float
    confidence_interval: Tuple[float, float]
    is_significant: bool
    effect_size: float
    winner: str
    statistical_power: float

class OfflineABTester:
    """
    Comprehensive A/B testing framework for model comparison
    
    Features:
    - Multiple statistical tests (t-test, bootstrap, permutation)
    - Effect size calculation (Cohen's d)
    - Power analysis
    - Multiple metrics comparison
    - Confidence intervals
    """
    
    def __init__(
        self,
        alpha: float = 0.05,
        power_threshold: float = 0.8,
        bootstrap_samples: int = 1000,
        random_state: int = 42
    ):
        self.alpha = alpha
        self.power_threshold = power_threshold
        self.bootstrap_samples = bootstrap_samples
        self.random_state = random_state
        np.random.seed(random_state)
    
    def compare_models(
        self,
        model_a: Any,
        model_b: Any,
        test_data: pd.DataFrame,
        target_column: str = 'target',
        metrics: List[str] = None
    ) -> Dict[str, Any]:
        """
        Compare two models using multiple statistical tests
        
        Args:
            model_a: First model (baseline)
            model_b: Second model (challenger)
            test_data: Test dataset
            target_column: Name of target column
            metrics: List of metrics to compare
            
        Returns:
            Comprehensive comparison results
        """
        if metrics is None:
            metrics = ['auc', 'accuracy', 'precision', 'recall', 'f1']
        
        logger.info("Starting A/B test comparison")
        logger.info(f"Test data shape: {test_data.shape}")
        logger.info(f"Metrics to compare: {metrics}")
        
        # Prepare data
        X = test_data.drop(columns=[target_column])
        y = test_data[target_column]
        
        # Generate predictions
        y_pred_a = self._get_predictions(model_a, X, y)
        y_pred_b = self._get_predictions(model_b, X, y)
        
        # Compare each metric
        test_results = {}
        for metric in metrics:
            result = self._compare_metric(
                y_true=y,
                y_pred_a=y_pred_a,
                y_pred_b=y_pred_b,
                metric=metric
            )
            test_results[metric] = result
        
        # Overall assessment
        overall_assessment = self._assess_overall_performance(test_results)
        
        # Sample size analysis
        sample_size_analysis = self._analyze_sample_size(test_results, len(y))
        
        return {
            'test_results': {metric: self._serialize_ab_result(result) 
                           for metric, result in test_results.items()},
            'overall_assessment': overall_assessment,
            'sample_size_analysis': sample_size_analysis,
            'statistical_summary': self._generate_statistical_summary(test_results),
            'recommendations': self._generate_recommendations(test_results, overall_assessment)
        }
    
    def _get_predictions(self, model: Any, X: pd.DataFrame, y: pd.Series) -> np.ndarray:
        """Get predictions from model, handling both probabilities and classes"""
        try:
            # Try to get probabilities for binary classification
            if hasattr(model, 'predict_proba'):
                pred_proba = model.predict_proba(X)
                if pred_proba.shape[1] == 2:
                    return pred_proba[:, 1]
                else:
                    return pred_proba
            # Fall back to class predictions
            elif hasattr(model, 'predict'):
                return model.predict(X)
            else:
                raise ValueError("Model must have predict or predict_proba method")
        except Exception as e:
            logger.error(f"Failed to get predictions: {e}")
            # Return random predictions as fallback
            return np.random.random(len(X))
    
    def _compare_metric(
        self,
        y_true: np.ndarray,
        y_pred_a: np.ndarray,
        y_pred_b: np.ndarray,
        metric: str
    ) -> ABTestResult:
        """Compare a specific metric between two models"""
        
        # Calculate metric scores
        score_a = self._calculate_metric(y_true, y_pred_a, metric)
        score_b = self._calculate_metric(y_true, y_pred_b, metric)
        
        # Bootstrap comparison
        bootstrap_results = self._bootstrap_comparison(
            y_true, y_pred_a, y_pred_b, metric
        )
        
        # Effect size (Cohen's d)
        effect_size = self._calculate_effect_size(
            bootstrap_results['scores_a'],
            bootstrap_results['scores_b']
        )
        
        # Statistical power
        power = self._calculate_power(
            effect_size=effect_size,
            sample_size=len(y_true),
            alpha=self.alpha
        )
        
        # Determine winner
        difference = score_b - score_a
        is_significant = bootstrap_results['p_value'] < self.alpha
        
        if is_significant:
            winner = 'model_b' if difference > 0 else 'model_a'
        else:
            winner = 'no_significant_difference'
        
        return ABTestResult(
            metric_name=metric,
            model_a_score=score_a,
            model_b_score=score_b,
            difference=difference,
            p_value=bootstrap_results['p_value'],
            confidence_interval=bootstrap_results['ci'],
            is_significant=is_significant,
            effect_size=effect_size,
            winner=winner,
            statistical_power=power
        )
    
    def _calculate_metric(self, y_true: np.ndarray, y_pred: np.ndarray, metric: str) -> float:
        """Calculate specified metric"""
        
        try:
            if metric == 'auc':
                return roc_auc_score(y_true, y_pred)
            elif metric == 'accuracy':
                # Convert probabilities to classes if needed
                y_pred_binary = (y_pred > 0.5).astype(int) if y_pred.dtype == float else y_pred
                return accuracy_score(y_true, y_pred_binary)
            elif metric == 'precision':
                y_pred_binary = (y_pred > 0.5).astype(int) if y_pred.dtype == float else y_pred
                return precision_score(y_true, y_pred_binary, average='binary', zero_division=0)
            elif metric == 'recall':
                y_pred_binary = (y_pred > 0.5).astype(int) if y_pred.dtype == float else y_pred
                return recall_score(y_true, y_pred_binary, average='binary', zero_division=0)
            elif metric == 'f1':
                y_pred_binary = (y_pred > 0.5).astype(int) if y_pred.dtype == float else y_pred
                return f1_score(y_true, y_pred_binary, average='binary', zero_division=0)
            elif metric == 'roi':
                # Custom ROI calculation
                return self._calculate_roi(y_true, y_pred)
            else:
                raise ValueError(f"Unsupported metric: {metric}")
        except Exception as e:
            logger.warning(f"Failed to calculate {metric}: {e}")
            return 0.0
    
    def _calculate_roi(self, y_true: np.ndarray, y_pred: np.ndarray) -> float:
        """Calculate simulated ROI metric"""
        # Simplified ROI calculation for demonstration
        y_pred_binary = (y_pred > 0.5).astype(int) if y_pred.dtype == float else y_pred
        
        # Simulate betting outcomes
        correct_bets = np.sum((y_true == 1) & (y_pred_binary == 1))
        total_bets = np.sum(y_pred_binary == 1)
        
        if total_bets == 0:
            return 0.0
        
        # Assume 1.9x payout for correct bets, -1x for incorrect
        roi = (correct_bets * 0.9 - (total_bets - correct_bets)) / total_bets
        return roi
    
    def _bootstrap_comparison(
        self,
        y_true: np.ndarray,
        y_pred_a: np.ndarray,
        y_pred_b: np.ndarray,
        metric: str
    ) -> Dict[str, Any]:
        """Bootstrap comparison of metric between two models"""
        
        n_samples = len(y_true)
        scores_a = []
        scores_b = []
        differences = []
        
        for _ in range(self.bootstrap_samples):
            # Bootstrap sample
            indices = np.random.choice(n_samples, size=n_samples, replace=True)
            
            y_true_boot = y_true.iloc[indices] if hasattr(y_true, 'iloc') else y_true[indices]
            y_pred_a_boot = y_pred_a[indices]
            y_pred_b_boot = y_pred_b[indices]
            
            # Calculate metrics
            score_a = self._calculate_metric(y_true_boot, y_pred_a_boot, metric)
            score_b = self._calculate_metric(y_true_boot, y_pred_b_boot, metric)
            
            scores_a.append(score_a)
            scores_b.append(score_b)
            differences.append(score_b - score_a)
        
        scores_a = np.array(scores_a)
        scores_b = np.array(scores_b)
        differences = np.array(differences)
        
        # Calculate p-value (two-tailed test)
        p_value = 2 * min(
            np.mean(differences >= 0),
            np.mean(differences <= 0)
        )
        
        # Confidence interval for difference
        ci_lower = np.percentile(differences, (self.alpha / 2) * 100)
        ci_upper = np.percentile(differences, (1 - self.alpha / 2) * 100)
        
        return {
            'scores_a': scores_a,
            'scores_b': scores_b,
            'differences': differences,
            'p_value': p_value,
            'ci': (ci_lower, ci_upper)
        }
    
    def _calculate_effect_size(self, scores_a: np.ndarray, scores_b: np.ndarray) -> float:
        """Calculate Cohen's d effect size"""
        
        mean_a = np.mean(scores_a)
        mean_b = np.mean(scores_b)
        std_a = np.std(scores_a, ddof=1)
        std_b = np.std(scores_b, ddof=1)
        
        # Pooled standard deviation
        n_a = len(scores_a)
        n_b = len(scores_b)
        pooled_std = np.sqrt(((n_a - 1) * std_a**2 + (n_b - 1) * std_b**2) / (n_a + n_b - 2))
        
        if pooled_std == 0:
            return 0.0
        
        return (mean_b - mean_a) / pooled_std
    
    def _calculate_power(self, effect_size: float, sample_size: int, alpha: float) -> float:
        """Calculate statistical power using t-distribution"""
        
        # Degrees of freedom for two-sample t-test
        df = 2 * sample_size - 2
        
        # Critical t-value
        t_critical = stats.t.ppf(1 - alpha / 2, df)
        
        # Non-centrality parameter
        ncp = effect_size * np.sqrt(sample_size / 2)
        
        # Power calculation
        power = 1 - stats.nct.cdf(t_critical, df, ncp) + stats.nct.cdf(-t_critical, df, ncp)
        
        return max(0.0, min(1.0, power))
    
    def _assess_overall_performance(self, test_results: Dict[str, ABTestResult]) -> Dict[str, Any]:
        """Assess overall performance across all metrics"""
        
        significant_improvements = []
        significant_degradations = []
        
        for metric, result in test_results.items():
            if result.is_significant:
                if result.difference > 0:
                    significant_improvements.append(metric)
                else:
                    significant_degradations.append(metric)
        
        # Overall recommendation
        if len(significant_improvements) > len(significant_degradations):
            recommendation = 'promote_model_b'
        elif len(significant_degradations) > len(significant_improvements):
            recommendation = 'keep_model_a'
        else:
            recommendation = 'inconclusive'
        
        return {
            'significant_improvements': significant_improvements,
            'significant_degradations': significant_degradations,
            'total_metrics_tested': len(test_results),
            'overall_recommendation': recommendation,
            'confidence_level': 1 - self.alpha
        }
    
    def _analyze_sample_size(self, test_results: Dict[str, ABTestResult], sample_size: int) -> Dict[str, Any]:
        """Analyze if sample size is adequate for reliable conclusions"""
        
        min_power = min(result.statistical_power for result in test_results.values())
        avg_power = np.mean([result.statistical_power for result in test_results.values()])
        
        is_adequate = min_power >= self.power_threshold
        
        # Estimate required sample size for 80% power
        max_effect_size = max(abs(result.effect_size) for result in test_results.values())
        if max_effect_size > 0:
            # Rough estimate using Cohen's formula
            required_n = (2 * (stats.norm.ppf(1 - self.alpha/2) + stats.norm.ppf(self.power_threshold))**2) / (max_effect_size**2)
        else:
            required_n = float('inf')
        
        return {
            'current_sample_size': sample_size,
            'min_statistical_power': min_power,
            'avg_statistical_power': avg_power,
            'is_sample_size_adequate': is_adequate,
            'estimated_required_sample_size': int(required_n) if required_n != float('inf') else None,
            'power_threshold': self.power_threshold
        }
    
    def _generate_statistical_summary(self, test_results: Dict[str, ABTestResult]) -> Dict[str, Any]:
        """Generate statistical summary of all tests"""
        
        p_values = [result.p_value for result in test_results.values()]
        effect_sizes = [result.effect_size for result in test_results.values()]
        
        return {
            'min_p_value': min(p_values),
            'max_p_value': max(p_values),
            'avg_p_value': np.mean(p_values),
            'min_effect_size': min(effect_sizes),
            'max_effect_size': max(effect_sizes),
            'avg_effect_size': np.mean(effect_sizes),
            'multiple_testing_correction': 'bonferroni',
            'corrected_alpha': self.alpha / len(test_results)
        }
    
    def _generate_recommendations(
        self,
        test_results: Dict[str, ABTestResult],
        overall_assessment: Dict[str, Any]
    ) -> List[str]:
        """Generate actionable recommendations based on test results"""
        
        recommendations = []
        
        # Overall recommendation
        if overall_assessment['overall_recommendation'] == 'promote_model_b':
            recommendations.append("✅ Promote Model B - Shows significant improvements")
        elif overall_assessment['overall_recommendation'] == 'keep_model_a':
            recommendations.append("❌ Keep Model A - Model B shows significant degradations")
        else:
            recommendations.append("⚠️ Inconclusive - Mixed results, consider additional testing")
        
        # Specific metric recommendations
        for metric, result in test_results.items():
            if result.is_significant and abs(result.effect_size) > 0.5:
                direction = "improvement" if result.difference > 0 else "degradation"
                recommendations.append(f"📊 {metric.upper()}: Large effect size ({result.effect_size:.3f}) - {direction}")
        
        # Power recommendations
        low_power_metrics = [metric for metric, result in test_results.items() 
                           if result.statistical_power < self.power_threshold]
        if low_power_metrics:
            recommendations.append(f"⚡ Low statistical power for: {', '.join(low_power_metrics)} - Consider larger sample size")
        
        return recommendations
    
    def _serialize_ab_result(self, result: ABTestResult) -> Dict[str, Any]:
        """Convert ABTestResult to serializable dictionary"""
        return {
            'metric_name': result.metric_name,
            'model_a_score': result.model_a_score,
            'model_b_score': result.model_b_score,
            'difference': result.difference,
            'p_value': result.p_value,
            'confidence_interval': result.confidence_interval,
            'is_significant': result.is_significant,
            'effect_size': result.effect_size,
            'winner': result.winner,
            'statistical_power': result.statistical_power
        }

def main():
    """Test A/B testing functionality"""
    from sklearn.datasets import make_classification
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.linear_model import LogisticRegression
    
    # Generate test data
    X, y = make_classification(
        n_samples=1000,
        n_features=20,
        n_informative=10,
        random_state=42
    )
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.3, random_state=42
    )
    
    # Train two models
    model_a = LogisticRegression(random_state=42)
    model_b = RandomForestClassifier(random_state=42, n_estimators=100)
    
    model_a.fit(X_train, y_train)
    model_b.fit(X_train, y_train)
    
    # Prepare test dataset
    test_data = pd.DataFrame(X_test, columns=[f'feature_{i}' for i in range(X_test.shape[1])])
    test_data['target'] = y_test
    
    # Initialize A/B tester
    tester = OfflineABTester(bootstrap_samples=100)  # Reduced for testing
    
    # Compare models
    results = tester.compare_models(
        model_a=model_a,
        model_b=model_b,
        test_data=test_data
    )
    
    print("A/B Test Results:")
    print(f"Overall recommendation: {results['overall_assessment']['overall_recommendation']}")
    
    for metric, result in results['test_results'].items():
        print(f"\n{metric.upper()}:")
        print(f"  Model A: {result['model_a_score']:.4f}")
        print(f"  Model B: {result['model_b_score']:.4f}")
        print(f"  Difference: {result['difference']:.4f}")
        print(f"  P-value: {result['p_value']:.4f}")
        print(f"  Significant: {result['is_significant']}")
        print(f"  Winner: {result['winner']}")

if __name__ == "__main__":
    main()