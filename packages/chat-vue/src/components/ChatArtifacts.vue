<script setup lang="ts">
import {
  ARTIFACT_COLLAPSED_COUNT,
  parseArtifacts,
  resolveArtifactLabels,
  type ChatArtifactAction,
  type ChatArtifactItem,
  type ChatArtifactsProps,
} from "@personai/agent-ui-chat-core";
import {
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Eye,
  FolderOpen,
  MoreHorizontal,
  RotateCcw,
} from "lucide-vue-next";
import { computed, ref } from "vue";

const props = defineProps<ChatArtifactsProps>();

const parsed = computed(() => parseArtifacts(props.artifacts));
const labels = computed(() => resolveArtifactLabels(props.locale, props.labels));
const expanded = ref(false);
const openMenuId = ref<string | null>(null);
const lastActions = ref<Record<string, ChatArtifactAction>>({});
const visibleItems = computed(() => {
  const items = parsed.value?.items ?? [];
  return expanded.value ? items : items.slice(0, ARTIFACT_COLLAPSED_COUNT);
});

function actionIcon(action?: ChatArtifactAction) {
  if (!action) return undefined;
  return {
    preview: Eye,
    open: ExternalLink,
    reveal: FolderOpen,
    save: Download,
  }[action];
}

function stateOf(item: ChatArtifactItem) {
  return props.states?.[item.id];
}

function itemHint(item: ChatArtifactItem) {
  return [
    item.mediaType ? labels.value.type(item.mediaType) : "",
    item.byteSize !== undefined ? labels.value.size(item.byteSize) : "",
  ].filter(Boolean).join(" · ");
}

function actionsFor(item: ChatArtifactItem) {
  return (item.actions ?? []).filter((action) => (
    action === "preview" ? Boolean(props.onPreview) : Boolean(props.onAction)
  ));
}

function primaryAction(item: ChatArtifactItem) {
  return actionsFor(item)[0];
}

function primaryActionLabel(item: ChatArtifactItem) {
  const action = primaryAction(item);
  return action ? labels.value.action(action) : "";
}

function overflowActions(item: ChatArtifactItem) {
  return actionsFor(item).slice(2);
}

function secondaryAction(item: ChatArtifactItem) {
  return actionsFor(item)[1];
}

function secondaryActionLabel(item: ChatArtifactItem) {
  const action = secondaryAction(item);
  return action ? labels.value.action(action) : "";
}

function retryActionFor(item: ChatArtifactItem) {
  const prior = lastActions.value[item.id];
  if (prior && (prior === "preview" ? props.onPreview : props.onAction)) return prior;
  return actionsFor(item)[0];
}

function dispatch(item: ChatArtifactItem, action?: ChatArtifactAction) {
  if (!action) return;
  lastActions.value = { ...lastActions.value, [item.id]: action };
  try {
    if (action === "preview") {
      props.onPreview?.(item);
      return;
    }
    void Promise.resolve(props.onAction?.(item, action)).catch(() => {
      // The host owns error reporting through `states` and its error channel.
    });
  } catch {
    // A malformed host callback must not break the transcript.
  }
}

function closeMenuOnBlur(event: FocusEvent, itemId: string) {
  if (openMenuId.value !== itemId) return;
  const next = event.relatedTarget as Node | null;
  if (!next || !(event.currentTarget as HTMLElement).contains(next)) openMenuId.value = null;
}
</script>

<template>
  <div v-if="parsed && parsed.items.length" class="ef-chat__artifacts" data-theme-part="chat-artifacts">
    <div class="ef-chat__artifacts-title">{{ labels.title }}</div>
    <ul class="ef-chat__artifacts-list" :aria-label="labels.title">
      <li
        v-for="item in visibleItems"
        :key="item.id"
        class="ef-chat__artifacts-item"
        :data-state="stateOf(item)"
        :aria-busy="stateOf(item) === 'pending' ? 'true' : undefined"
      >
        <div class="ef-chat__artifacts-main">
          <span class="ef-chat__artifacts-name" :title="item.display">{{ item.display }}</span>
          <span v-if="item.description" class="ef-chat__artifacts-description">{{ item.description }}</span>
          <span v-if="itemHint(item)" class="ef-chat__artifacts-meta">{{ itemHint(item) }}</span>
          <span v-if="stateOf(item) === 'pending'" class="ef-chat__artifacts-status" role="status">{{ labels.pending }}</span>
          <span v-if="stateOf(item) === 'failed'" class="ef-chat__artifacts-status ef-chat__artifacts-status--failed" role="alert">{{ labels.failed }}</span>
        </div>
        <div class="ef-chat__artifacts-actions">
          <button
            v-if="stateOf(item) === 'failed' && retryActionFor(item)"
            class="ef-chat__artifacts-retry"
            type="button"
            @click="dispatch(item, retryActionFor(item))"
          >
            <RotateCcw aria-hidden="true" :size="14" />
            <span>{{ labels.retry }}</span>
          </button>
          <button
            v-if="primaryAction(item)"
            class="ef-chat__artifacts-action ef-chat__artifacts-action--primary"
            type="button"
            :disabled="stateOf(item) === 'pending'"
            @click="dispatch(item, primaryAction(item))"
          >
            <component :is="actionIcon(primaryAction(item))" aria-hidden="true" :size="14" />
            <span>{{ primaryActionLabel(item) }}</span>
          </button>
          <button
            v-if="secondaryAction(item)"
            class="ef-chat__artifacts-action ef-chat__artifacts-action--primary"
            type="button"
            :disabled="stateOf(item) === 'pending'"
            @click="dispatch(item, secondaryAction(item))"
          >
            <component :is="actionIcon(secondaryAction(item))" aria-hidden="true" :size="14" />
            <span>{{ secondaryActionLabel(item) }}</span>
          </button>
          <div
            v-if="overflowActions(item).length"
            class="ef-chat__artifacts-more"
            @focusout="closeMenuOnBlur($event, item.id)"
            @keydown.esc="openMenuId = openMenuId === item.id ? null : openMenuId"
          >
            <button
              :aria-expanded="openMenuId === item.id"
              aria-haspopup="menu"
              :aria-label="labels.actions"
              class="ef-chat__artifacts-menu-button"
              :disabled="stateOf(item) === 'pending'"
              :title="labels.actions"
              type="button"
              @click="openMenuId = openMenuId === item.id ? null : item.id"
            >
              <MoreHorizontal aria-hidden="true" :size="14" />
            </button>
            <div v-if="openMenuId === item.id" class="ef-chat__artifacts-menu" role="menu" :aria-label="labels.actions">
              <button
                v-for="action in overflowActions(item)"
                :key="action"
                class="ef-chat__artifacts-menu-item"
                role="menuitem"
                type="button"
                @click="openMenuId = null; dispatch(item, action)"
              >
                <component :is="actionIcon(action)" aria-hidden="true" :size="14" />
                <span>{{ labels.action(action) }}</span>
              </button>
            </div>
          </div>
        </div>
      </li>
    </ul>
    <button
      v-if="parsed.items.length > ARTIFACT_COLLAPSED_COUNT"
      :aria-expanded="expanded"
      class="ef-chat__artifacts-toggle"
      type="button"
      @click="expanded = !expanded"
    >
      <ChevronUp v-if="expanded" aria-hidden="true" :size="14" />
      <ChevronDown v-else aria-hidden="true" :size="14" />
      <span>{{ expanded ? labels.less : labels.more(parsed.items.length) }}</span>
    </button>
  </div>
</template>
