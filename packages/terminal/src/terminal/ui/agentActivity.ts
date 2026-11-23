import { html, nothing } from "lit-html";
import { guard } from "lit-html/directives/guard.js";
import { repeat } from "lit-html/directives/repeat.js";
import {
  buildAguiUserWorkCards,
  currentAguiWorkSnapshot,
  formatJsonBlockValue,
  presentToolCall,
  type TranscriptAguiEvent,
} from "@personai/agent-ui-chat-core";

import type { AIStreamEvent } from "../../transport/types";
import type { ChatTerminalI18n } from "../i18n";
import { renderMarkdown as renderMarkdownContent } from "../utils/markdown";

export interface AgentActivityState {
  activityEvents: readonly AIStreamEvent[];
  activityStartedAt: number;
  activityNow: number;
  activityComplete: boolean;
  i18n: ChatTerminalI18n;
}

export function renderAgentActivity(state: AgentActivityState) {
  const events = state.activityEvents as readonly TranscriptAguiEvent[];
  const cards = mergeReasoningCards(buildAguiUserWorkCards(
    events.filter((event) => event.type.toUpperCase() !== "REASONING_TEXT_CONTENT"),
  ));
  const orderedCards = [...cards].sort((left, right) => {
    const leftRank = left.kind === "reasoning" ? 0 : 1;
    const rightRank = right.kind === "reasoning" ? 0 : 1;
    return leftRank - rightRank || left.value.firstMillis - right.value.firstMillis;
  });
  const latestEmptyReasoningId = orderedCards
    .filter(
      (card) =>
        card.kind === "reasoning" &&
        !card.value.ended &&
        !card.value.content.trim() &&
        !card.value.summary.trim() &&
        card.value.toolCards.length === 0,
    )
    .at(-1)?.value.id;
  const visibleCards = orderedCards.filter((card) => {
    if (card.kind === "reasoning") {
      return (
        card.value.content.trim().length > 0 ||
        card.value.summary.trim().length > 0 ||
        card.value.toolCards.length > 0 ||
        card.value.id === latestEmptyReasoningId
      );
    }
    if (card.kind === "tool") return card.value.parentReasoningId === null;
    if (card.kind === "toolGroup") {
      return card.value.toolCards.every((tool) => tool.parentReasoningId === null);
    }
    return true;
  });
  const snapshot = currentAguiWorkSnapshot([...events]);
  if (!cards.length && !snapshot) {
    if (state.activityComplete) return nothing;
    return html`<section class="ai-terminal-model-session__activity" aria-label=${state.i18n.t("activityLabel")}>
      <div class="ai-terminal-model-session__activity-item ai-terminal-model-session__activity-item--snapshot" role="status">
        <span class=${activityStatusClass(state)}>${formatActivityStatus(state.i18n.t("activityWorking"), state, state.i18n)}</span>
      </div>
    </section>`;
  }

  return html`<section class="ai-terminal-model-session__activity" aria-label=${state.i18n.t("activityLabel")}>
    ${snapshot && !cards.length ? renderActivitySnapshot(snapshot, state) : nothing}
    ${repeat(visibleCards, activityCardKey, (card) => renderActivityCard(card, state, events))}
  </section>`;
}

function activityCardKey(card: ReturnType<typeof buildAguiUserWorkCards>[number]): string {
  return card.kind === "reasoning"
    ? `reasoning:${card.value.runId}`
    : card.kind === "toolGroup"
      ? `tool-group:${card.value.id}`
      : `tool:${card.value.id}`;
}

