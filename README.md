# EngageVision

EngageVision is a multimodal application for predicting the engagement outlook of an Instagram post before publication.

The system evaluates the post image, caption, and planned publication time using a frozen Cluster-Adaptive Mixture-of-Experts model. It then produces a prediction, probability, model-based recommendations, and optional AI-assisted revisions.

The AI does not decide whether a post is better. The model selects the recommended direction and evaluates every generated revision again. A revision is presented as an improvement only when the model measures a real increase in probability.

> Predictions are probabilistic estimates, not guarantees of future engagement.

---

## Public Application

The deployed application can be opened from a phone, tablet, or computer:

**https://engage-vision.web.app/**

The public version uses Firebase Hosting for the frontend and a deployed FastAPI service for prediction.

The examiner does not need Expo Go, the source code, or the local MySQL database to test the public application.

---

## Active Research Configuration

| Item | Active value |
|---|---|
| Active model | `ENGAGEVISION_MOE_EEL_V1` |
| Active target | `EEL_V1_W40_C60_BOOTSTRAP_HAC` |
| Model architecture | Cluster-Adaptive Mixture of Experts |
| Model bundle | `model/final_engagevision_eel_moe_bundle.pkl` |
| Target task | Binary High/Low engagement outlook |
| Evaluation set | Frozen held-out test set |
| F1 score | `0.697` |
| Recall | `0.889` |
| PR-AUC | `0.718` |

The production model, target definition, calibration, thresholds, feature order, and prediction logic are frozen.

---

## Main Capabilities

- Email/password and phone/SMS authentication through Firebase.
- English, Hebrew, and Arabic interfaces.
- Full RTL support for Hebrew and Arabic.
- Dark and light visual themes.
- Image and caption input.
- Planned publication date and time.
- Automatic day-of-week calculation.
- High/Low engagement prediction.
- Calibrated probability display.
- Model-based structured recommendations.
- Caption, CTA, hashtag, timing, and image improvement directions.
- Optional AI-assisted caption and image revision.
- Model validation of every generated revision.
- Before/After comparison.
- Signal MRI visualization.
- Prediction history.
- Storage of real Likes, Comments, Shares, and Saves.
- Separation between predicted improvement and real observed outcome.
- Model information, evaluation metrics, graphs, and tables.
- Mobile and web support.

---

## Responsibility Separation

EngageVision separates prediction, recommendation, content generation, and verification:

1. The frozen MoE model calculates the original prediction and probability.
2. The Recommendation Engine tests structured alternatives and selects a model-supported direction.
3. The AI receives the structured instructions and generates a caption, CTA, hashtags, or image revision.
4. The same frozen model evaluates the generated revision again.
5. The application compares the original and revised probabilities.
6. A revision is marked as improved only if its probability actually increased.
7. If no tested revision improves the score, the application recommends keeping the original.

The AI is a content-generation assistant. It does not replace the prediction model and does not determine which version is better.

---

## Project Structure

```text
engage-vision/
├── frontend/              Expo / React Native application
│   ├── src/               Screens, components, services, themes, and utilities
│   ├── assets/            Application images and visual assets
│   ├── App.tsx            Main application entry
│   ├── app.json           Expo configuration
│   └── package.json       Frontend dependencies and commands
│
├── backend/               FastAPI prediction and recommendation service
│   ├── server.py          API entry point and routes
│   ├── model_provenance.py
│   ├── model_guided_recommendations.py
│   ├── model_guided_image_editor.py
│   ├── professional_caption_writer.py
│   ├── professional_guidance.py
│   ├── historical_intelligence.py
│   └── openai_service.py
│
├── model/                 Active model metadata and local model bundle
│   ├── final_engagevision_eel_moe_bundle.pkl
│   └── legacy/            Inactive historical bundle for rollback only
│
├── database/              Read-only SQL and EEL target documentation
├── tests/                 Automated model, API, security, and leakage tests
├── .env.example           Environment-variable template without secrets
├── .gitignore             Files excluded from Git
├── requirements.txt       Python dependencies
├── package.json           Root project commands
├── run_all.sh             Start backend and frontend
├── run_backend.sh         Start the FastAPI backend
├── run_frontend.sh        Start the Expo frontend
└── README.md              Project and examiner guide
```

