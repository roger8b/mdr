import os from "node:os";
import path from "node:path";
import fs from "fs-extra";

const home = os.homedir();
const configHome = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
const claudeHome = process.env.CLAUDE_CONFIG_DIR || path.join(home, ".claude");

export type AgentId = string;

export interface AgentConfig {
  name: AgentId;
  displayName: string;
  skillsDir: string;
  globalSkillsDir: string;
  ruleFile: string;
  ruleFormat: "boilerplate" | "cursor";
  appendOk: boolean;
  showInUniversalList?: boolean;
  detectInstalled: () => boolean;
}

export const AGENTS: Record<AgentId, AgentConfig> = {
  "claude-code": {
    name: "claude-code", displayName: "Claude Code",
    skillsDir: ".claude/skills",
    globalSkillsDir: path.join(claudeHome, "skills"),
    ruleFile: "CLAUDE.md", ruleFormat: "boilerplate", appendOk: true,
    detectInstalled: () => fs.existsSync(claudeHome),
  },
  "pi": {
    name: "pi", displayName: "Pi",
    skillsDir: ".pi/skills",
    globalSkillsDir: path.join(home, ".pi/agent/skills"),
    ruleFile: "AGENTS.md", ruleFormat: "boilerplate", appendOk: true,
    detectInstalled: () => fs.existsSync(path.join(home, ".pi/agent")),
  },
  "cursor": {
    name: "cursor", displayName: "Cursor",
    skillsDir: ".agents/skills",
    globalSkillsDir: path.join(home, ".cursor/skills"),
    ruleFile: ".cursor/rules/mdr.mdc", ruleFormat: "cursor", appendOk: false,
    detectInstalled: () => fs.existsSync(path.join(home, ".cursor")),
  },
  "continue": {
    name: "continue", displayName: "Continue",
    skillsDir: ".continue/skills",
    globalSkillsDir: path.join(home, ".continue/skills"),
    ruleFile: "AGENTS.md", ruleFormat: "boilerplate", appendOk: true,
    detectInstalled: () =>
      fs.existsSync(path.join(process.cwd(), ".continue")) || fs.existsSync(path.join(home, ".continue")),
  },
  "windsurf": {
    name: "windsurf", displayName: "Windsurf",
    skillsDir: ".windsurf/skills",
    globalSkillsDir: path.join(home, ".codeium/windsurf/skills"),
    ruleFile: "AGENTS.md", ruleFormat: "boilerplate", appendOk: true,
    detectInstalled: () => fs.existsSync(path.join(home, ".codeium/windsurf")),
  },
  "roo": {
    name: "roo", displayName: "Roo Code",
    skillsDir: ".roo/skills",
    globalSkillsDir: path.join(home, ".roo/skills"),
    ruleFile: "AGENTS.md", ruleFormat: "boilerplate", appendOk: true,
    detectInstalled: () => fs.existsSync(path.join(home, ".roo")),
  },
  "github-copilot": {
    name: "github-copilot", displayName: "GitHub Copilot",
    skillsDir: ".agents/skills",
    globalSkillsDir: path.join(home, ".copilot/skills"),
    ruleFile: ".github/copilot-instructions.md", ruleFormat: "boilerplate", appendOk: true,
    detectInstalled: () => fs.existsSync(path.join(home, ".copilot")),
  },
  "goose": {
    name: "goose", displayName: "Goose",
    skillsDir: ".goose/skills",
    globalSkillsDir: path.join(configHome, "goose/skills"),
    ruleFile: "AGENTS.md", ruleFormat: "boilerplate", appendOk: true,
    detectInstalled: () => fs.existsSync(path.join(configHome, "goose")),
  },
  "cline": {
    name: "cline", displayName: "Cline",
    skillsDir: ".agents/skills",
    globalSkillsDir: path.join(home, ".agents/skills"),
    ruleFile: ".clinerules", ruleFormat: "boilerplate", appendOk: true,
    detectInstalled: () => fs.existsSync(path.join(home, ".cline")),
  },
  "aider": {
    name: "aider", displayName: "Aider",
    skillsDir: ".aider/skills",
    globalSkillsDir: path.join(home, ".aider/skills"),
    ruleFile: "AGENTS.md", ruleFormat: "boilerplate", appendOk: true,
    detectInstalled: () => fs.existsSync(path.join(home, ".aider")),
  },
  "opencode": {
    name: "opencode", displayName: "OpenCode",
    skillsDir: ".agents/skills",
    globalSkillsDir: path.join(configHome, "opencode/skills"),
    ruleFile: "AGENTS.md", ruleFormat: "boilerplate", appendOk: true,
    detectInstalled: () => fs.existsSync(path.join(configHome, "opencode")),
  },
};

export function detectInstalledAgents(): AgentId[] {
  return Object.entries(AGENTS)
    .filter(([_, c]) => {
      try { return c.detectInstalled(); } catch { return false; }
    })
    .map(([id]) => id);
}

export function isUniversalAgent(id: AgentId): boolean {
  return AGENTS[id]?.skillsDir === ".agents/skills";
}

export function getAgent(id: AgentId): AgentConfig | undefined {
  return AGENTS[id];
}