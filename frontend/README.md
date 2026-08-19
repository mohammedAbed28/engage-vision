# EngageVision Final EEL Frontend

The preserved Codex Expo/React Native application with English, Hebrew and Arabic, Firebase authentication/history, required planned date/time, automatic weekday and a verified model dashboard.

```bash
cd /Users/hmode/Documents/Codex/EngageVision_Final_EEL
npm --prefix frontend ci
cp frontend/.env.example frontend/.env
./run_frontend.sh
```

The Firebase Web configuration for `engage-vision` is already included in the
client, as in the original Codex application. For Expo LAN development leave
`EXPO_PUBLIC_API_BASE_URL` empty; the client derives the Mac address from Metro.
For Android emulator it falls back to `http://10.0.2.2:8048`. Only a deployed
API requires an explicit HTTPS value. The backend owns the model and every
private key.

Product flow: authentication → account setup → home → image/caption/date/time → outlook → evidence/recommendation → optional revision → EngageVision re-score → history. The research dashboard shows model-level metrics and limitations; it never represents F1 as a personal success probability.