### Frontend

The user interface is located in:

```text
frontend/
```

It contains authentication, post analysis, outlook, recommendations, revision comparison, Signal MRI, history, translations, Firebase integration, and the dark/light themes.

### Backend

The API and model integration are located in:

```text
backend/
```

The backend loads the frozen model, prepares multimodal features, calculates predictions, builds structured recommendations, calls the optional AI services, and evaluates generated revisions.

### Active Model

The production model is:

```text
model/final_engagevision_eel_moe_bundle.pkl
```

No active prediction code should load a file from `model/legacy/`.

---

## Model Bundle and GitHub Size Limit

The active model bundle is approximately **962 MB**. GitHub rejects normal files larger than 100 MB, so the `.pkl` bundle is intentionally excluded from the repository by `.gitignore`.

The exact model bundle is included separately in the complete submission package.

Its SHA-256 digest is included with the submission so that the examiner can verify that the supplied file is identical to the active production model.

After receiving the complete package, place the model at:

```text
model/final_engagevision_eel_moe_bundle.pkl
```

The application can open without the OpenAI service, but local prediction cannot run without the active model bundle.

The public application uses the same frozen model version.

---

## SHA-256 Verification

SHA-256 is a digital fingerprint of the model file. If two model files produce the same SHA-256 value, they are identical at the binary level.

On macOS, the submitted model can be verified with:

```bash
shasum -a 256 model/final_engagevision_eel_moe_bundle.pkl
```

Compare the printed value with the SHA-256 value supplied in the final submission package.

---

## Requirements

For local development:

- Python 3.9 or newer.
- Node.js 18 or newer.
- npm.
- Expo Go for testing the native preview on a phone.
- The active `.pkl` model bundle.
- Firebase configuration.
- An OpenAI API key only when testing AI-assisted revisions.

The public website does not require local installation.

---

## Local Installation

Clone the repository:

```bash
git clone https://github.com/mohammedAbed28/engage-vision.git
cd engage-vision
```

Install the Python dependencies:

```bash
python3 -m pip install -r requirements.txt
```

Install the frontend dependencies:

```bash
npm --prefix frontend ci
```

Create local environment files from the safe templates:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Add private values only to the local `.env` files.

Never commit `.env`, API keys, database passwords, service-account files, private keys, tokens, or other credentials.

---

## Running the Complete Project

Start the backend and frontend together:

```bash
chmod +x run_all.sh run_backend.sh run_frontend.sh
./run_all.sh
```

Or start them separately.

Backend:

```bash
./run_backend.sh
```

Frontend:

```bash
./run_frontend.sh
```

Keep the terminal windows open while using the local application.

For Expo Go, the phone and computer should be connected to the same Wi-Fi network. Scan the QR code displayed by Expo.

For the public deployed version, use:

**https://engage-vision.web.app/**

---

## Running the Backend Directly

From the project root:

```bash
python3 -m uvicorn backend.server:app --host 0.0.0.0 --port 8049
```

Useful local checks:

```text
http://localhost:8049/health
http://localhost:8049/docs
```

The `/docs` route opens the interactive FastAPI API documentation.

---

## Environment Variables

Use the included `.env.example` files as templates.

Typical backend variables include:

```env
MODEL_BUNDLE_PATH=model/final_engagevision_eel_moe_bundle.pkl
OPENAI_API_KEY=
OPENAI_TEXT_MODEL=
OPENAI_IMAGE_EDIT_MODEL=
```

Typical frontend variables include:

