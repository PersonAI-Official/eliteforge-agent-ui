# EliteForge Agent UI

面向 Web 应用的可复用 UI 组件 monorepo，提供聊天、独立消息输入区、A2UI、动效与终端相关的核心能力和 React/Vue 实现。宿主应用负责提供会话与消息服务、鉴权、Agent 服务及终端进程；本项目通过 adapter 和 transport 接入这些能力。

## 包结构

```text
packages/
├── a2ui-core/    # A2UI 协议解析、Catalog 与交互核心
├── a2ui-react/   # A2UI React 渲染器
├── a2ui-react-native/ # A2UI React Native 渲染器
├── a2ui-vue/     # A2UI Vue 渲染器
├── chat-core/    # 聊天数据类型、ChatAdapter、AG-UI 处理与模拟宿主
├── chat-react/   # React 聊天运行时、面板和悬浮窗口
├── chat-react-native/ # React Native 聊天面板、消息列表与输入区
├── chat-vue/     # Vue 3 聊天组件
├── chat-theme/   # 可复用、可覆盖的聊天主题
├── composer-core/  # 输入区类型、输入工具与共享样式
├── composer-react/ # React 独立消息输入区
├── composer-vue/   # Vue 3 独立消息输入区
├── motion-core/  # 共用动效配置、主题变量和播放策略
├── motion-react/ # React 动效 Provider、效果接口和默认实现
├── motion-vue/   # Vue 动效接口与实现
└── terminal/     # xterm 终端、命令块、AI 交互和传输接口
```

聊天组件通过 `ChatAdapter` 连接宿主的会话与消息服务；React Native 宿主改用 `chat-core/headless` 子路径（不引入 DOM/mermaid）并通过 RPC 客户端提供消息；终端通过 `TerminalTransport` 连接 PTY，并可通过 `AITransport` 连接 AI 服务。React 和 Vue 聊天运行时支持结构化历史、活动状态恢复、消息来源标注和断开观察后的会话恢复。A2UI 包提供协议解析、Catalog 和对应框架的渲染器。动效包为聊天与 A2UI 提供共享的 `MotionProvider`、`AgentMotion` 和 `MotionConfig`，支持主题变量、系统减弱动画偏好和宿主开关。

## 本地开发与演示

```sh
npm install
npm run check
```

启动交互演示：

```sh
npm run dev --workspace @personai/agent-ui-chat-react
npm run dev --workspace @personai/agent-ui-chat-vue
npm run dev --workspace @personai/agent-ui-composer-react
npm run dev --workspace @personai/agent-ui-composer-vue
npm run dev --workspace @personai/agent-ui-terminal
```

React/Vue 聊天演示使用 `chat-core` 的模拟 adapter，可创建会话、发送消息并查看 AG-UI 活动；终端演示使用内存模拟的 Shell 和 AI transport，不会访问外部服务。独立输入区支持附件、命令/技能、队列和主题，接入见[独立消息输入区](docs/composer.md)。详细接入步骤见[接入指南](docs/integration-guide.md)，React Native 接入见[React Native 聊天与 A2UI](docs/react-native.md)，各组件 README 提供对应 API 说明。动效接入与 Bits 适配约定见[统一动效接入](docs/motion.md)。

## 开发技能

以下技能由 Framework 的 `eliteforge.agent-development` 能力包统一维护，并随 Tron 默认安装：

