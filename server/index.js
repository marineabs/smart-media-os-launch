import express from "express";
import http from "http";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const PUBLIC_CLIENT_URL = process.env.PUBLIC_CLIENT_URL || "";
const DEFAULT_ENERGY_STEP = Number(process.env.ENERGY_STEP || 5);
const DEFAULT_TARGET_PARTICIPANTS = Math.max(1, Math.round(100 / DEFAULT_ENERGY_STEP));
const NODE_COUNT = 8;
const MAX_LOGS = 8;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors({ origin: CLIENT_ORIGIN === "*" ? true : CLIENT_ORIGIN }));
app.use(express.json());

let sessionId = Date.now();
let targetParticipants = DEFAULT_TARGET_PARTICIPANTS;
let energyStep = 100 / targetParticipants;
let energyValue = 0;
let audioEnabled = false;

const initialState = () => ({
  sessionId,
  phase: "idle",
  energy: 0,
  participants: 0,
  targetParticipants,
  energyStep: formatEnergyStep(),
  audioEnabled,
  litNodes: 0,
  countdown: null,
  message: "等待产业能量汇聚",
  status: "能量蓄集中",
  capabilityIndex: 0,
  updatedAt: Date.now(),
  logs: [`${formatLogTime()} 等待您的能量接入...`]
});

let state = initialState();
let participantIds = new Set();
let participantLabels = new Map();
let participantUnits = new Map();
let participantSequence = 0;
let countdownTimer = null;

const capabilities = [
  "统一标准加载完成",
  "统一框架加载完成",
  "统一安全加载完成",
  "统一生态加载完成"
];

function formatEnergyStep() {
  return Number(energyStep.toFixed(2));
}

function clampEnergyValue(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function clampEnergy(value) {
  if (value >= 100) return 100;
  return Math.max(0, Math.min(99, Math.round(value)));
}

function derivePhase(energy) {
  if (energy >= 100) return "countdown";
  if (energy >= 80) return "boost";
  if (energy > 0) return "charging";
  return "idle";
}

function formatLogTime(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function addLog(text) {
  state.logs = [`${formatLogTime()} ${text}`, ...state.logs].slice(0, MAX_LOGS);
}

function normalizeUnitName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 24);
}

function getParticipantLabel(participantId, unitName = "") {
  const normalizedUnitName = normalizeUnitName(unitName);
  if (!participantId) return "移动端";
  if (normalizedUnitName) {
    participantUnits.set(participantId, normalizedUnitName);
    return normalizedUnitName;
  }
  const existingUnitName = participantUnits.get(participantId);
  if (existingUnitName) return existingUnitName;
  if (!participantLabels.has(participantId)) {
    participantSequence += 1;
    participantLabels.set(participantId, `移动端 ${String(participantSequence).padStart(2, "0")}`);
  }
  return participantLabels.get(participantId);
}

function syncDerivedState(nextEnergy = state.energy) {
  energyValue = clampEnergyValue(nextEnergy);
  state.energy = clampEnergy(energyValue);
  state.sessionId = sessionId;
  state.targetParticipants = targetParticipants;
  state.energyStep = formatEnergyStep();
  state.audioEnabled = audioEnabled;
  state.litNodes = Math.min(NODE_COUNT, Math.ceil((state.energy / 100) * NODE_COUNT));
  state.capabilityIndex = Math.min(
    capabilities.length - 1,
    Math.max(0, Math.floor((state.energy - 80) / 5))
  );

  if (state.phase !== "countdown" && state.phase !== "launched") {
    state.phase = derivePhase(state.energy);
    if (state.phase === "boost") {
      state.status = "核心能力加载中";
      state.message = "智慧视听新生态即将开启";
    } else if (state.phase === "charging") {
      state.status = "能量接入中";
    } else {
      state.status = "能量蓄集中";
      state.message = "等待产业能量汇聚";
    }
  }

  state.updatedAt = Date.now();
}

