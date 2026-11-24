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
} from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";

function actionIcon(action: ChatArtifactAction): ReactNode {
  switch (action) {
    case "preview":
      return <Eye aria-hidden="true" size={14} />;
    case "open":
      return <ExternalLink aria-hidden="true" size={14} />;
    case "reveal":
      return <FolderOpen aria-hidden="true" size={14} />;
    case "save":
      return <Download aria-hidden="true" size={14} />;
  }
}

function itemHint(item: ChatArtifactItem, labels: ReturnType<typeof resolveArtifactLabels>): string {
  return [
    item.mediaType ? labels.type(item.mediaType) : "",
    item.byteSize !== undefined ? labels.size(item.byteSize) : "",
  ].filter(Boolean).join(" · ");
}

/**
 * Delivered-file list for one assistant message. The host decides which
 * actions exist and tracks pending/failed execution; this component only
 * renders the flat, already-merged list.
 */
export function ChatArtifacts({
  artifacts,
  onAction,
  onPreview,
  labels: labelOverrides,
  locale,
  states,
}: ChatArtifactsProps) {
  const labels = useMemo(
    () => resolveArtifactLabels(locale, labelOverrides),
    [labelOverrides, locale],
  );
  const parsed = useMemo(() => parseArtifacts(artifacts), [artifacts]);
  const [expanded, setExpanded] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const lastActionRef = useRef<Record<string, ChatArtifactAction>>({});
  if (!parsed || parsed.items.length === 0) return null;

  const visibleItems = expanded
    ? parsed.items
    : parsed.items.slice(0, ARTIFACT_COLLAPSED_COUNT);

  function dispatch(item: ChatArtifactItem, action: ChatArtifactAction) {
    lastActionRef.current[item.id] = action;
    try {
      if (action === "preview") {
        onPreview?.(item);
        return;
      }
      void Promise.resolve(onAction?.(item, action)).catch(() => {
        // The host owns error reporting through `states` and its error channel.
      });
    } catch {
      // A malformed host callback must not break the transcript.
    }
  }

  function actionsFor(item: ChatArtifactItem) {
    return (item.actions ?? []).filter((action) => (
      action === "preview" ? Boolean(onPreview) : Boolean(onAction)
    ));
  }

  function retryActionFor(item: ChatArtifactItem): ChatArtifactAction | undefined {
    const prior = lastActionRef.current[item.id];
    if (prior && (prior === "preview" ? onPreview : onAction)) return prior;
    return actionsFor(item)[0];
  }

  return (
    <div className="ef-chat__artifacts" data-theme-part="chat-artifacts">
      <div className="ef-chat__artifacts-title">{labels.title}</div>
      <ul className="ef-chat__artifacts-list" aria-label={labels.title}>
        {visibleItems.map((item) => {
          const state = states?.[item.id];
          const pending = state === "pending";
          const failed = state === "failed";
          const actions = actionsFor(item);
          const [primary, secondary, ...overflow] = actions;
          const hint = itemHint(item, labels);
          const retryAction = failed ? retryActionFor(item) : undefined;
          return (
            <li
              key={item.id}
              className="ef-chat__artifacts-item"
              data-state={state}
              aria-busy={pending || undefined}
            >
              <div className="ef-chat__artifacts-main">
                <span className="ef-chat__artifacts-name" title={item.display}>{item.display}</span>
                {item.description ? <span className="ef-chat__artifacts-description">{item.description}</span> : null}
                {hint ? <span className="ef-chat__artifacts-meta">{hint}</span> : null}
                {pending ? <span className="ef-chat__artifacts-status" role="status">{labels.pending}</span> : null}
                {failed ? (
                  <span className="ef-chat__artifacts-status ef-chat__artifacts-status--failed" role="alert">
                    {labels.failed}
                  </span>
                ) : null}
              </div>
              <div className="ef-chat__artifacts-actions">
                {failed && retryAction ? (
                  <button
                    className="ef-chat__artifacts-retry"
                    type="button"
                    onClick={() => dispatch(item, retryAction)}
                  >
                    <RotateCcw aria-hidden="true" size={14} />
                    <span>{labels.retry}</span>
                  </button>
                ) : null}
                {primary ? (
                  <button
                    className="ef-chat__artifacts-action ef-chat__artifacts-action--primary"
                    type="button"
                    disabled={pending}
                    onClick={() => dispatch(item, primary)}
                  >
                    {actionIcon(primary)}
                    <span>{labels.action(primary)}</span>
                  </button>
                ) : null}
                {secondary ? (
                  <button
                    className="ef-chat__artifacts-action ef-chat__artifacts-action--primary"
                    type="button"
                    disabled={pending}
                    onClick={() => dispatch(item, secondary)}
                  >
                    {actionIcon(secondary)}
                    <span>{labels.action(secondary)}</span>
                  </button>
                ) : null}
                {overflow.length ? (
                  <div
                    className="ef-chat__artifacts-more"
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpenMenuId(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape" && openMenuId === item.id) {
                        setOpenMenuId(null);
                      }
                    }}
                  >
                    <button
                      aria-expanded={openMenuId === item.id}
                      aria-haspopup="menu"
                      aria-label={labels.actions}
                      className="ef-chat__artifacts-menu-button"
                      disabled={pending}
                      title={labels.actions}
                      type="button"
                      onClick={() => setOpenMenuId((current) => current === item.id ? null : item.id)}
                    >
                      <MoreHorizontal aria-hidden="true" size={14} />
                    </button>
                    {openMenuId === item.id ? (
                      <div className="ef-chat__artifacts-menu" role="menu" aria-label={labels.actions}>
                        {overflow.map((action) => (
                          <button
                            key={action}
                            className="ef-chat__artifacts-menu-item"
                            role="menuitem"
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              dispatch(item, action);
                            }}
                          >
                            {actionIcon(action)}
                            <span>{labels.action(action)}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {parsed.items.length > ARTIFACT_COLLAPSED_COUNT ? (
        <button
          aria-expanded={expanded}
          className="ef-chat__artifacts-toggle"
          type="button"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? <ChevronUp aria-hidden="true" size={14} /> : <ChevronDown aria-hidden="true" size={14} />}
          <span>{expanded ? labels.less : labels.more(parsed.items.length)}</span>
        </button>
      ) : null}
    </div>
  );
}