function mergeReasoningCards(
  cards: ReturnType<typeof buildAguiUserWorkCards>,
): ReturnType<typeof buildAguiUserWorkCards> {
  const reasoningCards = cards.filter((card) => card.kind === "reasoning");
  if (reasoningCards.length < 2) return cards;

  const first = reasoningCards[0].value;
  const merged = {
    kind: "reasoning" as const,
    value: {
      ...first,
      content: reasoningCards
        .map((card) => card.value.content.trim())
        .filter(Boolean)
        .join("\n\n"),
      summary: reasoningCards
        .map((card) => card.value.summary.trim())
        .filter(Boolean)
        .join("\n\n"),
      ended: reasoningCards.every((card) => card.value.ended),
      endMillis: reasoningCards.reduce((latest, card) => (
        Math.max(latest ?? 0, card.value.endMillis ?? 0) || null
      ), null as number | null),
      firstMillis: Math.min(...reasoningCards.map((card) => card.value.firstMillis)),
      id: `${first.runId}:reasoning`,
      toolCards: reasoningCards.flatMap((card) => card.value.toolCards),
    },
  };

  return [
    merged,
    ...cards.filter((card) => card.kind !== "reasoning"),
  ].sort((left, right) => left.value.firstMillis - right.value.firstMillis);
}

function renderActivitySnapshot(
  snapshot: NonNullable<ReturnType<typeof currentAguiWorkSnapshot>>,
  state: AgentActivityState,
) {
  const { i18n } = state;
  const summary = hasRunError(state.activityEvents)
    ? formatActivityStatus(i18n.t("activityFailed"), state, i18n)
    : state.activityComplete
      ? formatActivityStatus(i18n.t("activityElapsed"), state, i18n)
      : snapshot.activity === "THINKING"
      ? formatActivityStatus(i18n.t("reasoningThinking"), state, i18n)
      : formatActivityStatus(i18n.t("activityProcessed"), state, i18n);
  return html`<div class="ai-terminal-model-session__activity-item ai-terminal-model-session__activity-item--snapshot" aria-live="polite">
    ${hasRunError(state.activityEvents) ? nothing : renderActivityChevron()}
    <span class=${activityStatusClass(state)}>${summary}</span>
  </div>`;
}

function renderActivityCard(
  card: ReturnType<typeof buildAguiUserWorkCards>[number],
  state: AgentActivityState,
  events: readonly TranscriptAguiEvent[],
) {
  const { i18n } = state;
  if (card.kind === "reasoning") {
    const summary = activityStatusLabel(state, events, i18n);
    const detail = card.value.content || card.value.summary;
    return html`<details class="ai-terminal-model-session__activity-item">
      <summary>
        ${hasRunError(events) ? nothing : renderActivityChevron()}
        <span class=${activityStatusClass(state)}>${summary}</span>
      </summary>
      ${detail
        ? html`<div class="ai-terminal-model-session__activity-detail ai-terminal-markdown">
            ${guard([detail], () => renderMarkdownContent(detail))}
          </div>`
        : nothing}
      ${card.value.toolCards.length
        ? renderNestedToolGroup(card.value.toolCards, i18n, state)
        : nothing}
    </details>`;
  }

  if (card.kind === "toolGroup") {
    const tools = card.value.toolCards.filter((tool) => tool.started);
    return html`<details class="ai-terminal-model-session__activity-item">
      <summary>${renderActivityChevron()}<span>${i18n.t("toolsRan")} ${tools.length}</span></summary>
      <div class="ai-terminal-model-session__activity-list">
        ${repeat(tools, (tool) => tool.id, (tool) => renderToolActivity(tool, i18n, state))}
      </div>
    </details>`;
  }

  return renderToolActivity(card.value, i18n, state);
}

