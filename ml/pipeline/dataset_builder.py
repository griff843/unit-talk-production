"""
Dataset Builder for Unit Talk ML Pipeline
Phase 7A - Offline ML Prep

Builds training datasets from historical graded/settled props with comprehensive
feature engineering and data quality checks.
"""

import os
import json
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
import pandas as pd
import numpy as np
from pathlib import Path
import logging
from dataclasses import dataclass, asdict
import asyncio
from supabase import create_client, Client

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class DatasetConfig:
    """Configuration for dataset generation"""
    name: str
    start_date: datetime
    end_date: datetime
    target_column: str
    feature_groups: List[str]
    sports_filter: Optional[List[str]] = None
    min_samples_per_user: int = 10
    train_ratio: float = 0.7
    val_ratio: float = 0.15
    test_ratio: float = 0.15
    random_seed: int = 42
    

@dataclass
class DataCard:
    """Data card with dataset metadata"""
    dataset_id: str
    name: str
    version: str
    created_at: datetime
    config: DatasetConfig
    statistics: Dict[str, Any]
    feature_importance: Optional[Dict[str, float]] = None
    quality_metrics: Optional[Dict[str, Any]] = None
    

class DataQualityChecker:
    """Performs comprehensive data quality checks"""
    
    def __init__(self, config_path: str = "ml/configs/feature_definitions.json"):
        with open(config_path, 'r') as f:
            self.feature_config = json.load(f)
            
    def check_leakage(self, df: pd.DataFrame, target_col: str) -> Dict[str, Any]:
        """Check for temporal and feature leakage"""
        leakage_report = {
            "temporal_leakage": False,
            "feature_leakage": [],
            "suspicious_correlations": []
        }
        
        # Check temporal ordering
        if 'placed_at' in df.columns and 'settled_at' in df.columns:
            invalid_temporal = df[df['placed_at'] >= df['settled_at']]
            if len(invalid_temporal) > 0:
                leakage_report["temporal_leakage"] = True
                leakage_report["temporal_violations"] = len(invalid_temporal)
                
        # Check for suspiciously high correlations with target
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            if col != target_col and col in df.columns:
                corr = df[col].corr(df[target_col])
                if abs(corr) > 0.95:  # Suspicious threshold
                    leakage_report["suspicious_correlations"].append({
                        "feature": col,
                        "correlation": corr
                    })
                    
        # Check for features that shouldn't exist at prediction time
        future_features = ['actual_value', 'profit_loss', 'settlement_result', 
                          'actual_outcome', 'actual_payout']
        for feat in future_features:
            if feat in df.columns and feat != target_col:
                leakage_report["feature_leakage"].append(feat)
                
        return leakage_report
    
    def check_bias(self, df: pd.DataFrame, sensitive_features: List[str]) -> Dict[str, Any]:
        """Check for bias in the dataset"""
        bias_report = {
            "class_imbalance": {},
            "sport_distribution": {},
            "user_distribution": {},
            "temporal_distribution": {}
        }
        
        # Check target class balance
        if 'status' in df.columns:
            status_dist = df['status'].value_counts(normalize=True).to_dict()
            bias_report["class_imbalance"] = status_dist
            
        # Check sport distribution
        if 'sport' in df.columns:
            sport_dist = df['sport'].value_counts(normalize=True).to_dict()
            bias_report["sport_distribution"] = sport_dist
            
        # Check user distribution (no single user dominating)
        if 'user_id' in df.columns:
            user_counts = df['user_id'].value_counts()
            bias_report["user_distribution"] = {
                "total_users": len(user_counts),
                "max_picks_per_user": int(user_counts.max()),
                "min_picks_per_user": int(user_counts.min()),
                "concentration_top_10pct": float(user_counts.nlargest(int(len(user_counts) * 0.1)).sum() / len(df))
            }
            
        # Check temporal distribution
        if 'placed_at' in df.columns:
            df['month'] = pd.to_datetime(df['placed_at']).dt.to_period('M')
            monthly_dist = df['month'].value_counts(normalize=True).head(12)
            bias_report["temporal_distribution"] = {
                str(k): float(v) for k, v in monthly_dist.to_dict().items()
            }
            
        return bias_report
    
    def deduplicate(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, int]]:
        """Remove duplicates with detailed reporting"""
        initial_count = len(df)
        
        # Define duplicate criteria
        dup_columns = ['prop_id', 'user_id', 'placed_at']
        dup_columns = [col for col in dup_columns if col in df.columns]
        
        if dup_columns:
            df_dedup = df.drop_duplicates(subset=dup_columns, keep='first')
        else:
            df_dedup = df.drop_duplicates()
            
        removed_count = initial_count - len(df_dedup)
        
        dedup_report = {
            "initial_count": initial_count,
            "final_count": len(df_dedup),
            "removed_count": removed_count,
            "removed_percentage": (removed_count / initial_count * 100) if initial_count > 0 else 0
        }
        
        return df_dedup, dedup_report
    

