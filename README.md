# 🥗 AI Food Health Analyzer

An AI-powered web application that analyzes **packaged** and **normal/everyday** foods from images — extracts nutrition via OCR or estimates it from a food database, calculates a deterministic health score (per-100g normalized), and generates AI explanations with evidence-based risks, pros/cons and healthier alternatives.

Live: **Frontend** https://foodanalyzer-five.vercel.app/ · **Backend** https://food-analyzer-b7u4.onrender.com

Users can upload a food package image **or** a meal photo (or capture with device camera). The system validates that the image actually contains food, extracts/recognizes nutrition, scores it deterministically, and explains the result with an LLM.

---

## 🚀 Features

### 📸 Image-Based Analysis (Dual Mode)

**Packaged Food:**
- Upload nutrition label or capture via camera (rear `environment` facing, `playsInline` + `muted`)
- Client compress to 900px JPEG 0.70 + backend Sharp `1024px` `grayscale` `normalize` `sharpen` JPEG 78
- Tesseract.js OCR with local `eng.traineddata` (no download on Render), `1024px` primary + lazy `threshold` fallback, `PSM 6`, `30s`/`55s` timeouts, early-exit on high confidence
- Automatic detection of: Product Name, Ingredients, Nutrition Facts (calories, sodium, sugar/added sugar, saturated fat, protein, fiber, etc.)

**Normal / Everyday Food:**
- Meal photo → Groq/OpenRouter vision (`qwen/qwen3-vl-32b-instruct` via OpenRouter) → top-5 foods + confidence
- Manual portion editing (`small`/`medium`/`large` + grams/qty) — vision is optional, manual add always works
- Deterministic nutrition scaled from `nutritionDatabase.js` (43 foods, Indian + Western) with generic fallback for unknown foods (e.g., `Coke`, `Sushi` → estimated 150 kcal/100g)

**Food Validation Layer (New):**
- Reuses same vision model (`OpenRouter qwen`) before any OCR/recognition
- Returns `{isFood, confidence, foodType: packaged_food|normal_food|non_food|uncertain, reason}` → blocks non-food (`shampoo`, `soap`, `laptop`, `shoes`, etc.) before expensive pipeline
- High-conf `non_food ≥0.75` → `422 NON_FOOD_DETECTED`; `uncertain` (<0.75) → `422 UNCERTAIN_FOOD`; multi-object with any food → `isFood:true`
- Logs `Food Validation: isFood: true confidence: 0.95 foodType: packaged_food`

### 🧠 AI-Powered Health Analysis
- `nutritionDatabase` + `portionScaler` for normal food estimation
- Deterministic **per-100g normalized** `HealthScoreEngine` (base 70, max of per-serving vs per-100g penalties/bonuses)
- RAG retrieval (`MongoKeywordRetriever`, `topK=5`) + OpenRouter LLM (`nvidia`/`openai/gpt-4o-mini` text, `qwen` vision) with `1600→2200` token retry, `10s` abort, `json_object` mode, 10-min cache
- Pros / Cons / Evidence-based risks / Alternatives / Cited sources
- Graceful fallbacks when LLM unavailable (deterministic explanation)

### 📊 Health Score System (Improved)
Per-100g normalized (fixes 28g chips vs 330ml Coke clustering `55-70` → now `27-95` spread):

- **Base:** 70
- **Penalties (max of per-serving vs per-100g):**
  - Sodium: `baseline 120mg/100g` `2 per 100mg` max 22 (legacy 140mg/100mg per-serving)
  - Sugar: `baseline 6g/100g` `4 per 5g` max 28 (legacy 8g/100g); natural fruit sugar halved
  - Saturated Fat: `baseline 3g/100g` `3 per 1.5g` max 20
  - Ingredient quality: `max 18` + `long list ≥12 +3` / `≥20 +6`
  - Calories: `>400 kcal/100g +6`, `>300 +3`
- **Bonuses:**
  - Protein: `baseline 6g/100g` `2 per 3g` max 12
  - Fiber: `baseline 2.5g/100g` `3 per 2g` max 15
  - Whole fruit `fiber≥1.5g/100g` + natural sugar → `+10`
- **Special:** `water` (0 kcal, <20mg sodium) → `95 Very Healthy` without ingredients

Verdicts: `80-100 Very Healthy`, `65-79 Healthy`, `50-64 Moderately Healthy`, `35-49 Unhealthy`, `0-34 Very Unhealthy`

Example:
```json
{
  "healthScore": 44,
  "verdict": "Unhealthy",
  "scoreBreakdown": { "sodium": { "penalty": 2 }, "sugar": { "penalty": 12 }, "saturatedFat": { "penalty": 9 } }
}
```

