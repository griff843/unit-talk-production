"""
Model Registry and Governance System
Lightweight registry for ML model versioning, approval, and lifecycle management
"""

import json
import os
import hashlib
import shutil
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

@dataclass
class ModelMetadata:
    """Model metadata structure"""
    version: str
    path: str
    hash: str
    model_type: str
    training_date: str
    metrics: Dict[str, float]
    hyperparameters: Dict[str, Any]
    features: List[str]
    dataset_info: Dict[str, Any]
    approval_status: str = "pending"
    deployment_status: str = "none"
    created_by: str = "automated-pipeline"
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    deployed_at: Optional[str] = None
    archived_at: Optional[str] = None
    tags: List[str] = None

    def __post_init__(self):
        if self.tags is None:
            self.tags = []

@dataclass 
class DeploymentRecord:
    """Deployment history record"""
    model_version: str
    deployment_type: str  # production, staging, shadow, canary
    deployed_at: str
    deployed_by: str
    status: str  # success, failed, rolled_back
    metrics_at_deployment: Dict[str, float]
    rollback_reason: Optional[str] = None

class ModelRegistry:
    """
    Lightweight model registry for ML lifecycle management
    
    Features:
    - Model versioning and metadata tracking
    - Approval workflow with governance rules
    - Deployment history and rollback management
    - Model archival and cleanup
    - Hash-based integrity verification
    """
    
    def __init__(self, registry_path: str = "ml/registry"):
        self.registry_path = Path(registry_path)
        self.manifest_path = self.registry_path / "manifest.json"
        self.models_dir = self.registry_path / "models"
        
        # Ensure directories exist
        self.registry_path.mkdir(parents=True, exist_ok=True)
        self.models_dir.mkdir(parents=True, exist_ok=True)
        
        # Load or initialize manifest
        self.manifest = self._load_manifest()
    
    def _load_manifest(self) -> Dict[str, Any]:
        """Load registry manifest or create default"""
        if self.manifest_path.exists():
            with open(self.manifest_path, 'r') as f:
                return json.load(f)
        else:
            return self._create_default_manifest()
    
    def _create_default_manifest(self) -> Dict[str, Any]:
        """Create default registry manifest"""
        return {
            "registry_version": "1.0.0",
            "created_at": datetime.now().isoformat(),
            "last_updated": datetime.now().isoformat(),
            "models": [],
            "production_model": None,
            "staging_model": None,
            "archived_models": [],
            "governance": {
                "approval_required": True,
                "minimum_approval_score": 0.75,
                "required_metrics": ["auc", "accuracy", "precision", "recall"],
                "promotion_criteria": {
                    "auc_threshold": -0.005,
                    "roi_threshold": -0.02,
                    "minimum_improvement": 0.001
                },
                "retention_policy": {
                    "max_archived_models": 10,
                    "retention_days": 90
                }
            },
            "deployment_history": [],
            "rollback_history": []
        }
    
    def _save_manifest(self):
        """Save manifest to file"""
        self.manifest["last_updated"] = datetime.now().isoformat()
        with open(self.manifest_path, 'w') as f:
            json.dump(self.manifest, f, indent=2)
        logger.info(f"Registry manifest saved to {self.manifest_path}")
    
    def register_model(
        self,
        model_path: str,
        metadata: Dict[str, Any],
        auto_approve: bool = False
    ) -> str:
        """
        Register a new model in the registry
        
        Args:
            model_path: Path to model artifact
            metadata: Model metadata dictionary
            auto_approve: Whether to auto-approve the model
            
        Returns:
            Model version string
        """
        logger.info(f"Registering model from {model_path}")
        
        # Generate version
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        version = f"v{timestamp}"
        
        # Calculate model hash
        model_hash = self._calculate_file_hash(model_path)
        
        # Check for duplicate models
        if self._is_duplicate_model(model_hash):
            logger.warning(f"Model with hash {model_hash} already exists")
            return self._get_version_by_hash(model_hash)
        
        # Copy model to registry
        registry_model_path = self.models_dir / f"model_{version}.pkl"
        shutil.copy2(model_path, registry_model_path)
        
        # Create model metadata
        model_metadata = ModelMetadata(
            version=version,
            path=str(registry_model_path),
            hash=model_hash,
            model_type=metadata.get('model_type', 'unknown'),
            training_date=metadata.get('training_date', datetime.now().isoformat()),
            metrics=metadata.get('metrics', {}),
            hyperparameters=metadata.get('hyperparameters', {}),
            features=metadata.get('features', []),
            dataset_info=metadata.get('dataset_info', {}),
            approval_status="approved" if auto_approve else "pending"
        )
        
        # Auto-approval check
        if auto_approve or self._check_auto_approval_criteria(model_metadata):
            model_metadata.approval_status = "approved"
            model_metadata.approved_by = "automated-pipeline"
            model_metadata.approved_at = datetime.now().isoformat()
        
        # Add to registry
        self.manifest["models"].append(asdict(model_metadata))
        self._save_manifest()
        
        logger.info(f"Model registered with version {version}")
        return version
    
    def approve_model(self, version: str, approved_by: str) -> bool:
        """Manually approve a model"""
        model = self._find_model_by_version(version)
        if not model:
            logger.error(f"Model {version} not found")
            return False
        
        if model["approval_status"] == "approved":
            logger.info(f"Model {version} already approved")
            return True
        
        # Check approval criteria
        if not self._meets_approval_criteria(model):
            logger.error(f"Model {version} does not meet approval criteria")
            return False
        
        # Approve model
        model["approval_status"] = "approved"
        model["approved_by"] = approved_by
        model["approved_at"] = datetime.now().isoformat()
        
        self._save_manifest()
        logger.info(f"Model {version} approved by {approved_by}")
        return True
    
    def promote_to_production(self, version: str, deployed_by: str = "automated-pipeline") -> bool:
        """Promote model to production"""
        model = self._find_model_by_version(version)
        if not model:
            logger.error(f"Model {version} not found")
            return False
        
        if model["approval_status"] != "approved":
            logger.error(f"Model {version} not approved for production")
            return False
        
        # Archive current production model
        if self.manifest["production_model"]:
            current_prod = self.manifest["production_model"]
            current_prod["deployment_status"] = "archived"
            current_prod["archived_at"] = datetime.now().isoformat()
            self.manifest["archived_models"].append(current_prod)
        
        # Promote new model
        model["deployment_status"] = "production"
        model["deployed_at"] = datetime.now().isoformat()
        self.manifest["production_model"] = model.copy()
        
        # Record deployment
        deployment_record = DeploymentRecord(
            model_version=version,
            deployment_type="production",
            deployed_at=datetime.now().isoformat(),
            deployed_by=deployed_by,
            status="success",
            metrics_at_deployment=model["metrics"]
        )
        
        self.manifest["deployment_history"].append(asdict(deployment_record))
        self._save_manifest()
        
        logger.info(f"Model {version} promoted to production")
        return True
    
    def rollback_production(self, target_version: Optional[str] = None, reason: str = "Manual rollback") -> bool:
        """Rollback production to previous or specified version"""
        
        if target_version:
            # Rollback to specific version
            target_model = self._find_model_by_version(target_version)
            if not target_model:
                logger.error(f"Target version {target_version} not found")
                return False
        else:
            # Rollback to previous version
            if not self.manifest["archived_models"]:
                logger.error("No previous version available for rollback")
                return False
            target_model = self.manifest["archived_models"][-1]
        
        # Archive current production model
        if self.manifest["production_model"]:
            current_prod = self.manifest["production_model"]
            current_prod["deployment_status"] = "rolled_back"
            current_prod["archived_at"] = datetime.now().isoformat()
        
        # Restore target model
        target_model["deployment_status"] = "production"
        target_model["deployed_at"] = datetime.now().isoformat()
        self.manifest["production_model"] = target_model.copy()
        
        # Record rollback
        rollback_record = {
            "from_version": current_prod["version"] if self.manifest["production_model"] else "none",
            "to_version": target_model["version"],
            "rolled_back_at": datetime.now().isoformat(),
            "reason": reason
        }
        
        self.manifest["rollback_history"].append(rollback_record)
        self._save_manifest()
        
        logger.info(f"Production rolled back to {target_model['version']}")
        return True
    
    def get_production_model(self) -> Optional[Dict[str, Any]]:
        """Get current production model metadata"""
        return self.manifest.get("production_model")
    
    def get_active_model_path(self) -> Optional[str]:
        """Get path to active production model"""
        prod_model = self.get_production_model()
        return prod_model["path"] if prod_model else None
    
    def list_models(self, status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        """List models with optional status filter"""
        models = self.manifest["models"]
        
        if status_filter:
            models = [m for m in models if m["approval_status"] == status_filter]
        
        return sorted(models, key=lambda x: x["training_date"], reverse=True)
    
    def get_model_info(self, version: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific model"""
        return self._find_model_by_version(version)
    
    def cleanup_old_models(self) -> int:
        """Clean up old archived models based on retention policy"""
        retention_policy = self.manifest["governance"]["retention_policy"]
        max_archived = retention_policy["max_archived_models"]
        retention_days = retention_policy["retention_days"]
        
        # Remove old archived models
        archived_models = self.manifest["archived_models"]
        cutoff_date = datetime.now() - timedelta(days=retention_days)
        
        models_to_remove = []
        for model in archived_models:
            archived_at = datetime.fromisoformat(model.get("archived_at", ""))
            if archived_at < cutoff_date:
                models_to_remove.append(model)
        
        # Keep only the most recent archived models
        if len(archived_models) > max_archived:
            archived_models.sort(key=lambda x: x.get("archived_at", ""), reverse=True)
            models_to_remove.extend(archived_models[max_archived:])
        
        # Remove model files and metadata
        removed_count = 0
        for model in models_to_remove:
            try:
                # Remove model file
                model_path = Path(model["path"])
                if model_path.exists():
                    model_path.unlink()
                
                # Remove from registry
                if model in self.manifest["archived_models"]:
                    self.manifest["archived_models"].remove(model)
                if model in self.manifest["models"]:
                    self.manifest["models"].remove(model)
                
                removed_count += 1
                logger.info(f"Cleaned up model {model['version']}")
                
            except Exception as e:
                logger.error(f"Failed to cleanup model {model['version']}: {e}")
        
        if removed_count > 0:
            self._save_manifest()
        
        logger.info(f"Cleaned up {removed_count} old models")
        return removed_count
    
    def _calculate_file_hash(self, file_path: str) -> str:
        """Calculate SHA256 hash of file"""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()[:16]  # First 16 characters
    
    def _is_duplicate_model(self, model_hash: str) -> bool:
        """Check if model with same hash already exists"""
        return any(model["hash"] == model_hash for model in self.manifest["models"])
    
    def _get_version_by_hash(self, model_hash: str) -> Optional[str]:
        """Get model version by hash"""
        for model in self.manifest["models"]:
            if model["hash"] == model_hash:
                return model["version"]
        return None
    
    def _find_model_by_version(self, version: str) -> Optional[Dict[str, Any]]:
        """Find model by version"""
        for model in self.manifest["models"]:
            if model["version"] == version:
                return model
        return None
    
    def _check_auto_approval_criteria(self, model: ModelMetadata) -> bool:
        """Check if model meets auto-approval criteria"""
        governance = self.manifest["governance"]
        
        # Check minimum score
        auc_score = model.metrics.get("auc", 0)
        if auc_score < governance["minimum_approval_score"]:
            return False
        
        # Check required metrics
        required_metrics = governance["required_metrics"]
        for metric in required_metrics:
            if metric not in model.metrics:
                return False
        
        return True
    
    def _meets_approval_criteria(self, model: Dict[str, Any]) -> bool:
        """Check if model meets approval criteria"""
        governance = self.manifest["governance"]
        
        # Check minimum score
        auc_score = model["metrics"].get("auc", 0)
        if auc_score < governance["minimum_approval_score"]:
            return False
        
        # Check required metrics
        required_metrics = governance["required_metrics"]
        for metric in required_metrics:
            if metric not in model["metrics"]:
                return False
        
        return True
    
    def get_registry_stats(self) -> Dict[str, Any]:
        """Get registry statistics"""
        models = self.manifest["models"]
        
        return {
            "total_models": len(models),
            "approved_models": len([m for m in models if m["approval_status"] == "approved"]),
            "pending_models": len([m for m in models if m["approval_status"] == "pending"]),
            "archived_models": len(self.manifest["archived_models"]),
            "production_model": self.manifest["production_model"]["version"] if self.manifest["production_model"] else None,
            "total_deployments": len(self.manifest["deployment_history"]),
            "total_rollbacks": len(self.manifest["rollback_history"]),
            "registry_size_mb": self._calculate_registry_size(),
            "last_updated": self.manifest["last_updated"]
        }
    
    def _calculate_registry_size(self) -> float:
        """Calculate total size of registry in MB"""
        total_size = 0
        for model in self.manifest["models"]:
            model_path = Path(model["path"])
            if model_path.exists():
                total_size += model_path.stat().st_size
        
        return total_size / (1024 * 1024)  # Convert to MB

def main():
    """Test model registry functionality"""
    import tempfile
    import pickle
    from sklearn.ensemble import RandomForestClassifier
    
    # Create test model
    model = RandomForestClassifier(n_estimators=10, random_state=42)
    
    with tempfile.NamedTemporaryFile(suffix='.pkl', delete=False) as f:
        pickle.dump(model, f)
        temp_model_path = f.name
    
    # Initialize registry
    registry = ModelRegistry("test_registry")
    
    # Register model
    metadata = {
        "model_type": "random_forest",
        "metrics": {
            "auc": 0.85,
            "accuracy": 0.80,
            "precision": 0.82,
            "recall": 0.78
        },
        "features": ["feature_1", "feature_2", "feature_3"],
        "hyperparameters": {"n_estimators": 10, "random_state": 42}
    }
    
    version = registry.register_model(temp_model_path, metadata, auto_approve=True)
    print(f"Registered model version: {version}")
    
    # Promote to production
    success = registry.promote_to_production(version)
    print(f"Promotion success: {success}")
    
    # Get production model
    prod_model = registry.get_production_model()
    print(f"Production model: {prod_model['version'] if prod_model else 'None'}")
    
    # Registry stats
    stats = registry.get_registry_stats()
    print(f"Registry stats: {stats}")
    
    # Cleanup
    os.unlink(temp_model_path)
    shutil.rmtree("test_registry")

if __name__ == "__main__":
    main()