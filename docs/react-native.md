# React Native 聊天与 A2UI

Agent UI 为 React Native / Expo 宿主提供两个平台包，并与 Web 包共享协议逻辑：

| 包 | 作用 |
| --- | --- |
| `@personai/agent-ui-chat-core/headless` | 平台无关的消息、转录、AG-UI、工具展示、历史/A2UI 交互逻辑 |
| `@personai/agent-ui-a2ui-react-native` | A2UI catalog → RN 原语渲染器（`Text`/`View`/`TextInput`/`Pressable`/`ScrollView`） |
| `@personai/agent-ui-chat-react-native` | `ChatPanel`/`MessageList`/`MessageBubble`/`ArtifactList`/`Composer`/`ApprovalCard`/`ToolCard`/`A2UISurface` |

React Native 宿主**不要**直接引入 `chat-core` 根入口、`chat-react` 或 `a2ui-react`：根入口包含 DOM 模块和 `mermaid`，后两者依赖 DOM/CSS。`chat-core/headless` 只导出平台无关模块，`a2ui-core` 的 `A2UIClient`/`Surface`/`Action` 契约保持共用。

```text
RPC 客户端 / AG-UI 事件
        │  ChatMessage / ChatUserInputRequest / ChatA2uiSession
        ▼
@personai/agent-ui-chat-core/headless   （消息排序、工具标题、历史、交互信封）
        │
        ▼
@personai/agent-ui-chat-react-native    （ChatPanel → FlatList / Composer / ApprovalCard）
        │  A2UIClient + surfaceId
        ▼
@personai/agent-ui-a2ui-react-native    （renderSurface + RN 元素映射）
```

## 安装

```sh
npm install --save-exact \
  @personai/agent-ui-chat-react-native@1.0.0-preview.34 \
  @personai/agent-ui-a2ui-react-native@1.0.0-preview.34 \
  @personai/agent-ui-chat-core@1.0.0-preview.34
```

`react`（>= 19.2）与 `react-native`（>= 0.70）由宿主提供，都是 peer dependency。两个 RN 包不导出样式入口，主题通过 JS token 传入，不涉及 CSS。

## 聊天面板

```tsx
import { useState } from "react";
import { SafeAreaView } from "react-native";
import { ChatPanel } from "@personai/agent-ui-chat-react-native";
import type {
  ChatMessage,
  ChatUserInputAnswer,
  ChatUserInputRequest,
} from "@personai/agent-ui-chat-core/headless";

export function ChatScreen({
  messages,
  requests,
  sending,
  send,
  stop,
  answer,
}: {
  messages: ChatMessage[];
  requests: ChatUserInputRequest[];
  sending: boolean;
  send: (text: string) => void;
  stop: () => void;
  answer: (answers: ChatUserInputAnswer[]) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ChatPanel
        draft={draft}
        messages={messages}
        onAnswerUserInput={answer}
        onDraftChange={setDraft}
        onSend={() => {
          if (!draft.trim()) return;
          send(draft);
          setDraft("");
        }}
        onStop={stop}
        sending={sending}
        userInputRequests={requests}
      />
    </SafeAreaView>
  );
}
```

`ChatPanel` 是纯展示组件：消息、待回答交互和发送/停止回调都由宿主提供，状态与 `chat-core` 类型一致。

### `ChatPanel` 主要 props

| prop | 类型 | 说明 |
| --- | --- | --- |
| `messages` | `ChatMessage[]` | `chat-core` 历史/转录消息 |
| `draft` / `onDraftChange` | `string` / `(value: string) => void` | 受控输入区草稿 |
| `onSend` | `(mode?: ChatSubmitMode) => void` | 发送当前草稿 |
| `onStop` | `() => void` | 运行中停止 |
| `sending` / `sendDisabled` / `disabledInput` | `boolean` | 运行态控制 |
| `userInputRequests` / `onAnswerUserInput` | `ChatUserInputRequest[]` / `(answers: ChatUserInputAnswer[]) => void` | 原生审批/问答 |
| `runtime` / `onA2UIAction` | `ChatA2uiSession` / `ChatA2uiActionHandler` | A2UI 会话与动作回传 |
| `artifactLabels` / `artifactStates` | `Partial<ChatArtifactLabels>` / `Record<string, "pending" \| "failed">` | 交付文件文案与逐条状态 |
| `onArtifactAction` / `onArtifactPreview` | `(message, item, action) => void` / `(message, item) => void` | 交付文件动作与宿主预览；原生不自行打开 URL |
| `locale` | `string` | 交付文件等内置文案语言 |
| `showHeader` / `showComposer` / `showIdentity` | `boolean` | 布局开关 |
| `theme` | `Partial<ChatReactNativeTheme>` | RN 主题 token |

## 交付文件（Artifacts）

