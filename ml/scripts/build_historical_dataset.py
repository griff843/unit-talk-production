#!/usr/bin/env python3
"""
Build Historical Dataset Script
Phase 7A - Offline ML Prep

Builds comprehensive training dataset from 12-18 months of historical data.
"""

import os
import sys
import asyncio
import argparse
from datetime import datetime, timedelta
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent.parent))

from ml.pipeline.dataset_builder import DatasetBuilder, DatasetConfig
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def build_datasets():
    """Build multiple dataset configurations for different experiments"""
    
    # Get environment variables
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_ANON_KEY')
    
    if not supabase_url or not supabase_key:
        logger.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables")
        sys.exit(1)
        
    # Initialize builder
    builder = DatasetBuilder(supabase_url, supabase_key)
    
    # Dataset configurations to build
    configs = [
        # 1. Full dataset with all sports (12 months)
        DatasetConfig(
            name="unit_talk_full_12m",
            start_date=datetime.now() - timedelta(days=365),
            end_date=datetime.now() - timedelta(days=1),
            target_column="status",
            feature_groups=["market_features", "professional_features", "enhanced_scoring_features"],
            sports_filter=None,  # All sports
            min_samples_per_user=10,
            train_ratio=0.7,
            val_ratio=0.15,
            test_ratio=0.15,
            random_seed=42
        ),
        
        # 2. NFL-only dataset (18 months for seasonal patterns)
        DatasetConfig(
            name="unit_talk_nfl_18m",
            start_date=datetime.now() - timedelta(days=548),  # ~18 months
            end_date=datetime.now() - timedelta(days=1),
            target_column="status",
            feature_groups=["market_features", "professional_features", "enhanced_scoring_features"],
            sports_filter=["NFL"],
            min_samples_per_user=5,
            train_ratio=0.7,
            val_ratio=0.15,
            test_ratio=0.15,
            random_seed=42
        ),
        
        # 3. Basketball dataset (NBA + NCAAF, 12 months)
        DatasetConfig(
            name="unit_talk_basketball_12m",
            start_date=datetime.now() - timedelta(days=365),
            end_date=datetime.now() - timedelta(days=1),
            target_column="status",
            feature_groups=["market_features", "professional_features", "enhanced_scoring_features"],
            sports_filter=["NBA", "NCAAF"],
            min_samples_per_user=10,
            train_ratio=0.7,
            val_ratio=0.15,
            test_ratio=0.15,
            random_seed=42
        ),
        
        # 4. Profit regression dataset (for Kelly sizing optimization)
        DatasetConfig(
            name="unit_talk_profit_regression_12m",
            start_date=datetime.now() - timedelta(days=365),
            end_date=datetime.now() - timedelta(days=1),
            target_column="profit_loss",  # Regression target
            feature_groups=["market_features", "professional_features", "user_features"],
            sports_filter=["NFL", "NBA", "MLB", "NHL"],
            min_samples_per_user=20,
            train_ratio=0.7,
            val_ratio=0.15,
            test_ratio=0.15,
            random_seed=42
        ),
        
        # 5. CLV prediction dataset
        DatasetConfig(
            name="unit_talk_clv_prediction_12m",
            start_date=datetime.now() - timedelta(days=365),
            end_date=datetime.now() - timedelta(days=1),
            target_column="clv_realized",  # Custom target
            feature_groups=["market_features", "temporal_features"],
            sports_filter=["NFL", "NBA"],
            min_samples_per_user=10,
            train_ratio=0.7,
            val_ratio=0.15,
            test_ratio=0.15,
            random_seed=42
        )
    ]
    
    # Build each dataset
    for config in configs:
        try:
            logger.info(f"\n{'='*60}")
            logger.info(f"Building dataset: {config.name}")
            logger.info(f"{'='*60}")
            
            # Build dataset
            splits, data_card = await builder.build_dataset(config)
            
            # Save dataset
            builder.save_dataset(splits, data_card)
            
            # Print summary
            logger.info(f"\n✓ Dataset {config.name} built successfully!")
            logger.info(f"  - Total samples: {data_card.statistics['total_samples']}")
            logger.info(f"  - Total features: {data_card.statistics['total_features']}")
            logger.info(f"  - Date range: {data_card.statistics['date_range']['start']} to {data_card.statistics['date_range']['end']}")
            
            # Print quality metrics
            quality = data_card.statistics['quality_report']
            logger.info(f"  - Duplicates removed: {quality['deduplication']['removed_count']}")
            logger.info(f"  - Temporal leakage: {'DETECTED' if quality['leakage_detection']['temporal_leakage'] else 'None'}")
            logger.info(f"  - Feature leakage: {len(quality['leakage_detection']['feature_leakage'])} features removed")
            
        except Exception as e:
            logger.error(f"Failed to build dataset {config.name}: {str(e)}")
            continue
            
    logger.info(f"\n{'='*60}")
    logger.info("Dataset building complete!")
    logger.info(f"{'='*60}")


async def validate_datasets():
    """Validate built datasets"""
    datasets_dir = Path("ml/datasets")
    
    if not datasets_dir.exists():
        logger.error(f"Datasets directory not found: {datasets_dir}")
        return
        
    logger.info("\nValidating built datasets...")
    
    for dataset_dir in datasets_dir.iterdir():
        if dataset_dir.is_dir():
            logger.info(f"\nValidating dataset: {dataset_dir.name}")
            
            # Check required files
            required_files = ["train.parquet", "validation.parquet", "test.parquet", 
                            "data_card.json", "schema.json", "README.md"]
            
            missing_files = []
            for file in required_files:
                if not (dataset_dir / file).exists():
                    missing_files.append(file)
                    
            if missing_files:
                logger.warning(f"  ⚠ Missing files: {missing_files}")
            else:
                logger.info("  ✓ All required files present")
                
            # Load and validate data card
            try:
                import json
                import pandas as pd
                
                with open(dataset_dir / "data_card.json", 'r') as f:
                    data_card = json.load(f)
                    
                logger.info(f"  - Dataset name: {data_card['name']}")
                logger.info(f"  - Created: {data_card['created_at']}")
                logger.info(f"  - Total samples: {data_card['statistics']['total_samples']}")
                
                # Validate parquet files
                for split in ["train", "validation", "test"]:
                    df = pd.read_parquet(dataset_dir / f"{split}.parquet")
                    logger.info(f"  - {split}: {len(df)} samples, {len(df.columns)} features")
                    
            except Exception as e:
                logger.error(f"  ✗ Validation error: {str(e)}")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Build historical ML datasets")
    parser.add_argument("--validate-only", action="store_true", 
                       help="Only validate existing datasets")
    args = parser.parse_args()
    
    if args.validate_only:
        asyncio.run(validate_datasets())
    else:
        asyncio.run(build_datasets())
        asyncio.run(validate_datasets())


if __name__ == "__main__":
    main()