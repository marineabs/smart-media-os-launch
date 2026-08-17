import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import { QRCodeSVG } from "qrcode.react";
import {
  Activity,
  Antenna,
  BatteryCharging,
  CircleDot,
  Car,
  CheckCircle2,
  Clapperboard,
  Cpu,
  Network,
  Monitor,
  Play,
  Radio,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Tablet,
  Tv,
  UsersRound,
  Volume2,
  VolumeX,
  Zap
} from "lucide-react";
import "./styles.css";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  `${window.location.protocol}//${window.location.hostname}:3001`;

const audioConfig = {
  volume: 0.72,
  bgmVolume: 0.18,
  files: {
    bgm: "",
    inject: "",
    boost: "",
    countdown: "",
    launch: ""
  }
};

const defaultState = {
  sessionId: "default",
  phase: "idle",
  energy: 0,
  participants: 0,
  targetParticipants: 20,
  energyStep: 5,
  audioEnabled: false,
  litNodes: 0,
  countdown: null,
  message: "等待产业能量汇聚",
  status: "能量蓄集中",
  capabilityIndex: 0,
  logs: ["等待您的能量接入..."],
  capabilities: ["统一标准加载完成", "统一框架加载完成", "统一安全加载完成", "统一生态加载完成"],
  nodeCount: 8
};

const sources = [
  ["运营商协同", Radio],
  ["终端适配", Monitor],
  ["芯片支撑", Cpu],
  ["内容生态", Clapperboard],
  ["安全可信", ShieldCheck],
  ["开源共建", Activity]
];

const nodes = [
  ["运营商", Antenna],
  ["内容平台", Play],
  ["研发机构", Activity],
  ["开源社区", Cpu],
  ["安全机构", ShieldCheck],
  ["芯片企业", Cpu],
  ["终端厂商", Monitor],
  ["生态伙伴", Zap]
];

const devices = [
  ["电视", Tv],
  ["机顶盒", Monitor],
  ["智慧屏", Monitor],
  ["车载屏", Car],
  ["移动终端", Smartphone],
  ["公共大屏", Tablet]
];

function useLaunchSocket(role) {
  const socketRef = useRef(null);
  const [state, setState] = useState(defaultState);
  const [connected, setConnected] = useState(false);
  const [pulse, setPulse] = useState(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"]
    });

    socketRef.current = socket;
    socket.on("connect", () => {
      setConnected(true);
      socket.emit("client:join", { role });
    });
    socket.on("disconnect", () => setConnected(false));

    const update = (next) => setState((prev) => ({ ...prev, ...next }));
    socket.on("state:update", update);
    socket.on("state:reset", update);
    socket.on("countdown:start", update);
    socket.on("countdown:tick", update);
    socket.on("launch:complete", update);
    socket.on("energy:pulse", (next) => {
      update(next);
      setPulse(next.pulse || { id: Date.now() });
    });

    return () => socket.disconnect();
  }, [role]);

  const actions = useMemo(
    () => ({
      inject: (participantId, unitName) =>
        new Promise((resolve) => {
          if (!socketRef.current) {
            resolve({ ok: false, reason: "offline" });
            return;
          }
          socketRef.current.emit("energy:inject", { participantId, unitName }, (response) => {
            resolve(response || { ok: false });
          });
        }),
      addEnergy: (amount) =>
        socketRef.current?.emit("admin:addEnergy", { amount }),
      setTargetParticipants: (targetParticipants) =>
        new Promise((resolve) => {
          if (!socketRef.current) {
            resolve({ ok: false, reason: "offline" });
            return;
          }
          socketRef.current.emit("admin:setTargetParticipants", { targetParticipants }, (response) => {
            resolve(response || { ok: false });
          });
        }),
      setAudioEnabled: (audioEnabled) =>
        new Promise((resolve) => {
          if (!socketRef.current) {
            resolve({ ok: false, reason: "offline" });
            return;
          }
          socketRef.current.emit("admin:setAudioEnabled", { audioEnabled }, (response) => {
            resolve(response || { ok: false });
          });
        }),
      reset: () => socketRef.current?.emit("admin:reset"),
      countdown: () => socketRef.current?.emit("admin:startCountdown"),
      launch: () => socketRef.current?.emit("admin:launch")
    }),
    []
  );

  return { state, connected, pulse, actions };
}