完成的助手消息可携带 `message.artifacts`（`version: "v1"` 的扁平 `items`）。`chat-core/headless` 导出 `parseArtifacts`、`ARTIFACT_COLLAPSED_COUNT` 和 `ChatArtifactsProps` 等类型；`MessageBubble` 在 Markdown 正文与 A2UI 之后挂载 `ArtifactList`：

```tsx
import { ArtifactList } from "@personai/agent-ui-chat-react-native";
import type { ChatArtifacts } from "@personai/agent-ui-chat-core/headless";

<ArtifactList
  artifacts={artifacts}
  labels={{ title: "本次产出" }}
  locale="zh-CN"
  onAction={(item, action) => tunnel.call("artifact.action", { itemId: item.id, action })}
  onPreview={(item) => openNativeViewer(item)}
  states={{ "report.pdf": "pending" }}
/>;
```

- `actions` 是权威列表：只渲染其中的动作；`actions[0]` 为主按钮，其余以内联按钮行展示（原生没有 hover，也不使用 Web 的溢出菜单）。缺省或空数组只展示文件信息。
- 默认折叠到 4 项，超过时显示“全部 N 项 / 收起”。空 `items`、未知 `version` 或畸形条目不会渲染，组件不抛错。
- `states` 按条目 id 标记 `pending` / `failed`；失败显示“重试”，重复上次动作。`artifactLabels` 覆盖标题、折叠、重试、动作、大小和类型文案。
- 原生预览必须由宿主提供 `onPreview`（例如内置查看器或分享面板）。没有 `onPreview` 时不渲染预览按钮；`ArtifactList` 不会自行打开 URL，也不依赖 `window`。
- adapter 的 `artifactAction` / `artifactContentUrl` 是 Web 运行时契约；RN 宿主通过 RPC/原生能力实现同等动作，并把结果映射为 `states`。不要复制 Web 的 `ChatRuntimeWindow`。

## A2UI 表面

`A2UISurface` 复用 `a2ui-core` 的 `renderSurface`，因此数据绑定、校验、`ActionMessage` 信封与 Web 端一致，只替换元素创建：

```tsx
import { A2UIClient, A2UISurface } from "@personai/agent-ui-a2ui-react-native";
import { AGENT_CATALOG_ID } from "@personai/agent-ui-chat-core/headless";

const client = new A2UIClient();
client.apply({
  version: "v0.9.1",
  createSurface: { surfaceId: "greeting", catalogId: AGENT_CATALOG_ID },
});

<A2UISurface
  client={client}
  surfaceId="greeting"
  onAction={(message, metadata) => submitAction(message, metadata)}
/>;
```

### 映射规则

| A2UI / catalog | React Native |
| --- | --- |
| `Text`、`h1`–`h5`、`strong`、`code` | `Text`（按 variant 取字号） |
| `Card` | 带边框/圆角/内边距的 `View` |
| `Row` / `Column` | `View`（`flexDirection: row/column`） |
| `Button` | `Pressable` + `Text` |
| `TextField` / `CheckBox` / `ChoicePicker` | `TextInput` / `Pressable` 勾选 |
| `QuestionCard` / `ApprovalCard` | 固定交互卡片：题头导航、整行可点的选项、独立说明行、自定义答案与确认/跳过（见下节） |
| `List` / `Grid` | `View`（可横向） |
| `Image` / `Video` / `AudioPlayer` | `Image` / 占位符（宿主可注册自定义组件） |
| `Slider` / `Progress` / `Icon` | 只读文本或进度条 / 图标降级为项目符号 |
| 未知组件 | `Unsupported component: <name>` 文案 |

`components` prop 可注册自定义渲染器覆盖任意组件（签名为 `(context: RenderContext) => ReactNode`）。复杂组件（地图、富文本编辑器等）可以只在宿主侧用 WebView 兜底，但不要把整个会话塞进 WebView。

### 主题 token

CSS 变量映射为 JS token，避免引入 `chat-theme` 的 CSS：

```tsx
import { defaultA2UIReactNativeTheme } from "@personai/agent-ui-a2ui-react-native";

const theme = {
  ...defaultA2UIReactNativeTheme,
  primaryColor: "#0a7ea4",
  textColor: "#111827",
};
```

`A2UIReactNativeTheme` 字段：`textColor`、`mutedTextColor`、`surfaceColor`、`borderColor`、`primaryColor`、`primaryTextColor`、`dangerColor`、`borderRadius`、`spacing`。`ChatReactNativeTheme` 在此基础上增加 `panelColor`、`userBubbleColor`、`userBubbleTextColor`、`assistantBubbleColor`。

### 固定交互卡片

`QuestionCard` 与 `ApprovalCard` 由 `a2ui-core` 的固定组合生成，RN 渲染器只负责元素映射，因此题目、选项说明、翻题、跳过和提交语义与 React/Vue 端一致：

