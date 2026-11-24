# @personai/agent-ui-chat-vue

Vue 3 聊天界面和运行时组件。包负责展示会话、消息、附件、AG-UI 事件和运行状态；宿主通过 `ChatAdapter` 对接自己的服务，组件不绑定具体后端。

## 安装

```sh
npm install @personai/agent-ui-chat-vue @personai/agent-ui-chat-core @personai/agent-ui-chat-theme
```

应用入口引入主题和组件样式：

```ts
import "@personai/agent-ui-chat-theme";
import "@personai/agent-ui-chat-vue/styles.css";
```

## 快速试用

```vue
<script setup lang="ts">
import { ChatRuntimeWindow } from "@personai/agent-ui-chat-vue";
import { createMockChatAdapter } from "@personai/agent-ui-chat-core";

const adapter = createMockChatAdapter();
</script>

<template>
  <ChatRuntimeWindow :adapter="adapter" :config="{ floating: false, title: '助手' }" />
</template>
```

模拟 adapter 会回显消息并生成 AG-UI 流事件，无需后端。包内 `npm run dev` 页面同样使用该模拟 adapter。

宿主可通过 `onPasteAttachment` 接管粘贴的图片或文件（每个文件调用一次），在本地暂存附件，再在首次发送时上传；默认附件上传需要先创建会话，连续粘贴的多个文件会排队依次上传。

## 接入自己的后端

宿主实现 `ChatAdapter`，把会话、消息和流事件映射为 `@personai/agent-ui-chat-core` 的通用类型。至少需要提供 `createSession`、`deleteSession`、`loadMessages`、`loadAguiEvents` 和 `streamMessage`。流式过程中通过 handlers 报告文本片段和 AG-UI 事件。

只有后端确实支持时，才声明 `supportsActiveRun`、`supportsSteer`、`supportsStop` 等能力，并实现 `getActiveRun`、`steerMessage`、`stopRun`。停止后端运行需要 adapter 调用对应控制接口；断开事件流只表示停止接收事件。

## 交付文件

完成的助手消息可在 `ChatMessage.artifacts` 上携带 `version: "v1"` 的扁平文件列表。宿主已完成合并、去重和按客户端解析动作；组件不会看到文件路径或 `source`。`ChatRuntimeWindow` 和 `ChatPanel` 在 Markdown 正文之后、消息操作行之前渲染 `ChatArtifacts`：

- `actions` 只接受 `preview` / `open` / `reveal` / `save`；`actions[0]` 为主按钮，`actions[1]` 以内联次按钮显示，`actions[2..]` 进入溢出菜单。缺省或空数组不显示按钮。
- 未知版本、非数组 `items` 或缺少 `id` / `display` 的条目不会渲染；空 `items` 也不渲染，解析不抛错。
- 超过 4 项默认折叠，显示“全部 N 项 / 收起”。`artifactStates` 按条目 id 标记 `pending` / `failed`，失败时提供重试。
- adapter 实现 `artifactAction` 与 `artifactContentUrl`，按需声明 `supportsArtifacts: true`。运行时用 `inline` URL 在新标签页预览；`onArtifactPreview` 可替换预览，`onArtifactAction` 在动作完成后回调。
- 直接使用 `ChatPanel` 时传 `onArtifactAction`、`onArtifactPreview`、`artifactStates` 和可选的 `artifactLabels` / `locale`。单独使用 `ChatArtifacts` 时属性为 `artifacts`、`onAction`、`onPreview`、`labels`、`locale`、`states`。

```vue
<ChatPanel
  :artifact-labels="{ title: '本次产出' }"
  :artifact-states="artifactStates"
  :draft="draft"
  :messages="messages"
  :on-artifact-action="(message, item, action) => hostApi.artifactAction(message.runId, item.id, action)"
  :on-artifact-preview="(message, item) => openInAppViewer(item)"
  :on-draft-change="setDraft"
  :on-send="() => send()"
/>
```

此能力属于当前源码，消费方需安装包含该变更的 npm 版本后生效。

```vue
<script setup lang="ts">
import { ChatRuntimeWindow } from "@personai/agent-ui-chat-vue";
import type { ChatAdapter } from "@personai/agent-ui-chat-core";

defineProps<{ adapter: ChatAdapter }>();
</script>

<template>
  <ChatRuntimeWindow
    :adapter="adapter"
    :config="{ floating: false, title: '项目助手' }"
    agent-reply-effect="typewriter"
    :agent-reply-speed="120"
    current-user-display-name="访客"
    @session-change="(session) => console.log(session)"
  />
</template>
```