function useLaunchAudio(state, pulse) {
  const enabled = Boolean(state.audioEnabled);
  const ctxRef = useRef(null);
  const fileRef = useRef({});
  const lastPhaseRef = useRef(null);
  const lastPulseRef = useRef(null);
  const lastEnabledRef = useRef(false);

  const getContext = () => {
    if (!ctxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  };

  const getFile = (name) => {
    const src = audioConfig.files[name];
    if (!src) return null;
    if (!fileRef.current[name]) {
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.volume = name === "bgm" ? audioConfig.bgmVolume : audioConfig.volume;
      if (name === "bgm") audio.loop = true;
      fileRef.current[name] = audio;
    }
    return fileRef.current[name];
  };

  const playFile = (name) => {
    const audio = getFile(name);
    if (!audio) return false;
    audio.currentTime = 0;
    audio.play().catch(() => {});
    return true;
  };

  const playTone = (frequency, duration = 0.18, delay = 0, type = "sine", gainValue = 0.1) => {
    const ctx = getContext();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue * audioConfig.volume, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  };

  const playSynthetic = (name) => {
    if (name === "inject") {
      [660, 880, 1320].forEach((freq, index) => playTone(freq, 0.16, index * 0.055, "triangle", 0.08));
      return;
    }
    if (name === "boost") {
      [220, 330, 440, 660].forEach((freq, index) => playTone(freq, 0.24, index * 0.075, "sawtooth", 0.06));
      return;
    }
    if (name === "countdown") {
      playTone(520, 0.18, 0, "square", 0.07);
      playTone(780, 0.18, 0.18, "square", 0.06);
      return;
    }
    if (name === "launch") {
      [196, 294, 392, 588, 784].forEach((freq, index) => playTone(freq, 0.55, index * 0.08, "triangle", 0.09));
    }
  };

  const playEffect = (name) => {
    if (!enabled) return;
    if (!playFile(name)) playSynthetic(name);
  };

  const startBgm = () => {
    const file = getFile("bgm");
    if (file) {
      file.play().catch(() => {});
    }
  };

  const stopBgm = () => {
    const file = fileRef.current.bgm;
    if (file) file.pause();
  };

  useEffect(() => {
    if (!enabled) {
      stopBgm();
      lastEnabledRef.current = false;
      return;
    }

    const startAudio = async () => {
      const ctx = getContext();
      if (ctx?.state === "suspended") {
        await ctx.resume().catch(() => {});
      }
      startBgm();
      if (!lastEnabledRef.current) playSynthetic("inject");
      lastEnabledRef.current = true;
    };

    startAudio();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !pulse?.id || lastPulseRef.current === pulse.id) return;
    lastPulseRef.current = pulse.id;
    playEffect("inject");
  }, [enabled, pulse]);

  useEffect(() => {
    if (!enabled) {
      lastPhaseRef.current = state.phase;
      return;
    }
    const previous = lastPhaseRef.current;
    lastPhaseRef.current = state.phase;
    if (!previous || previous === state.phase) return;

    if (state.phase === "boost") playEffect("boost");
    if (state.phase === "countdown") playEffect("countdown");
    if (state.phase === "launched") playEffect("launch");
  }, [enabled, state.phase]);

  useEffect(() => () => stopBgm(), []);

  return { enabled };
}

function getParticipantId() {
  const key = "smart-media-os-participant";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  window.localStorage.setItem(key, next);
  return next;
}

function getStoredUnitName() {
  return window.localStorage.getItem("smart-media-os-unit-name") || "";
}

function getSubmittedKey(sessionId, participantId) {
  return `smart-media-os-submitted-${sessionId || "default"}-${participantId}`;
}

function HomeRouter() {
  const route = window.location.pathname.replace(/\/$/, "") || "/screen";
  if (route === "/mobile") return <MobilePage />;
  if (route === "/mobile-control") return <MobileControlPage />;
  if (route === "/admin") return <AdminPage />;
  return <ScreenPage />;
}