class FeatureEngineer:
    """Handles feature engineering and transformation"""
    
    def __init__(self, feature_config: Dict[str, Any]):
        self.feature_config = feature_config
        
    def extract_json_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Extract features from JSON columns"""
        json_columns = ['professional_insights', 'feature_contributions', 
                       'market_factors', 'player_factors', 'matchup_factors']
        
        for col in json_columns:
            if col in df.columns:
                # Extract specific fields from JSON
                if col == 'professional_insights':
                    df['steam_detected'] = df[col].apply(
                        lambda x: x.get('steam_moves', {}).get('detected', False) 
                        if isinstance(x, dict) else False
                    )
                    df['clv_prediction'] = df[col].apply(
                        lambda x: x.get('clv_prediction', {}).get('predicted_movement', 0) 
                        if isinstance(x, dict) else 0
                    )
                elif col == 'market_factors':
                    df['line_value_score'] = df[col].apply(
                        lambda x: x.get('lineValueScore', 0) 
                        if isinstance(x, dict) else 0
                    )
                    
        return df
    
    def create_interaction_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create interaction features as defined in config"""
        interactions = self.feature_config.get('feature_engineering', {}).get('interaction_features', [])
        
        for interaction in interactions:
            try:
                # Simple multiplication for now
                if 'line_movement' in df.columns and 'market_volume' in df.columns:
                    df['line_movement_x_volume'] = df['line_movement'] * df['market_volume']
            except Exception as e:
                logger.warning(f"Failed to create interaction feature {interaction['name']}: {e}")
                
        return df
    
    def create_temporal_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create time-based features"""
        if 'placed_at' in df.columns:
            df['placed_at'] = pd.to_datetime(df['placed_at'])
            df['hour_of_day'] = df['placed_at'].dt.hour
            df['day_of_week'] = df['placed_at'].dt.dayofweek
            df['month'] = df['placed_at'].dt.month
            df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
            
        if 'game_date' in df.columns and 'placed_at' in df.columns:
            df['hours_before_game'] = (
                pd.to_datetime(df['game_date']) - df['placed_at']
            ).dt.total_seconds() / 3600
            
        return df
    
    def encode_categorical_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Encode categorical features"""
        categorical_columns = ['sport', 'stat_type', 'tier', 'team']
        
        for col in categorical_columns:
            if col in df.columns:
                # Use one-hot encoding for small cardinality
                if df[col].nunique() < 20:
                    dummies = pd.get_dummies(df[col], prefix=col, drop_first=True)
                    df = pd.concat([df, dummies], axis=1)
                    df = df.drop(columns=[col])
                else:
                    # Use label encoding for high cardinality
                    df[f'{col}_encoded'] = pd.Categorical(df[col]).codes
                    
        return df
    

