import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const MEMORY_FILE = './memory/moltbook.json';

export function loadMoltbookMemory(): any {
  try {
    const data = readFileSync(MEMORY_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return { api_key: null, last_post_id: null, followed_agents: [] };
  }
}

export function saveMoltbookMemory(memory: any): void {
  mkdirSync('./memory', { recursive: true });
  writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

export function getMoltbookApiKey(): string {
  const memory = loadMoltbookMemory();
  if (!memory.api_key) {
    throw new Error('No Moltbook API key found. Run registration first.');
  }
  return memory.api_key;
}
