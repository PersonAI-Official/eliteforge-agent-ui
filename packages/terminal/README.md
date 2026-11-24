# @personai/agent-ui-terminal

可嵌入 Web 应用的终端组件，包含 xterm.js 渲染、Shell 命令块、交互输入、AI 对话/命令生成和流式活动展示。组件不创建服务端进程，也不绑定任何产品 API；宿主注入终端与 AI 传输实现。

## 安装

```sh
npm install --save-exact @personai/agent-ui-terminal@1.0.0-preview.34
```

应用入口需导入 `@personai/agent-ui-terminal/styles.css`。包内 `npm run dev` 提供本地模拟宿主演示。

## 最小接入

```ts
import { initTerminal, createTerminalTransport, createAITransport } from "@personai/agent-ui-terminal";
import "@personai/agent-ui-terminal/styles.css";

const terminal = initTerminal({
  el: document.querySelector("#terminal")!,
  transport: {
    // 负责启动/连接 PTY，并把输入、尺寸变化和信号转发给宿主服务。
    terminal: createTerminalTransport({ url: "https://your-terminal-service" }),
    // 可选：宿主提供 AI 请求与流式传输；省略后仍可使用普通终端。
    ai: createAITransport({
      url: "https://your-ai-service/chat",
      headers: { Authorization: `Bearer ${token}` },
    }),
  },
  locale: "zh-CN",
  onExit: (code) => console.log("shell exited", code),
  onError: (error) => console.error(error),
});

// 页面卸载或终端标签关闭时释放组件和两条连接。
terminal.dispose();
```

`createTerminalTransport` 使用 Socket.IO 连接远端 PTY。服务端负责安全地创建并管理 shell 进程；浏览器组件只发送终端输入、尺寸变化和信号。连接地址、认证、租户信息和进程启动策略均由宿主决定。

## 实例控制

`initTerminal()` 返回可直接调用的实例，无需获取内部 Terminal 类或 xterm 对象。以下三个方法从 `1.0.0-preview.3` 开始提供，`1.0.0-preview.2` 不包含它们。

| 方法 | 返回值 | 行为 |
| --- | --- | --- |
| `clear()` | `void` | 调用 xterm 清屏，清除缓冲区并保留当前提示行；不向 shell 发送 clear 命令、不停止 PTY，也不删除宿主历史 |
| `getSelection()` | `string` | 读取终端选中的文本；未选择时返回空字符串 |
| `focus()` | `void` | 聚焦终端输入；不重建实例或连接 |

```ts
terminal.clear();
const selectedText = terminal.getSelection();
terminal.focus();
```

这些方法在实例存活期间使用；关闭后调用 `dispose()`，不要继续操作已销毁的实例。三个方法均保留当前主题和语言设置。

主题初始化放在 `terminalOptions.themeTokens`；运行中通过 `setThemeTokens(tokens)` 更新，通过 `resetTheme()` 清除覆盖，通过 `refreshTheme()` 将当前 CSS 颜色同步到 xterm。`setLocale()` / `setMessages()` 更新文案。

## 自定义传输

如果宿主的传输协议不同，实现并注入 `TerminalTransport` 即可。它负责连接、发送键盘输入/尺寸/信号，并通知组件输出、会话信息、退出和错误。需要 AI 能力时再实现 `AITransport` 的 `request` 与 `stream`；流式结果通过 `onChunk` 提供文本，通过 `onEvent` 提供结构化 Agent 活动。详见包导出的 TypeScript 接口。

```ts
const terminal = initTerminal({
  el,
  transport: {
    terminal: hostTerminalTransport,
    ai: hostAITransport,
  },
  prompts: {
    chat: (text) => `请结合当前终端上下文回答：${text}`,
    explain: ({ command, output }) => `解释命令 ${command} 的输出：\n${output}`,
    generate: (text) => `根据需求生成 shell 命令：${text}`,
  },
  agentPrefix: "#",
  onExit: closeTerminalTab,
});
```

`initTerminal` 还支持 locale、文案覆盖、xterm 主题/字体选项、命令分流规则和降级状态回调。`dispose()` 会停止组件监听、AI 请求并释放传输。

本包固定使用 xterm.js 5.5.0，并在安装时应用一处范围受限的输入补丁，避免 macOS 中文输入法提交时丢字或重复。升级 xterm 版本时，补丁会拒绝应用；需先验证对应版本的输入行为。

## 运行期工具详情

Agent 活动区中的思考、工具组和单个工具都使用原生 `<details>`。运行期间即可展开和收起；流式事件到达只更新标题与内容，不会把用户已展开的详情重新折叠，运行结束也不重置展开状态。展开后可查看工具参数和已经返回的结果，结果稍后到达时继续写入同一项。

宿主验收时在真实后端确认：工具仍在运行、以及工具已结束但整轮未结束时都能展开；新事件到达后已展开项保持打开；“终止会话”按钮仍能停止当前运行；结束后主题切换、终端输入和 `dispose()` 无回归。
