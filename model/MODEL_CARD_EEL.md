# Model Card — EngageVision MoE EEL v1

## Identification

- **Model version:** `ENGAGEVISION_MOE_EEL_V1`
- **Target version:** `EEL_V1_W40_C60_BOOTSTRAP_HAC`
- **Method:** Expected Engagement Lift (מדד שיפור המעורבות ביחס לצפוי)
- **Bundle:** `final_engagevision_eel_moe_bundle.pkl`
- **Compatibility:** 935 frozen features, text embedding 384→PCA64, image embedding 512→PCA64, 12 clusters.

## Intended use

Pre-publication classification of an Instagram draft as High/Low EEL using an image, caption, planned date/time and safe content features. The app may use the result to rank evidence-based suggestions and compare a draft with an optional revision.

Not intended for guaranteed outcome claims, individual psychological profiling, moderation decisions, or direct prediction of exact future likes/comments.

## Target construction

Historical likes and comments are used only to construct labels:

1. Estimate expected likes and expected comments using historical reference data.
2. Calculate log residuals: `log1p(actual) − log1p(expected)`.
3. Convert residuals to within-account percentiles.
4. Calculate `EEL = 0.40 × like_percentile + 0.60 × comment_percentile`.
5. For each account, estimate 200 HAC(k=2) boundaries by bootstrap and freeze the median.
6. Label historical rows High when their score meets the frozen boundary.

Inference never receives actual likes, comments, expected outcomes, EEL score or the EEL label.

## Architecture

The frozen Stage-1 architecture keeps the original EngageVision approach:

- safe handcrafted text/image/time features;
- multilingual MiniLM text embeddings and CLIP image embeddings;
- separate PCA reduction to 64 dimensions each;
- KMeans routing to 12 content clusters;
- global RF/ExtraTrees/XGBoost/CatBoost ensemble;
- local expert per content cluster;
- validation-selected adaptive global/expert blending;
- isotonic calibration;
- validation-selected cluster-specific Fβ=1.25 thresholds.

Global weights are RF 0.05, ExtraTrees 0.75, XGBoost 0.00 and CatBoost 0.20. A zero XGBoost weight is a frozen validation outcome, not a missing component.

## Data and split

- 88,419 uniquely joined usable rows from `safespace.safespace`, `text_embeddings` and `image_embeddings` on `post_id`.
- Six historical accounts.
- Train 61,893; Validation 13,263; Test 13,263.
- Sorted post-id SHA-256: `28f623f8c2fbb6c1c6b26986ffa18b9376e84b8998c30a601e3100c3c7ab24bc`.

## Fixed-Test metrics — seed 42

| Metric | Value |
|---|---:|
| Accuracy | 0.6517 |
| Precision | 0.5732 |
| Recall | 0.8889 |
| Specificity | 0.4570 |
| F1 | 0.6970 |
| Fβ=1.25 | 0.7316 |
| ROC-AUC | 0.7778 |
| PR-AUC | 0.7181 |
| Brier score | 0.1909 |
| ECE | 0.0140 |
| TN / FP / FN / TP | 3,330 / 3,956 / 664 / 5,313 |

Across seeds 42/123/777: mean F1 0.6979, standard deviation 0.0016; mean Recall 0.8804; mean PR-AUC 0.7179.

## Selection decision

The EEL Champion had mean F1 0.7007 versus 0.6979 for Stage-1 control, but its paired F1 confidence intervals included zero at all three seeds and it lowered mean Recall and PR-AUC. Stage-1 control was selected for stability, recall and scientific restraint. Stage-2 feedback is rejected based on later identical-row controlled experiments.

## Limitations

The EEL target is different from the legacy target; metric differences are not a same-task gain. The historical Test has been inspected previously. Only six accounts are represented; leave-one-account-out evidence does not establish equal new-account performance. The chosen expectation family had partial convergence warnings. See `MODEL_LIMITATIONS.md`.

## Reproducibility and integrity

Exact hash, timestamp and metric values are in `MODEL_BUNDLE_MANIFEST.json` and `MODEL_METRICS.json`. Training code is `training/train_eel_moe.py`. Test predictions are `training_output/eel_test_predictions.csv`. The original bundle is preserved only as a verified rollback artifact.