- 题头包含标题、上一题、进度和下一题；最后一题的导航按钮变为“继续”。
- 每个选项是一整行 `Pressable`（无障碍角色 `radio`），选项标题与说明各占一行，窄屏自动换行。
- 底部保留自定义答案输入；最后一题出现确认按钮，非最后一题可跳过。
- 卡片自身负责背景、圆角、描边和内边距，宿主**不要**再包一层卡片。
- 待回答卡片应作为转录/消息列表的一部分（或等效的按内容自然撑高的容器）渲染。不要放进固定高度或嵌套 `ScrollView`，否则会出现内层滚动条、题头或确认按钮被裁切。卡片变高时由外层消息列表滚动。
- 已回答/已批准的请求通过 `interactionMessages` 生成 `InteractionReceipt`：转录中保留一个“已解答疑惑 / 已提供数据 / 已批准”的胶囊，点开后显示逐题答案。`ChatPanel` 已自动完成装饰；自行渲染消息列表时，把已回答的 `ChatUserInputRequest` 一并传给 `interactionMessages`，不要只删除待回答卡片。

### Composer 与剪贴板

`chat-react-native` 的 `Composer` 与 `composer-react` / `composer-vue` 使用同一套输入契约（`draft` / `onDraftChange` / `onSend` / `onStop`），并提供原生扩展位：

- `composerHeader`、`footerAddon`、`renderAttachmentControl`、`renderAttachment`、`renderSuggestion`
- 附件、队列消息、运行中 `steer` / `queue` 模式、`$`/`/` 建议、禁用原因
- `theme` 与逐槽位 `styles` 覆盖

React Native 没有浏览器 `ClipboardEvent`/`DataTransfer`。宿主通过 `clipboard` 注入 `ComposerClipboardAdapter`，`Composer` 在附件按钮上提供长按粘贴（不单独占一个按钮）：

```tsx
const clipboard = {
  async readFile() {
    const image = await Clipboard.getImageAsync({ format: "png" });
    if (image) return { name: `pasted-${Date.now()}.png`, mimeType: "image/png", base64: image.data };
    const url = await Clipboard.getUrlAsync();
    return url && /^(file|content):/i.test(url)
      ? { name: "pasted-file", uri: url }
      : null;
  },
};

<Composer
  draft={draft}
  onDraftChange={setDraft}
  onSend={send}
  onPickAttachment={pickFile}
  onPasteAttachment={uploadFile}
  clipboard={clipboard}
/>;
```

移动端剪贴板通常只暴露一张图片或一个 URL；多文件需要宿主原生模块。图片建议在宿主上传前压缩（长边 1280、JPEG 质量约 0.75），`Composer` 不替宿主改写文件。

## 宿主对接要点

- RPC 事件本身就是 AG-UI 事件：沿用 `chat-core/headless` 的 `buildTranscriptPresentation`、`buildAguiUserWorkCards`、`toolDisplayName` 等函数，不要另写一套事件名。
- 审批/问答答案优先使用 `nativeUserInputAnswer` / `nativeUserInputBatchAnswer`（`ChatUserInputAnswerInput`），保留 resume 载荷。
- A2UI 快照持久化和增量应用使用 `ChatA2uiSession`（`chat-core/headless`），`MessageBubble` 与 `ApprovalCard` 会直接消费。
- `ApprovalCard` 由 `createInteractionClient` + A2UI 交互组件渲染，因此批准/拒绝按钮、过期和状态文案与 Web 端一致；它不会额外包一层卡片，宿主应把它放进可随内容滚动的转录区域。
- `MessageBubble` 渲染 Markdown 正文（标题、列表、代码、表格等）、附件名、A2UI 表面和交付文件列表；Mermaid、文本批注选择仍是 Web 专属能力。
- `ToolCard` 与 Web tool row 对齐：标题使用 `toolCommandCountLabel` / `toolDisplayName`（批量命令显示“执行 N 个命令”），展开只展示 `toolOperationDetails` 的操作字段，从不渲染参数或结果 JSON；`result` 仅用于识别顶层 `isError`。
- 审批/问答卡片使用 `ApprovalCard` + `nativeUserInputRequests`；A2UI 表面通过 `ChatA2uiSession` 水合状态并回传 `onA2UIAction`，不要另写一套交互协议。

## 已知边界

- 图标组件没有内置图标库，降级为项目符号；需要图标时用 `components` 覆盖 `Icon`。
- `QuestionCard` 多问题导航依赖 `queueMicrotask`，需要 RN 运行时提供该全局（Hermes/React Native 0.70+ 已提供；如宿主环境缺失需自行 polyfill）。
- RN 包不导出 CSS 样式入口；主题通过上表 token 控制。
- 仅当宿主显式支持时才使用 `react-native-web`，它负责 RN → Web，不负责 Web 组件 → RN。