### 🎨 UI
- Side-by-side `410px + 1fr` on desktop (`>1024px`), stacked on tablet/phone (`≤1024px` / `720px`)
- Right-pane shows health report (both modes via lifted state); left `NormalFoodFlow` no longer duplicates at bottom
- `NonFoodBanner` / `Unclear` / `Nutrition table not readable` (with `Try Normal Food mode` button) instead of health metrics
- Camera: robust `getUserMedia` (`ideal:environment` → `environment` → `true`), `50ms` modal mount delay, `isSecureContext` check, `srcObject` + `play()` in `useEffect`, stable `stopCamera` (no premature close), detailed toasts for `NotAllowed`/`NotFound`/`NotReadable`

---

## 🏗️ Architecture

**Packaged Flow:**
```text
User Image (packaged)
        ↓
Food Validation (qwen vision, OpenRouter) ──→ NON_FOOD/UNCERTAIN → 422 friendly error (no score)
        ↓ FOOD
Image Preprocessing (Sharp 1024px)
        ↓
Tesseract OCR (local eng.traineddata, PSM6, 30s/55s)
        ↓
Text Normalizer + Parsers (nutritionParser, ingredientsParser)
        ↓
Vision Fallback (qwen) if OCR <0.12 confidence — merges missing fields
        ↓
Health Score Engine (per-100g normalized, base 70)
        ↓
RAG Retrieval (Mongo) → Groq/OpenRouter LLM (nvidia/gpt-4o-mini) → explanation
        ↓
Results Dashboard (right pane)
```

**Normal Flow:**
```text
Meal Image
        ↓
Food Validation → NON_FOOD → 422 stop
        ↓ FOOD
Vision Food Recognition (qwen) → top 5 foods + confidence
        ↓
User confirms + portion (small/medium/large / grams/qty)
        ↓
nutritionDatabase + portionScaler → estimated nutrition (generic fallback for unknown e.g. Coke)
        ↓
Health Score Engine (per-100g, generic fallback still scored)
        ↓
RAG → LLM → Results Dashboard (right pane)
```

---

## 🛠️ Tech Stack

### Frontend
- React 19 + Vite 6
- Lucide React, CSS (responsive `1024px`/`720px` breakpoints)

### Backend
- Node.js ≥18, Express 4, Helmet (CORS `origin:true`), CORS
- Multer (disk, 10MB), Sharp, Tesseract.js 5 + `eng.traineddata` (5MB, local)

### Database
- MongoDB Atlas (optional — retrieval disabled if `MONGODB_URI` not set or placeholder)

### AI & OCR
- **LLM:** OpenRouter `openai/gpt-4o-mini` (text RAG), `qwen/qwen3-vl-32b-instruct` (vision validation/recognition/nutrition fallback) via `https://openrouter.ai/api/v1` + `HTTP-Referer`/`X-Title`
- **OCR:** Tesseract.js (local traineddata, `/tmp/tesseract-cache`)
- **RAG:** `@langchain/core`, `MongoKeywordRetriever`

### Deployment
- **Frontend:** Vercel `https://foodanalyzer-five.vercel.app`
- **Backend:** Render `https://food-analyzer-b7u4.onrender.com` (free tier, 120s timeout, keep-alive `9min` ping, `900px` client compress + `1024px` backend)

---

## 📂 Project Structure

```text
food-analyzer/

├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Packaged + Normal modes, camera (fixed race), wakeBackend + 3-retry, lifted normalResult
│   │   └── styles.css             # 1024px/720px responsive, side-by-side
│   └── package.json

├── backend/
│   ├── src/
│   │   ├── ai/
│   │   │   ├── clients/llmClient.js          # OpenRouter unified (nvidia+qwen), 1600→2200 retry, cache
│   │   │   ├── clients/groqClient.js         # Re-export → llmClient (compat)
│   │   │   ├── foodRecognition/              # Vision qwen, json_object retry
│   │   │   ├── foodValidation/               # NEW: isFood validation (non-food gate)
│   │   │   ├── chains/ragAnalysis.chain.js
│   │   │   ├── prompts/                      # ragAnalysis + normalFood
│   │   │   ├── retrievers/mongoKeywordRetriever.js
│   │   │   └── schemas/ {llmOutput, foodValidation}.js
│   │   ├── domain/
│   │   │   ├── ocr/ {tesseractWorker, imagePreprocessor (1024px), ocr.service (30s/55s), parsers, textNormalizer}
│   │   │   ├── scoring/ {healthScoreEngine (per-100g max), scoringRules, thresholds (per-100g + legacy), verdictMapper, ingredientQuality*}
│   │   │   └── nutrition/portionScaler.js
│   │   ├── data/nutritionDatabase.js         # 43 foods + generic fallback
│   │   ├── services/ {analysis.service (validation + vision fallback), normalFood.service (generic fallback), ragAnalysis.service}
│   │   ├── controllers/ {analysis, food (validation gate), health}
│   │   ├── middleware/ {upload, errorHandler}
│   │   ├── repositories/ {product, analysis, healthKnowledge}
│   │   └── config/env.js                    # OpenRouter only (Groq removed)
│   ├── knowledge/                   # RAG docs
│   ├── eng.traineddata              # 5MB, committed, local Tesseract
│   └── package.json
└── README.md
```

