"use client";
import { useState } from "react";
import { ChevronRight, Folder, FolderOpen, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
/** Column width for each depth level in px */
const COL = 18;

export function MenuTreeView({ tree, selectedIds, onToggle, highlightIds }) {
  return (
    <div className="py-0.5">
      {tree.map((node, i) => (
        <TreeNode
          key={node.menu.id}
          node={node}
          depth={0}
          isLast={i === tree.length - 1}
          guides={[]}
          selectedIds={selectedIds}
          onToggle={onToggle}
          highlightIds={highlightIds}
        />
      ))}
    </div>
  );
}
function TreeNode({ node, depth, isLast, guides, selectedIds, onToggle, highlightIds }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const checked = selectedIds.has(node.menu.id);
  const dimmed = highlightIds !== undefined && !highlightIds.has(node.menu.id);
  // Children inherit current guide state + whether this node continues
  const childGuides = depth === 0 ? [] : [...guides, !isLast];
  const mid = Math.floor(COL / 2);

  return (
    <div className={dimmed ? "opacity-40 transition-opacity" : "transition-opacity"}>
      {/* ── Row ── */}
      <div
        className={[
          "group/row relative flex min-h-8 w-full min-w-0 items-center rounded-sm py-1 transition-colors",
          checked ? "bg-primary/[0.04] hover:bg-primary/[0.07]" : "hover:bg-accent/50",
        ].join(" ")}
      >
        {/* Ancestor guide columns — vertical continuation lines */}
        {guides.map((showLine, i) => (
          <span key={i} className="relative h-full shrink-0" style={{ width: COL }}>
            {showLine && (
              <span className="absolute top-0 bottom-0 w-px bg-border/60" style={{ left: mid }} />
            )}
          </span>
        ))}

        {/* Branch connector at this node's depth (depth > 0 only) */}
        {depth > 0 ? (
          <span className="relative h-full shrink-0" style={{ width: COL }}>
            {/* Vertical segment: full-height if not last, half-height if last */}
            <span
              className="absolute w-px bg-border/60"
              style={{
                left: mid,
                top: 0,
                height: isLast ? "50%" : "100%",
              }}
            />
            {/* Horizontal branch to content */}
            <span
              className="absolute h-px bg-border/60"
              style={{ left: mid, top: "50%", width: mid }}
            />
            {/* Junction dot */}
            <span
              className="absolute size-[3px] rounded-full bg-border"
              style={{ left: mid - 1, top: "calc(50% - 1.5px)" }}
            />
          </span>
        ) : (
          <span className="w-2 shrink-0" />
        )}

        {/* Expand/collapse chevron */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronRight
              className={`size-3.5 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
            />
          </button>
        ) : (
          <span className="size-5 shrink-0" />
        )}

        {/* Checkbox */}
        <span className="mx-1.5 shrink-0">
          <Checkbox
            checked={checked}
            onCheckedChange={(next) => onToggle(node.menu.id, next === true)}
            variant={hasChildren ? "info" : "default"}
            size="sm"
          />
        </span>

        {/* Icon */}
        <span className="mr-1.5 shrink-0 text-muted-foreground">
          {hasChildren ? (
            expanded ? (
              <FolderOpen className="size-3.5 text-primary/70" />
            ) : (
              <Folder className="size-3.5 text-primary/70" />
            )
          ) : (
            <FileText className="size-3.5" />
          )}
        </span>

        {/* Label */}
        <div className="flex min-w-0 flex-1 items-start gap-2 pr-2">
          <div className="min-w-0 flex-1">
            <span
              className={`block min-w-0 truncate text-sm ${hasChildren ? "font-semibold text-foreground" : "text-foreground/85"}`}
            >
              {node.menu.title}
            </span>
            {node.menu.label && node.menu.label !== node.menu.title && (
              <span className="block min-w-0 truncate text-[11px] text-muted-foreground">
                {node.menu.label}
              </span>
            )}
          </div>
          <div className="ml-auto mt-0.5 flex shrink-0 items-center gap-1.5">
            {node.menu.permission_key && (
              <Badge variant="outline" className="max-w-[10rem] shrink-0 font-mono text-[10px]">
                {node.menu.permission_key}
              </Badge>
            )}
            {hasChildren && (
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                {node.children.length}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* ── Children ── */}
      {hasChildren && expanded && (
        <div>
          {node.children.map((child, i) => (
            <TreeNode
              key={child.menu.id}
              node={child}
              depth={depth + 1}
              isLast={i === node.children.length - 1}
              guides={childGuides}
              selectedIds={selectedIds}
              onToggle={onToggle}
              highlightIds={highlightIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}