`agent-reply-effect` 默认为 `off`，可设为 `typewriter` 按字符呈现流式回复；`agent-reply-speed` 表示每秒字符数，范围为 30–240，默认 120。运行中的空回复气泡会在首个文本片段到达后显示。

组件文案可通过 props、主题 CSS 变量及 `@personai/agent-ui-chat-theme` 覆盖；头部、侧栏和底部可用 `#header`、`#sidebar`、`#footerAddon` slots 扩展。

`ChatPanel`、`ChatWindow` 和 `ChatRuntimeWindow` 支持 `#composerTop`，对应 React 的 `composerTop`：内容位于输入框外部上方，适合放置工作目录、Agent 等会话控件。`#composerHeader` 位于输入框内部，`#footerAddon` 位于输入框底部工具栏。也可通过 `composerTop` prop 传入 Vue 组件；同时提供时优先使用 slot。

```vue
<ChatRuntimeWindow :adapter="adapter" :config="{ floating: false }">
  <template #composerTop>
    <div class="conversation-controls">
      <DirectorySelector />
      <AgentSelector />
    </div>
  </template>
</ChatRuntimeWindow>
```

上例的 `DirectorySelector`、`AgentSelector` 由宿主提供。设置 `:show-composer="false"` 的面板或窗口不渲染 `composerTop`。运行时压缩上下文期间，插槽中的原生表单控件会与 React 一样通过 `fieldset disabled` 禁用。

历史定位栏默认显示，可通过 `:show-history-rail="false"` 关闭。`1.0.0-preview.12` 以 3px 微点显示轮次，当前轮次为 9px 短竖线。索引绝对定位在聊天左侧原有留白内，默认透明点击区域宽 16px，不占用正文或输入框宽度。悬停或键盘聚焦显示问题与最多两行纯文本回复摘要；点击、Enter 或空格只滚动聊天正文。方向键、Home / End 可选择轮次，Escape 关闭预览。长对话的索引在自身范围内滚动，跳转遵循 MotionProvider 与系统减少动效设置。主题通过 `data-theme-part="chat-history"` 和 `--agent-ui-chat-history-*` 变量调整；升级到 `1.0.0-preview.12` 后生效。

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
- `ChatPanel`：宿主自行管理状态时使用的低层聊天面板。
- `ChatWindow`：悬浮、拖动和调整大小的聊天窗口。

完整 props 与 adapter 类型以包导出的 TypeScript 声明为准。

只读会话可设置 `showComposer={false}`（Vue 使用 `:show-composer="false"`），复用相同的消息、工作过程和工具卡片，不渲染输入框。

Finished context-compaction notices can expand block details supplied through `HistoryStep.compaction` or the live `agent.memory.compaction.details` event. Translate them with `workRailLabels.notices.compactionBlock`, `compactionNoChanges` and `compactionDetailsUnavailable`. This addition is available from `1.0.0-preview.5`; see `docs/integration-guide.md`.

`1.0.0-preview.29` 起，宿主可在失败的 `RUN_ERROR` 事件上附带 `diagnostic: { traceId, href }`；React/Vue 会在运行失败通知中渲染 Trace ID 与同源链路链接。文案通过 `workRailLabels.notices.traceId(traceId)` 和 `viewTrace` 覆盖，React 另支持 `renderRunNoticeExtra(notice)` 追加自定义内容。诊断随事件到达，历史投影不含 trace 信息；详见 `docs/integration-guide.md`。

图片附件及结构化历史的图片以紧凑缩略图显示，点击查看原图。可通过 `--agent-ui-chat-image-thumbnail-width`、`--agent-ui-chat-image-thumbnail-height` 和 `--agent-ui-chat-image-thumbnail-radius` 调整，默认分别为 `112px`、`80px`、`10px`；此行为适用于当前源码，发布状态以 npm 版本为准。

用户历史图片与实时附件归入对应用户消息组，缩略图位于消息正文上方并沿右边缘对齐；多张图片自动换行，点击仍打开原图预览。助手和系统消息不使用用户消息的右对齐分组。

Since `1.0.0-preview.7`, work rails clear resolved question pauses and use a local monotonic clock for live elapsed time. `chat-core` exports `WorkElapsedClock(initialElapsedMs)`, `setRunning(running, now?)`, and `elapsed(now?)`; optional clock values use milliseconds on the same monotonic time base.
