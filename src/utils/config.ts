import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { Config, ProjectConfig } from '../types.js';

const CONFIG_DIR = join(homedir(), '.highlight-workflow');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function getDefaultConfig(): Config {
  return {
    projects: [],
    defaultProject: '',
    storageBasePath: join(homedir(), 'Documents', 'HighlightNotes'),
    defaultCalendar: 'google',
    defaultEmailMethod: 'draft',
  };
}

export function loadConfig(): Config {
  ensureConfigDir();

  if (!existsSync(CONFIG_FILE)) {
    const defaultConfig = getDefaultConfig();
    saveConfig(defaultConfig);
    return defaultConfig;
  }

  try {
    const content = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content) as Config;
  } catch {
    return getDefaultConfig();
  }
}

export function saveConfig(config: Config): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function addProject(project: ProjectConfig): Config {
  const config = loadConfig();
  const existing = config.projects.findIndex(p => p.name === project.name);

  if (existing >= 0) {
    config.projects[existing] = project;
  } else {
    config.projects.push(project);
  }

  if (!config.defaultProject) {
    config.defaultProject = project.name;
  }

  saveConfig(config);
  return config;
}

export function getProject(name: string): ProjectConfig | undefined {
  const config = loadConfig();
  return config.projects.find(p => p.name === name);
}

export function listProjects(): ProjectConfig[] {
  const config = loadConfig();
  return config.projects;
}
