"""
Evaluation Framework for Unit Talk ML
Phase 7A - Offline ML Prep

Comprehensive evaluation with AUC, PR-AUC, calibration, lift metrics,
and business-specific KPIs.
"""

import os
import json
import yaml
import joblib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import (
    roc_auc_score, precision_recall_curve, auc, accuracy_score,
    precision_score, recall_score, f1_score, log_loss, brier_score_loss,
    confusion_matrix, classification_report, roc_curve
)
from sklearn.calibration import calibration_curve, CalibratedClassifierCV
import scipy.stats as stats
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CalibrationAnalyzer:
    """Analyzes model calibration"""
    
    def __init__(self):
        self.n_bins = 10
        
    def reliability_diagram(
        self, 
        y_true: np.ndarray, 
        y_prob: np.ndarray,
        title: str = "Reliability Diagram"
    ) -> Dict[str, Any]:
        """Generate reliability diagram and calibration metrics"""
        
        # Calculate calibration curve
        fraction_of_positives, mean_predicted_value = calibration_curve(
            y_true, y_prob, n_bins=self.n_bins, strategy='uniform'
        )
        
        # Calculate Expected Calibration Error (ECE)
        bin_boundaries = np.linspace(0, 1, self.n_bins + 1)
        bin_lowers = bin_boundaries[:-1]
        bin_uppers = bin_boundaries[1:]
        
        ece = 0
        for bin_lower, bin_upper in zip(bin_lowers, bin_uppers):
            in_bin = (y_prob > bin_lower) & (y_prob <= bin_upper)
            prop_in_bin = in_bin.mean()
            
            if prop_in_bin > 0:
                accuracy_in_bin = y_true[in_bin].mean()
                avg_confidence_in_bin = y_prob[in_bin].mean()
                ece += np.abs(avg_confidence_in_bin - accuracy_in_bin) * prop_in_bin
                
        # Create plot
        plt.figure(figsize=(8, 6))
        plt.plot([0, 1], [0, 1], 'k--', label='Perfect calibration')
        plt.plot(mean_predicted_value, fraction_of_positives, 'o-', 
                label=f'Model (ECE: {ece:.3f})')
        plt.xlabel('Mean Predicted Probability')
        plt.ylabel('Fraction of Positives')
        plt.title(title)
        plt.legend()
        plt.grid(True, alpha=0.3)
        
        return {
            'ece': float(ece),
            'fraction_of_positives': fraction_of_positives.tolist(),
            'mean_predicted_value': mean_predicted_value.tolist(),
            'brier_score': brier_score_loss(y_true, y_prob)
        }
    
    def calibration_belt(
        self, 
        y_true: np.ndarray, 
        y_prob: np.ndarray,
        confidence_level: float = 0.95
    ) -> Dict[str, Any]:
        """Calculate calibration belt for confidence intervals"""
        
        # Sort by predicted probability
        sorted_indices = np.argsort(y_prob)
        y_true_sorted = y_true[sorted_indices]
        y_prob_sorted = y_prob[sorted_indices]
        
        # Calculate cumulative accuracy
        cumulative_accuracy = np.cumsum(y_true_sorted) / np.arange(1, len(y_true_sorted) + 1)
        
        # Calculate confidence bands using Clopper-Pearson interval
        n = len(y_true_sorted)
        alpha = 1 - confidence_level
        
        lower_bounds = []
        upper_bounds = []
        
        for i in range(1, n + 1):
            successes = np.sum(y_true_sorted[:i])
            
            if successes == 0:
                lower = 0
            else:
                lower = stats.beta.ppf(alpha/2, successes, i - successes + 1)
                
            if successes == i:
                upper = 1
            else:
                upper = stats.beta.ppf(1 - alpha/2, successes + 1, i - successes)
                
            lower_bounds.append(lower)
            upper_bounds.append(upper)
            
        return {
            'cumulative_accuracy': cumulative_accuracy.tolist(),
            'lower_bounds': lower_bounds,
            'upper_bounds': upper_bounds,
            'predicted_probabilities': y_prob_sorted.tolist()
        }


