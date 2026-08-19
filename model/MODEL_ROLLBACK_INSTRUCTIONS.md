# Model Rollback Instructions

The application runtime is locked to `EEL_V1`. The archived legacy bundle is
included only for comparison documentation and reproducibility; it is not
selectable through `.env` and must never be presented as the EEL model.

An emergency rollback requires a separate reviewed code release and a full
test run. Do not rename bundles, overwrite the EEL bundle, or serve outputs
from two target definitions as if they were one production model.