- [eliteforge-agent-ui-theme](https://gitee.com/person-ai/eliteforge-agent-framework/blob/main/crates/capability/eliteforge-agent-capability-development/skills/eliteforge-agent-ui-theme/SKILL.md)：维护 Chat、Composer、A2UI、Motion 与终端主题、公开挂点和 React/Vue 样式一致性。
- [eliteforge-agent-ui-integration](https://gitee.com/person-ai/eliteforge-agent-framework/blob/main/crates/capability/eliteforge-agent-capability-development/skills/eliteforge-agent-ui-integration/SKILL.md)：指引其他 agent 通过 npm 接入组件，实现宿主 adapter/transport，并验证统一版本和交互流程。

代码修改后须同步核对两份 skill，具体要求见 [AGENTS.md](AGENTS.md)。

## 构建与发布

所有包使用 `@personai/agent-ui-*` 命名空间，发布到公共 npm。当前仓库源码及包清单采用 [GNU Affero General Public License v3.0](LICENSE)（`AGPL-3.0-only`）；已发布 npm 版本以对应版本随包分发的许可证为准。A2UI 包同时保留第三方许可证 `LICENSE.a2ui`。以下命令均在仓库根目录执行。

### 1. 安装依赖并构建

```sh
npm ci
npm run build
```

`npm run build` 按依赖关系构建全部工作区包，产物位于各包的 `dist/`。终端包安装时会修改所解析到的 xterm 5.5.0 文件，以修复输入法行为。

### 2. 统一更新版本

```sh
npm run version:all -- 0.2.0
```

将 `0.2.0` 替换为目标版本。命令要求完整的 SemVer 版本号，并同步更新根包、全部工作区包、包之间的依赖版本和 `package-lock.json`。检查改动后重新构建：

```sh
npm run build
npm pack --dry-run --workspaces --ignore-scripts
```

检查打包文件和版本，确认无误后提交版本变更。npm 上已经发布过的包版本不能重复发布，重新发布时需要使用新的版本号。

### 3. 登录并确认权限

```sh
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
```

登录的账号需要拥有 `@personai` 组织的发布权限，并按 npm 的提示完成身份验证。包的 `publishConfig` 指向公共 npm 并设置为公开发布。

### 4. 按依赖顺序发布

确认构建和打包检查通过后，按下列顺序发布。遇到失败时循环会停止；修复问题后，跳过已成功发布的包，从失败的包继续。

```sh
for package in \
  a2ui-core composer-core motion-core chat-theme \
  motion-react motion-vue composer-react composer-vue \
  a2ui-react a2ui-vue a2ui-react-native chat-core chat-react chat-vue chat-react-native terminal
do
  npm publish --workspace "@personai/agent-ui-$package" --tag latest || break
done
```

上述命令将正式版本和预发布版本都发布到 `latest`，预发布版本发布后即为默认安装版本。安装最新版本时直接使用包名，例如 `npm install @personai/agent-ui-chat-react`。不要为预发布版本改用 `--tag next`，否则 `latest` 会停留在旧版本；需要额外渠道标签时可另行添加，但不能替代 `latest`。

发布后查询版本和标签：

```sh
npm view @personai/agent-ui-chat-react version dist-tags --registry=https://registry.npmjs.org/
```

确认 `version` 和 `dist-tags.latest` 都是目标版本。如果某次发布误用了其他标签，可使用 `npm dist-tag add @personai/agent-ui-chat-react@<版本> latest` 修正。

Finished context-compaction notices can expand block details supplied through `HistoryStep.compaction` or the live `agent.memory.compaction.details` event. Translate them with `workRailLabels.notices.compactionBlock`, `compactionNoChanges` and `compactionDetailsUnavailable`. This addition is available from `1.0.0-preview.5`; see `docs/integration-guide.md`.

`1.0.0-preview.29` 起，宿主可在失败的 `RUN_ERROR` 事件上附带 `diagnostic: { traceId, href }`；React/Vue 会在运行失败通知中渲染 Trace ID 与同源链路链接。文案通过 `workRailLabels.notices.traceId(traceId)` 和 `viewTrace` 覆盖，React 另支持 `renderRunNoticeExtra(notice)` 追加自定义内容。诊断随事件到达，历史投影不含 trace 信息；详见 `docs/integration-guide.md`。

`1.0.0-preview.8` groups historical user image thumbnails above their message, aligned to the right, in React and Vue. Annotation controls inherit the host theme, including hover colors.

`1.0.0-preview.8` fixes stale waiting-for-answer states after accepted responses and uses a local monotonic work clock in React and Vue. Live elapsed time continues without new protocol events, pauses while awaiting input, and freezes when execution ends.

`1.0.0-preview.9` 为 React 和 Vue 工具组中执行中的圆点添加呼吸动画，并遵循系统减少动态效果设置。

`1.0.0-preview.10` 在 React 和 Vue 工作过程的每条消息悬停或聚焦时显示复制按钮和时间，触屏设备始终显示。当前源码移除了工作过程内的逐条操作行：复制和时间只保留在最终答复上，中间步骤下方不再预留操作行高度。

`1.0.0-preview.31` 起，浏览器终端的思考、工具组和单个工具在运行中即可展开和收起。流式事件只更新内容，不会折叠用户已展开的详情，运行结束也不重置展开状态；工具参数与结果可在运行中和结束后查看，“终止会话”行为不变。详见终端包 README 与接入文档。
