import React, { useState, useEffect, useRef, useCallback } from "react";

const REST_SECONDS = 150; // 2 min 30 s

// Treinos padrão do Edu — texto no mesmo formato que o parser entende
const PRESETS = [
  {
    label: "Treino 1",
    focus: "Costas + Bíceps",
    text: `Puxada no triângulo 3x10 - 55kg
Serrote 3x10 - 26/28kg
Remada aberta altura do cotovelo 4x10 - 45kg
Crucifixo inverso 4x12 - 40kg
Bíceps barra 3x10 - 25kg
Bíceps máquina 3x12 - 20kg`,
  },
  {
    label: "Treino 2",
    focus: "Peito + Ombro + Braços",
    text: `Supino barra 3x12 - 17kg
Crucifixo máquina 4x10 - 65/70kg
Remada aberta 4x10 - 45/50kg
Puxada aberta 4x10 - 55kg
Desenvolvimento na máquina 3x10 - 20/22kg
Elevação lateral 4x12 - 10kg
Bíceps barra W 3x12 - 25kg
Tríceps na barra 3x12 - 40kg`,
  },
  {
    label: "Treino 3",
    focus: "Pernas + Glúteos",
    text: `Levantamento terra barra hexagonal 4x8 - 25kg cada lado
Agachamento na caixa 4x15 - kettlebell 20kg
Afundo 3x10 - kettlebell 20kg
Cadeira flexora 3x10 - 50kg
Cadeira abdutora 3x10 - 60kg
Cadeira extensora 3x10 - 60kg`,
  },
  {
    label: "Treino 4",
    focus: "Peito + Ombro",
    text: `Supino barra 3x12 - 17kg
Crucifixo máquina 4x10 - 65/70kg
Supino inclinado na máquina 3x10 - 25kg
Desenvolvimento na máquina 3x10 - 20/22kg
Elevação lateral 4x12 - 10kg`,
  },
  {
    label: "Treino 5",
    focus: "Costas + Bíceps",
    text: `Puxada no triângulo 3x10 - 55kg
Serrote 3x10 - 26/28kg
Remada aberta altura do cotovelo 4x10 - 45kg
Crucifixo inverso 4x12 - 40kg
Bíceps barra 3x10 - 25kg
Bíceps máquina 3x12 - 20kg`,
  },
  {
    label: "Treino 6",
    focus: "Costas + Bíceps (volume)",
    text: `Puxada aberta 3x10 - 50kg
Remada articulada 3x12 - 40kg cada lado
Puxada triângulo 3x10 - 45/50kg
Remada aberta cotovelo alto 3x12 - 40/45kg
Crucifixo inverso na máquina 3x12 - 45kg
Bíceps barra W 3x12 - 25kg`,
  },
  {
    label: "Treino 7",
    focus: "Ombro + Costas + Bíceps + Core",
    text: `Desenvolvimento barra em pé 3x10 - só a barra
Remada aberta cotovelo alto 4x10 - 45kg
Supino inclinado com barra 3x10 - 10kg cada lado
Puxada no triângulo 3x10 - 50kg
Crucifixo inverso na máquina 3x12 - 45kg
Bíceps scott 3x10 - 20kg cada lado
Bíceps em pé na barra 3x12 - 20kg
Prancha 3x60`,
  },
  {
    label: "Treino 8",
    focus: "Peito + Ombro + Pernas",
    text: `Supino 3x10 - 15kg cada lado
Crucifixo na máquina 3x10 - 65kg
Desenvolvimento na máquina sentado 3x10 - 20kg cada lado
Elevação lateral 3x10 - 8/9kg
Agachamento na caixa 3x10 - kettlebell 20kg
Cadeira extensora 3x10 - 40/50kg`,
  },
];

