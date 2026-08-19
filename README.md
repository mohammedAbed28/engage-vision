# EngageVision

EngageVision is an Expo / React Native app that predicts Instagram post engagement **before** you publish. It scores an image, caption, and planned date/time with a frozen **EEL Mixture-of-Experts** model.

OpenAI is optional and used only to draft caption or image revisions. Every revision is scored again by the same frozen model. Scores are probabilities, not guarantees.

## Project layout

```text
frontend/    Expo app (auth, create post, outlook, history, EN/HE/AR)
backend/     FastAPI API, prediction, caption/image revision
model/       Frozen model docs, manifests, and (local) .pkl bundle
database/    SQL scripts for the EEL target columns
tests/       pytest coverage for model, API, and leakage checks
```

**Frontend:** `frontend/`  
**Backend:** `backend/`

## Requirements

- Python 3.9+
- Node 18+
- npm
- Expo Go on your phone (same Wi-Fi as the computer)

## Setup

```bash
cd /Users/hmode/Documents/Codex/EngageVision_Final_EEL

python3 -m pip install -r requirements.txt
npm --prefix frontend ci

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Put secrets only in `.env` files. Do not commit them. The OpenAI key belongs in `backend/.env` only.

## Run

```bash
./run_all.sh
```

Or separately:

```bash
./run_backend.sh
./run_frontend.sh
```

Keep the terminal open and scan the Expo QR code. Phone and computer must be on the same Wi-Fi.

## Tests

```bash
python3 -m pytest -q
npm --prefix frontend run typecheck
```

## The `.pkl` model file (what it is, what to do)

`model/final_engagevision_eel_moe_bundle.pkl` is the **trained model** the backend loads to predict. It is not source code. It is a serialized sklearn/CatBoost/XGBoost bundle (~**962 MB**).

There is also a legacy bundle at `model/legacy/final_model_bundle_legacy_v1.pkl` (~**755 MB**).

GitHub rejects files over **100 MB**, so these `.pkl` files are listed in `.gitignore`. Keep them on your computer. Clone the repo, then copy the `.pkl` files into `model/` (and `model/legacy/` if you need rollback) if you work on another machine.

The app can start without OpenAI. It cannot predict without the main `.pkl` file.

Model (from the frozen test set): Stage-1 Cluster-Adaptive MoE, F1 **0.697**, Recall **0.889**, PR-AUC **0.718**.

## Firebase and OpenAI

Firebase Auth and Firestore live in `frontend/`. Passwords and SMS codes are not stored in Firestore.

## Push to GitHub (you run this; this repo is not pushed from here)

Work **only** inside this folder. Do not run `git` from your home directory.

```bash
cd /Users/hmode/Documents/Codex/EngageVision_Final_EEL
git init
git add .
git status   # confirm .env and *.pkl are NOT listed
git commit -m "Add EngageVision final EEL project."
git remote add origin https://github.com/mohammedAbed28/engage-vision.git
git branch -M main
git push -u origin main
```

If the GitHub repo already has a README or license, pull first or use `--force` only if you intend to replace the remote history.
