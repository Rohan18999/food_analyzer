import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
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
  ShieldCheck,
  HeartPulse,
  Salad,
} from "lucide-react";

const RENDER_API_URL = "https://food-analyzer-b7u4.onrender.com";
const DEFAULT_API_URL = import.meta.env.VITE_API_BASE_URL || RENDER_API_URL;
function cleanBaseUrl(url) { return String(url || "").replace(/\/$/, ""); }
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function nutrientValue(nutrient, fallback = "Not found") {
  if (!nutrient || nutrient.amount == null) return fallback;
  return `${nutrient.amount}${nutrient.unit || ""}`;
}
function formatIngredientName(v) {
  return String(v || "").replace(/\s+/g, " ").trim().replace(/\b\w/g, (l) => l.toUpperCase());
}
function scoreTone(score) {
  if (score >= 80) return "excellent";
  if (score >= 65) return "good";
  if (score >= 50) return "moderate";
  return "poor";
}

function StatusPill({ status, label }) {
  const Icon = status === "ready" ? CheckCircle2 : status === "error" ? AlertCircle : Activity;
  return (
    <div className={`status-pill ${status}`}>
      <Icon size={14} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function MetricCard({ label, value, note, icon: Icon }) {
  return (
    <article className="metric">
      <div className="metric-label">
        {Icon ? <Icon size={13} aria-hidden="true" /> : null}
        <span>{label}</span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{note}</div>
    </article>
  );
}

function TextList({ items, emptyText, tone = "neutral" }) {
  const safe = items?.length ? items : [emptyText];
  return (
    <ul className={`clean-list ${tone}`}>
      {safe.map((item, i) => <li key={`${item}-${i}`}>{item}</li>)}
    </ul>
  );
}

function IngredientQuality({ breakdown }) {
  const matches = breakdown?.ingredientQuality?.raw?.matches || [];
  if (!matches.length) {
    return (
      <div className="quiet-message">
        <BadgeCheck size={16} />
        <span>No ingredient concerns were detected from the extracted list.</span>
      </div>
    );
  }
  return (
    <div className="ingredient-risk-grid">
      {matches.map((m, i) => (
        <div className="risk-card" key={`${m.ruleId}-${m.ingredient}-${i}`}>
          <div className="risk-icon"><FlaskConical size={16} /></div>
          <div>
            <div className="risk-title">{formatIngredientName(m.ingredient)}</div>
            <div className="row-meta">{m.label} · {m.category} · #{m.ingredientIndex + 1}</div>
          </div>
          <span className="penalty">-{m.penalty}</span>
        </div>
      ))}
    </div>
  );
}

function Alternatives({ items }) {
  if (!items?.length) return <p>No alternatives returned.</p>;
  return (
    <div className="alternatives-list">
      {items.map((a, i) => (
        <article className="alternative-row" key={`${a.name}-${i}`}>
          <div className="row-top"><span>{a.name}</span><Leaf size={15} /></div>
          <div className="row-meta">{a.reason}</div>
        </article>
      ))}
    </div>
  );
}

function Sources({ items }) {
  if (!items?.length) return <p>No sources returned.</p>;
  return (
    <div className="sources-list">
      {items.map((s, i) => (
        <article className="source-row" key={`${s.title}-${i}`}>
          <div className="row-top"><span>{s.title}</span><span className="row-meta">{s.usedInExplanation ? "Used" : "Retrieved"}</span></div>
          <div className="row-meta">{s.category}</div>
        </article>
      ))}
    </div>
  );
}

function FallbackBanner({ reason }) {
  if (!reason) return null;
  const isMissingKey = reason.code === 'LLM_NOT_CONFIGURED';
  return (
    <div className="estimated-banner" style={{ borderColor: isMissingKey ? '#fbbf24' : '#f87171', background: isMissingKey ? 'linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%)' : 'linear-gradient(135deg,#fef2f2 0%,#fee2e2 100%)', color: isMissingKey ? '#92400e' : '#991b1b' }}>
      <Info size={16} />
      <span>
        {isMissingKey ? (
          <><strong>AI explanation unavailable</strong> — GROQ_API_KEY not set. Deterministic score shown. Add it to <code>backend/.env</code> and restart to enable Groq insights.</>
        ) : (
          <><strong>AI fallback active</strong> — {reason.message || 'Groq temporarily unavailable.'} Score is still accurate.</>
        )}
      </span>
    </div>
  );
}

async function compressImage(file, maxWidth = 900, quality = 0.70) {
  if (!file || !file.type.startsWith('image/')) return file;
  if (file.size < 400 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxWidth / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1 && file.size < 700 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

// Render free tier sleeps after ~15min idle — cold boot takes 30-50s.
// Poll /health/ready with long per-attempt timeout so we actually wait for wake
// instead of fast-failing with "Failed to fetch". Total budget ~60s.
async function wakeBackend(base, showToast, opts = {}) {
  const { silent = false, maxMs = 60000 } = opts;
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < maxMs) {
    attempt++;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000); // Render wake needs ~15s per hit
      const r = await fetch(`${base}/api/v1/health/ready`, { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(t);
      if (r.ok) {
        if (attempt > 1 && !silent) showToast('Backend awake — continuing…', 3000);
        return true;
      }
    } catch {
      // network error or abort — backend still waking
    }
    if (Date.now() - start >= maxMs) break;
    if (!silent) {
      const elapsed = Math.round((Date.now() - start) / 1000);
      showToast(`Waking backend… (${elapsed}s) — Render free tier sleeps after 15 min, first hit can take 30-50s. Keep tab open…`, 6000);
    }
    await new Promise((res) => setTimeout(res, 2500));
  }
  return false;
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
  const isEstimated = result.isEstimated || result.nutritionFacts?.isEstimated;

  const metrics = [
    { label: "Calories", value: facts.calories ?? "—", note: isEstimated ? "estimated" : "per serving", icon: Activity },
    { label: "Sugar", value: nutrientValue(facts.addedSugars || facts.totalSugars), note: `${breakdown.sugar?.penalty ?? 0} penalty`, icon: CircleAlert },
    { label: "Sodium", value: nutrientValue(facts.sodium), note: `${breakdown.sodium?.penalty ?? 0} penalty`, icon: CircleAlert },
    { label: "Sat Fat", value: nutrientValue(facts.saturatedFat), note: `${breakdown.saturatedFat?.penalty ?? 0} penalty`, icon: CircleAlert },
    { label: "Additives", value: `${ingredientPenalty}`, note: "penalty", icon: FlaskConical },
  ];

  return (
    <section className="result-content" aria-live="polite">
      {(result.isFallback || result.fallbackReason) && <FallbackBanner reason={result.fallbackReason} />}
      {isEstimated && (
        <div className="estimated-banner">
          <Info size={16} />
          <span><strong>Estimated nutrition</strong> — values vary by recipe, oil, and portion. Use as a helpful guide, not a lab measurement.</span>
        </div>
      )}

      <header className={`result-hero ${tone}`}>
        <div className="result-copy">
          <p className="eyebrow">{isEstimated ? "Meal Analysis" : "Lab-style Analysis"}</p>
          <div className="verdict-line"><Sparkles size={16} /><span>{result.verdict || "Health verdict"}</span></div>
          <p className="score-summary">
            {totalPenalties} penalty · {totalBonuses} bonus {result.foods ? `· ${result.foods.map((f) => `${f.foodName} ${f.grams}g`).join(" + ")}` : !isEstimated ? `· ${Math.round((result.extractionConfidence ?? 0) * 100)}% confidence` : ""}
          </p>
        </div>
        <div className="score-ring" style={{ "--score-angle": `${Math.max(0, Math.min(100, score)) * 3.6}deg` }}>
          <span>{Math.round(score)}</span><small>/100</small>
        </div>
      </header>

      <div className="metrics-grid">
        {metrics.map((m) => <MetricCard key={m.label} {...m} />)}
      </div>

      {result.foods && (
        <section className="analysis-section" style={{ borderTop: 0, paddingTop: 0 }}>
          <div className="section-title-row">
            <div><h3>Estimated nutrition</h3><p>Scaled deterministically from our food database.</p></div>
            <span className="section-badge">Estimated</span>
          </div>
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
        <h3>What this means</h3>
        <p>{result.explanation || "No explanation returned."}</p>
      </section>

      <div className="report-grid">
        <section className="analysis-section report-card">
          <h3>Watch out</h3>
          <TextList items={concerns} emptyText="No concerns returned." tone="risk" />
        </section>
        <section className="analysis-section report-card">
          <h3>Strengths</h3>
          <TextList items={result.pros} emptyText="No positives returned." tone="positive" />
        </section>
      </div>

      {!isEstimated && (
        <section className="analysis-section">
          <div className="section-title-row">
            <div><h3>Ingredient quality</h3><p>Weighted by severity and position in the list.</p></div>
            <span className="section-badge">{ingredientPenalty} penalty</span>
          </div>
          <IngredientQuality breakdown={breakdown} />
        </section>
      )}

      <section className="analysis-section">
        <h3>{isEstimated ? "Make it healthier" : "Better alternatives"}</h3>
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
  const [detectedFoods, setDetectedFoods] = useState([]);
  const [manualInput, setManualInput] = useState("");
  const [result, setResult] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file) return;
    setSelectedFile(file);
    setDetectedFoods([]);
    setResult(null);
    setPreviewUrl((cur) => { if (cur) URL.revokeObjectURL(cur); return URL.createObjectURL(file); });
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCameraStream(stream); setShowCamera(true);
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
    } catch { showToast("Camera access denied or not available"); }
  }, [showToast]);

  const stopCamera = useCallback(() => {
    if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
    setCameraStream(null); setShowCamera(false);
  }, [cameraStream]);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const v = videoRef.current, c = canvasRef.current;
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
      c.toBlob((blob) => {
        if (blob) { const file = new File([blob], "camera-photo.jpg", { type: "image/jpeg" }); handleFile(file); stopCamera(); }
      }, "image/jpeg", 0.95);
    }
  }, [handleFile, stopCamera]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => () => { stopCamera(); }, [stopCamera]);

  const recognize = async () => {
    if (!selectedFile) { showToast("Select a meal photo first."); return; }
    setIsRecognizing(true);
    const base = cleanBaseUrl(apiBaseUrl);
    // Don't block recognize on full 60s wake — 20s quick wake is enough, then POST will retry
    await wakeBackend(base, showToast, { maxMs: 20000 });
    for (let attempt = 1; attempt <= 3; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000);
      try {
        const compressed = await compressImage(selectedFile, 900, 0.70);
        const fd = new FormData(); fd.append("image", compressed);
        const res = await fetch(`${base}/api/v1/food/recognize`, { method: "POST", body: fd, signal: controller.signal, cache: 'no-store' });
        clearTimeout(timeout);
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload.success) throw new Error(payload.error?.message || `Recognition failed ${res.status}`);
        const foods = payload.data.foods || [];
        if (!foods.length) {
          showToast("No food detected — add items manually below.");
          setDetectedFoods([{ name: "", confidence: 0, portion: { size: "medium", grams: "", quantity: "" } }]);
        } else setDetectedFoods(foods.map((f) => ({ name: f.name, confidence: f.confidence, portion: { size: "medium", grams: "", quantity: "" } })));
        setIsRecognizing(false);
        return;
      } catch (e) {
        clearTimeout(timeout);
        const isNet = e.name === 'TypeError' && String(e.message).includes('fetch');
        const isAbort = e.name === 'AbortError';
        if (attempt < 3 && isNet) {
          showToast(`Backend waking (attempt ${attempt}/3) — retrying automatically in 4s…`, 6000);
          await new Promise((r) => setTimeout(r, 4000));
          await wakeBackend(base, showToast, { maxMs: 15000, silent: true });
          continue;
        }
        let msg = e.message;
        if (isAbort) msg = `Recognition timed out after 90s — Render cold start can be slow, please retry (backend warms after first hit).`;
        else if (isNet) msg = `Failed to fetch ${base}/api/v1/food/recognize — backend still waking after ${attempt} tries. Wait 20s and tap Recognize again, or hit Refresh status.`;
        showToast(msg, 9000);
        break;
      }
    }
    setIsRecognizing(false);
  };

  const updateFood = (idx, patch) => setDetectedFoods((prev) => prev.map((f, i) => i === idx ? { ...f, ...patch } : f));
  const updatePortion = (idx, patch) => setDetectedFoods((prev) => prev.map((f, i) => i === idx ? { ...f, portion: { ...f.portion, ...patch } } : f));
  const removeFood = (idx) => setDetectedFoods((p) => p.filter((_, i) => i !== idx));
  const addManual = () => {
    if (!manualInput.trim()) return;
    setDetectedFoods((p) => [...p, { name: manualInput.trim(), confidence: 1, portion: { size: "medium", grams: "", quantity: "" } }]);
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
    const base = cleanBaseUrl(apiBaseUrl);
    await wakeBackend(base, showToast, { maxMs: 20000 });
    for (let attempt = 1; attempt <= 3; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 70000);
      try {
        const res = await fetch(`${base}/api/v1/food/analyze`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ foods }), signal: controller.signal, cache: 'no-store',
        });
        clearTimeout(timeout);
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload.success) throw new Error(payload.error?.message || `Analysis failed ${res.status}`);
        setResult(payload.data);
        setIsAnalyzing(false);
        return;
      } catch (err) {
        clearTimeout(timeout);
        const isNet = err.name === 'TypeError' && String(err.message).includes('fetch');
        const isAbort = err.name === 'AbortError';
        if (attempt < 3 && isNet) {
          showToast(`Backend waking (attempt ${attempt}/3) — retrying automatically…`, 6000);
          await new Promise((r) => setTimeout(r, 4000));
          await wakeBackend(base, showToast, { maxMs: 15000, silent: true });
          continue;
        }
        let msg = err.message;
        if (isAbort) msg = `Analysis timed out after 70s — Render cold start can be slow, please retry.`;
        else if (isNet) msg = `Failed to fetch ${base}/api/v1/food/analyze — backend still waking after ${attempt} tries. Hit Refresh status, wait 15s, retry.`;
        showToast(msg, 9000);
        break;
      }
    }
    setIsAnalyzing(false);
  };

  const fileMeta = useMemo(() => selectedFile ? `${selectedFile.name} · ${formatBytes(selectedFile.size)}` : "JPEG, PNG, WebP up to 10 MB", [selectedFile]);

  return (
    <>
      <div className="upload-options">
        <label className={`drop-zone ${isDragging ? "dragging" : ""}`} htmlFor="normalImageInput"
          onDragOver={(ev) => { ev.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(ev) => { ev.preventDefault(); setIsDragging(false); handleFile(ev.dataTransfer.files?.[0]); }}>
          <input id="normalImageInput" type="file" accept="image/jpeg,image/png,image/webp" onChange={(ev) => handleFile(ev.target.files?.[0])} />
          <span className="drop-icon"><ImagePlus size={18} /></span>
          <span className="drop-title">Upload meal photo</span>
          <span className="drop-meta">{fileMeta}</span>
        </label>
        <button type="button" className="camera-button" onClick={startCamera}><Camera size={18} /><span>Take Photo</span></button>
      </div>

      <div className="preview-frame">
        {previewUrl ? <img src={previewUrl} alt="Meal preview" /> : <div className="preview-placeholder"><Salad size={28} /></div>}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button className="primary-button" style={{ flex: 1 }} type="button" onClick={recognize} disabled={!selectedFile || isRecognizing}>
          {isRecognizing ? <><Loader2 className="spin" size={16} /> Recognizing…</> : <><Search size={16} /> Recognize Food</>}
        </button>
        {detectedFoods.length > 0 && <button className="ghost-icon-button" type="button" title="Clear all" onClick={() => setDetectedFoods([])} style={{ width: 48, height: 48 }}><Trash2 size={16} /></button>}
      </div>

      {detectedFoods.length > 0 && (
        <form onSubmit={analyze} className="normal-food-form">
          <div className="analysis-section" style={{ borderTop: 0, paddingTop: 0 }}>
            <div className="section-title-row">
              <div><h3>Confirm foods & portion</h3><p>Edit names if needed — accuracy starts here.</p></div>
              <span className="section-badge">{detectedFoods.length} items</span>
            </div>
            <div className="alternatives-list">
              {detectedFoods.map((food, idx) => (
                <article key={idx} className="alternative-row" style={{ gap: 10 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input className="portion-input" value={food.name} onChange={(e) => updateFood(idx, { name: e.target.value })} placeholder="e.g. Chicken Biryani" style={{ flex: 1 }} />
                    <button type="button" className="ghost-icon-button" onClick={() => removeFood(idx)} style={{ width: 34, height: 34, flexShrink: 0 }}><X size={14} /></button>
                  </div>
                  {food.confidence > 0 && food.confidence < 1 && <div className="row-meta">Recognition confidence: {Math.round(food.confidence * 100)}%</div>}
                  <div className="portion-controls">
                    <div className="portion-row">
                      <span className="row-meta" style={{ minWidth: 44, display: "inline-flex", alignItems: "center", gap: 4 }}><Scale size={12} />Size</span>
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
                      <input className="portion-input small" type="number" min="1" placeholder="Grams" value={food.portion.grams} onChange={(e) => updatePortion(idx, { grams: e.target.value })} />
                      <span className="row-meta">g</span>
                      <input className="portion-input small" type="number" min="1" placeholder="Qty" value={food.portion.quantity} onChange={(e) => updatePortion(idx, { quantity: e.target.value })} />
                      <span className="row-meta">pcs</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input className="portion-input" value={manualInput} onChange={(e) => setManualInput(e.target.value)} placeholder="Add another food e.g. Raita" style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addManual(); } }} />
              <button type="button" className="secondary-button" onClick={addManual} style={{ height: 42, padding: "0 14px" }}><Plus size={14} /> Add</button>
            </div>
          </div>
          <div className="estimated-banner"><Info size={15} /><span>Portion helps us estimate nutrition. Choose a size or enter grams/qty. All values are <strong>estimated</strong>.</span></div>
          <button className="primary-button" type="submit" disabled={isAnalyzing}>
            {isAnalyzing ? <><Loader2 className="spin" size={16} /> Analyzing meal…</> : "Analyze meal"}
          </button>
        </form>
      )}

      {!detectedFoods.length && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input className="portion-input" value={manualInput} onChange={(e) => setManualInput(e.target.value)} placeholder="Or type a food name e.g. Dosa, Chapati, Salad" style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (manualInput.trim()) { setDetectedFoods([{ name: manualInput.trim(), confidence: 1, portion: { size: "medium", grams: "", quantity: "" } }]); setManualInput(""); } } }} />
          <button type="button" className="secondary-button" onClick={() => { if (manualInput.trim()) { setDetectedFoods([{ name: manualInput.trim(), confidence: 1, portion: { size: "medium", grams: "", quantity: "" } }]); setManualInput(""); } }}><Plus size={14} /> Add</button>
        </div>
      )}

      {showCamera && (
        <div className="camera-modal">
          <div className="camera-overlay">
            <button className="camera-close" onClick={stopCamera}><X size={18} /></button>
            <video ref={videoRef} autoPlay playsInline muted className="camera-feed" />
            <canvas ref={canvasRef} style={{ display: "none" }} />
            <button className="camera-capture" onClick={capturePhoto}><div className="camera-capture-button" /></button>
            <p className="camera-instruction">Center the meal in the frame</p>
          </div>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 18 }}>
          <ResultPanel result={result} />
        </div>
      )}
    </>
  );
}

