import { JournalEntry, Category } from '../types';

const BASE_URL = 'http://localhost:3001';
const API_URL = `${BASE_URL}/entries`;
const STORAGE_KEY = 'luminary_journal_entries';

export const ApiService = {
  /**
   * 快速探测后端状态
   */
  async checkConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200); // 增加一点容错时间
      const response = await fetch(`${BASE_URL}/ping`, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response.ok;
    } catch (e) {
      return false;
    }
  },

  /**
   * 获取所有日志
   */
  async getEntries(): Promise<JournalEntry[]> {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error('Server returned error');
      const data = await response.json();
      // 同步到本地缓存一份
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return data;
    } catch {
      console.warn("Using local storage fallback for GET");
      return this.getLocalEntries();
    }
  },

  /**
   * 创建新日志
   */
  async createEntry(entry: Omit<JournalEntry, 'id'>): Promise<JournalEntry> {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
      if (!response.ok) throw new Error('Creation failed');
      const saved = await response.json();
      
      // 更新本地缓存
      const local = await this.getLocalEntries();
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...local, saved]));
      
      return saved;
    } catch (e) {
      console.warn("Saving to local storage due to connection issue");
      return this.createLocalEntry(entry);
    }
  },

  /**
   * 删除日志
   */
  async deleteEntry(id: string): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Deletion failed');
      
      // 同步更新本地
      const local = await this.getLocalEntries();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(local.filter((e: any) => e.id !== id)));
    } catch {
      return this.deleteLocalEntry(id);
    }
  },

  // --- 本地存储逻辑 (作为 Fallback) ---
  async getLocalEntries(): Promise<JournalEntry[]> {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  async createLocalEntry(entry: Omit<JournalEntry, 'id'>): Promise<JournalEntry> {
    const newEntry = { ...entry, id: `local-${Date.now()}` };
    const entries = await this.getLocalEntries();
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...entries, newEntry]));
    return newEntry as JournalEntry;
  },

  async deleteLocalEntry(id: string): Promise<void> {
    const entries = await this.getLocalEntries();
    const updated = entries.filter((e: JournalEntry) => e.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  async importEntries(data: JournalEntry[]): Promise<void> {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
};