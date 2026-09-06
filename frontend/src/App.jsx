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
  CheckCircle2,
  CircleAlert,
  FlaskConical,
  ImagePlus,
  Leaf,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  X,
  Utensils,
  Package,
  Search,
  Plus,
  Trash2,
  Scale,
  Info,
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
        <span>No ingredient concerns were detected from the extracted list.</span>
      </div>
    );
  }
  return (
    <div className="ingredient-risk-grid">
      {matches.map((match, index) => (
        <div className="risk-card" key={`${match.ruleId}-${match.ingredient}-${index}`}>
          <div className="risk-icon">
            <FlaskConical size={18} aria-hidden="true" />
          </div>
          <div>
            <div className="risk-title">{formatIngredientName(match.ingredient)}</div>
            <div className="row-meta">{match.label} · {match.category} · ingredient #{match.ingredientIndex + 1}</div>
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
        <article className="alternative-row" key={`${alternative.name}-${index}`}>
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

function Sources({ items }) {
  if (!items?.length) return <p>No sources returned.</p>;
  return (
    <div className="sources-list">
      {items.map((source, index) => (
        <article className="source-row" key={`${source.title}-${index}`}>
          <div className="row-top">
            <span>{source.title}</span>
            <span className="row-meta">{source.usedInExplanation ? "Used" : "Retrieved"}</span>
          </div>
          <div className="row-meta">{source.category}</div>
        </article>
      ))}
    </div>
  );
}

function ResultPanel({ result }) {
  const score = Number(result.healthScore || 0);
  const facts = result.product?.nutritionFacts || result.nutritionFacts || {};
  const breakdown = result.scoreBreakdown || {};
  const concerns = result.cons?.length ? result.cons : result.evidenceBasedRisks;
  const tone = scoreTone(score);
  const ingredientPenalty = breakdown.ingredientQuality?.penalty ?? 0;
  const totalPenalties = breakdown.totalPenalties ?? 0;
  const totalBonuses = breakdown.totalBonuses ?? 0;
  const extractionConfidence = Math.round((result.extractionConfidence ?? 0) * 100);
  const isEstimated = result.isEstimated || result.nutritionFacts?.isEstimated;

  const metrics = [
    { label: "Calories", value: facts.calories ?? "Not found", note: isEstimated ? "estimated" : "per serving", icon: Activity },
    { label: "Sugar", value: nutrientValue(facts.addedSugars || facts.totalSugars), note: `${breakdown.sugar?.penalty ?? 0} penalty`, icon: CircleAlert },
    { label: "Sodium", value: nutrientValue(facts.sodium), note: `${breakdown.sodium?.penalty ?? 0} penalty`, icon: CircleAlert },
    { label: "Sat Fat", value: nutrientValue(facts.saturatedFat), note: `${breakdown.saturatedFat?.penalty ?? 0} penalty`, icon: CircleAlert },
    { label: "Additives", value: `${ingredientPenalty}`, note: "penalty", icon: FlaskConical },
  ];

  return (
    <section className="result-content" aria-live="polite">
      {isEstimated && (
        <div className="estimated-banner">
          <Info size={16} aria-hidden="true" />
          <span><strong>Estimated Nutrition</strong> — values may vary depending on preparation and portion size.</span>
        </div>
      )}
      <header className={`result-hero ${tone}`}>
        <div className="result-copy">
          <p className="eyebrow">{isEstimated ? "Meal Analysis" : "Health Analysis"}</p>
          <div className="verdict-line">
            <Sparkles size={17} aria-hidden="true" />
            <span>{result.verdict || "Health verdict"}</span>
          </div>
          <p className="score-summary">
            {totalPenalties} penalty points, {totalBonuses} bonus points{isEstimated ? "" : `, ${extractionConfidence}% extraction confidence`}.
            {result.foods ? ` · ${result.foods.map((f) => `${f.foodName} ${f.grams}g`).join(" + ")}` : ""}
          </p>
        </div>
        <div className="score-ring" style={{ "--score-angle": `${Math.max(0, Math.min(100, score)) * 3.6}deg` }}>
          <span>{Math.round(score)}</span>
          <small>/100</small>
        </div>
      </header>

      <div className="metrics-grid">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      {result.foods && (
        <section className="analysis-section">
          <h3>Estimated Nutrition {isEstimated && <span className="section-badge" style={{ marginLeft: 8 }}>Estimated</span>}</h3>
          <div className="alternatives-list">
            {result.foods.map((f, i) => (
              <article key={i} className="alternative-row">
                <div className="row-top"><span>{f.foodName}</span><span className="row-meta">{f.grams}g · {f.portionSource}</span></div>
                <div className="row-meta">{f.calories} kcal · {f.protein}g protein · {f.carbs}g carbs · {f.fat}g fat · {f.fiber}g fiber · {f.sodium}mg sodium</div>
              </article>
            ))}
          </div>
          <div className="row-meta" style={{ marginTop: 8 }}>Total: {facts.calories} kcal · Per-serving estimate</div>
        </section>
      )}

      <section className="analysis-section primary-analysis">
        <h3>Explanation</h3>
        <p>{result.explanation || "No explanation returned."}</p>
      </section>

      <div className="report-grid">
        <section className="analysis-section report-card">
          <h3>Concerns</h3>
          <TextList items={concerns} emptyText="No concerns returned." tone="risk" />
        </section>
        <section className="analysis-section report-card">
          <h3>Positives</h3>
          <TextList items={result.pros} emptyText="No positives returned." tone="positive" />
        </section>
      </div>

      {!isEstimated && (
        <section className="analysis-section">
          <div className="section-title-row">
            <div>
              <h3>Ingredient Quality</h3>
              <p>Flagged items are weighted by severity and position in the ingredient list.</p>
            </div>
            <span className="section-badge">{ingredientPenalty} penalty</span>
          </div>
          <IngredientQuality breakdown={breakdown} />
        </section>
      )}

      <section className="analysis-section">
        <h3>{isEstimated ? "Healthier Suggestions" : "Better Alternatives"}</h3>
        <Alternatives items={result.alternatives} />
      </section>

      <section className="analysis-section">
        <h3>Sources</h3>
        <Sources items={result.retrievedSources} />
      </section>
    </section>
  );
}

function NormalFoodFlow({ apiBaseUrl, showToast }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedFoods, setDetectedFoods] = useState([]); // [{name, confidence, portion:{size, grams, quantity}}]
  const [manualInput, setManualInput] = useState("");
  const [result, setResult] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file) return;
    setSelectedFile(file);
    setDetectedFoods([]);
    setResult(null);
    setPreviewUrl((cur) => {
      if (cur) URL.revokeObjectURL(cur);
      return URL.createObjectURL(file);
    });
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCameraStream(stream);
      setShowCamera(true);
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
    } catch (e) { showToast("Camera access denied or not available"); }
  }, [showToast]);

  const stopCamera = useCallback(() => {
    if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
    setCameraStream(null); setShowCamera(false);
  }, [cameraStream]);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current, canvas = canvasRef.current;
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d"); ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) { const file = new File([blob], "camera-photo.jpg", { type: "image/jpeg" }); handleFile(file); stopCamera(); }
      }, "image/jpeg", 0.95);
    }
  }, [handleFile, stopCamera]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => () => { stopCamera(); }, [stopCamera]);

  const recognize = async () => {
    if (!selectedFile) { showToast("Select a meal photo first."); return; }
    setIsRecognizing(true);
    try {
      const fd = new FormData(); fd.append("image", selectedFile);
      const res = await fetch(`${cleanBaseUrl(apiBaseUrl)}/api/v1/food/recognize`, { method: "POST", body: fd });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) throw new Error(payload.error?.message || `Recognition failed ${res.status}`);
      const foods = payload.data.foods || [];
      if (!foods.length) { showToast("No food detected. Try adding items manually below."); setDetectedFoods([{ name: "", confidence: 0, portion: { size: "medium", grams: "", quantity: "" } }]); }
      else setDetectedFoods(foods.map((f) => ({ name: f.name, confidence: f.confidence, portion: { size: "medium", grams: "", quantity: "" } })));
    } catch (e) { showToast(e.message); } finally { setIsRecognizing(false); }
  };

  const updateFood = (idx, patch) => {
    setDetectedFoods((prev) => prev.map((f, i) => i === idx ? { ...f, ...patch } : f));
  };
  const updatePortion = (idx, patch) => {
    setDetectedFoods((prev) => prev.map((f, i) => i === idx ? { ...f, portion: { ...f.portion, ...patch } } : f));
  };
  const removeFood = (idx) => setDetectedFoods((prev) => prev.filter((_, i) => i !== idx));
  const addManual = () => {
    if (!manualInput.trim()) return;
    setDetectedFoods((prev) => [...prev, { name: manualInput.trim(), confidence: 1, portion: { size: "medium", grams: "", quantity: "" } }]);
    setManualInput("");
  };

  const analyze = async (e) => {
    e.preventDefault();
    const foods = detectedFoods.filter((f) => f.name.trim()).map((f) => ({
      name: f.name.trim(),
      portion: {
        size: f.portion.size || undefined,
        grams: f.portion.grams ? Number(f.portion.grams) : undefined,
        quantity: f.portion.quantity ? Number(f.portion.quantity) : undefined,
      },
    }));
    if (!foods.length) { showToast("Add at least one food item."); return; }
    setIsAnalyzing(true);
    try {
      const res = await fetch(`${cleanBaseUrl(apiBaseUrl)}/api/v1/food/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foods }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) throw new Error(payload.error?.message || `Analysis failed ${res.status}`);
      setResult(payload.data);
    } catch (err) { showToast(err.message); } finally { setIsAnalyzing(false); }
  };

  const fileMeta = useMemo(() => selectedFile ? `${selectedFile.name} | ${formatBytes(selectedFile.size)}` : "JPEG, PNG, or WebP", [selectedFile]);

  return (
    <>
      <div className="upload-options">
        <label className={`drop-zone ${isDragging ? "dragging" : ""}`} htmlFor="normalImageInput"
          onDragOver={(ev) => { ev.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(ev) => { ev.preventDefault(); setIsDragging(false); handleFile(ev.dataTransfer.files?.[0]); }}>
          <input id="normalImageInput" type="file" accept="image/jpeg,image/png,image/webp" onChange={(ev) => handleFile(ev.target.files?.[0])} />
          <span className="drop-icon"><ImagePlus size={24} /></span>
          <span className="drop-title">Upload meal photo</span>
          <span className="drop-meta">{fileMeta}</span>
        </label>
        <button type="button" className="camera-button" onClick={startCamera}><Camera size={24} /><span>Take Photo</span></button>
      </div>

      <div className="preview-frame">
        {previewUrl ? <img src={previewUrl} alt="Meal preview" /> : <div className="preview-placeholder"><Utensils size={34} /></div>}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button className="primary-button" style={{ flex: 1 }} type="button" onClick={recognize} disabled={!selectedFile || isRecognizing}>
          {isRecognizing ? <><Loader2 className="spin" size={18} /> Recognizing...</> : <><Search size={18} /> Recognize Food</>}
        </button>
        {detectedFoods.length > 0 && <button className="ghost-icon-button" type="button" title="Clear" onClick={() => setDetectedFoods([])} style={{ width: 50, height: 50 }}><Trash2 size={18} /></button>}
      </div>

      {detectedFoods.length > 0 && (
        <form onSubmit={analyze} className="normal-food-form">
          <div className="analysis-section" style={{ borderTop: 0, paddingTop: 0 }}>
            <div className="section-title-row">
              <div><h3>Detected Foods</h3><p>Edit names and set portion for each item.</p></div>
              <span className="section-badge">{detectedFoods.length} items</span>
            </div>

            <div className="alternatives-list">
              {detectedFoods.map((food, idx) => (
                <article key={idx} className="alternative-row" style={{ gap: 10 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input className="portion-input" value={food.name} onChange={(e) => updateFood(idx, { name: e.target.value })} placeholder="Food name e.g. Chicken Biryani" style={{ flex: 1 }} />
                    <button type="button" className="ghost-icon-button" onClick={() => removeFood(idx)} style={{ width: 34, height: 34, flexShrink: 0 }}><X size={16} /></button>
                  </div>
                  {food.confidence > 0 && food.confidence < 1 && <div className="row-meta">Recognition: {Math.round(food.confidence * 100)}%</div>}
                  <div className="portion-controls">
                    <div className="portion-row">
                      <span className="row-meta" style={{ minWidth: 52 }}><Scale size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />Size</span>
                      <div className="size-options">
                        {["small", "medium", "large"].map((s) => (
                          <label key={s} className={`size-pill ${food.portion.size === s ? "active" : ""}`}>
                            <input type="radio" name={`size-${idx}`} checked={food.portion.size === s} onChange={() => updatePortion(idx, { size: s })} />
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="portion-row">
                      <input className="portion-input small" type="number" min="1" placeholder="Grams e.g. 350" value={food.portion.grams} onChange={(e) => updatePortion(idx, { grams: e.target.value })} />
                      <span className="row-meta">g</span>
                      <input className="portion-input small" type="number" min="1" placeholder="Qty" value={food.portion.quantity} onChange={(e) => updatePortion(idx, { quantity: e.target.value })} />
                      <span className="row-meta">pcs</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input className="portion-input" value={manualInput} onChange={(e) => setManualInput(e.target.value)} placeholder="Add food manually e.g. Raita" style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addManual(); } }} />
              <button type="button" className="primary-button" onClick={addManual} style={{ height: 40, padding: "0 14px", marginTop: 0 }}><Plus size={16} /> Add</button>
            </div>
          </div>

          <div className="estimated-banner" style={{ marginTop: 4 }}>
            <Info size={16} /><span>Portion helps estimate nutrition. Choose size or enter grams/qty. Nutrition is <strong>estimated</strong>.</span>
          </div>

          <button className="primary-button" type="submit" disabled={isAnalyzing}>
            {isAnalyzing ? <><Loader2 className="spin" size={18} /> Analyzing meal...</> : "Analyze meal"}
          </button>
        </form>
      )}

      {!detectedFoods.length && (
        <div style={{ display: "flex", gap: 8 }}>
          <input className="portion-input" value={manualInput} onChange={(e) => setManualInput(e.target.value)} placeholder="Or type food name e.g. Dosa" style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addManual(); } }} />
          <button type="button" className="primary-button" onClick={() => { if (manualInput.trim()) { setDetectedFoods([{ name: manualInput.trim(), confidence: 1, portion: { size: "medium", grams: "", quantity: "" } }]); setManualInput(""); } }} style={{ height: 40, padding: "0 14px", marginTop: 0 }}><Plus size={16} /> Add</button>
        </div>
      )}

      {showCamera && (
        <div className="camera-modal">
          <div className="camera-overlay">
            <button className="camera-close" onClick={stopCamera}><X size={24} /></button>
            <video ref={videoRef} autoPlay playsInline muted className="camera-feed" />
            <canvas ref={canvasRef} style={{ display: "none" }} />
            <button className="camera-capture" onClick={capturePhoto}><div className="camera-capture-button" /></button>
            <p className="camera-instruction">Position the meal in the frame</p>
          </div>
        </div>
      )}

      {result && (
        <div className="result-pane" style={{ marginTop: 18, padding: 0, boxShadow: "none", border: "none", background: "transparent" }}>
          <ResultPanel result={result} />
        </div>
      )}
    </>
  );
}

export default function App() {
  const [apiBaseUrl] = useState(DEFAULT_API_URL);
  const [backendStatus, setBackendStatus] = useState({ status: "", label: "Checking" });
  const [mode, setMode] = useState("packaged"); // packaged | normal
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
      const response = await fetch(`${cleanBaseUrl(apiBaseUrl)}/api/v1/health/ready`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const groqReady = payload?.services?.groq === "configured";
      setBackendStatus({ status: groqReady ? "ready" : "error", label: groqReady ? "Ready" : "No Groq key" });
    } catch { setBackendStatus({ status: "error", label: "Offline" }); }
  }, [apiBaseUrl]);

  const handleFile = useCallback((file) => {
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl((cur) => { if (cur) URL.revokeObjectURL(cur); return URL.createObjectURL(file); });
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCameraStream(stream); setShowCamera(true);
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
    } catch (error) { showToast("Camera access denied or not available"); console.error(error); }
  }, [showToast]);

  const stopCamera = useCallback(() => {
    if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
    setCameraStream(null); setShowCamera(false);
  }, [cameraStream]);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current, canvas = canvasRef.current;
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d"); ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) { const file = new File([blob], "camera-photo.jpg", { type: "image/jpeg" }); handleFile(file); stopCamera(); }
      }, "image/jpeg", 0.95);
    }
  }, [handleFile, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const submitAnalysis = async (event) => {
    event.preventDefault();
    if (!selectedFile) { showToast("Select a product image first."); return; }
    setIsAnalyzing(true);
    try {
      const formData = new FormData(); formData.append("image", selectedFile);
      const response = await fetch(`${cleanBaseUrl(apiBaseUrl)}/api/v1/analysis`, { method: "POST", body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error?.message || payload.message || `Analysis failed ${response.status}`);
      setResult(payload.data);
    } catch (error) { showToast(error.message); } finally { setIsAnalyzing(false); }
  };

  useEffect(() => { checkBackendStatus(); }, [checkBackendStatus]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  return (
    <main className="app-shell">
      <section className="workspace" aria-label="Food health analyzer">
        <div className="input-pane">
          <header className="pane-header">
            <div>
              <p className="eyebrow">Food Health Analyzer</p>
              <h1>{mode === "packaged" ? "Scan a packaged food label" : "Analyze your meal"}</h1>
              <p className="pane-subtitle">
                {mode === "packaged" ? "Upload a clear photo of the nutrition table and ingredients panel." : "Upload a meal photo, confirm foods, and set portion."}
              </p>
            </div>
            <div className="status-stack">
              <StatusPill {...backendStatus} />
              <button className="ghost-icon-button" type="button" onClick={checkBackendStatus} aria-label="Refresh"><RefreshCw size={16} /></button>
            </div>
          </header>

          <div className="mode-toggle">
            <button type="button" className={`mode-card ${mode === "packaged" ? "active" : ""}`} onClick={() => { setMode("packaged"); setResult(null); }}>
              <Package size={20} />
              <div><span className="mode-title">Packaged Food</span><span className="mode-desc">Scan nutrition label</span></div>
            </button>
            <button type="button" className={`mode-card ${mode === "normal" ? "active" : ""}`} onClick={() => { setMode("normal"); setResult(null); }}>
              <Utensils size={20} />
              <div><span className="mode-title">Normal Food</span><span className="mode-desc">Analyze your meal</span></div>
            </button>
          </div>

          {mode === "packaged" ? (
            <form className="upload-form" onSubmit={submitAnalysis}>
              <div className="upload-options">
                <label className={`drop-zone ${isDragging ? "dragging" : ""}`} htmlFor="imageInput"
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files?.[0]); }}>
                  <input id="imageInput" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleFile(e.target.files?.[0])} />
                  <span className="drop-icon"><ImagePlus size={24} /></span>
                  <span className="drop-title">Upload label image</span>
                  <span className="drop-meta">{fileMeta}</span>
                </label>
                <button type="button" className="camera-button" onClick={startCamera}><Camera size={24} /><span>Take Photo</span></button>
              </div>
              <div className="preview-frame">
                {previewUrl ? <img src={previewUrl} alt="Label preview" /> : <div className="preview-placeholder"><Upload size={34} /></div>}
              </div>
              <button className="primary-button" type="submit" disabled={isAnalyzing}>
                {isAnalyzing ? <><Loader2 className="spin" size={18} /> Analyzing...</> : "Analyze product"}
              </button>
            </form>
          ) : (
            <div className="upload-form" style={{ gap: 14 }}>
              <NormalFoodFlow apiBaseUrl={apiBaseUrl} showToast={showToast} />
            </div>
          )}
        </div>

        <div className="result-pane">
          {mode === "packaged" ? (
            result ? <ResultPanel result={result} /> : (
              <div className="empty-state">
                <div className="empty-icon"><Apple size={42} /></div>
                <p className="eyebrow">Ready</p>
                <h2>Your health report will appear here.</h2>
                <p>The app extracts nutrition facts, checks ingredients, scores the product, and explains the tradeoffs.</p>
              </div>
            )
          ) : (
            // Normal mode results are rendered inside NormalFoodFlow; show placeholder if no result yet outside? Keep pane for packaged-size consistency but hide duplicate
            <div className="empty-state">
              <div className="empty-icon"><Utensils size={42} /></div>
              <p className="eyebrow">Normal Food</p>
              <h2>Meal analysis appears on the left.</h2>
              <p>After recognizing food and setting portion, your estimated nutrition, health score, and AI explanation will show inline. Packaged results appear here.</p>
            </div>
          )}
        </div>
      </section>

      {toast ? <div className="toast" role="status">{toast}</div> : null}

      {showCamera && mode === "packaged" && (
        <div className="camera-modal">
          <div className="camera-overlay">
            <button className="camera-close" onClick={stopCamera}><X size={24} /></button>
            <video ref={videoRef} autoPlay playsInline muted className="camera-feed" />
            <canvas ref={canvasRef} style={{ display: "none" }} />
            <button className="camera-capture" onClick={capturePhoto}><div className="camera-capture-button" /></button>
            <p className="camera-instruction">Position the nutrition label in the frame</p>
          </div>
        </div>
      )}
    </main>
  );
}