export default function App() {
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_URL);
  const [resolvedApiUrl, setResolvedApiUrl] = useState(DEFAULT_API_URL);
  const [backendStatus, setBackendStatus] = useState({ status: "", label: "Checking" });
  const [mode, setMode] = useState("packaged");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [toast, setToast] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const fileMeta = useMemo(() => selectedFile ? `${selectedFile.name} · ${formatBytes(selectedFile.size)}` : "JPEG, PNG, WebP up to 10 MB", [selectedFile]);

  const showToast = useCallback((m, dur = 6000) => { setToast(m); setTimeout(() => setToast(""), dur); }, []);
  const checkBackendStatus = useCallback(async () => {
    setBackendStatus({ status: "", label: "Checking" });
    const candidates = [
      cleanBaseUrl(apiBaseUrl),
      cleanBaseUrl(RENDER_API_URL),
      'http://localhost:3002',
      'http://localhost:3001',
    ];
    const uniq = [...new Set(candidates.filter(Boolean))];
    for (const base of uniq) {
      try {
        const controller = new AbortController();
        // 12s for Render cold start wake (was 4s — too short, always marked Offline)
        const t = setTimeout(() => controller.abort(), 12000);
        const r = await fetch(`${base}/api/v1/health/ready`, { signal: controller.signal });
        clearTimeout(t);
        if (!r.ok) continue;
        const payload = await r.json();
        const groqReady = payload?.services?.groq === "configured";
        const ocrState = payload?.services?.ocr;
        const label = ocrState === 'warming' ? 'Warming…' : groqReady ? "Ready" : "No Groq key";
        setBackendStatus({ status: groqReady ? "ready" : "error", label });
        setResolvedApiUrl(base);
        // if discovered URL differs from configured, remember it
        if (base !== cleanBaseUrl(apiBaseUrl)) setApiBaseUrl(base);
        return;
      } catch (e) {
        // continue to next candidate
      }
    }
    setBackendStatus({ status: "error", label: "Offline — tap ↻ to wake Render" });
  }, [apiBaseUrl]);

  const handleFile = useCallback((file) => {
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl((cur) => { if (cur) URL.revokeObjectURL(cur); return URL.createObjectURL(file); });
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCameraStream(s); setShowCamera(true);
      if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); }
    } catch { showToast("Camera access denied or not available"); }
  }, [showToast]);

  const stopCamera = useCallback(() => {
    if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
    setCameraStream(null); setShowCamera(false);
  }, [cameraStream]);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const v = videoRef.current, c = canvasRef.current;
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
      c.toBlob((blob) => {
        if (blob) { const file = new File([blob], "camera-photo.jpg", { type: "image/jpeg" }); handleFile(file); stopCamera(); }
      }, "image/jpeg", 0.95);
    }
  }, [handleFile, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // Perceived performance: faster stepping (900ms) so UI feels alive even if backend is 8-12s
  useEffect(() => {
    if (!isAnalyzing) { setAnalysisStep(0); return; }
    const steps = 4;
    const interval = setInterval(() => setAnalysisStep((s) => Math.min(s + 1, steps - 1)), 1100);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const submitAnalysis = async (e) => {
    e.preventDefault();
    if (!selectedFile) { showToast("Select a product image first."); return; }
    setIsAnalyzing(true);
    setAnalysisStep(0);
    const base = cleanBaseUrl(resolvedApiUrl || apiBaseUrl);

    // Light wake before heavy POST — full wake is done inside retry loop
    await wakeBackend(base, showToast, { maxMs: 20000 });

    for (let attempt = 1; attempt <= 3; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 110000);
      try {
        const compressed = await compressImage(selectedFile, 900, 0.70);
        setAnalysisStep(1);
        const fd = new FormData(); fd.append("image", compressed);
        const r = await fetch(`${base}/api/v1/analysis`, { method: "POST", body: fd, signal: controller.signal, cache: 'no-store' });
        clearTimeout(timeout);
        setAnalysisStep(3);
        const p = await r.json().catch(() => ({}));
        if (!r.ok || !p.success) {
          const err = new Error(p.error?.message || p.message || `Analysis failed ${r.status}`);
          err.code = p.error?.code;
          err.details = p.error?.details;
          throw err;
        }
        setResult(p.data);
        if (p.data?.isFallback) showToast(`Analysis completed with fallback: ${p.data.fallbackReason?.message || 'AI temporarily unavailable'}`);
        setIsAnalyzing(false);
        return;
      } catch (err) {
        clearTimeout(timeout);
        const isNet = err.name === 'TypeError' && String(err.message).includes('fetch');
        const isAbort = err.name === 'AbortError';
        if (attempt < 3 && isNet) {
          showToast(`Backend waking (attempt ${attempt}/3) — retrying automatically in 4s…`, 7000);
          await new Promise((res) => setTimeout(res, 4000));
          await wakeBackend(base, showToast, { maxMs: 15000, silent: true });
          continue;
        }
        let msg = err.message;
        if (err.code === 'EXTRACTION_INCOMPLETE') {
          msg = err.message + (err.details?.foundFields ? ` (found: ${err.details.foundFields})` : '') + ' — Tip: tight crop, good light, flat label. Or try Normal Food mode for meals without labels.';
          showToast(msg, 9000);
        } else if (isAbort) {
          msg = `Request timed out after 110s — Render free tier is slow. Try tighter crop (900px) + good light. Tap Analyze again — warmed request is ~10s. (${base})`;
          showToast(msg, 9000);
        } else if (isNet) {
          msg = `Failed to fetch ${base}/api/v1/analysis — backend still waking after ${attempt} tries. Hit Refresh status, wait 15s, retry.`;
          showToast(msg, 9000);
        } else {
          showToast(msg);
        }
        break;
      }
    }
    setIsAnalyzing(false);
  };

  useEffect(() => { checkBackendStatus(); }, [checkBackendStatus]);
  // Keep Render backend warm while tab is open — ping every 9 min (free tier sleeps ~15 min)
  useEffect(() => {
    const id = setInterval(() => {
      const base = cleanBaseUrl(resolvedApiUrl || DEFAULT_API_URL);
      fetch(`${base}/api/v1/health/ready`, { cache: 'no-store' }).catch(() => {});
    }, 9 * 60 * 1000);
    return () => clearInterval(id);
  }, [resolvedApiUrl]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark"><HeartPulse size={20} /></div>
            <div>
              <div className="brand-title">Food Health Analyzer</div>
              <div className="brand-sub">AI nutrition • Honest scoring • No guesswork</div>
            </div>
          </div>
          <div className="topbar-actions">
            <StatusPill {...backendStatus} />
            <button className="ghost-icon-button" type="button" onClick={checkBackendStatus} aria-label="Refresh status" title="Refresh status"><RefreshCw size={15} /></button>
          </div>
        </div>
      </header>

      <main className="app-shell">
        <section className="workspace" aria-label="Food health analyzer">
          <div className="input-pane">
            <header className="pane-header">
              <div>
                <p className="eyebrow">{mode === "packaged" ? "Packaged Food" : "Everyday Meal"}</p>
                <h1>{mode === "packaged" ? "Scan the nutrition label" : "Analyze your meal"}</h1>
                <p className="pane-subtitle">
                  {mode === "packaged" ? "A clear photo of the nutrition table + ingredients gives the most accurate score." : "Upload a meal photo, confirm the foods, and set how much you ate."}
                </p>
              </div>
            </header>

            <div className="mode-toggle" role="tablist" aria-label="Analysis mode">
              <button role="tab" aria-selected={mode === "packaged"} type="button" className={`mode-card ${mode === "packaged" ? "active" : ""}`} onClick={() => { setMode("packaged"); setResult(null); }}>
                <Package size={16} /><span className="mode-title">Packaged</span>
              </button>
              <button role="tab" aria-selected={mode === "normal"} type="button" className={`mode-card ${mode === "normal" ? "active" : ""}`} onClick={() => { setMode("normal"); setResult(null); }}>
                <Utensils size={16} /><span className="mode-title">Normal Food</span>
              </button>
            </div>

            <div className="row-meta" style={{ fontSize: '0.78rem', marginTop: 4, opacity: 0.7 }}>API: {cleanBaseUrl(resolvedApiUrl)}</div>
            {mode === "packaged" ? (
              <form className="upload-form" onSubmit={submitAnalysis}>
                <div className="upload-options">
                  <label className={`drop-zone ${isDragging ? "dragging" : ""}`} htmlFor="imageInput"
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files?.[0]); }}>
                    <input id="imageInput" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleFile(e.target.files?.[0])} />
                    <span className="drop-icon"><ImagePlus size={18} /></span>
                    <span className="drop-title">Drop or upload label</span>
                    <span className="drop-meta">{fileMeta}</span>
                  </label>
                  <button type="button" className="camera-button" onClick={startCamera}><Camera size={18} /><span>Take Photo</span></button>
                </div>

                <div className="preview-frame">
                  {previewUrl ? <img src={previewUrl} alt="Label preview" /> : <div className="preview-placeholder"><Upload size={26} /></div>}
                </div>

                <button className="primary-button" type="submit" disabled={isAnalyzing}>
                  {isAnalyzing ? <><Loader2 className="spin" size={16} /> {["Uploading…", "Extracting nutrition…", "Scoring…", "Generating AI insights…"][analysisStep] || "Analyzing…"}</> : "Analyze product"}
                </button>
                {isAnalyzing && <div className="row-meta" style={{ textAlign: 'center', fontSize: '0.78rem' }}>Usually ~6-10s (warmed). First cold start may take ~20s — image is auto-compressed for speed.</div>}

                <div className="row-meta" style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                  <ShieldCheck size={14} /> Deterministic scoring · LLM explains, never invents
                </div>
              </form>
            ) : (
              <div className="upload-form" style={{ gap: 14 }}>
                <NormalFoodFlow apiBaseUrl={resolvedApiUrl} showToast={showToast} />
              </div>
            )}
          </div>

          <div className="result-pane">
            {mode === "packaged" ? (
              result ? <ResultPanel result={result} /> : (
                <div className="empty-state">
                  <div className="empty-icon"><Apple size={32} /></div>
                  <p className="eyebrow">Ready to analyze</p>
                  <h2>Your health report will appear here</h2>
                  <p>We extract nutrition facts, check ingredient quality, calculate a deterministic score, and explain the trade-offs with evidence.</p>
                  <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap", justifyContent: "center" }}>
                    <span className="section-badge" style={{ background: "#fff", border: "1px solid var(--line)" }}><ShieldCheck size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />No score hallucination</span>
                    <span className="section-badge" style={{ background: "#fff", border: "1px solid var(--line)" }}>OCR + Groq RAG</span>
                  </div>
                </div>
              )
            ) : (
              <div className="empty-state">
                <div className="empty-icon"><Salad size={30} /></div>
                <p className="eyebrow">Normal food</p>
                <h2>Your meal story, made visual</h2>
                <p>Recognize dishes with vision AI, adjust portions, and get an <strong>estimated</strong> nutrition breakdown plus a health score — all inline on the left. Packaged lab labels stay ultra-precise.</p>
                <div className="alternatives-list" style={{ marginTop: 18, textAlign: "left", maxWidth: 420, width: "100%" }}>
                  <div className="alternative-row" style={{ padding: "12px 14px" }}>
                    <div className="row-top" style={{ fontSize: "0.88rem" }}>How it works</div>
                    <div className="row-meta">Photo → Recognize → Confirm portion → Deterministic nutrition → Health score → Groq explanation</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {toast ? <div className="toast" role="status">{toast}</div> : null}

        {showCamera && mode === "packaged" && (
          <div className="camera-modal">
            <div className="camera-overlay">
              <button className="camera-close" onClick={stopCamera}><X size={18} /></button>
              <video ref={videoRef} autoPlay playsInline muted className="camera-feed" />
              <canvas ref={canvasRef} style={{ display: "none" }} />
              <button className="camera-capture" onClick={capturePhoto}><div className="camera-capture-button" /></button>
              <p className="camera-instruction">Fit the nutrition label in the frame</p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
