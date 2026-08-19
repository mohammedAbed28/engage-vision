# EngageVision Final EEL Backend

Self-contained FastAPI v11 service for the Codex application. It loads only a bundle inside this final project and never imports the original or Claude application.

Runtime-locked bundle: `model/final_engagevision_eel_moe_bundle.pkl`. The
mobile/API runtime cannot select the archived legacy model.

## Run

```bash
cd /Users/hmode/Documents/Codex/EngageVision_Final_EEL
cp backend/.env.example backend/.env
./run_backend.sh
```

Core routes: `/health`, `/model-info`, `/model-metrics`, `/research/model-card`, `/predict`, `/predict-from-upload-v3`, `/predict-before-after`, caption revision and model-guided image revision.

Upload prediction requires image, caption, planned date and planned time. The server derives month, hour and weekday, extracts MiniLM/CLIP features, applies the frozen MoE and uses the cluster threshold stored in the bundle.

OpenAI is optional and server-side only. It assists revisions; EngageVision re-scores the candidates. A before/after difference is not a causal estimate.