class LiftAnalyzer:
    """Analyzes lift and gains for different probability thresholds"""
    
    def __init__(self):
        pass
        
    def calculate_lift_curve(
        self, 
        y_true: np.ndarray, 
        y_prob: np.ndarray,
        n_buckets: int = 10
    ) -> Dict[str, Any]:
        """Calculate lift curve by probability deciles"""
        
        # Sort by probability (descending)
        sorted_indices = np.argsort(-y_prob)
        y_true_sorted = y_true[sorted_indices]
        y_prob_sorted = y_prob[sorted_indices]
        
        # Create buckets
        bucket_size = len(y_true) // n_buckets
        
        lift_data = []
        cumulative_gains = []
        
        baseline_rate = y_true.mean()
        total_positives = y_true.sum()
        
        for i in range(n_buckets):
            start_idx = i * bucket_size
            end_idx = min((i + 1) * bucket_size, len(y_true))
            
            bucket_y_true = y_true_sorted[start_idx:end_idx]
            bucket_y_prob = y_prob_sorted[start_idx:end_idx]
            
            bucket_positive_rate = bucket_y_true.mean()
            lift = bucket_positive_rate / baseline_rate if baseline_rate > 0 else 0
            
            # Cumulative gains
            cumulative_positives = y_true_sorted[:end_idx].sum()
            cumulative_gain = cumulative_positives / total_positives if total_positives > 0 else 0
            
            lift_data.append({
                'bucket': i + 1,
                'bucket_size': end_idx - start_idx,
                'positive_rate': float(bucket_positive_rate),
                'lift': float(lift),
                'avg_probability': float(bucket_y_prob.mean()),
                'min_probability': float(bucket_y_prob.min()),
                'max_probability': float(bucket_y_prob.max())
            })
            
            cumulative_gains.append(float(cumulative_gain))
            
        return {
            'lift_data': lift_data,
            'cumulative_gains': cumulative_gains,
            'baseline_rate': float(baseline_rate)
        }
    
    def calculate_top_k_metrics(
        self, 
        y_true: np.ndarray, 
        y_prob: np.ndarray,
        k_values: List[int] = [10, 20, 50, 100]
    ) -> Dict[int, Dict[str, float]]:
        """Calculate precision/recall at top-K predictions"""
        
        # Sort by probability (descending)
        sorted_indices = np.argsort(-y_prob)
        y_true_sorted = y_true[sorted_indices]
        
        results = {}
        total_positives = y_true.sum()
        
        for k in k_values:
            if k <= len(y_true):
                top_k_true = y_true_sorted[:k]
                precision_at_k = top_k_true.sum() / k
                recall_at_k = top_k_true.sum() / total_positives if total_positives > 0 else 0
                
                results[k] = {
                    'precision_at_k': float(precision_at_k),
                    'recall_at_k': float(recall_at_k),
                    'hits_at_k': int(top_k_true.sum())
                }
                
        return results