function emitState(eventName = "state:update", extra = {}) {
  io.emit(eventName, {
    ...state,
    sessionId,
    targetParticipants,
    energyStep: formatEnergyStep(),
    audioEnabled,
    capabilities,
    nodeCount: NODE_COUNT,
    ...extra
  });
}

function clearCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function enterLaunched() {
  clearCountdown();
  state.phase = "launched";
  state.energy = 100;
  state.litNodes = NODE_COUNT;
  state.countdown = null;
  state.status = "正式启动";
  state.message = "智慧视听操作系统专业委员会正式启动";
  addLog("专业委员会正式启动，智慧视听新生态启动");
  syncDerivedState(100);
  state.phase = "launched";
  emitState("launch:complete", { flashId: Date.now() });
}

function startCountdown() {
  if (state.phase === "launched") return;

  clearCountdown();
  state.phase = "countdown";
  state.energy = 100;
  state.litNodes = NODE_COUNT;
  state.countdown = 5;
  state.status = "启动倒计时";
  state.message = "专业委员会启动准备就绪";
  addLog("专业委员会启动准备就绪，启动倒计时");
  emitState("countdown:start", { flashId: Date.now() });

  countdownTimer = setInterval(() => {
    state.countdown -= 1;
    state.updatedAt = Date.now();

    if (state.countdown <= 0) {
      enterLaunched();
      return;
    }

    emitState("countdown:tick", { flashId: Date.now() });
  }, 1000);
}

function increaseEnergy(amount, source = "scan", participantId = "", unitName = "") {
  if (state.phase === "launched" || state.phase === "countdown") {
    return { ok: false, reason: "closed" };
  }

  const normalizedUnitName = normalizeUnitName(unitName);
  if (source === "scan" && !normalizedUnitName) {
    return { ok: false, reason: "missing_name" };
  }

  const isNewParticipant = participantId && !participantIds.has(participantId);
  if (source === "scan" && participantId && !isNewParticipant) {
    getParticipantLabel(participantId, normalizedUnitName);
    return { ok: false, reason: "duplicate" };
  }

  if (source === "scan") {
    if (participantId) participantIds.add(participantId);
    if (isNewParticipant || !participantId) {
      state.participants += 1;
    }
  }

  state.message = source === "admin" ? "后台能量指令已接入" : "新的产业能量已接入";
  if (source === "admin") {
    addLog("后台手动注入能量");
  } else {
    const participantLabel = getParticipantLabel(participantId, normalizedUnitName);
    const actionText = isNewParticipant || !participantId ? "接入能量" : "再次注入";
    addLog(`${participantLabel} ${actionText}`);
  }
  syncDerivedState(energyValue + amount);

  emitState("energy:pulse", {
    pulse: {
      id: Date.now(),
      source,
      amount,
      participantId
    }
  });

  if (energyValue >= 100) {
    startCountdown();
  }

  return { ok: true };
}

function setTargetParticipants(value) {
  const nextTarget = Math.max(1, Math.min(500, Math.round(Number(value) || DEFAULT_TARGET_PARTICIPANTS)));
  targetParticipants = nextTarget;
  energyStep = 100 / targetParticipants;

  if (state.phase !== "countdown" && state.phase !== "launched") {
    syncDerivedState(state.participants * energyStep);
  } else {
    state.targetParticipants = targetParticipants;
    state.energyStep = formatEnergyStep();
  }

  addLog(`预计参与人数设为 ${targetParticipants} 人`);
  emitState("state:update");
  return { targetParticipants, energyStep: formatEnergyStep() };
}

function setAudioEnabled(value) {
  audioEnabled = Boolean(value);
  state.audioEnabled = audioEnabled;
  addLog(audioEnabled ? "现场音效已开启" : "现场音效已关闭");
  emitState("state:update");
  return { audioEnabled };
}

