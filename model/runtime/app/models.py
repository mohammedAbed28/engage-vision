"""
Model factory functions for the Cluster-Adaptive Mixture-of-Experts
architecture: a global ensemble (4 diverse tree models) plus one expert
model per content cluster. Hyperparameters match the validated research
script (final_selected_moe_with_clip_app_layer) exactly, since this
configuration is what produced the F1/Recall numbers the model was chosen
for — see README.md "Model search log".
"""

from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier
from xgboost import XGBClassifier

from app.config import RANDOM_STATE

try:
    from catboost import CatBoostClassifier
    CATBOOST_AVAILABLE = True
except ImportError:
    CATBOOST_AVAILABLE = False


def build_global_models(y_train) -> dict:
    """Four diverse tree ensembles whose out-of-fold probabilities are later
    combined by a validation-tuned weighted average (see app/ensemble.py)."""
    low_count = int((y_train == 0).sum())
    high_count = int((y_train == 1).sum())
    scale_pos_weight = low_count / high_count if high_count > 0 else 1.0

    models = {
        "Random Forest": RandomForestClassifier(
            n_estimators=650, max_depth=18, min_samples_split=8, min_samples_leaf=4,
            class_weight="balanced_subsample", random_state=RANDOM_STATE, n_jobs=-1
        ),
        "Extra Trees": ExtraTreesClassifier(
            n_estimators=900, max_depth=None, min_samples_split=8, min_samples_leaf=3,
            class_weight="balanced", random_state=RANDOM_STATE, n_jobs=-1
        ),
        "XGBoost": XGBClassifier(
            n_estimators=900, learning_rate=0.03, max_depth=4, subsample=0.88,
            colsample_bytree=0.88, min_child_weight=3, reg_lambda=2.0, reg_alpha=0.1,
            scale_pos_weight=scale_pos_weight, eval_metric="logloss",
            random_state=RANDOM_STATE, n_jobs=-1
        ),
    }

    if CATBOOST_AVAILABLE:
        models["CatBoost"] = CatBoostClassifier(
            iterations=900, learning_rate=0.03, depth=6, l2_leaf_reg=5,
            loss_function="Logloss", eval_metric="F1", auto_class_weights="Balanced",
            random_seed=RANDOM_STATE, verbose=False
        )

    return models


def build_expert_model(y_train_cluster):
    """Per-content-cluster specialist model — a single ExtraTrees, since
    each expert only ever sees one cluster's worth of training data."""
    return ExtraTreesClassifier(
        n_estimators=650, max_depth=None, min_samples_split=6, min_samples_leaf=2,
        class_weight="balanced", random_state=RANDOM_STATE, n_jobs=-1
    )
