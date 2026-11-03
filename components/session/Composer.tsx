"use client";

/**
 * Composer — 输入框 + 发送/停止按钮 + slash 命令/skill 自动补全。
 *
 * - 输入 "/" 作为首字符时弹出 slash 命令补全菜单
 * - 输入 "@<filter>"（空格或行首后跟 @）时弹出 skill 补全菜单
 *   特别地，/skills @ 是 codex CLI 的 skill 调用语法
 * - Up/Down 选择，Enter/Tab 确认，Escape 关闭
 * - /clear 等本地命令直接执行，其余作为 prompt 发送给 codex
 * - Enter 发送，Shift+Enter 换行
 * - 运行中按钮变为 Stop
 * - 有 resumeSessionId 时走 resume 分支
 * - 无 cwd 时禁用
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useConversationLayout } from "@/stores/conversation-layout";
import { branchPrompt, type QuestionDraft } from "@/lib/session/conversation-layout";
import { useExecStream } from "@/hooks/useExecStream";
import { useConfig } from "@/hooks/useConfig";
import { useSkills } from "@/hooks/useSkills";
import { useActiveSession } from "@/stores/active-session";
import { ArrowUp, Square, CornerDownLeft, History, Sparkles, Plus, X, GitBranch, ChevronDown } from "lucide-react";
import { SlashCommandMenu } from "./SlashCommandMenu";
import { SkillMenu } from "./SkillMenu";
import {
  filterSlashCommands,
  type SlashCommand,
} from "@/lib/codex/slash-commands";
import type { SkillInfo } from "@/types/api";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export function Composer() {
  const { t } = useLanguage();
  const { prefs } = useConfig();
  const { skills } = useSkills();
  const { run, abort, isRunning } = useExecStream();
  const { state, dispatch } = useActiveSession();
  const layout = useConversationLayout();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // slash 命令菜单状态
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);

  // skill 菜单状态
  const [skillOpen, setSkillOpen] = useState(false);
  const [skillIndex, setSkillIndex] = useState(0);

  const running = isRunning || state.status === "running";
  const disabled = !prefs?.cwd;
  const resumeId = state.resumeSessionId;

  // 从输入值中提取 slash 前缀（仅在首字符为 / 且未含空格时触发）
  const slashPrefix = useMemo(() => {
    if (!value.startsWith("/")) return null;
    // 遇到空格说明已进入参数输入阶段，关闭菜单
    const spaceIdx = value.indexOf(" ");
    if (spaceIdx !== -1) return null;
    return value;
  }, [value]);

  const filteredCommands = useMemo(
    () => (slashPrefix ? filterSlashCommands(slashPrefix) : []),
    [slashPrefix],
  );

  /**
   * skill @ 触发检测：输入末尾的 @<filter>（@ 前需为空格或行首）。
   *
   * 匹配场景：
   * - "/skills @nat" → filter = "nat"
   * - "使用 @nature-" → filter = "nature-"
   * - "@" → filter = ""（空过滤，显示全部）
   *
   * 不匹配：
   * - "email@test"（@ 前非空格）
   * - "/skills @" 后跟空格再输入其他文字（@<filter> 不在末尾）
   */
  const skillTrigger = useMemo(() => {
    const match = value.match(/(?:^|\s)@(\S*)$/);
    if (!match) return null;
    return { filter: match[1] };
  }, [value]);

  const filteredSkills = useMemo(() => {
    if (!skillTrigger) return [];
    const filter = skillTrigger.filter.toLowerCase();
    if (!filter) return skills;
    return skills.filter((s) => s.name.toLowerCase().includes(filter));
  }, [skillTrigger, skills]);

  // slash 菜单开关跟随 prefix 与过滤结果
  useEffect(() => {
    if (slashPrefix && filteredCommands.length > 0) {
      setSlashOpen(true);
    } else {
      setSlashOpen(false);
    }
    // 前缀变化时重置选中项
    setSlashIndex(0);
  }, [slashPrefix, filteredCommands.length]);

  // skill 菜单开关跟随 trigger 与过滤结果
  useEffect(() => {
    if (skillTrigger && filteredSkills.length > 0) {
      setSkillOpen(true);
    } else {
      setSkillOpen(false);
    }
    setSkillIndex(0);
  }, [skillTrigger, filteredSkills.length]);

  // 自适应高度
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  /** 选中某个 slash 命令后的处理 */
  const handleSlashSelect = useCallback(
    (cmd: SlashCommand) => {
      setSlashOpen(false);

      // 本地执行命令
      if (cmd.execute === "local") {
        if (cmd.name === "/clear") {
          abort();
          dispatch({ type: "RESET" });
          dispatch({ type: "SET_RESUME", sessionId: null });
        }
        setValue("");
        textareaRef.current?.focus();
        return;
      }

      // prompt 命令：插入命令名 + 空格，光标定位到末尾，用户可追加参数
      setValue(`${cmd.name} `);
      textareaRef.current?.focus();
      // 将光标移到末尾
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.setSelectionRange(el.value.length, el.value.length);
        }
      });
    },
    [abort, dispatch],
  );

  /** 选中某个 skill 后的处理：将末尾的 @<filter> 替换为 @<skill-name> */
  const handleSkillSelect = useCallback(
    (skill: SkillInfo) => {
      setSkillOpen(false);
      // 替换输入末尾的 @<filter> 为 @<skill-name> （带尾随空格）
      const newValue = value.replace(/@(\S*)$/, `@${skill.name} `);
      setValue(newValue);
      textareaRef.current?.focus();
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.setSelectionRange(el.value.length, el.value.length);
        }
      });
    },
    [value],
  );

  const execute = (text: string, draft?: QuestionDraft) => {
    if (running || disabled || !prefs?.cwd || !layout.ready) return;
    const group = layout.doc.groups.find((entry) => entry.id === (draft?.groupId ?? layout.doc.activeGroupId));
    const parentId = draft ? draft.parentId : layout.doc.replyToId;
    const parentKey = group?.nodes.find((node) => node.id === parentId)?.turnId ?? group?.anchorTurnId;
    const parent = group?.type === "tree" ? layout.turns.find((turn) => turn.id === parentKey) : undefined;
    layout.attachTurn("question-" + (resumeId ? layout.turns.length : 0), draft);
    void run({
      prompt: branchPrompt(text, parent),
      cwd: prefs.cwd, model: prefs.model, effort: prefs.effort,
      sandbox: prefs.sandbox, approvalPolicy: prefs.approvalPolicy,
      collaborationMode: prefs.collaborationMode ?? "default",
      skipGitRepoCheck: true, resumeSessionId: resumeId ?? undefined,
    });
  };
  const send = () => {
    const text = value.trim();
    if (!text || disabled || !layout.ready) return;
    if (layout.doc.mode === "tree") layout.addDraft(text);
    else {
      if (running) return;
      execute(text);
    }
    setValue("");
    textareaRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      // skill 菜单打开时优先处理（与 slash 菜单互斥，不会同时打开）
      if (skillOpen && filteredSkills.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSkillIndex((i) => (i + 1) % filteredSkills.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSkillIndex(
            (i) => (i - 1 + filteredSkills.length) % filteredSkills.length,
          );
          return;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          handleSkillSelect(filteredSkills[skillIndex]);
          return;
        }
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSkillSelect(filteredSkills[skillIndex]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setSkillOpen(false);
          return;
        }
      }

      // slash 菜单打开时优先处理导航键
      if (slashOpen && filteredCommands.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSlashIndex((i) => (i + 1) % filteredCommands.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSlashIndex(
            (i) => (i - 1 + filteredCommands.length) % filteredCommands.length,
          );
          return;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          handleSlashSelect(filteredCommands[slashIndex]);
          return;
        }
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          const trimmed = value.trim();
          const exactMatch = filteredCommands.find((cmd) => cmd.name === trimmed);
          if (exactMatch) {
            if (exactMatch.execute === "local") {
              // 本地命令（如 /clear）：直接执行
              handleSlashSelect(exactMatch);
            } else if (!running && !disabled && prefs?.cwd) {
              // prompt 命令且当前可发送：直接发送，不再插入空格等待二次回车
              setSlashOpen(false);
              send();
            } else {
              // 无法发送（运行中/无 cwd）：退回到菜单选择，保留输入供用户后续操作
              handleSlashSelect(filteredCommands[slashIndex]);
            }
          } else {
            // 部分匹配：从菜单选择（插入命令名 + 空格）
            handleSlashSelect(filteredCommands[slashIndex]);
          }
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setSlashOpen(false);
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    };

  return (
    <div className="border-t border-[hsl(var(--overlay)/0.05)] bg-[hsl(var(--surface))] px-4 py-[6px]">
      <div className="mx-auto max-w-4xl">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div role="group" aria-label={t("org.modeLabel")} className="inline-flex rounded-lg border border-[hsl(var(--overlay)/0.12)] p-0.5">
            {(["normal", "tree", "fold"] as const).map((mode) => (
              <button key={mode} type="button" aria-pressed={layout.doc.mode === mode}
                disabled={!layout.ready}
                onClick={() => layout.selectMode(mode)}
                className={"inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs focus-ring " +
                  (layout.doc.mode === mode ? "bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--overlay)/0.05)]")}>
                {mode === "tree" ? <GitBranch className="h-3 w-3" /> : mode === "fold" ? <ChevronDown className="h-3 w-3" /> : null}
                {t(("org." + mode) as "org.normal" | "org.tree" | "org.fold")}
              </button>
            ))}
          </div>
          {layout.doc.mode !== "normal" && <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {t(layout.doc.mode === "tree" ? "org.treeHelp" : "org.foldHelp")}
          </span>}
          {layout.doc.replyToId && <button type="button" onClick={() => layout.followUp(layout.doc.activeGroupId!, null)}
            className="max-w-full truncate rounded-md bg-[hsl(var(--primary)/0.08)] px-2 py-1 text-xs text-[hsl(var(--primary))] focus-ring">
            {t("org.replyingTo")} {layout.turns.find((turn) => turn.id === layout.doc.groups.find((group) => group.id === layout.doc.activeGroupId)?.nodes.find((node) => node.id === layout.doc.replyToId)?.turnId)?.prompt?.text.slice(0, 45)}
            <X className="ml-1 inline h-3 w-3" />
          </button>}
        </div>
        {layout.doc.drafts.length > 0 && <div className="mb-2 rounded-lg border border-[hsl(var(--primary)/0.18)] bg-[hsl(var(--surface-2))] p-2" aria-label={t("org.drafts")}>
          <div className="mb-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">{t("org.drafts")} ({layout.doc.drafts.length})</div>
          <div className="max-h-36 space-y-1 overflow-y-auto">
            {layout.doc.drafts.map((draft) => <div key={draft.id} className="flex items-center gap-2">
              <textarea aria-label={t("org.draftText")} rows={1} value={draft.text} onChange={(event) => layout.editDraft(draft.id, event.target.value)}
                className="min-w-0 flex-1 resize-y rounded-md border border-[hsl(var(--overlay)/0.08)] bg-background px-2 py-1 text-sm focus-ring" />
              <button type="button" onClick={() => execute(draft.text.trim(), draft)} disabled={running || disabled || !draft.text.trim()}
                className="rounded-md bg-[hsl(var(--primary)/0.12)] px-2 py-1 text-xs text-[hsl(var(--primary))] disabled:opacity-40 focus-ring">{t("org.send")}</button>
              <button type="button" aria-label={t("org.removeDraft")} onClick={() => layout.removeDraft(draft.id)}
                className="rounded-md p-1 text-[hsl(var(--muted-foreground))] focus-ring"><X className="h-3.5 w-3.5" /></button>
            </div>)}
          </div>
        </div>}
        <div className="relative">
          {/* slash 命令补全菜单 */}
          {slashOpen && filteredCommands.length > 0 && (
            <SlashCommandMenu
              commands={filteredCommands}
              selectedIndex={slashIndex}
              onSelect={handleSlashSelect}
              onHover={setSlashIndex}
            />
          )}

          {/* skill 补全菜单（/skills @ 触发） */}
          {skillOpen && filteredSkills.length > 0 && (
            <SkillMenu
              skills={filteredSkills}
              selectedIndex={skillIndex}
              onSelect={handleSkillSelect}
              onHover={setSkillIndex}
            />
          )}

          <div
            className={`flex items-end gap-2 rounded-xl border bg-[hsl(var(--surface-2))] px-3 py-2 shadow-sm transition-all ${
              disabled
                ? "border-[hsl(var(--overlay)/0.05)] opacity-50"
                : "border-[hsl(var(--overlay)/0.1)] focus-within:border-[hsl(var(--primary)/0.4)] focus-within:shadow-md"
            }`}
          >
            <textarea
              ref={textareaRef}
              data-main-composer
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={disabled}
              rows={1}
              placeholder={
                disabled
                  ? t("composer.setCwd")
                  : resumeId
                    ? t("composer.continue")
                    : t("composer.ask")
              }
              className="flex-1 resize-none bg-transparent text-base text-foreground placeholder:text-[hsl(var(--muted-foreground))] outline-none disabled:cursor-not-allowed"
              style={{ minHeight: "28px", maxHeight: "200px" }}
            />

            {running && (
              <button
                onClick={abort}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.1)] text-[hsl(var(--danger))] hover:bg-[hsl(var(--danger)/0.2)] transition-colors focus-ring"
                title={t("common.stop")}
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            )}
            {(!running || layout.doc.mode === "tree") && (
              <button
                onClick={send}
                disabled={!value.trim() || disabled || !layout.ready}
                className={"inline-flex shrink-0 items-center justify-center rounded-md border border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.2)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-ring " + (layout.doc.mode === "tree" ? "h-8 gap-1 px-2 text-xs" : "h-7 w-7")}
                title={layout.doc.mode === "tree" ? t("org.add") : "Send (Enter)"}
                aria-label={layout.doc.mode === "tree" ? t("org.add") : "Send (Enter)"}
              >
                {layout.doc.mode === "tree" ? <><Plus className="h-3.5 w-3.5" />{t("org.add")}</> : <ArrowUp className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-0.5">
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-[hsl(var(--overlay)/0.05)] px-2 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
            {resumeId ? (
              <>
                <History className="h-3 w-3 text-[hsl(var(--primary))]" />
                {t("composer.continuing")}
                <span className="text-foreground/65">{resumeId.slice(0, 8)}</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3 text-[hsl(var(--primary))]" />
                {t("composer.new")}
              </>
            )}
          </span>
          <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[10px] text-[hsl(var(--muted-foreground))]">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-[hsl(var(--overlay)/0.1)] bg-[hsl(var(--surface-2))] px-1.5 py-0.5 font-mono text-[9px] text-foreground/70">Enter</kbd>
              {layout.doc.mode === "tree" ? t("org.add") : t("composer.send")}
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-[hsl(var(--overlay)/0.1)] bg-[hsl(var(--surface-2))] px-1.5 py-0.5 font-mono text-[9px] text-foreground/70">Shift</kbd>
              <CornerDownLeft className="h-3 w-3" />
              {t("composer.newline")}
            </span>
            {(slashOpen || skillOpen) && (
              <span className="font-mono">{t("composer.selectHint")}</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
