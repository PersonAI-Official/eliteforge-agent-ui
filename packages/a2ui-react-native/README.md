# @personai/agent-ui-a2ui-react-native

A2UI 协议的 React Native 渲染器。协议解析、Catalog、数据绑定、表单校验和 `ActionMessage` 生成继续复用 [`@personai/agent-ui-a2ui-core`](../a2ui-core)；本包只负责把抽象渲染树映射成 React Native 原语，不引入 CSS/DOM。

## 安装

```sh
npm install --save-exact @personai/agent-ui-a2ui-react-native@1.0.0-preview.30
```

peer dependencies：`react`（>= 19.2）、`react-native`（>= 0.70）。

## 用法

```tsx
import { A2UIClient, A2UIRenderer, A2UISurface } from "@personai/agent-ui-a2ui-react-native";

const client = new A2UIClient();
for (const message of envelopes) client.apply(message);

// 单个 surface
<A2UISurface
  client={client}
  surfaceId="profile-form"
  onAction={(message, metadata) => submitAction(message, metadata)}
/>;

// 当前 client 的全部 surface
<A2UIRenderer client={client} onAction={submitAction} />;
```

`A2UISurface` 在每次 client 快照变化时重新渲染（`useSyncExternalStore`）。默认不滚动，由外层 `ScrollView`/`FlatList` 负责滚动；需要独立滚动时传 `scrollable`。

## Props

### `A2UISurfaceProps`

| prop | 类型 | 说明 |
| --- | --- | --- |
| `client` | `A2UIClient` | `a2ui-core` 客户端 |
| `surfaceId` | `string` | 目标 surface |
| `onAction` | `ActionHandler` | 用户动作回调，参数与 Web 端一致 |
| `components` | `Record<string, (context: RenderContext) => ReactNode>` | 自定义组件覆盖 |
| `scrollable` | `boolean` | 根节点是否包 `ScrollView` |
| `style` / `contentContainerStyle` | RN style | 根容器样式 |
| `theme` | `Partial<A2UIReactNativeTheme>` | 主题 token |
| `testID` | `string` | 测试标识 |

`A2UIRendererProps` 与上表相同，另有 `surfaceIds`（默认取 client 当前全部 surface）、`emptyLabel`（无 surface 时的占位文案）。

## Catalog 映射

- `Text` / `h1`–`h5` / `strong` / `code` / `p` / `label` → `Text`
- `Card` → 带边框、圆角、内边距的 `View`
- `Row` / `Column` / `List` / `Grid` → `View`（`flexDirection`、`gap` 来自 catalog 语义）
- `Button` → `Pressable` + `Text`
- `TextField` → `TextInput`（`obscured` 映射 `secureTextEntry`，`number` 映射数字键盘）
- `CheckBox` / `ChoicePicker` → `Pressable` 勾选标记
- `QuestionCard` / `ApprovalCard` → 固定交互卡片：题头导航、整行可点选项、独立标题/说明、自定义答案与确认/跳过。卡片自带背景、圆角和内边距，宿主不要再包一层卡片。
- `Image` → `Image`；`Video` / `AudioPlayer` 降级为占位文案
- `Progress` → 原生进度条；`Icon` / `Slider` 降级
- 未知组件 → `Unsupported component: <name>`，可在 `components` 中覆盖

固定的问答/审批卡片按内容自然撑高。宿主应把它放进消息列表等可滚动区域；不要塞进固定高度或嵌套 `ScrollView`，否则会出现内层滚动条或内容被裁切。

## 主题

```tsx
import {
  defaultA2UIReactNativeTheme,
  type A2UIReactNativeTheme,
} from "@personai/agent-ui-a2ui-react-native";

const theme: Partial<A2UIReactNativeTheme> = {
  primaryColor: "#0969da",
  borderRadius: 12,
};
```

主题是 JS token（颜色、圆角、间距），对应 `docs/a2ui-theme.md` 的 CSS 变量语义；不要从 Web 包导入 `styles.css`。

## 边界

- 不依赖 `a2ui-react`/`a2ui-vue`/DOM/CSS。
- 不内置图标库；需要图标时通过 `components` 覆盖。
- 复杂组件可用宿主侧 WebView 兜底，但消息流、输入与审批保持原生。
- 完整接入说明见 [React Native 聊天与 A2UI](../../docs/react-native.md)。