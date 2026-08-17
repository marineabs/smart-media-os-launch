# 智慧视听操作系统专业委员会启动互动系统

React + Node.js + Socket.IO 实现的会议现场互动启动系统，包含大屏展示、手机扫码助力、后台控制和本地启动配置器。

## 功能

- 大屏端实时展示能量值、参与人数、生态节点、能量接入动态和最终启动画面。
- 手机端填写姓名或单位名称后注入能量，成功后进入“助力成功”页面。
- 同一轮次同一台手机或浏览器只能注入一次，后台重置后进入新轮次。
- 能量达到 80% 后进入强化加载状态。
- 能量达到 100% 后自动进入 5 秒倒计时。
- 倒计时结束后显示“智慧视听操作系统专业委员会正式启动”最终画面。
- 后台控制端支持预计参与人数、音效开关、手动加能量、倒计时、直接启动和重置。
- 大屏右下角保留音效按钮，用于现场浏览器音频解锁。
- 启动配置器支持自动获取本机 IP、启动正式服务或开发服务。

## 页面地址

开发模式默认访问：

- 大屏端：`http://localhost:5173/screen`
- 手机扫码端：`http://localhost:5173/mobile`
- 后台控制端：`http://localhost:5173/admin`
- 手机控制台备用入口：`http://localhost:5173/mobile-control`
- Socket.IO 服务：`http://localhost:3001`

正式部署默认访问：

- 大屏端：`http://本机IP:3001/screen`
- 手机扫码端：`http://本机IP:3001/mobile`
- 后台控制端：`http://本机IP:3001/admin`
- 手机控制台备用入口：`http://本机IP:3001/mobile-control`

## 推荐启动方式

要求 Node.js 18 或更高版本。

不需要手动打开 HTML 文件，直接双击启动配置文件：

- macOS：双击 `启动配置.command`
- Windows：双击 `启动配置.bat`

启动后会自动打开：

```text
http://localhost:4599
```

配置页面支持：

- 自动读取本机局域网 IP。
- 自动填写当前项目目录。
- 选择启动模式：
  - 正式部署：访问端口 `3001`
  - 开发调试：访问端口 `5173`
- 选择是否执行 `npm install`。
- 选择是否在正式部署前执行前端构建。
- 一键启动服务。
- 一键停止服务。
- 查看运行日志。
- 直接查看大屏端、手机端和后台端链接。

现场一般选择 `192.168.x.x` 形式的局域网 IP。手机和大屏电脑必须处于同一 Wi-Fi 或局域网内。

## 手动开发运行

```bash
npm install
npm run dev
```

开发模式会同时启动：

- 前端 Vite：`http://localhost:5173`
- Node 服务：`http://localhost:3001`

如需让手机访问开发服务，建议指定局域网地址：

```bash
PUBLIC_CLIENT_URL=http://本机IP:5173 CLIENT_ORIGIN=* npm run dev
```

示例：

```bash
PUBLIC_CLIENT_URL=http://192.168.1.101:5173 CLIENT_ORIGIN=* npm run dev
```

## 手动正式部署

```bash
npm install
npm run build
PUBLIC_CLIENT_URL=http://本机IP:3001 CLIENT_ORIGIN=* npm run start
```

示例：

```bash
PUBLIC_CLIENT_URL=http://192.168.1.101:3001 CLIENT_ORIGIN=* npm run start
```

正式模式下 Node.js 会直接托管 `client/dist`，不需要再启动 Vite，也不需要访问 `5173` 端口。

## 后台控制

后台地址：

```text
http://本机IP:3001/admin
```

后台可以操作：

- 设置预计参与人数。
- 自动计算每人能量值。
- 开启或关闭现场音效。
- 手动加能量。
- 进入倒计时。
- 直接启动。
- 重置当前轮次。

预计参与人数会决定每位参与者贡献的能量：

```text
20 人 -> 每人 5%
30 人 -> 每人 3.33%
10 人 -> 每人 10%
```

建议正式开始前先设置预计参与人数。如果启动过程中修改，系统会按当前已参与人数重新计算现场能量。

## 手机端参与规则

手机端地址：

```text
http://本机IP:3001/mobile
```

规则：

- 必须填写“姓名或单位名称”才能提交。
- 提交成功后显示“助力成功”页面。
- 当前轮次内，同一台手机或同一浏览器不能重复注入。
- 后台点击“重置”后会进入新轮次，同一台手机可以再次参与。
- 大屏“能量接入动态”会显示时间和姓名或单位名称，例如：

```text
14:32 中国移动 接入能量
14:33 华为 接入能量
14:34 后台手动注入能量
```

## 二维码规则

大屏底部二维码自动生成，不需要外部生成。

二维码内容来自服务端 `/api/scan-url`，会指向手机端 `/mobile`。

现场建议通过启动配置器或环境变量设置正确的 `PUBLIC_CLIENT_URL`，例如：

```text
http://192.168.1.101:3001/mobile
```

如果大屏用 `localhost` 打开，手机扫码可能打不开，因为手机的 `localhost` 指向手机自身。现场应使用局域网 IP 打开大屏。

## 音效说明

音效可以在以下位置控制：

- 大屏右下角音效按钮。
- 后台 `/admin` 的现场设置。
- 手机控制台备用入口 `/mobile-control`。

浏览器通常要求页面有过一次真实点击后才能播放音频。如果后台或手机控制台开启音效后大屏没有声音，请在大屏页面点击一次右下角音效按钮。

默认使用浏览器 Web Audio 合成互动音效，不生成背景氛围音，避免现场出现低频嗡鸣。如需使用真实背景音乐或音效，把文件放到：

```text
client/public/audio/
```

然后在 `client/src/main.jsx` 的 `audioConfig.files` 中填写路径，例如：

```js
files: {
  bgm: "/audio/bgm.mp3",
  inject: "/audio/inject.mp3",
  boost: "/audio/boost.mp3",
  countdown: "/audio/countdown.mp3",
  launch: "/audio/launch.mp3"
}
```

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3001` | Node.js 正式服务端口 |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS 来源，现场调试可用 `*` |
| `PUBLIC_CLIENT_URL` | 空 | 生成二维码使用的前端公网或局域网地址 |
| `ENERGY_STEP` | `5` | 初始默认能量步进，用于推算默认预计参与人数；现场推荐在后台设置预计参与人数 |
| `VITE_SOCKET_URL` | `http://当前主机:3001` | 前端连接 Socket.IO 的地址 |
| `LAUNCHER_PORT` | `4599` | 启动配置器端口 |

## 目录结构

```text
.
├── client
│   ├── public/assets
│   │   ├── start-screen.png
│   │   └── final-screen.png
│   └── src
│       ├── main.jsx
│       └── styles.css
├── launcher
│   ├── index.html
│   ├── package.json
│   └── server.js
├── server
│   └── index.js
├── package.json
├── 启动配置.command
├── 启动配置.bat
└── README.md
```

## 现场操作建议

- 大屏建议使用 1920x1080 或其他 16:9 分辨率全屏打开 `/screen`。
- 后台控制端由导播或技术人员打开 `/admin`。
- 正式开始前在后台设置预计参与人数。
- 正式开始前测试一次音效；如果没声音，点击大屏右下角音效按钮解锁。
- 彩排后点击后台“重置”，再进入正式流程。
- 手机和大屏电脑必须在同一 Wi-Fi 或局域网。
- 如果手机无法访问，检查电脑 IP、防火墙、路由器 AP 隔离或客户端隔离设置。