function renderToolActivity(
  tool: Extract<ReturnType<typeof buildAguiUserWorkCards>[number], { kind: "tool" }>["value"],
  i18n: ChatTerminalI18n,
  state: AgentActivityState,
) {
  const complete = tool.ended || Boolean(tool.result);
  const running = tool.started && !complete;
  const args = tool.args === undefined ? "" : formatJsonBlockValue(tool.args);
  const result = tool.result ? formatJsonBlockValue(tool.result) : "";
  const presentation = presentToolCall(tool.toolName, tool.args, { locale: i18n.locale });
  const label = presentation.title || i18n.t("toolUnnamed");

  return html`<details class="ai-terminal-model-session__activity-item ai-terminal-model-session__activity-item--tool">
    <summary>${renderActivityChevron()}<span>${running ? i18n.t("toolRunning") : i18n.t("toolRan")} ${label}</span></summary>
    ${args || result
      ? html`<div class="ai-terminal-model-session__activity-detail">
          ${args
            ? html`<section><h4>${i18n.t("toolParameters")}</h4><pre>${args}</pre></section>`
            : nothing}
          ${result
            ? html`<section><h4>${i18n.t("toolResult")}</h4><pre>${result}</pre></section>`
            : nothing}
        </div>`
      : nothing}
  </details>`;
}

function renderNestedToolGroup(
  tools: Extract<
    ReturnType<typeof buildAguiUserWorkCards>[number],
    { kind: "reasoning" }
  >["value"]["toolCards"],
  i18n: ChatTerminalI18n,
  state: AgentActivityState,
) {
  const startedTools = tools.filter((tool) => tool.started);
  if (!startedTools.length) return nothing;
  return html`<details class="ai-terminal-model-session__activity-item ai-terminal-model-session__activity-item--nested">
    <summary>${renderActivityChevron()}<span>${i18n.t("toolsRan")} ${startedTools.length}</span></summary>
    <div class="ai-terminal-model-session__activity-list">
      ${repeat(startedTools, (tool) => tool.id, (tool) => renderToolActivity(tool, i18n, state))}
    </div>
  </details>`;
}

function renderActivityChevron() {
  return html`<svg
    class="ai-terminal-model-session__activity-chevron"
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="m9 18 6-6-6-6"></path>
  </svg>`;
}

function activityElapsedMilliseconds(state: AgentActivityState) {
  return Math.max(0, state.activityNow - state.activityStartedAt);
}

function activityStatusLabel(
  state: AgentActivityState,
  events: readonly TranscriptAguiEvent[],
  i18n: ChatTerminalI18n,
) {
  if (hasRunError(events)) {
    return formatActivityStatus(i18n.t("activityFailed"), state, i18n);
  }
  if (state.activityComplete) {
    return formatActivityStatus(i18n.t("activityElapsed"), state, i18n);
  }
  if (hasActiveReasoning(events)) {
    return formatActivityStatus(i18n.t("reasoningThinking"), state, i18n);
  }
  return formatActivityStatus(i18n.t("activityProcessed"), state, i18n);
}

function hasRunError(events: readonly TranscriptAguiEvent[]) {
  return events.some((event) => event.type.toUpperCase() === "RUN_ERROR");
}

function formatActivityStatus(
  status: string,
  state: AgentActivityState,
  i18n: ChatTerminalI18n,
) {
  return `${status} ${formatDurationValue(activityElapsedMilliseconds(state), i18n)}`;
}

function activityStatusClass(state: AgentActivityState) {
  return state.activityComplete
    ? "ai-terminal-model-session__activity-status"
    : "ai-terminal-model-session__activity-status ai-terminal-model-session__activity-status--running";
}

function hasActiveReasoning(events: readonly TranscriptAguiEvent[]) {
  let active = false;
  events.forEach((event) => {
    const type = event.type.toUpperCase();
    if (type === "REASONING_START" || type === "REASONING_MESSAGE_START") active = true;
    if (type === "REASONING_END" || type === "REASONING_MESSAGE_END") active = false;
  });
  return active;
}

function formatElapsedDuration(milliseconds: number, i18n: ChatTerminalI18n) {
  return `${i18n.t("activityElapsed")} ${formatDurationValue(milliseconds, i18n)}`;
}

function formatDurationValue(milliseconds: number, i18n: ChatTerminalI18n) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}${i18n.t("activityMinute")} ${seconds}${i18n.t("activitySecond")}`;
}
