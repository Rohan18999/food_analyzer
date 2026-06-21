import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import {
  Activity,
  AlertCircle,
  Apple,
  BadgeCheck,
  Camera,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  CircleAlert,
  FlaskConical,
  ImagePlus,
  Info,
  Leaf,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  X,
} from "lucide-react";

const DEFAULT_API_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3002";

function cleanBaseUrl(url) {
  return url.replace(/\/$/, "");
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function nutrientValue(nutrient, fallback = "Not found") {
  if (!nutrient || nutrient.amount == null) return fallback;
  return `${nutrient.amount}${nutrient.unit || ""}`;
}

function formatIngredientName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function scoreTone(score) {
  if (score >= 80) return "excellent";
  if (score >= 65) return "good";
  if (score >= 50) return "moderate";
  return "poor";
}

function StatusPill({ status, label }) {
  const Icon =
    status === "ready"
      ? CheckCircle2
      : status === "error"
        ? AlertCircle
        : Activity;

  return (
    <div className={`status-pill ${status}`}>
      <Icon size={15} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function MetricCard({ label, value, note, icon: Icon }) {
  return (
    <article className="metric">
      <div className="metric-label">
        {Icon ? <Icon size={15} aria-hidden="true" /> : null}
        <span>{label}</span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{note}</div>
    </article>
  );
}

function TextList({ items, emptyText, tone = "neutral" }) {
  const safeItems = items?.length ? items : [emptyText];

  return (
    <ul className={`clean-list ${tone}`}>
      {safeItems.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

function IngredientQuality({ breakdown }) {
  const quality = breakdown?.ingredientQuality;
  const matches = quality?.raw?.matches || [];

  if (!matches.length) {
    return (
      <div className="quiet-message">
        <BadgeCheck size={18} aria-hidden="true" />
        <span>
          No ingredient concerns were detected from the extracted list.
        </span>
      </div>
    );
  }

  return (
    <div className="ingredient-risk-grid">
      {matches.map((match, index) => (
        <div
          className="risk-card"
          key={`${match.ruleId}-${match.ingredient}-${index}`}
        >
          <div className="risk-icon">
            <FlaskConical size={18} aria-hidden="true" />
          </div>
          <div>
            <div className="risk-title">
              {formatIngredientName(match.ingredient)}
            </div>
            <div className="row-meta">
              {match.label} · {match.category} · ingredient #
              {match.ingredientIndex + 1}
            </div>
          </div>
          <span className="penalty">-{match.penalty}</span>
        </div>
      ))}
    </div>
  );
}

function Alternatives({ items }) {
  if (!items?.length) return <p>No alternatives returned.</p>;

  return (
    <div className="alternatives-list">
      {items.map((alternative, index) => (
        <article
          className="alternative-row"
          key={`${alternative.name}-${index}`}
        >
          <div className="row-top">
            <span>{alternative.name}</span>
            <Leaf size={16} aria-hidden="true" />
          </div>
          <div className="row-meta">{alternative.reason}</div>
        </article>
      ))}
    </div>
  );
}

function IngredientChips({ items }) {
  if (!items?.length) return <p>No ingredients extracted.</p>;

  return (
    <div className="ingredients-flow">
      {items.map((ingredient, index) => (
        <span className="ingredient-tag" key={`${ingredient}-${index}`}>
          <span className="ingredient-tag-number">{index + 1}</span>
          {formatIngredientName(ingredient)}
        </span>
      ))}
    </div>
  );
}

function Sources({ items }) {
  if (!items?.length) return <p>No sources returned.</p>;

  return (
    <div className="sources-list">
      {items.map((source, index) => (
        <article className="source-row" key={`${source.title}-${index}`}>
          <div className="row-top">
            <span>{source.title}</span>
            <span className="row-meta">
              {source.usedInExplanation ? "Used" : "Retrieved"}
            </span>
          </div>
          <div className="row-meta">{source.category}</div>
        </article>
      ))}
    </div>
  );
}

function ResultPanel({ result }) {
  const score = Number(result.healthScore || 0);
  const facts = result.product?.nutritionFacts || {};
  const breakdown = result.scoreBreakdown || {};
  const concerns = result.cons?.length
    ? result.cons
    : result.evidenceBasedRisks;
  const tone = scoreTone(score);
  const ingredientPenalty = breakdown.ingredientQuality?.penalty ?? 0;
  const totalPenalties = breakdown.totalPenalties ?? 0;
  const totalBonuses = breakdown.totalBonuses ?? 0;
  const extractionConfidence = Math.round(
    (result.extractionConfidence ?? 0) * 100,
  );

  const metrics = [
    {
      label: "Calories",
      value: facts.calories ?? "Not found",
      note: "per serving",
      icon: Activity,
    },
    {
      label: "Sugar",
      value: nutrientValue(facts.addedSugars || facts.totalSugars),
      note: `${breakdown.sugar?.penalty ?? 0} point penalty`,
      icon: CircleAlert,
    },
    {
      label: "Sodium",
      value: nutrientValue(facts.sodium),
      note: `${breakdown.sodium?.penalty ?? 0} point penalty`,
      icon: CircleAlert,
    },
    {
      label: "Sat Fat",
      value: nutrientValue(facts.saturatedFat),
      note: `${breakdown.saturatedFat?.penalty ?? 0} point penalty`,
      icon: CircleAlert,
    },
    {
      label: "Additives",
      value: `${ingredientPenalty}`,
      note: "point penalty",
      icon: FlaskConical,
    },
  ];

  return (
    <section className="result-content" aria-live="polite">
      <header className={`result-hero ${tone}`}>
        <div className="result-copy">
          <p className="eyebrow">Health Analysis</p>
          <div className="verdict-line">
            <Sparkles size={17} aria-hidden="true" />
            <span>{result.verdict || "Health verdict"}</span>
          </div>
          <p className="score-summary">
            {totalPenalties} penalty points, {totalBonuses} bonus points,{" "}
            {extractionConfidence}% extraction confidence.
          </p>
        </div>
        <div
          className="score-ring"
          style={{
            "--score-angle": `${Math.max(0, Math.min(100, score)) * 3.6}deg`,
          }}
        >
          <span>{Math.round(score)}</span>
          <small>/100</small>
        </div>
      </header>

      <div className="metrics-grid">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <section className="analysis-section primary-analysis">
        <h3>Explanation</h3>
        <p>{result.explanation || "No explanation returned."}</p>
      </section>

      <div className="report-grid">
        <section className="analysis-section report-card">
          <h3>Concerns</h3>
          <TextList
            items={concerns}
            emptyText="No concerns returned."
            tone="risk"
          />
        </section>
        <section className="analysis-section report-card">
          <h3>Positives</h3>
          <TextList
            items={result.pros}
            emptyText="No positives returned."
            tone="positive"
          />
        </section>
      </div>

      <section className="analysis-section">
        <div className="section-title-row">
          <div>
            <h3>Ingredient Quality</h3>
            <p>
              Flagged items are weighted by severity and position in the
              ingredient list.
            </p>
          </div>
          <span className="section-badge">{ingredientPenalty} penalty</span>
        </div>
        <IngredientQuality breakdown={breakdown} />
      </section>

      <section className="analysis-section">
        <h3>Better Alternatives</h3>
        <Alternatives items={result.alternatives} />
      </section>

      <section className="analysis-section">
        <h3>Sources</h3>
        <Sources items={result.retrievedSources} />
      </section>
    </section>
  );
}

export default function App() {
  const [apiBaseUrl] = useState(DEFAULT_API_URL);
  const [backendStatus, setBackendStatus] = useState({
    status: "",
    label: "Checking",
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [toast, setToast] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const fileMeta = useMemo(() => {
    if (!selectedFile) return "JPEG, PNG, or WebP";
    return `${selectedFile.name} | ${formatBytes(selectedFile.size)}`;
  }, [selectedFile]);

  const showToast = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 6000);
  }, []);

  const checkBackendStatus = useCallback(async () => {
    setBackendStatus({ status: "", label: "Checking" });

    try {
      const response = await fetch(
        `${cleanBaseUrl(apiBaseUrl)}/api/v1/health/ready`,
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = await response.json();
      const groqReady = payload?.services?.groq === "configured";
      setBackendStatus({
        status: groqReady ? "ready" : "error",
        label: groqReady ? "Ready" : "No Groq key",
      });
    } catch {
      setBackendStatus({ status: "error", label: "Offline" });
    }
  }, [apiBaseUrl]);

  const handleFile = useCallback((file) => {
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return URL.createObjectURL(file);
    });
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setCameraStream(stream);
      setShowCamera(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      showToast("Camera access denied or not available");
      console.error("Camera error:", error);
    }
  }, [showToast]);

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  }, [cameraStream]);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], "camera-photo.jpg", {
              type: "image/jpeg",
            });
            handleFile(file);
            stopCamera();
          }
        },
        "image/jpeg",
        0.95,
      );
    }
  }, [handleFile, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const submitAnalysis = async (event) => {
    event.preventDefault();

    if (!selectedFile) {
      showToast("Select a product image first.");
      return;
    }

    setIsAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);

      const response = await fetch(
        `${cleanBaseUrl(apiBaseUrl)}/api/v1/analysis`,
        {
          method: "POST",
          body: formData,
        },
      );

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.error?.message ||
            payload.message ||
            `Analysis failed with HTTP ${response.status}`,
        );
      }

      setResult(payload.data);
    } catch (error) {
      showToast(error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    checkBackendStatus();
  }, [checkBackendStatus]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <main className="app-shell">
      <section className="workspace" aria-label="Food health analyzer">
        <div className="input-pane">
          <header className="pane-header">
            <div>
              <p className="eyebrow">Product Health Analyzer</p>
              <h1>Scan a packaged food label</h1>
              <p className="pane-subtitle">
                Upload a clear photo of the nutrition table and ingredients
                panel.
              </p>
            </div>
            <div className="status-stack">
              <StatusPill {...backendStatus} />
              <button
                className="ghost-icon-button"
                type="button"
                onClick={checkBackendStatus}
                aria-label="Refresh backend status"
                title="Refresh backend status"
              >
                <RefreshCw size={16} aria-hidden="true" />
              </button>
            </div>
          </header>

          <form className="upload-form" onSubmit={submitAnalysis}>
            <div className="upload-options">
              <label
                className={`drop-zone ${isDragging ? "dragging" : ""}`}
                htmlFor="imageInput"
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  handleFile(event.dataTransfer.files?.[0]);
                }}
              >
                <input
                  id="imageInput"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => handleFile(event.target.files?.[0])}
                />
                <span className="drop-icon" aria-hidden="true">
                  <ImagePlus size={24} />
                </span>
                <span className="drop-title">Upload label image</span>
                <span className="drop-meta">{fileMeta}</span>
              </label>

              <button
                type="button"
                className="camera-button"
                onClick={startCamera}
                aria-label="Open camera"
              >
                <Camera size={24} aria-hidden="true" />
                <span>Take Photo</span>
              </button>
            </div>

            <div className="preview-frame">
              {previewUrl ? (
                <img src={previewUrl} alt="Selected product label preview" />
              ) : (
                <div className="preview-placeholder">
                  <Upload size={34} aria-hidden="true" />
                </div>
              )}
            </div>

            <button
              className="primary-button"
              type="submit"
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="spin" size={18} aria-hidden="true" />
                  Analyzing...
                </>
              ) : (
                "Analyze product"
              )}
            </button>
          </form>
        </div>

        <div className="result-pane">
          {result ? (
            <ResultPanel result={result} />
          ) : (
            <div className="empty-state">
              <div className="empty-icon">
                <Apple size={42} aria-hidden="true" />
              </div>
              <p className="eyebrow">Ready</p>
              <h2>Your health report will appear here.</h2>
              <p>
                The app extracts nutrition facts, checks ingredients, scores the
                product, and explains the tradeoffs.
              </p>
            </div>
          )}
        </div>
      </section>

      {toast ? (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}

      {showCamera && (
        <div className="camera-modal">
          <div className="camera-overlay">
            <button
              className="camera-close"
              onClick={stopCamera}
              aria-label="Close camera"
            >
              <X size={24} aria-hidden="true" />
            </button>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-feed"
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />
            <button
              className="camera-capture"
              onClick={capturePhoto}
              aria-label="Capture photo"
            >
              <div className="camera-capture-button" />
            </button>
            <p className="camera-instruction">
              Position the nutrition label in the frame
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