```env
EXPO_PUBLIC_API_BASE_URL=
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

Do not place the OpenAI secret key in the frontend. It belongs only in the backend environment or the production secret manager.

---

## Firebase

Firebase provides:

- Authentication.
- Email/password registration and login.
- Phone/SMS authentication.
- Password reset.
- Protected application access.
- Firestore user profiles.
- User history and saved outcomes.
- Public frontend hosting.

Passwords and SMS verification codes are never stored in Firestore.

A user profile can contain:

```text
users/{uid}
├── uid
├── fullName
├── email
├── phoneNumber
├── registrationMethod
└── createdAt
```

Private backend credentials are not stored in the frontend repository.

---

## OpenAI Integration

OpenAI is optional and is used only after the model and Recommendation Engine determine a structured improvement direction.

OpenAI may generate:

- Caption revisions.
- CTA revisions.
- Hashtag suggestions.
- Image-editing candidates.

Every candidate is evaluated again by the frozen EngageVision model.

If the model does not measure an increase in probability, the interface must not claim that the candidate improved the post.

The application remains able to perform its original model prediction when the OpenAI service is unavailable.

---

## Prediction Workflow

```text
Post image + caption + planned time
                  │
                  ▼
        Multimodal preprocessing
                  │
                  ▼
      Frozen EngageVision MoE model
                  │
                  ▼
     Prediction + calibrated probability
                  │
                  ▼
 Model-guided counterfactual recommendations
                  │
                  ▼
       Optional AI content generation
                  │
                  ▼
       Frozen model evaluates revision
                  │
                  ▼
  Verified Before/After result or keep original