---

## ⚙️ Installation

### Clone
```bash
git clone <repository-url>
cd food-analyzer
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Backend Setup
```bash
cd backend
npm install
npm run dev
```

---

## 🔑 Environment Variables

**Backend `backend/.env` (OpenRouter only — Groq removed):**
```env
NODE_ENV=development
PORT=3002

MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/food_health_analyzer

# OpenRouter — https://openrouter.ai/keys (free tier: nvidia text + qwen vision)
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_VISION_MODEL=qwen/qwen3-vl-32b-instruct
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_SITE_URL=https://foodanalyzer-five.vercel.app
OPENROUTER_APP_NAME=AI Food Health Analyzer

RAG_TOP_K=5
KNOWLEDGE_DIR=./knowledge
MAX_FILE_SIZE_MB=10
UPLOAD_DIR=./uploads
```

Frontend `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:3002
# On Vercel: set VITE_API_BASE_URL=https://food-analyzer-b7u4.onrender.com
```

Render env: add the same `OPENROUTER_*` vars + `MONGODB_URI` if using RAG, then **Manual Deploy**.

---

## 📈 Health Scoring Logic (Updated)

Base `70` + bonuses − penalties (max of per-serving vs per-100g, normalized via `servingSize` grams):

- **Water** `250ml` 0 kcal → `95 Very Healthy` (special case)
- **Apple 150g** (natural sugar halved, fiber≥1.5 → +10) → `80 Very Healthy`
- **Coca-Cola 330ml** (35g sugar per serving) → `46 Unhealthy` (was 56 Moderately)
- **Lays 28g** (680mg/100g sodium) → `39 Unhealthy` (was 70 Healthy)
- **Granola 40g** (25g/100g sugar) → `44 Unhealthy`
- **Oatmeal 40g** → `80 Very Healthy`

See `backend/src/domain/scoring/healthScoreEngine.js:25` for `parseServingGrams` + `max(perServing,per100g)`.

---

## 👨‍💻 Author
Developed as an AI-powered nutrition analysis project combining OCR, vision AI, and full-stack web development.

---

## 📜 License
MIT

---

## 📝 Usage

### Packaged
1. `Packaged` tab → `Drop or upload label` or `Take Photo` (allow camera, HTTPS required)
2. Tight crop of nutrition table + ingredients, good light, flat label
3. `Analyze product` → health report appears **on right** (desktop) / below on phone

### Normal Food
1. `Normal Food` tab → `Upload meal photo` or `Take Photo` → `Recognize Food`
2. Edit names if needed, set portion (`small`/`medium`/`large` or grams/qty) → `Analyze meal` → report on **right**

### Camera
- Uses `environment` rear camera → `video:true` fallback, `muted` + `playsInline` + `autoPlay` for iOS
- Stable open until capture/close (fixed premature `useEffect` cleanup that closed after ~2s)
- Shows toasts for `NotAllowed` (lock icon → Allow), `NotFound`, `NotReadable`

### Non-Food Handling
- `Shampoo`/`shoes`/`laptop` → `This image does not appear to contain a food product` (`422 NON_FOOD_DETECTED`) — no health score
- Blurry/dark → `could not be confidently identified` (`422 UNCERTAIN_FOOD`)
- Nutrition not readable (confidence 7%) → `Nutrition table not readable` + `Try Normal Food mode` button; vision fallback tries to extract via `qwen` before failing

---

## 🔧 OCR Debugging
```bash
cd backend
npm run debug:ocr -- /path/to/product-image.png
```

---

## 📚 Knowledge Base Setup
Place `.txt` or `.md` files in `knowledge/<Category>/` then:
```bash
cd backend
npm run ingest:knowledge
```
Categories: `WHO Guidelines`, `FDA Guidelines`, `Food Additives`, `Sugar Research`, `Sodium Research`, `Saturated Fat Research`, `Nutrition Recommendations`
