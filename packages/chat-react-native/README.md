# @personai/agent-ui-chat-react-native

最小可用的 React Native 聊天组件集，状态类型来自 [`@personai/agent-ui-chat-core/headless`](../chat-core)（平台无关子路径，不引入 DOM/mermaid），A2UI 由 [`@personai/agent-ui-a2ui-react-native`](../a2ui-react-native) 渲染。

## 安装

```sh
npm install --save-exact \
  @personai/agent-ui-chat-react-native@1.0.0-preview.34 \
  @personai/agent-ui-chat-core@1.0.0-preview.34
```

peer dependencies：`react`（>= 19.2）、`react-native`（>= 0.70）。不导出 CSS 入口。

## 组件

| 组件 | 说明 |
| --- | --- |
| `ChatPanel` | 头部 + `MessageList` + 待回答审批卡 + `Composer` |
| `MessageList` | `FlatList` 虚拟化消息列表，空态文案、新消息自动滚底 |
| `MessageBubble` | 身份/时间、Markdown 正文、附件名、交付文件列表、内嵌 A2UI 表面 |
| `ArtifactList` | 交付文件行：标题、折叠、逐条状态/重试与内联动作按钮；不打开 URL |
| `Composer` | 与 React/Vue 对齐的输入组件：附件、队列、建议、`steer`/`queue` 模式、`composerHeader`/`footerAddon`、`render*` 扩展位与 `clipboard` 适配器 |
| `ApprovalCard` | 复用 `chat-core` 的 `createInteractionClient` 与 A2UI 交互组件渲染审批/问答；卡片自带边框与内边距，不再额外包一层卡片 |
| `InteractionReceipt` | 已回答/已批准的紧凑胶囊；点开展示逐题答案，与 Web 的 `InteractionReceipt` 对齐 |
| `ToolCard` | 与 Web 一致的工具行：简约工具名/命令计数，展开只显示 `toolOperationDetails` 的操作字段，不渲染参数或结果 JSON |
| `A2UISurface` / `A2UIRenderer` | 从 `a2ui-react-native` 透传，方便单包接入 |

## 用法

```tsx
import { useState } from "react";
import { ChatPanel } from "@personai/agent-ui-chat-react-native";
import type { ChatMessage } from "@personai/agent-ui-chat-core/headless";

<ChatPanel
  messages={messages}
  draft={draft}
  onDraftChange={setDraft}
  onSend={(mode) => send(draft, mode)}
  onStop={stop}
  sending={running}
  userInputRequests={requests}
  onAnswerUserInput={(answers) => answer(answers)}
/>;
```

`ChatPanel` 不持有传输层：消息和交互请求由宿主（Tron/PersonAI-Mobile 的 RPC 客户端）提供，A2UI 增量通过 `ChatA2uiSession` 应用。

`userInputRequests` 的卡片会按内容自然撑高。`ChatPanel` 把它们放在消息列表尾部，因此卡片变高时由列表滚动；宿主自行组合时也应遵循同样布局，不要放进固定高度或嵌套 `ScrollView`，否则题头或确认按钮会被裁切。

单独使用 `MessageList` 并自行渲染底部卡片时，把待回答数量传给 `scrollToEndKey`，列表会在卡片出现或切换题目后重新滚到底部。`ChatPanel` 会先用 `interactionMessages` 把已回答请求装饰成 `InteractionReceipt`；自行组装消息列表时也应这样做，否则提交后只会移除卡片，转录里不会留下“已解答疑惑”。

`ToolCard` 也接受可选的 `labels: ChatWorkRailLabels`，宿主可在其中提供 `tool.resolveName` 覆盖工具标题；默认标题与 Web 相同，来自 `toolCommandCountLabel` / `toolDisplayName`。`result` 只用于判断顶层 `isError`，不会展示原始输出。

## 交付文件

`ChatMessage.artifacts` 为 `version: "v1"` 的扁平文件列表；`chat-core/headless` 导出 `parseArtifacts`、`ARTIFACT_COLLAPSED_COUNT`、`ChatArtifactsProps` 和标签解析函数。`MessageBubble` 在正文与 A2UI 之后挂载 `ArtifactList`，`ChatPanel` / `MessageList` 透传以下属性：

- `artifactLabels`：覆盖标题、折叠、重试、动作、大小和类型文案。
- `artifactStates`：按条目 id 标记 `pending` / `failed`，失败时显示重试。
- `onArtifactAction(message, item, action)`：交互动作为 `open` / `reveal` / `save`；`actions[0]` 为主按钮，其余以内联按钮行展示。
- `onArtifactPreview(message, item)`：原生预览必须由宿主提供；未提供时不显示预览按钮。
- `locale`：内置文案语言。

`actions` 是权威列表，缺省或空数组只展示文件信息。未知版本、畸形条目或空 `items` 不渲染，组件不抛错；超过 4 项默认折叠。原生端不读取 `artifactContentUrl`，也不自行打开链接。

```tsx
<ChatPanel
  artifactLabels={{ title: "本次产出" }}
  artifactStates={{ "report.pdf": "failed" }}
  draft={draft}
  messages={messages}
  onArtifactAction={(message, item, action) => tunnel.call("artifact.action", { itemId: item.id, action })}
  onArtifactPreview={(message, item) => openNativeViewer(item)}
  onDraftChange={setDraft}
  onSend={() => sendDraft()}
  sending={running}
/>
```

## Composer 扩展点

`Composer` 与 `composer-react` / `composer-vue` 保持同一输入契约（`draft`、`onDraftChange`、`onSend`、`onStop`），并增加 RN 专属扩展：

- `composerHeader` / `footerAddon`：输入区上方与工具栏插槽。
- `renderAttachmentControl` / `renderAttachment` / `renderSuggestion`：替换附件按钮、附件卡片、建议行。
- `pendingAttachments` / `onPickAttachment` / `onRemoveAttachment`：附件选择与移除由宿主实现。
- `queuedMessages` 与编辑、删除、排序、引导回调。
- `clipboard` + `onPasteAttachment`：React Native 没有粘贴事件，宿主注入 `readFile()`；Composer 在附件按钮上提供长按粘贴，不单独占一个按钮。
- `styles` 逐槽位覆盖，`theme` 复用 `ChatReactNativeTheme`。

移动端剪贴板通常只有一张图片或一个 URL；多文件需宿主原生模块。图片压缩属于宿主上传职责。

## 主题

`ChatReactNativeTheme` 在 A2UI token 基础上增加 `panelColor`、`userBubbleColor`、`userBubbleTextColor`、`assistantBubbleColor`；通过 `theme` prop 传入，所有组件共享 `defaultChatReactNativeTheme` 默认值。

## 边界

- 不依赖 `chat-react`、`a2ui-react`、`react-markdown`、`lucide-react` 或任何 CSS。
- Markdown 由本包内置的 RN 渲染器提供：标题、粗体/斜体/删除线、行内与代码块、列表、引用、链接和 GFM 表格；不抓取远程图片，HTML 不渲染。
- Mermaid、文本批注选择、历史侧栏和悬浮窗口仍是 Web 专属能力，本包不提供。
- 完整接入与宿主对接约定见 [React Native 聊天与 A2UI](../../docs/react-native.md)。
