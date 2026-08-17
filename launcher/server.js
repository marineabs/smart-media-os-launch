import http from "http";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const LAUNCHER_PORT = Number(process.env.LAUNCHER_PORT || 4599);

let appProcess = null;
let taskRunning = false;
let status = "idle";
let lastConfig = null;
const logs = [];

function pushLog(line) {
  const text = `[${new Date().toLocaleTimeString("zh-CN", { hour12: false })}] ${line}`;
  logs.push(text);
  if (logs.length > 500) logs.shift();
  console.log(text);
}

function getLocalIps() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => item.address);
}

function sendJson(res, payload, code = 200) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function validateProjectDir(projectDir) {
  const resolved = path.resolve(String(projectDir || PROJECT_ROOT));
  const packagePath = path.join(resolved, "package.json");
  if (!fs.existsSync(packagePath)) {
    throw new Error(`项目目录无效，未找到 package.json：${resolved}`);
  }
  return resolved;
}

function runFiniteCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    pushLog(`执行：${command} ${args.join(" ")}`);
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: false
    });

    child.stdout.on("data", (data) => pushLog(data.toString().trimEnd()));
    child.stderr.on("data", (data) => pushLog(data.toString().trimEnd()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} 退出码 ${code}`));
      }
    });
  });
}

function startLongRunningCommand(command, args, options) {
  pushLog(`启动：${command} ${args.join(" ")}`);
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    shell: false,
    detached: true
  });

  appProcess = child;
  status = "running";
  child.stdout.on("data", (data) => pushLog(data.toString().trimEnd()));
  child.stderr.on("data", (data) => pushLog(data.toString().trimEnd()));
  child.on("error", (error) => {
    pushLog(`服务启动失败：${error.message}`);
    status = "error";
    appProcess = null;
  });
  child.on("close", (code) => {
    pushLog(`服务已退出，退出码：${code}`);
    status = code === 0 ? "stopped" : "error";
    appProcess = null;
  });
}

async function startApp(config) {
  if (taskRunning) throw new Error("已有启动任务正在执行");
  if (appProcess) throw new Error("服务已在运行，请先停止再重新启动");

  taskRunning = true;
  status = "starting";
  try {
    const projectDir = validateProjectDir(config.projectDir);
    const mode = config.mode === "dev" ? "dev" : "prod";
    const ip = String(config.ip || "127.0.0.1").trim();
    const appPort = mode === "dev" ? 5173 : Number(config.port || 3001);
    const publicClientUrl = `http://${ip}:${appPort}`;
    const env = {
      ...process.env,
      CLIENT_ORIGIN: "*",
      PUBLIC_CLIENT_URL: publicClientUrl
    };

    lastConfig = { projectDir, mode, ip, publicClientUrl };
    pushLog(`项目目录：${projectDir}`);
    pushLog(`访问地址：${publicClientUrl}`);

    if (config.install) {
      await runFiniteCommand("npm", ["install"], { cwd: projectDir, env });
    }

    if (mode === "prod" && config.build) {
      await runFiniteCommand("npm", ["run", "build"], { cwd: projectDir, env });
    }

    startLongRunningCommand("npm", ["run", mode === "dev" ? "dev" : "start"], { cwd: projectDir, env });
  } finally {
    taskRunning = false;
  }
}

function stopApp() {
  if (!appProcess) {
    status = "stopped";
    return;
  }
  pushLog("正在停止服务...");
  try {
    process.kill(-appProcess.pid, "SIGTERM");
  } catch (error) {
    try {
      appProcess.kill("SIGTERM");
    } catch {
      pushLog(`停止失败：${error.message}`);
    }
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/") {
      const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "GET" && req.url === "/api/status") {
      sendJson(res, {
        status,
        taskRunning,
        running: Boolean(appProcess),
        projectRoot: PROJECT_ROOT,
        ips: getLocalIps(),
        lastConfig,
        logs
      });
      return;
    }

    if (req.method === "POST" && req.url === "/api/start") {
      const body = await readBody(req);
      startApp(body).catch((error) => {
        pushLog(`启动失败：${error.message}`);
        status = "error";
        taskRunning = false;
      });
      sendJson(res, { ok: true });
      return;
    }

    if (req.method === "POST" && req.url === "/api/stop") {
      stopApp();
      sendJson(res, { ok: true });
      return;
    }

    sendJson(res, { ok: false, error: "not_found" }, 404);
  } catch (error) {
    pushLog(`请求处理失败：${error.message}`);
    sendJson(res, { ok: false, error: error.message }, 500);
  }
});

server.listen(LAUNCHER_PORT, "127.0.0.1", () => {
  pushLog(`配置器已启动：http://localhost:${LAUNCHER_PORT}`);
});
