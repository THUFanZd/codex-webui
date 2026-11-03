"use client";

/**
 * ConfigPanel — 配置面板（cwd/model/effort/sandbox/approval）。
 *
 * 发送框下方常驻目录和配置展开入口，其余字段默认收起。
 * 展开后字段按窄屏双列排列；偏好仍通过 useConfig 持久化。
 */

import { useState } from "react";
import { useConfig } from "@/hooks/useConfig";
import { DirectoryPicker } from "@/components/fs/DirectoryPicker";
import { Select } from "@/components/ui/Select";
import { FolderOpen, ChevronDown, SlidersHorizontal } from "lucide-react";
import type { SandboxMode, ApprovalPolicy } from "@/types/api";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export function ConfigPanel() {
  const { config, prefs, updatePrefs } = useConfig();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { t } = useLanguage();

  if (!config || !prefs) {
    return (
      <div className="px-4 py-2 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
        loading config…
      </div>
    );
  }

  return (
    <div
      className="px-3 py-2 text-xs sm:px-4"
      data-config-panel="true"
      aria-label={t("config.label")}
    >
      <div className="flex min-w-0 items-center gap-2">
        <button onClick={() => setPickerOpen(true)} aria-label={t("config.cwd")}
          className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--surface-2))] hover:text-foreground focus-ring"
          title={prefs.cwd || t("composer.setCwd")}>
          <FolderOpen className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate font-mono text-[11px]">{prefs.cwd || t("composer.setCwd")}</span>
        </button>
        <span className="hidden max-w-36 truncate text-[11px] text-[hsl(var(--muted-foreground))] sm:inline" title={prefs.model}>{prefs.model}</span>
        <button type="button" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded} aria-controls="session-config-fields"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-[11px] text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--surface-2))] hover:text-foreground focus-ring">
          <SlidersHorizontal className="h-3.5 w-3.5" />{t("config.settings")}<ChevronDown className={"region-disclosure h-3 w-3 " + (expanded ? "rotate-180" : "")} />
        </button>
      </div>
      {expanded && <div id="session-config-fields" className="config-fields region-body mt-2 grid grid-cols-2 items-end gap-2 border-t border-[hsl(var(--border-subtle))] pb-1 pt-3 sm:flex sm:flex-wrap">
      {/* model */}
      <div className="min-w-[150px] flex-[1_1_170px]">
        <span className="mb-1 block text-[10px] text-[hsl(var(--muted-foreground))]">
          {t("config.model")}
        </span>
        <div title={prefs.model ?? ""}>
          <Select
            value={prefs.model ?? ""}
            options={config.models}
            onChange={(v) => {
              // 切换模型时，若当前 effort 不被新模型支持，则回退到模型默认
              const m = config.models.find((x) => x.value === v);
              if (m?.supportedEfforts && m.supportedEfforts.length > 0) {
                if (!m.supportedEfforts.includes(prefs.effort ?? "")) {
                  updatePrefs({
                    model: v,
                    effort: m.defaultEffort ?? m.supportedEfforts[0],
                  });
                  return;
                }
              }
              updatePrefs({ model: v });
            }}
            placement="top"
            aria-label="Model"
            className="h-8 rounded-lg px-2.5"
          />
        </div>
      </div>

      {/* effort */}
      <div className="w-28 shrink-0">
        <span className="mb-1 block text-[10px] text-[hsl(var(--muted-foreground))]">
          {t("config.effort")}
        </span>
        <div>
          <Select
            value={prefs.effort ?? ""}
            options={(() => {
              const m = config.models.find((x) => x.value === prefs.model);
              // 若模型有 supportedEfforts，仅展示该模型支持的级别；否则展示全部
              if (m?.supportedEfforts && m.supportedEfforts.length > 0) {
                return config.efforts.filter((e) =>
                  m.supportedEfforts!.includes(e.value),
                );
              }
              return config.efforts;
            })()}
            onChange={(v) => updatePrefs({ effort: v })}
            placement="top"
            aria-label="Reasoning effort"
            className="h-8 rounded-lg px-2.5"
          />
        </div>
      </div>

      {/* collaboration mode */}
      <div className="w-28 shrink-0">
        <span className="mb-1 block text-[10px] text-[hsl(var(--muted-foreground))]">
          {t("config.mode")}
        </span>
        <Select
          value={prefs.collaborationMode ?? "default"}
          options={[
            { value: "default", label: "Default", description: t("config.modeDefault") },
            { value: "plan", label: "Plan", description: t("config.modePlan") },
          ]}
          onChange={(value) => updatePrefs({ collaborationMode: value as "default" | "plan" })}
          placement="top"
          aria-label="Collaboration mode"
          className="h-8 rounded-lg px-2.5"
        />
      </div>

      {/* sandbox */}
      <div className="min-w-[140px] flex-[0.9_1_160px]">
        <span className="mb-1 block text-[10px] text-[hsl(var(--muted-foreground))]">
          {t("config.sandbox")}
        </span>
        <div>
          <Select
            value={prefs.sandbox}
            options={config.sandboxes.map((s) => ({ value: s, label: s }))}
            onChange={(v) => updatePrefs({ sandbox: v as SandboxMode })}
            placement="top"
            aria-label="Sandbox"
            className="h-8 rounded-lg px-2.5"
          />
        </div>
      </div>

      {/* approval */}
      <div className="min-w-[130px] flex-[0.8_1_145px]">
        <span className="mb-1 block text-[10px] text-[hsl(var(--muted-foreground))]">
          {t("config.approval")}
        </span>
        <div>
          <Select
            value={prefs.approvalPolicy}
            options={config.approvals.map((a) => ({ value: a, label: a }))}
            onChange={(v) =>
              updatePrefs({ approvalPolicy: v as ApprovalPolicy })
            }
            placement="top"
            aria-label="Approval"
            className="h-8 rounded-lg px-2.5"
          />
        </div>
      </div>

      </div>}
      {pickerOpen && (
        <DirectoryPicker
          current={prefs.cwd}
          onSelect={(p) => {
            updatePrefs({ cwd: p });
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