// ---------- Parser ----------
// Reconhece linhas como:
//   "Supino reto 4x10"
//   "Agachamento 4 x 12 - 40kg"
//   "Rosca direta 3X15  20kg"
//   "Leg press 4 séries de 15"
// Cabeçalhos ("Treino A", "Peito/Tríceps") viram seções.
function parseWorkout(text) {
  const lines = text.split("\n").map((l) => l.trim());
  const items = [];

  const setRepRegex =
    /(\d{1,2})\s*(?:x|×|series?\s*de|séries?\s*de)\s*(\d{1,3})/i;
  // carga: "- 40kg", "40 kg", "40kg" no fim
  const loadRegex = /(?:[-–—]\s*)?(\d{1,4}(?:[.,]\d{1,2})?)\s*(kg|lb|kgs)?\s*$/i;

  for (const line of lines) {
    if (!line) continue;

    const m = line.match(setRepRegex);
    if (!m) {
      // sem padrão NxR -> trata como cabeçalho/seção
      items.push({ type: "section", title: line });
      continue;
    }

    const sets = parseInt(m[1], 10);
    const reps = parseInt(m[2], 10);

    // nome = tudo antes do match de séries
    let name = line.slice(0, m.index).trim();
    // resto = depois do match (pode conter carga)
    let rest = line.slice(m.index + m[0].length).trim();

    let load = "";
    const lm = rest.match(loadRegex);
    if (lm && lm[1]) {
      load = lm[1] + (lm[2] ? lm[2].toLowerCase().replace("kgs", "kg") : "kg");
    }

    if (!name) name = "Exercício";

    items.push({
      type: "exercise",
      id: Math.random().toString(36).slice(2),
      name,
      targetReps: reps,
      sets: Array.from({ length: sets }, () => ({
        done: false,
        load: load,
        reps: String(reps),
      })),
    });
  }

  return items;
}

// Camada de persistência: usa window.storage (ambiente Claude) quando existe,
// senão cai pro localStorage (site publicado no Vercel). Mesma interface async.
const store = {
  async get(key) {
    try {
      if (typeof window !== "undefined" && window.storage) {
        return await window.storage.get(key);
      }
      const v = localStorage.getItem(key);
      return v == null ? null : { key, value: v };
    } catch (e) {
      return null;
    }
  },
  async set(key, value) {
    try {
      if (typeof window !== "undefined" && window.storage) {
        return await window.storage.set(key, value);
      }
      localStorage.setItem(key, value);
      return { key, value };
    } catch (e) {
      return null;
    }
  },
};

// Deduz grupos musculares a partir dos nomes dos exercícios.
// Mantém a ordem em que aparecem (peito antes de costas se veio antes).
const MUSCLE_RULES = [
  { group: "Peito", kw: ["supino", "crucifixo", "peck", "peitoral", "flexão", "flexao", "crossover"] },
  { group: "Costas", kw: ["puxada", "remada", "serrote", "barra fixa", "pulldown", "pull down", "levantamento terra", "terra"] },
  { group: "Ombro", kw: ["desenvolvimento", "elevação lateral", "elevacao lateral", "elevação frontal", "elevacao frontal", "arnold", "militar"] },
  { group: "Bíceps", kw: ["bíceps", "biceps", "rosca", "scott"] },
  { group: "Tríceps", kw: ["tríceps", "triceps", "testa", "corda", "francês", "frances", "mergulho"] },
  { group: "Posterior de ombro", kw: ["crucifixo inverso", "inverso"] },
  { group: "Quadríceps", kw: ["agachamento", "extensora", "leg press", "leg", "afundo", "avanço", "avanco", "passada"] },
  { group: "Posterior de coxa", kw: ["flexora", "stiff", "mesa flexora"] },
  { group: "Glúteos", kw: ["glúteo", "gluteo", "abdutora", "hip thrust", "elevação pélvica", "elevacao pelvica", "kettlebell"] },
  { group: "Panturrilha", kw: ["panturrilha", "gêmeos", "gemeos"] },
  { group: "Core", kw: ["prancha", "abdominal", "abdômen", "abdomen", "core"] },
];

function muscleSummary(exercises) {
  const found = [];
  for (const ex of exercises) {
    const n = ex.name.toLowerCase();
    for (const rule of MUSCLE_RULES) {
      // "crucifixo inverso" é posterior de ombro, não peito
      if (rule.group === "Peito" && n.includes("inverso")) continue;
      if (rule.kw.some((k) => n.includes(k)) && !found.includes(rule.group)) {
        found.push(rule.group);
      }
    }
  }
  return found;
}

