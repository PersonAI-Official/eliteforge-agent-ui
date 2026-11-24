# @personai/agent-ui-chat-react

React 聊天界面和运行时组件。包负责展示会话、消息、附件、AG-UI 事件和运行状态；宿主负责把自己的会话服务接到 `ChatAdapter`，组件不假设具体后端。

## 安装

```sh
npm install @personai/agent-ui-chat-react @personai/agent-ui-chat-core @personai/agent-ui-chat-theme
```

需要 React 19。应用入口引入主题和组件样式：

```tsx
import "@personai/agent-ui-chat-theme";
import "@personai/agent-ui-chat-react/styles.css";
```

## 快速试用

无需后端即可用内置模拟 adapter 查看组件：

```tsx
import { ChatRuntimeWindow } from "@personai/agent-ui-chat-react";
import { createMockChatAdapter } from "@personai/agent-ui-chat-core";

export function App() {
  return (
    <ChatRuntimeWindow
      adapter={createMockChatAdapter()}
      config={{ floating: false, title: "助手" }}
    />
  );
}
```

发送消息后，模拟 adapter 会回显内容并产生一组 AG-UI 流事件。包内 `npm run dev` 页面也使用该模拟 adapter。

如果要在首次发送前保持本地草稿，给 `ChatRuntimeWindow` 设置 `allowDraftSession`。组件会直接显示输入框，空白输入不会创建会话；首次有效发送才调用 `adapter.createSession`。创建期间会锁定重复提交，创建失败保留草稿并通过 `onError` 报告，用户可重试。默认关闭该选项，保持原有空会话展示。

宿主可通过 `onPasteAttachment` 接管粘贴的图片或文件（每个文件调用一次），在本地暂存附件，再在首次发送时上传；默认附件上传需要先创建会话，连续粘贴的多个文件会排队依次上传。

## 接入自己的后端

为宿主实现 `ChatAdapter`，把后端协议转换成 chat-core 的通用类型。最小实现需要声明能力并提供会话、消息、AG-UI 事件和流式发送方法：

```ts
import type { ChatAdapter } from "@personai/agent-ui-chat-core";

const adapter: ChatAdapter = {
  capabilities: {
    supportsAbort: true,
    supportsActiveRun: false,
    supportsAgui: true,
    supportsProtocolReplay: false,
    supportsSteer: false,
    supportsStop: false,
    supportsStreaming: true,
  },
  async createSession(input) { throw new Error("实现宿主的会话创建请求"); },
  async deleteSession(sessionId) { throw new Error("实现宿主的会话删除请求"); },
  async loadMessages(sessionId) { throw new Error("将宿主消息映射为 ChatMessage[]"); },
  async loadAguiEvents(sessionId) { throw new Error("将宿主事件映射为 ChatAguiEvent[]"); },
  async streamMessage(session, input, handlers, signal) {
    // 收到片段时调用 handlers?.onDelta(delta)
    // 收到事件时调用 handlers?.onAguiEvent(event)
    throw new Error("实现宿主的流式发送请求");
  },
};
```

仅在后端支持对应操作时，才声明 `supportsActiveRun`、`supportsSteer`、`supportsStop` 等能力并实现 `getActiveRun`、`steerMessage`、`stopRun`。停止运行必须由宿主 adapter 调用后端控制接口；断开流只代表停止接收事件。

## 交付文件

完成的助手消息可在 `ChatMessage.artifacts` 上携带 `version: "v1"` 的扁平文件列表。宿主已完成合并、去重和按客户端解析动作；组件不会看到文件路径或 `source`。`ChatRuntimeWindow` 与 `ChatPanel` 在 Markdown 正文之后、消息操作行之前渲染 `ChatArtifacts`：

- `actions` 只接受 `preview` / `open` / `reveal` / `save`；`actions[0]` 为主按钮，`actions[1]` 以内联次按钮显示，`actions[2..]` 进入溢出菜单。缺省或空数组不显示按钮。
- 未知版本、非数组 `items` 或缺少 `id` / `display` 的条目不会渲染；空 `items` 也不渲染，解析不抛错。
- 超过 4 项默认折叠，显示“全部 N 项 / 收起”。`artifactStates` 按条目 id 标记 `pending` / `failed`，失败时提供重试。
- adapter 实现 `artifactAction(session, { runId, itemId, action }, signal)` 与 `artifactContentUrl(session, { runId, itemId, disposition })`，按需声明 `supportsArtifacts: true`。运行时用 `inline` URL 在新标签页预览；`onArtifactPreview` 可替换预览，`onArtifactAction` 在动作完成后回调。
- 直接使用 `ChatPanel` 时传 `onArtifactAction`、`onArtifactPreview`、`artifactStates` 和可选的 `artifactLabels` / `locale`。单独使用 `ChatArtifacts` 时属性为 `artifacts`、`onAction`、`onPreview`、`labels`、`locale`、`states`。

```tsx
<ChatPanel
  draft={draft}
  messages={messages}
  onDraftChange={setDraft}
  onSend={() => send()}
  onArtifactAction={async (message, item, action) => {
    await hostApi.artifactAction(message.runId, item.id, action);
  }}
  onArtifactPreview={(message, item) => openInAppViewer(item)}
/>
```

此能力属于当前源码，消费方需安装包含该变更的 npm 版本后生效。

```tsx
<ChatRuntimeWindow
  adapter={adapter}
  config={{ floating: false, title: "项目助手" }}
  agentReplyEffect="typewriter"
  agentReplySpeed={120}
  currentUserDisplayName="访客"
  onSessionChange={(session) => console.log(session)}
/>
```