class DatasetBuilder:
    """Main dataset builder class"""
    
    def __init__(self, supabase_url: str, supabase_key: str):
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.quality_checker = DataQualityChecker()
        self.feature_engineer = FeatureEngineer(self.quality_checker.feature_config)
        
    async def fetch_training_data(self, config: DatasetConfig) -> pd.DataFrame:
        """Fetch raw training data from Supabase"""
        logger.info(f"Fetching data from {config.start_date} to {config.end_date}")
        
        # Build query to fetch settled picks with all features
        query = self.supabase.table('unified_picks').select(
            """
            *,
            raw_props!unified_picks_prop_id_fkey (
                player_name, sport, team, stat_type, line,
                over_odds, under_odds, opening_line,
                opening_over_odds, opening_under_odds,
                trend_confidence, matchup_quality, line_value_score
            ),
            prop_settlements!prop_settlements_unified_pick_id_fkey (
                actual_value, settlement_result, settlement_confidence
            ),
            scored_props!scored_props_prop_ref_fkey (
                edge, prob_win, professional_score,
                market_factors, player_factors, matchup_factors
            ),
            users!unified_picks_user_id_fkey (
                username, win_rate, roi, tier
            )
            """
        ).gte('placed_at', config.start_date.isoformat()) \
         .lte('placed_at', config.end_date.isoformat()) \
         .in_('status', ['won', 'lost'])  # Only settled picks
        
        # Apply sport filter if specified
        if config.sports_filter:
            query = query.in_('raw_props.sport', config.sports_filter)
            
        # Execute query
        response = query.execute()
        
        if not response.data:
            raise ValueError("No data found for the specified criteria")
            
        # Convert to DataFrame and flatten nested data
        df = pd.json_normalize(response.data, sep='_')
        logger.info(f"Fetched {len(df)} records")
        
        return df
    
    def prepare_features(self, df: pd.DataFrame, config: DatasetConfig) -> pd.DataFrame:
        """Prepare and engineer features"""
        logger.info("Preparing features...")
        
        # Extract JSON features
        df = self.feature_engineer.extract_json_features(df)
        
        # Create temporal features
        df = self.feature_engineer.create_temporal_features(df)
        
        # Create interaction features
        df = self.feature_engineer.create_interaction_features(df)
        
        # Calculate derived features
        if 'line' in df.columns and 'opening_line' in df.columns:
            df['line_movement'] = df['line'] - df['opening_line']
            
        # Encode categorical features
        df = self.feature_engineer.encode_categorical_features(df)
        
        # Remove features with high missing rate
        missing_threshold = self.quality_checker.feature_config['data_quality_rules']['missing_value_threshold']
        missing_rates = df.isnull().sum() / len(df)
        cols_to_drop = missing_rates[missing_rates > missing_threshold].index
        if len(cols_to_drop) > 0:
            logger.warning(f"Dropping {len(cols_to_drop)} columns with high missing rates: {cols_to_drop.tolist()}")
            df = df.drop(columns=cols_to_drop)
            
        return df
    
    def create_train_val_test_split(
        self, 
        df: pd.DataFrame, 
        config: DatasetConfig
    ) -> Dict[str, pd.DataFrame]:
        """Create train/validation/test splits with time-based ordering"""
        logger.info("Creating train/val/test splits...")
        
        # Sort by time to prevent leakage
        df = df.sort_values('placed_at')
        
        # Calculate split indices
        n = len(df)
        train_idx = int(n * config.train_ratio)
        val_idx = int(n * (config.train_ratio + config.val_ratio))
        
        splits = {
            'train': df.iloc[:train_idx],
            'validation': df.iloc[train_idx:val_idx],
            'test': df.iloc[val_idx:]
        }
        
        # Log split information
        for split_name, split_df in splits.items():
            logger.info(f"{split_name}: {len(split_df)} samples "
                       f"({len(split_df)/len(df)*100:.1f}%) "
                       f"from {split_df['placed_at'].min()} to {split_df['placed_at'].max()}")
            
        return splits
    
    def generate_data_card(
        self, 
        df: pd.DataFrame, 
        config: DatasetConfig,
        quality_report: Dict[str, Any]
    ) -> DataCard:
        """Generate comprehensive data card"""
        dataset_id = hashlib.md5(
            f"{config.name}_{config.start_date}_{config.end_date}".encode()
        ).hexdigest()[:8]
        
        statistics = {
            "total_samples": len(df),
            "total_features": len(df.columns),
            "date_range": {
                "start": str(df['placed_at'].min()) if 'placed_at' in df.columns else None,
                "end": str(df['placed_at'].max()) if 'placed_at' in df.columns else None
            },
            "target_distribution": df[config.target_column].value_counts().to_dict() if config.target_column in df.columns else {},
            "sports_included": df['sport'].unique().tolist() if 'sport' in df.columns else [],
            "quality_report": quality_report
        }
        
        return DataCard(
            dataset_id=dataset_id,
            name=config.name,
            version="1.0.0",
            created_at=datetime.now(),
            config=config,
            statistics=statistics
        )
    
    async def build_dataset(self, config: DatasetConfig) -> Tuple[Dict[str, pd.DataFrame], DataCard]:
        """Main dataset building pipeline"""
        logger.info(f"Building dataset: {config.name}")
        
        # Fetch raw data
        df = await self.fetch_training_data(config)
        
        # Prepare features
        df = self.prepare_features(df, config)
        
        # Quality checks
        logger.info("Running quality checks...")
        
        # Deduplication
        df, dedup_report = self.quality_checker.deduplicate(df)
        
        # Leakage detection
        leakage_report = self.quality_checker.check_leakage(df, config.target_column)
        
        # Bias analysis
        bias_report = self.quality_checker.check_bias(df, ['sport', 'user_id'])
        
        # Remove leaky features
        if leakage_report['feature_leakage']:
            logger.warning(f"Removing leaky features: {leakage_report['feature_leakage']}")
            df = df.drop(columns=leakage_report['feature_leakage'], errors='ignore')
            
        # Create splits
        splits = self.create_train_val_test_split(df, config)
        
        # Generate data card
        quality_report = {
            "deduplication": dedup_report,
            "leakage_detection": leakage_report,
            "bias_analysis": bias_report
        }
        data_card = self.generate_data_card(df, config, quality_report)
        
        return splits, data_card
    
    def save_dataset(
        self, 
        splits: Dict[str, pd.DataFrame], 
        data_card: DataCard,
        output_dir: str = "ml/datasets"
    ):
        """Save dataset splits and metadata"""
        dataset_dir = Path(output_dir) / data_card.dataset_id
        dataset_dir.mkdir(parents=True, exist_ok=True)
        
        # Save splits as parquet files
        for split_name, split_df in splits.items():
            output_path = dataset_dir / f"{split_name}.parquet"
            split_df.to_parquet(output_path, index=False)
            logger.info(f"Saved {split_name} split to {output_path}")
            
        # Save data card
        data_card_path = dataset_dir / "data_card.json"
        with open(data_card_path, 'w') as f:
            json.dump(asdict(data_card), f, indent=2, default=str)
        logger.info(f"Saved data card to {data_card_path}")
        
        # Save schema
        schema_path = dataset_dir / "schema.json"
        schema = {
            split_name: {
                "columns": split_df.columns.tolist(),
                "dtypes": split_df.dtypes.astype(str).to_dict(),
                "shape": split_df.shape
            }
            for split_name, split_df in splits.items()
        }
        with open(schema_path, 'w') as f:
            json.dump(schema, f, indent=2)
            
        # Create README
        readme_path = dataset_dir / "README.md"
        with open(readme_path, 'w') as f:
            f.write(f"# Dataset: {data_card.name}\n\n")
            f.write(f"**ID**: {data_card.dataset_id}\n")
            f.write(f"**Created**: {data_card.created_at}\n")
            f.write(f"**Samples**: {data_card.statistics['total_samples']}\n")
            f.write(f"**Features**: {data_card.statistics['total_features']}\n\n")
            f.write("## Splits\n")
            for split_name, split_df in splits.items():
                f.write(f"- **{split_name}**: {len(split_df)} samples\n")
            f.write("\n## Target Distribution\n")
            f.write(f"```json\n{json.dumps(data_card.statistics['target_distribution'], indent=2)}\n```\n")
            
        logger.info(f"Dataset saved to {dataset_dir}")


async def main():
    """Example usage"""
    # Load environment variables
    supabase_url = os.getenv('SUPABASE_URL', '')
    supabase_key = os.getenv('SUPABASE_ANON_KEY', '')
    
    # Define dataset configuration
    config = DatasetConfig(
        name="unit_talk_ml_phase7a",
        start_date=datetime.now() - timedelta(days=365),  # 12 months of data
        end_date=datetime.now() - timedelta(days=1),  # Up to yesterday
        target_column="status",  # Binary classification: won/lost
        feature_groups=["market_features", "professional_features", "enhanced_scoring_features"],
        sports_filter=["NFL", "NBA", "MLB", "NHL"],
        min_samples_per_user=10,
        train_ratio=0.7,
        val_ratio=0.15,
        test_ratio=0.15,
        random_seed=42
    )
    
    # Build dataset
    builder = DatasetBuilder(supabase_url, supabase_key)
    splits, data_card = await builder.build_dataset(config)
    
    # Save dataset
    builder.save_dataset(splits, data_card)
    
    logger.info("Dataset building complete!")


if __name__ == "__main__":
    asyncio.run(main())