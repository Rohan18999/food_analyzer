# 🥗 AI Food Health Analyzer

An AI-powered web application that analyzes packaged food products from images and determines whether they are healthy or unhealthy based on nutrition facts and ingredients.

Users can upload a food product image, and the system extracts nutrition information using OCR, calculates a health score, provides health insights, and recommends healthier alternatives.

---

## 🚀 Features

### 📸 Image-Based Analysis

- Upload food package images or capture photos using device camera
- OCR-based text extraction using Tesseract.js
- Automatic detection of:
  - Product Name
  - Ingredients
  - Nutrition Facts

### 🧠 AI-Powered Health Analysis

- Nutrition data extraction
- Ingredient analysis
- Deterministic health scoring engine
- AI-generated explanations
- Pros and Cons analysis
- Healthier alternative recommendations

### 📊 Health Score System

The application evaluates products based on:

- Sodium Content
- Sugar Content
- Saturated Fat
- Protein Content
- Dietary Fiber
- Other nutritional indicators

Example:

```json
{
  "healthScore": 72,
  "verdict": "Moderately Healthy"
}
```

---

## 🏗️ Architecture

```text
User Uploads Image
        │
        ▼
Express Backend
        │
        ▼
Tesseract OCR
        │
        ▼
Text Extraction
        │
        ▼
Structured Parsing
        │
        ▼
Health Score Engine
        │
        ▼
AI Analysis (LLM)
        │
        ▼
Results Dashboard
```

---

## 🛠️ Tech Stack

### Frontend

- React with Vite
- Lucide React for icons
- CSS for styling

### Backend

- Express.js
- Node.js

### Database

- MongoDB Atlas

### AI & OCR

- Tesseract.js
- Groq API for AI analysis
- Sharp for image preprocessing

### Deployment

- Vercel (Frontend)
- Render (Backend)

---

## 📂 Project Structure

```text
food-health-analyzer/

├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   └── styles.css
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── ai/              # RAG pipeline
│   │   ├── domain/          # OCR & scoring
│   │   ├── services/        # Business logic
│   │   ├── controllers/     # API endpoints
│   │   ├── middleware/      # Upload, error handling
│   │   ├── repositories/    # Data access
│   │   └── config/          # Configuration
│   ├── knowledge/           # Knowledge documents
│   └── package.json
│
└── README.md
```

---

## ⚙️ Installation

### Clone Repository

```bash
git clone <repository-url>
cd food-health-analyzer
```

---

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

---

### Backend Setup

```bash
cd backend
npm install
npm run dev
```

---

## 🔑 Environment Variables

Create a `.env` file in the backend directory.

```env
NODE_ENV=development
PORT=3002

MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/food_health_analyzer

GROQ_API_KEY=gsk-your-key-here
GROQ_MODEL=llama-3.1-8b-instant

RAG_TOP_K=5
KNOWLEDGE_DIR=./knowledge
MAX_FILE_SIZE_MB=10
UPLOAD_DIR=./uploads
```

### Frontend (.env)

```env
VITE_API_BASE_URL=http://localhost:3002
```

---

## 📈 Health Scoring Logic

The score starts at:

```text
100
```

Penalties:

- High Sodium
- High Sugar
- High Saturated Fat

Bonuses:

- High Protein
- High Fiber

Example:

```text
100
-15 (High Sodium)
-10 (High Sugar)
+5  (Protein)

Final Score = 80
```

---

## 👨‍💻 Author

Developed as an AI-powered nutrition analysis project combining OCR, AI, and full-stack web development.

---

## 📜 License

This project is licensed under the MIT License.

---

## 📝 Usage

### Upload Image

1. Click "Upload label image" to select a file
2. Or click "Take Photo" to use your device camera
3. Click "Analyze product" to get health analysis

### Camera Feature

- Uses device's rear camera (environment facing mode)
- Live preview with capture button
- Photos automatically convert to files for analysis
- Works on mobile devices and desktop with webcams

---

## 🔧 OCR Debugging

To inspect OCR output for a specific image:

```bash
cd backend
npm run debug:ocr -- /path/to/product-image.png
```

---

## 📚 Knowledge Base Setup

Place `.txt` or `.md` files in `knowledge/<Category>/` folders, then:

```bash
cd backend
npm run ingest:knowledge
```

Sample categories:

- WHO Guidelines
- FDA Guidelines
- Food Additives
- Sugar Research
- Sodium Research
- Saturated Fat Research
- Nutrition Recommendations