```

---

## Model Evaluation Dashboard

The application’s model-information section presents the active research configuration and final evaluation evidence.

It includes:

- Active model and target identifiers.
- F1, Recall, and PR-AUC.
- Confusion matrix.
- ROC curve.
- Precision–Recall curve.
- Threshold analysis.
- Probability and calibration information.
- Class distribution.
- Per-cluster performance where available.
- Scientific notes explaining that predictive signals are not necessarily causal.

The dashboard must always display metrics from the active frozen model and target, not from a legacy experiment.

---

## Database Source

The historical research dataset was built from the local MySQL `safespace` schema.

The multimodal loader joined the post data with:

- `text_embeddings`
- `image_embeddings`

using `post_id`.

The resulting cleaned dataset contained approximately 88,419 usable rows across six accounts.

The historical split was approximately:

| Split | Rows |
|---|---:|
| Train | 61,893 |
| Validation | 13,263 |
| Test | 13,263 |

The production application does not expose the local MySQL database or port 3306 publicly.

Database access scripts must use environment variables and read-only access where possible.

---

## Data Safety and Leakage Prevention

The prediction feature set excludes outcome and identity fields that would leak the answer or prevent generalization to new users.

Examples of forbidden prediction inputs include:

- Likes.
- Comment count.
- Shares and saves when used as post-publication outcomes.
- Raw engagement score.
- Target labels.
- Username.
- Account identity.
- Post URL.
- Any field created after publication that directly reveals success.

Historical outcome fields may be stored separately for later comparison and controlled user-level experiments. They are not silently injected into the frozen model’s prediction features.

---

## Automated Tests

Run the backend test suite:

```bash
python3 -m pytest -q
```

Run the frontend type check:

```bash
npm --prefix frontend run typecheck
```

The test suite covers, where applicable:

- Active model loading.
- Model and target metadata.
- Prediction API responses.
- Feature-order protection.
- Leakage-sensitive fields.
- Recommendation structure.
- Model verification of revisions.
- No-improvement handling.
- Authentication states.
- Translation resources.
- RTL behavior.
- Error handling.
- Timeout behavior.

---

## Examiner Quick Start

### Option 1 — Public application

Open:

**https://engage-vision.web.app/**

Then:

1. Create an account or log in.
2. Open the post-analysis screen.
3. Upload an image.
4. Enter a caption.
5. Select the planned date and time.
6. Run the analysis.
7. Review the prediction and probability.
8. Open the model-based recommendations.
9. Generate an optional AI-assisted revision.
10. Compare the verified Before/After probabilities.
11. Open Signal MRI and the model-information dashboard.
12. Review the saved prediction in History.

### Option 2 — Review the source code

Start with:

- `README.md`
- `frontend/App.tsx`
- `frontend/src/`
- `backend/server.py`
- `backend/model_provenance.py`
- `backend/model_guided_recommendations.py`
- `backend/openai_service.py`
- `model/`
- `tests/`

### Option 3 — Run locally

1. Clone the repository.
2. Copy the active model bundle from the submission package into `model/`.
3. Install the Python and frontend dependencies.
4. Create the local environment files.
5. Run `./run_all.sh`.
6. Open the Expo QR code or the web preview.

---

## User Guide

The normal application flow is:

1. Register or log in.
2. Choose the application language.
3. Select the light or dark theme.
4. Upload an image and enter a caption.
5. Choose the planned date and time.
6. Run the prediction.
7. Read the outlook and the probability.
8. Review model-based recommendations and Signal MRI.
9. Choose an improvement direction.
10. Generate a revision when desired.
11. Accept the revision only when the model verifies a higher score.
12. Save the experiment.
13. After publication, enter the real observed engagement results.
14. Compare predicted improvement with the real outcome in History.

---

## Security Notes

- No private password should be committed to Git.
- `.env` files are ignored.
- `.pkl` bundles are ignored.
- Private keys and service-account files are ignored.
- The OpenAI API key is stored only on the backend.
- Production secrets should be stored in Google Secret Manager.
- MySQL port 3306 must not be exposed publicly.
- The frontend cannot access the user’s computer, terminal, home folder, or local environment variables.
- Firebase security rules should restrict private data to the authenticated owner.
- API errors must not reveal secrets or internal filesystem paths.

---

## Git Repository Rules

The repository contains source code, configuration templates, tests, and documentation.

It intentionally excludes:

- `.env` files.
- API keys and tokens.
- Database passwords.
- Service-account credentials.
- Private keys.
- `node_modules/`.
- Expo cache.
- Python cache.
- Test cache.
- Large `.pkl` model bundles.
- Temporary output files.
- Local IDE settings when not required.

Before committing, verify:

```bash
git status
```

Make sure that no `.env`, `.pkl`, credential, private-key, or secret file is listed.

---

## Scientific Interpretation

EngageVision estimates the probability that a post belongs to the High engagement class defined by the frozen EEL target.

A higher probability does not guarantee more likes or comments. It indicates that the post is more similar, according to the learned multimodal patterns, to historically successful posts under the research target.

Counterfactual recommendations are model-based sensitivity checks. They show how the prediction changes under controlled feature modifications. They should not be interpreted automatically as proof of causality.

---

## Important Limitations

- Predictions are probabilistic.
- Instagram engagement is influenced by external factors not available before publication.
- The model was trained on a specific historical dataset.
- A recommendation may not improve every post.
- AI-generated content may require human review.
- Real-world outcomes should be recorded and compared with the prediction.
- The model should not be retrained automatically from individual user results.
- The final decision to publish remains with the user.

---

## Submission Contents

The complete submission package should include:

- Source-code repository.
- Active model bundle.
- Model SHA-256 file.
- Final presentation.
- Final modelling report.
- Final evaluation report.
- User guide.
- Deployment evidence.
- Model evaluation plots and tables.
- Requirement-to-implementation evidence table.

The GitHub repository does not contain the 962 MB model bundle because of GitHub’s normal 100 MB file limit.

---

## Project Identification

**Project:** EngageVision  
**Active model:** `ENGAGEVISION_MOE_EEL_V1`  
**Active target:** `EEL_V1_W40_C60_BOOTSTRAP_HAC`  
**Active bundle:** `model/final_engagevision_eel_moe_bundle.pkl`  
**Public application:** https://engage-vision.web.app/  
**Repository:** https://github.com/mohammedAbed28/engage-vision