class BusinessMetricsAnalyzer:
    """Analyzes business-specific metrics for betting"""
    
    def __init__(self):
        self.kelly_multiplier = 0.25  # Conservative Kelly fraction
        
    def calculate_roi_metrics(
        self,
        y_true: np.ndarray,
        y_prob: np.ndarray,
        odds: Optional[np.ndarray] = None,
        bet_amounts: Optional[np.ndarray] = None
    ) -> Dict[str, float]:
        """Calculate ROI and related betting metrics"""
        
        if odds is None:
            # Simulate fair odds from probabilities
            odds = 1 / y_prob
            
        if bet_amounts is None:
            # Use Kelly criterion for bet sizing
            edge = y_prob - (1 / odds)
            kelly_fractions = np.maximum(0, edge * self.kelly_multiplier)
            bet_amounts = kelly_fractions * 100  # Assume $100 base unit
            
        # Calculate profits/losses
        profits = np.where(y_true == 1, bet_amounts * (odds - 1), -bet_amounts)
        
        total_wagered = bet_amounts.sum()
        total_profit = profits.sum()
        
        roi = (total_profit / total_wagered * 100) if total_wagered > 0 else 0
        
        # Win rate
        win_rate = y_true.mean() * 100
        
        # Sharpe ratio (risk-adjusted return)
        if len(profits) > 1:
            sharpe_ratio = profits.mean() / profits.std() if profits.std() > 0 else 0
        else:
            sharpe_ratio = 0
            
        # Maximum drawdown
        cumulative_profits = np.cumsum(profits)
        peak = np.maximum.accumulate(cumulative_profits)
        drawdown = (peak - cumulative_profits) / np.maximum(peak, 1)
        max_drawdown = drawdown.max() * 100
        
        # Profit factor
        winning_trades = profits[profits > 0]
        losing_trades = profits[profits < 0]
        
        if len(losing_trades) > 0 and losing_trades.sum() < 0:
            profit_factor = winning_trades.sum() / abs(losing_trades.sum())
        else:
            profit_factor = float('inf') if len(winning_trades) > 0 else 0
            
        return {
            'roi_percent': float(roi),
            'total_profit': float(total_profit),
            'total_wagered': float(total_wagered),
            'win_rate_percent': float(win_rate),
            'sharpe_ratio': float(sharpe_ratio),
            'max_drawdown_percent': float(max_drawdown),
            'profit_factor': float(profit_factor),
            'num_bets': len(y_true),
            'avg_bet_size': float(bet_amounts.mean())
        }
    
    def tier_performance_analysis(
        self,
        y_true: np.ndarray,
        y_prob: np.ndarray,
        tier_thresholds: Dict[str, float]
    ) -> Dict[str, Dict[str, Any]]:
        """Analyze performance by tier assignment"""
        
        results = {}
        
        # Assign tiers based on probability thresholds
        tiers = np.full(len(y_prob), 'D', dtype='<U1')
        
        for tier, threshold in sorted(tier_thresholds.items(), key=lambda x: x[1], reverse=True):
            if tier != 'D':  # D is default
                tiers[y_prob >= threshold] = tier
                
        # Analyze each tier
        for tier in ['S', 'A', 'B', 'C', 'D']:
            mask = tiers == tier
            
            if mask.sum() > 0:
                tier_y_true = y_true[mask]
                tier_y_prob = y_prob[mask]
                
                results[tier] = {
                    'count': int(mask.sum()),
                    'percentage': float(mask.mean() * 100),
                    'win_rate': float(tier_y_true.mean() * 100),
                    'avg_confidence': float(tier_y_prob.mean()),
                    'precision': float(tier_y_true.mean()),
                    'calibration_error': float(abs(tier_y_prob.mean() - tier_y_true.mean()))
                }
                
                # Business metrics if sufficient samples
                if len(tier_y_true) >= 10:
                    business_metrics = self.calculate_roi_metrics(tier_y_true, tier_y_prob)
                    results[tier].update(business_metrics)
                    
        return results