function ScreenPage() {
  const { state, connected, pulse, actions } = useLaunchSocket("screen");
  const [scanUrl, setScanUrl] = useState(`${window.location.origin}/mobile`);
  const phaseClass = `phase-${state.phase}`;
  useLaunchAudio(state, pulse);

  useEffect(() => {
    fetch(`${SOCKET_URL}/api/scan-url`)
      .then((res) => res.json())
      .then((data) => data.url && setScanUrl(data.url))
      .catch(() => setScanUrl(`${window.location.origin}/mobile`));
  }, []);

  const activeCapability = state.phase === "boost" || state.phase === "countdown"
    ? state.capabilities?.[state.capabilityIndex] || "核心能力加载中"
    : state.status;

  return (
    <main className={`screen-shell ${phaseClass}`}>
      <div className="reference-bg reference-start" />
      <div className="grid-overlay" />
      <div className="energy-waves" />
      {pulse && <div key={pulse.id} className="flying-particle" />}

      <header className="screen-header">
        <div />
        <div className="title-block">
          <h1>智慧视听操作系统产业联盟成立大会</h1>
          <p>汇聚产业能量　共启视听新生态</p>
        </div>
        <div className="scan-hint">
          <Zap size={20} />
          <span>扫码参与启动</span>
        </div>
      </header>

      <section className="side-panel left-panel">
        <h2>产业能量来源</h2>
        {sources.map(([label, Icon]) => (
          <div className="source-row" key={label}>
            <span className="source-icon"><Icon size={21} /></span>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <section className="core-stage">
        <div className="orbit">
          {nodes.map(([label, Icon], index) => {
            const lit = index < state.litNodes || ["countdown", "launched"].includes(state.phase);
            return (
              <div
                className={`orbit-node ${lit ? "lit" : ""}`}
                style={{ "--angle": `${index * (360 / nodes.length)}deg` }}
                key={label}
              >
                <span><Icon size={28} /></span>
                <small>{label}</small>
              </div>
            );
          })}
        </div>

        <div className="core">
          <div className="core-rings" />
          <div className="core-disc">
            <span className="core-name">Smart Media OS</span>
            <strong>智慧视听操作系统</strong>
            {state.phase === "countdown" ? (
              <b className="count-number">{state.countdown}</b>
            ) : (
              <>
                <small>{state.status}</small>
                <b>{state.energy}%</b>
              </>
            )}
          </div>
        </div>

        <div className="device-row">
          {devices.map(([label, Icon], index) => (
            <div
              className={`device-item ${state.energy >= 80 || state.phase === "launched" ? "visible" : ""}`}
              style={{ "--delay": `${index * 110}ms` }}
              key={label}
            >
              <Icon size={24} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="side-panel right-panel">
        <h2>实时参与数据</h2>
        <Metric icon={UsersRound} label="已参与人数" value={state.participants} unit="人" />
        <Metric icon={BatteryCharging} label="累计能量值" value={state.energy} unit="%" />
        <Metric icon={Network} label="点亮生态节点" value={state.litNodes} unit="个" />
        <Metric icon={CircleDot} label="距离启动还差" value={Math.max(0, 100 - state.energy)} unit="%" />
      </section>

      <section className="side-panel event-panel">
        <h2>能量接入动态</h2>
        {(state.logs || []).slice(0, 3).map((item, index) => (
          <p key={`${item}-${index}`}>{item}<span>··</span></p>
        ))}
      </section>

      <footer className="screen-footer">
        <div className="qr-card">
          <QRCodeSVG value={scanUrl} size={132} fgColor="#051426" bgColor="#ffffff" />
        </div>
        <div className="footer-copy">
          <span>扫码为智慧视听操作系统</span>
          <strong>注入能量</strong>
          <small>每一次参与，都是产业生态的一次连接</small>
        </div>
      </footer>

      <div className="message-strip">{state.message}</div>
      <div className="screen-float-actions">
        <button
          className={`audio-toggle ${state.audioEnabled ? "on" : ""}`}
          onClick={() => actions.setAudioEnabled(!state.audioEnabled)}
          title={state.audioEnabled ? "音效已开" : "开启音效"}
        >
          {state.audioEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
          <span>音效</span>
        </button>
      </div>
      <div className={`connection-dot ${connected ? "online" : ""}`} />
      {state.phase === "launched" && <FinalScene />}
    </main>
  );
}

function Metric({ icon: Icon, label, value, unit }) {
  return (
    <div className={`metric ${Icon ? "has-icon" : ""}`}>
      {Icon && <span className="metric-icon"><Icon size={19} /></span>}
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{unit}</em>
    </div>
  );
}

function FinalScene() {
  return (
    <section className="final-scene">
      <div className="reference-bg reference-final" />
      <div className="final-glow" />
    </section>
  );
}

function MobilePage() {
  const { state, connected, actions } = useLaunchSocket("mobile");
  const [participantId] = useState(getParticipantId);
  const [unitName, setUnitName] = useState(getStoredUnitName);
  const [pressed, setPressed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [nameError, setNameError] = useState("");
  const closed = state.phase === "countdown" || state.phase === "launched";
  const disabled = closed || submitting || submitted;
  const trimmedUnitName = unitName.trim();

  useEffect(() => {
    setSubmitted(window.localStorage.getItem(getSubmittedKey(state.sessionId, participantId)) === "1");
  }, [state.sessionId, participantId]);

  const inject = async () => {
    if (disabled) return;
    if (!trimmedUnitName) {
      setNameError("请先输入姓名或单位名称");
      return;
    }
    window.localStorage.setItem("smart-media-os-unit-name", trimmedUnitName);
    setSubmitting(true);
    setPressed(true);
    const result = await actions.inject(participantId, trimmedUnitName);
    if (result.ok || result.reason === "duplicate") {
      const submittedSessionId = result.state?.sessionId || state.sessionId;
      window.localStorage.setItem(getSubmittedKey(submittedSessionId, participantId), "1");
      setSubmitted(true);
    } else if (result.reason === "missing_name") {
      setNameError("请先输入姓名或单位名称");
    }
    setSubmitting(false);
    window.setTimeout(() => setPressed(false), 650);
  };

  if (submitted) {
    return (
      <main className="mobile-shell">
        <div className="mobile-bg" />
        <section className="mobile-card success-card">
          <span className={`mobile-status ${connected ? "online" : ""}`}>
            {connected ? "已连接现场大屏" : "连接中"}
          </span>
          <CheckCircle2 size={62} className="success-icon" />
          <h1><span>助力成功</span></h1>
          <p>{trimmedUnitName ? `${trimmedUnitName} 的产业能量已接入` : "您的产业能量已接入现场大屏"}</p>
          <div className="mobile-meter">
            <strong>{state.energy}%</strong>
            <span>现场能量</span>
            <div><i style={{ width: `${state.energy}%` }} /></div>
          </div>
          <small>参与人数：{state.participants} 人</small>
        </section>
      </main>
    );
  }

  return (
    <main className="mobile-shell">
      <div className="mobile-bg" />
      <section className="mobile-card">
        <span className={`mobile-status ${connected ? "online" : ""}`}>
          {connected ? "已连接现场大屏" : "连接中"}
        </span>
        <h1><span>智慧视听操作系统</span><span>产业联盟成立大会</span></h1>
        <p>{state.phase === "launched" ? "联盟已正式成立" : "点击按钮，将您的产业能量注入中央核心"}</p>
        <label className="unit-field">
          <span>姓名或单位名称</span>
          <input
            type="text"
            value={unitName}
            maxLength={24}
            placeholder="请输入姓名或单位名称"
            onChange={(event) => {
              setUnitName(event.target.value);
              if (nameError) setNameError("");
            }}
            disabled={disabled}
          />
        </label>
        {nameError && <p className="field-error">{nameError}</p>}
        <div className="mobile-meter">
          <strong>{state.energy}%</strong>
          <span>现场能量</span>
          <div><i style={{ width: `${state.energy}%` }} /></div>
        </div>
        <button className={`inject-button ${pressed ? "pressed" : ""}`} onClick={inject} disabled={disabled}>
          <Zap size={30} />
          <span>{closed ? "启动已完成" : submitting ? "正在提交" : "注入能量"}</span>
        </button>
        <small>参与人数：{state.participants} 人</small>
      </section>
    </main>
  );
}

function MobileControlPage() {
  const { state, connected, actions } = useLaunchSocket("mobile-control");
  const [target, setTarget] = useState(state.targetParticipants || 20);
  const [saved, setSaved] = useState(false);
  const [audioSaving, setAudioSaving] = useState(false);

  useEffect(() => {
    setTarget(state.targetParticipants || 20);
  }, [state.targetParticipants]);

  const saveTarget = async () => {
    const result = await actions.setTargetParticipants(target);
    if (result.ok) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1200);
    }
  };

  const toggleAudio = async () => {
    setAudioSaving(true);
    await actions.setAudioEnabled(!state.audioEnabled);
    setAudioSaving(false);
  };

  return (
    <main className="mobile-shell">
      <div className="mobile-bg" />
      <section className="mobile-card control-card">
        <span className={`mobile-status ${connected ? "online" : ""}`}>
          {connected ? "控制台已连接" : "连接中"}
        </span>
        <h1><span>手机控制台</span></h1>
        <p>设置预计参与人数，系统将自动计算每位参与者的能量贡献。</p>
        <label className="unit-field">
          <span>预计参与人数</span>
          <input
            type="number"
            min="1"
            max="500"
            value={target}
            onChange={(event) => setTarget(Number(event.target.value))}
          />
        </label>
        <div className="control-summary">
          <Metric label="当前人数" value={state.targetParticipants || 20} unit="人" />
          <Metric label="每人能量" value={state.energyStep || 5} unit="%" />
          <Metric label="已参与" value={state.participants} unit="人" />
        </div>
        <button className={`control-toggle ${state.audioEnabled ? "on" : ""}`} onClick={toggleAudio} disabled={audioSaving}>
          {state.audioEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
          <span>{state.audioEnabled ? "关闭现场音效" : "开启现场音效"}</span>
        </button>
        <button className="inject-button" onClick={saveTarget}>
          <UsersRound size={28} />
          <span>{saved ? "已保存" : "确认设置"}</span>
        </button>
        <small>大屏端会实时同步新的能量计算规则</small>
      </section>
    </main>
  );
}

function AdminPage() {
  const { state, connected, actions } = useLaunchSocket("admin");
  const [amount, setAmount] = useState(10);
  const [target, setTarget] = useState(state.targetParticipants || 20);
  const [targetSaved, setTargetSaved] = useState(false);
  const [audioSaving, setAudioSaving] = useState(false);

  useEffect(() => {
    setTarget(state.targetParticipants || 20);
  }, [state.targetParticipants]);

  const saveTarget = async () => {
    const result = await actions.setTargetParticipants(target);
    if (result.ok) {
      setTargetSaved(true);
      window.setTimeout(() => setTargetSaved(false), 1200);
    }
  };

  const toggleAudio = async () => {
    setAudioSaving(true);
    await actions.setAudioEnabled(!state.audioEnabled);
    setAudioSaving(false);
  };

  return (
    <main className="admin-shell">
      <section className="admin-header">
        <div>
          <span className={`admin-conn ${connected ? "online" : ""}`}>{connected ? "服务已连接" : "服务未连接"}</span>
          <h1>启动互动后台控制端</h1>
          <p>用于现场导播、技术保障和主持流程兜底控制</p>
        </div>
        <a href="/screen" target="_blank" rel="noreferrer">打开大屏端</a>
      </section>

      <section className="admin-grid">
        <div className="admin-card">
          <h2>当前状态</h2>
          <Metric label="阶段" value={phaseText(state.phase)} unit="" />
          <Metric label="能量" value={state.energy} unit="%" />
          <Metric label="参与人数" value={state.participants} unit="人" />
          <Metric label="预计人数" value={state.targetParticipants || 20} unit="人" />
          <Metric label="每人能量" value={state.energyStep || 5} unit="%" />
          <Metric label="生态节点" value={state.litNodes} unit="个" />
        </div>

        <div className="admin-card">
          <h2>现场设置</h2>
          <div className="amount-control">
            <label htmlFor="targetParticipants">预计参与人数</label>
            <input
              id="targetParticipants"
              type="number"
              min="1"
              max="500"
              value={target}
              onChange={(event) => setTarget(Number(event.target.value))}
            />
            <button onClick={saveTarget}>
              <UsersRound size={18} /> {targetSaved ? "已保存" : "确认"}
            </button>
          </div>
          <div className="admin-config-summary">
            <Metric label="当前人数" value={state.targetParticipants || 20} unit="人" />
            <Metric label="每人能量" value={state.energyStep || 5} unit="%" />
          </div>
          <button className={`admin-audio-toggle ${state.audioEnabled ? "on" : ""}`} onClick={toggleAudio} disabled={audioSaving}>
            {state.audioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            {state.audioEnabled ? "关闭现场音效" : "开启现场音效"}
          </button>
        </div>

        <div className="admin-card">
          <h2>控制操作</h2>
          <div className="amount-control">
            <label htmlFor="amount">手动加能量</label>
            <input
              id="amount"
              type="number"
              min="1"
              max="100"
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value))}
            />
            <button onClick={() => actions.addEnergy(amount)}>
              <Zap size={18} /> 加能量
            </button>
          </div>
          <div className="admin-actions">
            <button onClick={actions.countdown}>
              <RotateCcw size={18} /> 进入倒计时
            </button>
            <button onClick={actions.launch}>
              <CheckCircle2 size={18} /> 直接启动
            </button>
            <button className="danger" onClick={actions.reset}>
              <RefreshCcw size={18} /> 重置
            </button>
          </div>
        </div>

        <div className="admin-card wide">
          <h2>动态日志</h2>
          {(state.logs || []).map((item, index) => (
            <p className="admin-log" key={`${item}-${index}`}>{item}</p>
          ))}
        </div>
      </section>
    </main>
  );
}

function phaseText(phase) {
  const map = {
    idle: "待启动",
    charging: "扫码注入",
    boost: "强化加载",
    countdown: "倒计时",
    launched: "已成立"
  };
  return map[phase] || phase;
}

createRoot(document.getElementById("root")).render(<HomeRouter />);