// ---------- Timer ----------
function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// "há 2h", "ontem", "há 3 dias" — referência amigável de quando foi
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d} dias`;
  const date = new Date(ts);
  return `${String(date.getDate()).padStart(2, "0")}/${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

// AudioContext reaproveitado (criar um por toque trava no iOS)
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) {
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {}
  }
  return _audioCtx;
}

// Chamar DENTRO de um gesto do usuário (toque) para destravar o áudio no iOS.
// Toca um silêncio inaudível só pra "ligar" o contexto.
function unlockAudio() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0.0001; // praticamente mudo
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.03);
  } catch (e) {}
}

function alertEnd() {
  // som: padrão de alarme — 5 bipes fortes e longos
  try {
    const ctx = getAudioCtx();
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume();
      const t0 = ctx.currentTime;
      const beeps = 5;
      const gap = 0.34;
      const dur = 0.26;
      for (let i = 0; i < beeps; i++) {
        const start = t0 + i * gap;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.type = "square"; // mais penetrante que sine
        o.frequency.value = i % 2 === 0 ? 880 : 1175;
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.6, start + 0.02);
        g.gain.setValueAtTime(0.6, start + dur - 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        o.start(start);
        o.stop(start + dur);
      }
    }
  } catch (e) {}
  // vibração (Android/Chrome; iOS Safari ignora silenciosamente)
  try {
    if (navigator.vibrate)
      navigator.vibrate([400, 150, 400, 150, 400, 150, 600]);
  } catch (e) {}
}

const C = {
  bg: "#0a0a0a",
  panel: "#141414",
  panel2: "#1c1c1c",
  line: "#2a2a2a",
  text: "#f2f2f0",
  dim: "#8a8a85",
  accent: "#d4ff00",
  accentDim: "#9ab300",
  done: "#3a3a32",
  danger: "#ff4d3d",
};

const MONO = "'JetBrains Mono', 'SF Mono', ui-monospace, monospace";
const DISPLAY = "'Archivo', 'Helvetica Neue', sans-serif";