`agentReplyEffect` 默认为 `off`，可设为 `typewriter` 按字符呈现流式回复；`agentReplySpeed` 表示每秒字符数，范围为 30–240，默认 120。运行中的空回复气泡会在首个文本片段到达后显示。

组件名称、配置和数据类型均不绑定业务项目。文案可通过组件 props、主题 CSS 变量及 `@personai/agent-ui-chat-theme` 覆盖；侧栏、头部和底部可通过 `sidebarContent`、`headerContent`、`footerAddon` 扩展。

## 对话历史定位

`1.0.0-preview.12` 的历史定位栏以 3px 微点显示轮次，当前轮次为 9px 短竖线。索引绝对定位在聊天左侧原有留白内，默认透明点击区域宽 16px，不占用正文或输入框宽度。悬停或键盘聚焦显示问题与最多两行纯文本回复摘要；点击、Enter 或空格只滚动聊天正文。方向键、Home / End 可选择轮次，Escape 关闭预览。长对话的索引在自身范围内滚动，跳转遵循 MotionProvider 与系统减少动效设置。

设置 `showHistoryRail={false}` 可关闭；主题通过 `data-theme-part="chat-history"` 和 `--agent-ui-chat-history-*` 变量调整。升级到 `1.0.0-preview.12` 后生效。

## 目标提示

`ChatRuntimeWindow` 和 `ChatPanel` 接受可选的 `goal` 属性，在输入框上方显示宿主提供的目标、状态和进度。宿主传入本地化的 `labels` 和可用操作回调（`onPause`、`onResume`、`onRestart`、`onDelete`）；未提供的操作不会显示。`busy` 禁用全部操作，`resumeDisabled` 单独禁用恢复。传入 `null` 或不传时不显示提示。组件只负责展示和触发回调，目标读取、生命周期与持久化由宿主管理。

## 工具展示

正文始终独立显示；思考与工具按相邻正文分段折叠，不会因同一运行又产生回复而隐藏之前的正文。展开过程后，每个连续工具阶段按工具调用数量展示：

```text
0 个调用 -> 不展示工具卡片
1 个调用 -> 直接展示工具卡片
多个调用 -> 分组摘要 -> 展开后展示工具卡片
```

一次调用中的批量条目仍属于同一个工具调用。实时运行、历史恢复和事件重放均遵循此规则。

当前源码中，React/Vue 工具分组标题只显示已开始的工具调用总数，使用 `workRailLabels.tool.group(count)`，例如“13 个工具调用”；失败的调用也计入总数，一次批量调用计为一次。分组不再按命令、搜索、读写或其他操作分类统计，旧 `groupSummary` 回调保留类型兼容但不再调用。展开后的工具明细保持原有展示。消费方需安装包含此变更的 npm 版本后生效。

## 导出

- `ChatRuntimeWindow`：包含会话和消息状态管理的完整运行时。
- `ChatPanel`：由宿主自行管理状态时使用的低层聊天面板。
- `ChatWindow`：可悬浮、拖动和调整大小的聊天窗口。

各组件完整 props 与 adapter 类型以包导出的 TypeScript 声明为准。

宿主使用统一气泡提示时，设置 `errorDisplay="external"` 并提供 `onError`。发送前的校验和请求错误只通过回调报告，不在输入框上方重复显示；已收到运行失败事件时，只在运行历史中展示，不再重复调用发送错误回调。默认 `inline` 会在输入框上方显示发送错误。

只读会话可设置 `showComposer={false}`（Vue 使用 `:show-composer="false"`），复用相同的消息、工作过程和工具卡片，不渲染输入框。

Finished context-compaction notices can expand block details supplied through `HistoryStep.compaction` or the live `agent.memory.compaction.details` event. Translate them with `workRailLabels.notices.compactionBlock`, `compactionNoChanges` and `compactionDetailsUnavailable`. This addition is available from `1.0.0-preview.5`; see `docs/integration-guide.md`.

`1.0.0-preview.29` 起，宿主可在失败的 `RUN_ERROR` 事件上附带 `diagnostic: { traceId, href }`；React/Vue 会在运行失败通知中渲染 Trace ID 与同源链路链接。文案通过 `workRailLabels.notices.traceId(traceId)` 和 `viewTrace` 覆盖，React 另支持 `renderRunNoticeExtra(notice)` 追加自定义内容。诊断随事件到达，历史投影不含 trace 信息；详见 `docs/integration-guide.md`。

图片附件及结构化历史的图片以紧凑缩略图显示，点击查看原图。可通过 `--agent-ui-chat-image-thumbnail-width`、`--agent-ui-chat-image-thumbnail-height` 和 `--agent-ui-chat-image-thumbnail-radius` 调整，默认分别为 `112px`、`80px`、`10px`；此行为适用于当前源码，发布状态以 npm 版本为准。

用户历史图片与实时附件归入对应用户消息组，缩略图位于消息正文上方并沿右边缘对齐；多张图片自动换行，点击仍打开原图预览。助手和系统消息不使用用户消息的右对齐分组。

Since `1.0.0-preview.7`, work rails clear resolved question pauses and use a local monotonic clock for live elapsed time. `chat-core` exports `WorkElapsedClock(initialElapsedMs)`, `setRunning(running, now?)`, and `elapsed(now?)`; optional clock values use milliseconds on the same monotonic time base.