class ModelEvaluator:
    """Main model evaluation class"""
    
    def __init__(self, config_path: str = "ml/configs/pipeline_config.yml"):
        with open(config_path, 'r') as f:
            self.config = yaml.safe_load(f)
            
        self.calibration_analyzer = CalibrationAnalyzer()
        self.lift_analyzer = LiftAnalyzer()
        self.business_analyzer = BusinessMetricsAnalyzer()
        
    def load_model_and_data(
        self,
        model_path: str,
        dataset_id: str,
        split: str = 'test'
    ) -> Tuple[Any, pd.DataFrame, Any]:
        """Load model, data, and feature processor"""
        
        # Load model
        model_dir = Path(model_path)
        
        if (model_dir / 'model.keras').exists():
            import tensorflow as tf
            model = tf.keras.models.load_model(model_dir / 'model.keras')
        elif (model_dir / 'model.joblib').exists():
            model = joblib.load(model_dir / 'model.joblib')
        else:
            raise FileNotFoundError(f"No model found in {model_dir}")
            
        # Load feature processor
        feature_processor = joblib.load(model_dir / 'feature_processor.joblib')
        
        # Load test data
        dataset_path = Path(self.config['infrastructure']['storage']['datasets']) / dataset_id
        data = pd.read_parquet(dataset_path / f"{split}.parquet")
        
        return model, data, feature_processor
    
    def comprehensive_evaluation(
        self,
        model: Any,
        X: np.ndarray,
        y: np.ndarray,
        model_type: str,
        tier_thresholds: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """Perform comprehensive model evaluation"""
        
        logger.info(f"Running comprehensive evaluation for {model_type}")
        
        # Get predictions
        if hasattr(model, 'predict_proba'):
            y_prob = model.predict_proba(X)[:, 1]
        else:
            y_prob = model.predict(X)
            
        y_pred = (y_prob > 0.5).astype(int)
        
        # Standard classification metrics
        metrics = {
            'auc': float(roc_auc_score(y, y_prob)),
            'accuracy': float(accuracy_score(y, y_pred)),
            'precision': float(precision_score(y, y_pred)),
            'recall': float(recall_score(y, y_pred)),
            'f1_score': float(f1_score(y, y_pred)),
            'log_loss': float(log_loss(y, y_prob)),
            'brier_score': float(brier_score_loss(y, y_prob))
        }
        
        # PR-AUC
        precision_curve, recall_curve, _ = precision_recall_curve(y, y_prob)
        metrics['pr_auc'] = float(auc(recall_curve, precision_curve))
        
        # Calibration analysis
        calibration_results = self.calibration_analyzer.reliability_diagram(
            y, y_prob, f"{model_type} Calibration"
        )
        
        # Lift analysis
        lift_results = self.lift_analyzer.calculate_lift_curve(y, y_prob)
        top_k_results = self.lift_analyzer.calculate_top_k_metrics(y, y_prob)
        
        # Business metrics
        business_results = self.business_analyzer.calculate_roi_metrics(y, y_prob)
        
        # Tier analysis
        if tier_thresholds is None:
            tier_thresholds = self.config['evaluation']['tier_thresholds']
            
        tier_results = self.business_analyzer.tier_performance_analysis(
            y, y_prob, tier_thresholds
        )
        
        # Confusion matrix
        cm = confusion_matrix(y, y_pred)
        
        # Feature importance (if available)
        feature_importance = {}
        if hasattr(model, 'feature_importances_'):
            feature_importance = dict(enumerate(model.feature_importances_))
        elif hasattr(model, 'feature_importance'):
            feature_importance = dict(enumerate(model.feature_importance()))
            
        results = {
            'model_type': model_type,
            'evaluation_timestamp': datetime.now().isoformat(),
            'sample_size': len(y),
            'metrics': metrics,
            'calibration': calibration_results,
            'lift_analysis': lift_results,
            'top_k_metrics': top_k_results,
            'business_metrics': business_results,
            'tier_analysis': tier_results,
            'confusion_matrix': cm.tolist(),
            'feature_importance': feature_importance
        }
        
        return results
    
    def generate_evaluation_report(
        self,
        results: Dict[str, Any],
        output_path: str
    ):
        """Generate comprehensive evaluation report"""
        
        # Create output directory
        output_dir = Path(output_path)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Save full results as JSON
        with open(output_dir / "evaluation_results.json", 'w') as f:
            json.dump(results, f, indent=2)
            
        # Generate markdown report
        report_path = output_dir / "evaluation_report.md"
        
        with open(report_path, 'w') as f:
            f.write(f"# Model Evaluation Report: {results['model_type']}\n\n")
            f.write(f"**Generated**: {results['evaluation_timestamp']}\n")
            f.write(f"**Sample Size**: {results['sample_size']:,}\n\n")
            
            # Core metrics
            f.write("## Core Performance Metrics\n\n")
            metrics = results['metrics']
            f.write(f"- **AUC**: {metrics['auc']:.4f}\n")
            f.write(f"- **PR-AUC**: {metrics['pr_auc']:.4f}\n")
            f.write(f"- **Accuracy**: {metrics['accuracy']:.4f}\n")
            f.write(f"- **Precision**: {metrics['precision']:.4f}\n")
            f.write(f"- **Recall**: {metrics['recall']:.4f}\n")
            f.write(f"- **F1 Score**: {metrics['f1_score']:.4f}\n")
            f.write(f"- **Log Loss**: {metrics['log_loss']:.4f}\n")
            f.write(f"- **Brier Score**: {metrics['brier_score']:.4f}\n\n")
            
            # Calibration
            f.write("## Calibration Analysis\n\n")
            cal = results['calibration']
            f.write(f"- **Expected Calibration Error (ECE)**: {cal['ece']:.4f}\n")
            f.write(f"- **Brier Score**: {cal['brier_score']:.4f}\n\n")
            
            # Business metrics
            f.write("## Business Performance\n\n")
            biz = results['business_metrics']
            f.write(f"- **ROI**: {biz['roi_percent']:.2f}%\n")
            f.write(f"- **Win Rate**: {biz['win_rate_percent']:.2f}%\n")
            f.write(f"- **Sharpe Ratio**: {biz['sharpe_ratio']:.3f}\n")
            f.write(f"- **Max Drawdown**: {biz['max_drawdown_percent']:.2f}%\n")
            f.write(f"- **Profit Factor**: {biz['profit_factor']:.2f}\n\n")
            
            # Tier analysis
            f.write("## Tier Performance\n\n")
            f.write("| Tier | Count | % | Win Rate | Avg Confidence | ROI |\n")
            f.write("|------|-------|---|----------|----------------|-----|\n")
            
            for tier in ['S', 'A', 'B', 'C', 'D']:
                if tier in results['tier_analysis']:
                    t = results['tier_analysis'][tier]
                    roi = t.get('roi_percent', 0)
                    f.write(f"| {tier} | {t['count']} | {t['percentage']:.1f}% | "
                           f"{t['win_rate']:.1f}% | {t['avg_confidence']:.3f} | {roi:.1f}% |\n")
                    
            # Top-K metrics
            f.write("\n## Top-K Performance\n\n")
            f.write("| K | Precision@K | Recall@K | Hits |\n")
            f.write("|---|-------------|----------|------|\n")
            
            for k, metrics in results['top_k_metrics'].items():
                f.write(f"| {k} | {metrics['precision_at_k']:.3f} | "
                       f"{metrics['recall_at_k']:.3f} | {metrics['hits_at_k']} |\n")
                       
            f.write("\n## Lift Analysis\n\n")
            f.write("Performance by probability deciles:\n\n")
            f.write("| Decile | Lift | Positive Rate | Avg Probability |\n")
            f.write("|--------|------|---------------|----------------|\n")
            
            for bucket_data in results['lift_analysis']['lift_data']:
                f.write(f"| {bucket_data['bucket']} | {bucket_data['lift']:.2f} | "
                       f"{bucket_data['positive_rate']:.3f} | {bucket_data['avg_probability']:.3f} |\n")
                       
        logger.info(f"Evaluation report saved to {report_path}")
    
    def compare_models(
        self,
        model_results: Dict[str, Dict[str, Any]],
        output_path: str
    ):
        """Compare multiple models and generate comparison report"""
        
        output_dir = Path(output_path)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Create comparison table
        comparison_data = []
        
        for model_name, results in model_results.items():
            metrics = results['metrics']
            business = results['business_metrics']
            
            comparison_data.append({
                'Model': model_name,
                'AUC': metrics['auc'],
                'PR-AUC': metrics['pr_auc'],
                'F1': metrics['f1_score'],
                'Log Loss': metrics['log_loss'],
                'ROI %': business['roi_percent'],
                'Win Rate %': business['win_rate_percent'],
                'Sharpe': business['sharpe_ratio']
            })
            
        # Save comparison
        comparison_df = pd.DataFrame(comparison_data)
        comparison_df.to_csv(output_dir / "model_comparison.csv", index=False)
        
        # Generate comparison report
        with open(output_dir / "model_comparison.md", 'w') as f:
            f.write("# Model Comparison Report\n\n")
            f.write(comparison_df.to_markdown(index=False, floatfmt=".4f"))
            f.write("\n\n")
            
            # Recommend best model
            best_auc = comparison_df.loc[comparison_df['AUC'].idxmax(), 'Model']
            best_roi = comparison_df.loc[comparison_df['ROI %'].idxmax(), 'Model']
            
            f.write(f"**Best AUC**: {best_auc}\n")
            f.write(f"**Best ROI**: {best_roi}\n")


def main():
    """Example usage"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Evaluate ML models")
    parser.add_argument("--model-path", required=True, help="Path to trained model")
    parser.add_argument("--dataset-id", required=True, help="Dataset ID")
    parser.add_argument("--output-path", default="ml/reports", help="Output path for reports")
    args = parser.parse_args()
    
    evaluator = ModelEvaluator()
    
    # Load model and data
    model, data, feature_processor = evaluator.load_model_and_data(
        args.model_path, args.dataset_id
    )
    
    # Prepare features
    X = data.drop(columns=['status', 'placed_at', 'settled_at'], errors='ignore')
    y = data['status']
    
    X_processed = feature_processor.transform(X)
    y_processed = (y == 'won').astype(int) if y.dtype == 'object' else y.values
    
    # Evaluate
    results = evaluator.comprehensive_evaluation(
        model, X_processed, y_processed, 
        model_type=Path(args.model_path).parent.name
    )
    
    # Generate report
    evaluator.generate_evaluation_report(results, args.output_path)
    
    print(f"Evaluation complete! Report saved to {args.output_path}")


if __name__ == "__main__":
    main()