export default function App() {
  const [raw, setRaw] = useState("");
  const [items, setItems] = useState([]);
  const [phase, setPhase] = useState("input"); // input | workout
  const [notes, setNotes] = useState(""); // sugestões de melhoria
  const [history, setHistory] = useState([]); // últimos treinos {name, ts}

  // Carrega o histórico salvo ao abrir o app
  useEffect(() => {
    (async () => {
      try {
        const r = await store.get("history");
        if (r && r.value) setHistory(JSON.parse(r.value));
      } catch (e) {
        // chave ainda não existe — histórico vazio
      }
    })();
  }, []);

  const recordWorkout = useCallback((name) => {
    setHistory((prev) => {
      const entry = { name, ts: Date.now() };
      const next = [entry, ...prev].slice(0, 3); // mantém só os 3 últimos
      store.set("history", JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // timer baseado em timestamp de término (sobrevive a sair do app)
  const [endAt, setEndAt] = useState(null); // ms epoch de quando o descanso acaba
  const [restLeft, setRestLeft] = useState(0);
  const [resting, setResting] = useState(false);
  const tickRef = useRef(null);
  const firedRef = useRef(false); // garante que o alerta toque uma vez só

  const wakeLockRef = useRef(null);

  // Wake Lock: impede a tela de apagar/bloquear durante o treino
  const requestWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch (e) {}
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch (e) {}
  }, []);

  const startRest = useCallback((seconds = REST_SECONDS) => {
    // "destrava" o áudio no mesmo gesto de toque (necessário no iOS)
    unlockAudio();
    firedRef.current = false;
    setEndAt(Date.now() + seconds * 1000);
    setRestLeft(seconds);
    setResting(true);
  }, []);

  const stopRest = useCallback(() => {
    setResting(false);
    setEndAt(null);
    if (tickRef.current) clearInterval(tickRef.current);
  }, []);

  // recalcula o restante pelo relógio real — funciona mesmo após o app
  // ficar suspenso em segundo plano (ao voltar, mostra o tempo correto)
  useEffect(() => {
    if (!resting || endAt == null) return;

    const recompute = () => {
      const left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      setRestLeft(left);
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        alertEnd();
        setResting(false);
        if (tickRef.current) clearInterval(tickRef.current);
      }
    };

    recompute(); // imediato (cobre a volta ao app)
    tickRef.current = setInterval(recompute, 250);

    // ao reabrir a aba/app, recalcula na hora
    const onVis = () => {
      if (document.visibilityState === "visible") recompute();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", recompute);

    return () => {
      clearInterval(tickRef.current);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", recompute);
    };
  }, [resting, endAt]);

  // Mantém a tela acesa enquanto estiver na tela de treino
  useEffect(() => {
    if (phase === "workout") {
      requestWakeLock();
      const onVis = () => {
        if (document.visibilityState === "visible") requestWakeLock();
      };
      document.addEventListener("visibilitychange", onVis);
      return () => {
        document.removeEventListener("visibilitychange", onVis);
        releaseWakeLock();
      };
    } else {
      releaseWakeLock();
    }
  }, [phase, requestWakeLock, releaseWakeLock]);

  const buildFrom = (text, name) => {
    const parsed = parseWorkout(text);
    if (parsed.filter((i) => i.type === "exercise").length === 0) {
      alert(
        "Não encontrei exercícios. Use o formato: Nome 4x10 (séries x reps), carga opcional depois de um traço."
      );
      return;
    }
    unlockAudio(); // destrava áudio já no gesto de iniciar o treino
    const exs = parsed.filter((i) => i.type === "exercise");
    const section = parsed.find((i) => i.type === "section");
    // nome: preset > título do texto > resumo de músculos > genérico
    let finalName = name || (section && section.title);
    if (!finalName) {
      const muscles = muscleSummary(exs);
      finalName = muscles.length
        ? "Avulso · " + muscles.join(" + ")
        : "Treino avulso";
    }
    recordWorkout(finalName);
    setItems(parsed);
    setPhase("workout");
  };

  const build = () => buildFrom(raw);

  const toggleSet = (exId, setIdx) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== exId) return it;
        const sets = it.sets.map((s, i) =>
          i === setIdx ? { ...s, done: !s.done } : s
        );
        return { ...it, sets };
      })
    );
    // dispara descanso só ao MARCAR (não ao desmarcar)
    const ex = items.find((i) => i.id === exId);
    if (ex && !ex.sets[setIdx].done) startRest();
  };

  const updateSet = (exId, setIdx, field, val) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== exId) return it;
        const sets = it.sets.map((s, i) =>
          i === setIdx ? { ...s, [field]: val } : s
        );
        return { ...it, sets };
      })
    );
  };

  const exercises = items.filter((i) => i.type === "exercise");
  const totalSets = exercises.reduce((a, e) => a + e.sets.length, 0);
  const doneSets = exercises.reduce(
    (a, e) => a + e.sets.filter((s) => s.done).length,
    0
  );
  const pct = totalSets ? Math.round((doneSets / totalSets) * 100) : 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily: MONO,
        maxWidth: 480,
        margin: "0 auto",
        position: "relative",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Archivo:wght@700;900&family=JetBrains+Mono:wght@400;600;700&display=swap"
        rel="stylesheet"
      />

      {/* Header */}
      <div
        style={{
          padding: "20px 18px 14px",
          borderBottom: `1px solid ${C.line}`,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontFamily: DISPLAY,
            fontWeight: 900,
            fontSize: 24,
            letterSpacing: "-0.03em",
            textTransform: "uppercase",
          }}
        >
          TREINO<span style={{ color: C.accent }}>.</span>
        </div>
        {phase === "workout" && (
          <button
            onClick={() => {
              setPhase("input");
              stopRest();
            }}
            style={{
              background: "transparent",
              border: `1px solid ${C.line}`,
              color: C.dim,
              fontFamily: MONO,
              fontSize: 11,
              padding: "6px 10px",
              borderRadius: 6,
              cursor: "pointer",
              textTransform: "uppercase",
            }}
          >
            Editar
          </button>
        )}
      </div>

      {phase === "input" && (
        <div style={{ padding: 18 }}>
          {history.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <div
                style={{
                  fontFamily: DISPLAY,
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: C.dim,
                  marginBottom: 10,
                }}
              >
                Últimos treinos
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {history.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: C.panel,
                      border: `1px solid ${C.line}`,
                      borderRadius: 10,
                      padding: "10px 12px",
                    }}
                  >
                    <span style={{ fontFamily: MONO, fontSize: 13 }}>
                      {h.name}
                    </span>
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 11,
                        color: C.dim,
                        flexShrink: 0,
                        marginLeft: 10,
                      }}
                    >
                      {timeAgo(h.ts)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div
            style={{
              fontSize: 12,
              color: C.dim,
              lineHeight: 1.6,
              marginBottom: 14,
            }}
          >
            Cole o treino que o personal mandou. Uma linha por exercício, no
            formato <span style={{ color: C.accent }}>Nome 4x10</span>. Carga
            opcional depois de um traço (ex: <code>Agachamento 4x12 - 40kg</code>
            ). Linhas de título viram divisórias.
          </div>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={`Treino A — Peito/Tríceps\nSupino reto 4x10 - 30kg\nSupino inclinado 4x12\nCrucifixo 3x15 - 12kg\nTríceps corda 4x15`}
            style={{
              width: "100%",
              minHeight: 260,
              background: C.panel,
              border: `1px solid ${C.line}`,
              borderRadius: 10,
              color: C.text,
              fontFamily: MONO,
              fontSize: 14,
              padding: 14,
              resize: "vertical",
              lineHeight: 1.7,
              boxSizing: "border-box",
              outline: "none",
            }}
          />
          <button
            onClick={build}
            style={{
              width: "100%",
              marginTop: 14,
              background: C.accent,
              color: "#0a0a0a",
              border: "none",
              borderRadius: 10,
              padding: "16px",
              fontFamily: DISPLAY,
              fontWeight: 900,
              fontSize: 16,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
              cursor: "pointer",
            }}
          >
            Criar Rotina →
          </button>

          {/* Treinos fixos do Edu */}
          <div
            style={{
              marginTop: 28,
              paddingTop: 20,
              borderTop: `1px solid ${C.line}`,
            }}
          >
            <div
              style={{
                fontFamily: DISPLAY,
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: C.dim,
                marginBottom: 4,
              }}
            >
              Treinos do Edu
            </div>
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 14 }}>
              Toque pra começar na hora.
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              {PRESETS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => buildFrom(p.text, `${p.label} · ${p.focus}`)}
                  style={{
                    textAlign: "left",
                    background: C.panel,
                    border: `1px solid ${C.line}`,
                    borderRadius: 12,
                    padding: "14px 14px",
                    cursor: "pointer",
                    color: C.text,
                  }}
                >
                  <div
                    style={{
                      fontFamily: DISPLAY,
                      fontWeight: 900,
                      fontSize: 15,
                      marginBottom: 4,
                    }}
                  >
                    {p.label}
                  </div>
                  <div
                    style={{
                      fontFamily: MONO,
                      fontSize: 11,
                      color: C.accent,
                      lineHeight: 1.4,
                    }}
                  >
                    {p.focus}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {phase === "workout" && (
        <div style={{ padding: "0 0 140px" }}>
          {/* progress */}
          <div style={{ padding: "14px 18px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                color: C.dim,
                marginBottom: 8,
              }}
            >
              <span>PROGRESSO</span>
              <span style={{ color: C.accent }}>
                {doneSets}/{totalSets} séries · {pct}%
              </span>
            </div>
            <div
              style={{
                height: 6,
                background: C.panel2,
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: C.accent,
                  transition: "width 0.3s",
                }}
              />
            </div>
          </div>

          {items.map((it, idx) =>
            it.type === "section" ? (
              <div
                key={idx}
                style={{
                  padding: "18px 18px 6px",
                  fontFamily: DISPLAY,
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: C.dim,
                }}
              >
                — {it.title}
              </div>
            ) : (
              <Exercise
                key={it.id}
                ex={it}
                onToggle={toggleSet}
                onUpdate={updateSet}
              />
            )
          )}

          {/* Campo de sugestões de melhoria */}
          <div style={{ padding: "24px 14px 0" }}>
            <div
              style={{
                fontFamily: DISPLAY,
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: C.dim,
                marginBottom: 8,
              }}
            >
              — Ideias de melhoria
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anote aqui o que mudar no app enquanto treina…"
              style={{
                width: "100%",
                minHeight: 90,
                background: C.panel,
                border: `1px solid ${C.line}`,
                borderRadius: 10,
                color: C.text,
                fontFamily: MONO,
                fontSize: 13,
                padding: 12,
                resize: "vertical",
                lineHeight: 1.6,
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>
        </div>
      )}

      {/* Timer overlay */}
      {resting && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            maxWidth: 480,
            margin: "0 auto",
            background: C.accent,
            color: "#0a0a0a",
            padding: "20px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 -8px 30px rgba(212,255,0,0.25)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                opacity: 0.7,
              }}
            >
              Descanso
            </div>
            <div
              style={{
                fontFamily: DISPLAY,
                fontWeight: 900,
                fontSize: 48,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmt(restLeft)}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setEndAt((v) => (v || Date.now()) + 30000)}
              style={{
                background: "rgba(10,10,10,0.12)",
                border: "1px solid rgba(10,10,10,0.3)",
                color: "#0a0a0a",
                borderRadius: 8,
                padding: "10px 12px",
                fontFamily: MONO,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              +30s
            </button>
            <button
              onClick={stopRest}
              style={{
                background: "#0a0a0a",
                border: "none",
                color: C.accent,
                borderRadius: 8,
                padding: "10px 14px",
                fontFamily: DISPLAY,
                fontWeight: 900,
                fontSize: 13,
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Pular
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Exercise({ ex, onToggle, onUpdate }) {
  const allDone = ex.sets.every((s) => s.done);
  return (
    <div
      style={{
        margin: "8px 14px",
        background: allDone ? C.panel2 : C.panel,
        border: `1px solid ${allDone ? C.accentDim : C.line}`,
        borderRadius: 12,
        padding: 14,
        opacity: allDone ? 0.7 : 1,
        transition: "all 0.2s",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: 16,
            textDecoration: allDone ? "line-through" : "none",
          }}
        >
          {ex.name}
        </div>
        <div style={{ fontSize: 12, color: C.dim }}>
          {ex.sets.length}×{ex.targetReps}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ex.sets.map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <button
              onClick={() => onToggle(ex.id, i)}
              style={{
                width: 34,
                height: 34,
                flexShrink: 0,
                borderRadius: 8,
                border: `2px solid ${s.done ? C.accent : C.line}`,
                background: s.done ? C.accent : "transparent",
                color: s.done ? "#0a0a0a" : C.dim,
                fontFamily: MONO,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {s.done ? "✓" : i + 1}
            </button>
            <input
              value={s.load}
              onChange={(e) => onUpdate(ex.id, i, "load", e.target.value)}
              placeholder="carga"
              style={{
                flex: 1,
                minWidth: 0,
                background: C.bg,
                border: `1px solid ${C.line}`,
                borderRadius: 8,
                color: C.text,
                fontFamily: MONO,
                fontSize: 13,
                padding: "8px 10px",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
            <input
              value={s.reps}
              onChange={(e) => onUpdate(ex.id, i, "reps", e.target.value)}
              placeholder="reps"
              style={{
                width: 64,
                flexShrink: 0,
                background: C.bg,
                border: `1px solid ${C.line}`,
                borderRadius: 8,
                color: C.text,
                fontFamily: MONO,
                fontSize: 13,
                padding: "8px 10px",
                boxSizing: "border-box",
                outline: "none",
                textAlign: "center",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