function resetState() {
  clearCountdown();
  sessionId = Date.now();
  energyValue = 0;
  state = initialState();
  participantIds = new Set();
  participantLabels = new Map();
  participantUnits = new Map();
  participantSequence = 0;
  emitState("state:reset", { flashId: Date.now() });
}

function getPublicBaseUrl(req) {
  if (PUBLIC_CLIENT_URL) return PUBLIC_CLIENT_URL.replace(/\/$/, "");
  const host = req.get("host")?.replace(`:${PORT}`, ":5173") || "localhost:5173";
  return `${req.protocol}://${host}`;
}

app.get("/api/state", (_req, res) => {
  res.json({ ...state, capabilities, nodeCount: NODE_COUNT, targetParticipants, energyStep: formatEnergyStep(), audioEnabled });
});

app.get("/api/scan-url", (req, res) => {
  res.json({ url: `${getPublicBaseUrl(req)}/mobile` });
});

app.post("/api/admin/reset", (_req, res) => {
  resetState();
  res.json({ ok: true, state });
});

app.post("/api/admin/add-energy", (req, res) => {
  const amount = Number(req.body?.amount || 10);
  const result = increaseEnergy(amount, "admin");
  res.json({ ok: result.ok, reason: result.reason, state });
});

app.post("/api/admin/target-participants", (req, res) => {
  const config = setTargetParticipants(req.body?.targetParticipants);
  res.json({ ok: true, state, config });
});

app.post("/api/admin/audio", (req, res) => {
  const config = setAudioEnabled(req.body?.audioEnabled);
  res.json({ ok: true, state, config });
});

app.post("/api/admin/countdown", (_req, res) => {
  startCountdown();
  res.json({ ok: true, state });
});

app.post("/api/admin/launch", (_req, res) => {
  enterLaunched();
  res.json({ ok: true, state });
});

const clientDist = path.resolve(__dirname, "../client/dist");
app.use(express.static(clientDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/socket.io")) return next();
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) next();
  });
});

io.on("connection", (socket) => {
  socket.emit("state:update", {
    ...state,
    sessionId,
    targetParticipants,
    energyStep: formatEnergyStep(),
    audioEnabled,
    capabilities,
    nodeCount: NODE_COUNT
  });

  socket.on("client:join", (payload = {}) => {
    socket.data.role = payload.role || "guest";
    socket.emit("state:update", {
      ...state,
      sessionId,
      targetParticipants,
      energyStep: formatEnergyStep(),
      audioEnabled,
      capabilities,
      nodeCount: NODE_COUNT
    });
  });

  socket.on("energy:inject", (payload = {}, callback) => {
    const participantId = String(payload.participantId || socket.id);
    const unitName = normalizeUnitName(payload.unitName);
    const result = increaseEnergy(energyStep, "scan", participantId, unitName);
    callback?.({ ok: result.ok, reason: result.reason, state });
  });

  socket.on("admin:addEnergy", (payload = {}, callback) => {
    const amount = Number(payload.amount || 10);
    const result = increaseEnergy(amount, "admin");
    callback?.({ ok: result.ok, reason: result.reason, state });
  });

  socket.on("admin:setTargetParticipants", (payload = {}, callback) => {
    const config = setTargetParticipants(payload.targetParticipants);
    callback?.({ ok: true, state, config });
  });

  socket.on("admin:setAudioEnabled", (payload = {}, callback) => {
    const config = setAudioEnabled(payload.audioEnabled);
    callback?.({ ok: true, state, config });
  });

  socket.on("admin:reset", (_payload, callback) => {
    resetState();
    callback?.({ ok: true, state });
  });

  socket.on("admin:startCountdown", (_payload, callback) => {
    startCountdown();
    callback?.({ ok: true, state });
  });

  socket.on("admin:launch", (_payload, callback) => {
    enterLaunched();
    callback?.({ ok: true, state });
  });
});

server.listen(PORT, () => {
  console.log(`Socket.IO server listening on http://localhost:${PORT}`);
});
