import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface OliveDB extends DBSchema {
  projects: {
    key: string;
    value: {
      id: string;
      name: string;
      data: any;
      thumbnail?: string;
      createdAt: Date;
      updatedAt: Date;
    };
    indexes: { 
      'updatedAt': Date; 
      'name': string; 
    };
  };
  media: {
    key: string;
    value: {
      id: string;
      name: string;
      type: string;
      size: number;
      data: ArrayBuffer;
      thumbnail?: string;
      metadata: any;
      createdAt: Date;
    };
    indexes: { 
      'type': string; 
      'createdAt': Date; 
    };
  };
  preferences: {
    key: string;
    value: any;
  };
  cache: {
    key: string;
    value: {
      key: string;
      data: any;
      expiry: number;
    };
    indexes: { 
      'expiry': number; 
    };
  };
}

export class StorageManager {
  private db?: IDBPDatabase<OliveDB>;
  private readonly dbName = 'OliveDB';
  private readonly dbVersion = 1;

  async initialize(): Promise<void> {
    try {
      this.db = await openDB<OliveDB>(this.dbName, this.dbVersion, {
        upgrade(db) {
          // Projects store
          if (!db.objectStoreNames.contains('projects')) {
            const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
            projectStore.createIndex('updatedAt', 'updatedAt');
            projectStore.createIndex('name', 'name');
          }

          // Media store
          if (!db.objectStoreNames.contains('media')) {
            const mediaStore = db.createObjectStore('media', { keyPath: 'id' });
            mediaStore.createIndex('type', 'type');
            mediaStore.createIndex('createdAt', 'createdAt');
          }

          // Preferences store
          if (!db.objectStoreNames.contains('preferences')) {
            db.createObjectStore('preferences', { keyPath: 'key' });
          }

          // Cache store
          if (!db.objectStoreNames.contains('cache')) {
            const cacheStore = db.createObjectStore('cache', { keyPath: 'key' });
            cacheStore.createIndex('expiry', 'expiry');
          }
        }
      });
      
      console.log('✅ Storage initialized');
    } catch (error) {
      console.error('❌ Failed to initialize storage:', error);
      throw error;
    }
  }

  // Project storage methods
  async saveProject(project: any): Promise<void> {
    if (!this.db) throw new Error('Storage not initialized');
    
    const projectData = {
      id: project.id,
      name: project.name,
      data: project,
      thumbnail: await this.generateProjectThumbnail(project),
      createdAt: project.createdAt || new Date(),
      updatedAt: new Date()
    };

    await this.db.put('projects', projectData);
  }

  async loadProject(id: string): Promise<any | null> {
    if (!this.db) throw new Error('Storage not initialized');
    
    const result = await this.db.get('projects', id);
    return result ? result.data : null;
  }

  async listProjects(): Promise<any[]> {
    if (!this.db) throw new Error('Storage not initialized');
    
    const projects = await this.db.getAll('projects');
    return projects.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async deleteProject(id: string): Promise<void> {
    if (!this.db) throw new Error('Storage not initialized');
    await this.db.delete('projects', id);
  }

  // Media storage methods
  async saveMedia(file: File, metadata?: any): Promise<string> {
    if (!this.db) throw new Error('Storage not initialized');
    
    const id = this.generateId();
    const buffer = await file.arrayBuffer();
    
    const mediaData = {
      id,
      name: file.name,
      type: file.type,
      size: file.size,
      data: buffer,
      thumbnail: await this.generateMediaThumbnail(file),
      metadata: metadata || {},
      createdAt: new Date()
    };

    await this.db.put('media', mediaData);
    return id;
  }

  async loadMedia(id: string): Promise<{ file: File; metadata: any } | null> {
    if (!this.db) throw new Error('Storage not initialized');
    
    const result = await this.db.get('media', id);
    if (!result) return null;

    const file = new File([result.data], result.name, { type: result.type });
    return { file, metadata: result.metadata };
  }

  async listMedia(type?: string): Promise<any[]> {
    if (!this.db) throw new Error('Storage not initialized');
    
    if (type) {
      return await this.db.getAllFromIndex('media', 'type', type);
    }
    return await this.db.getAll('media');
  }

  async deleteMedia(id: string): Promise<void> {
    if (!this.db) throw new Error('Storage not initialized');
    await this.db.delete('media', id);
  }

  // Preferences storage methods
  async setPreference(key: string, value: any): Promise<void> {
    if (!this.db) throw new Error('Storage not initialized');
    await this.db.put('preferences', { key, value });
  }

  async getPreference(key: string, defaultValue?: any): Promise<any> {
    if (!this.db) throw new Error('Storage not initialized');
    
    const result = await this.db.get('preferences', key);
    return result ? result.value : defaultValue;
  }

  async getAllPreferences(): Promise<Record<string, any>> {
    if (!this.db) throw new Error('Storage not initialized');
    
    const prefs = await this.db.getAll('preferences');
    const result: Record<string, any> = {};
    
    prefs.forEach(pref => {
      result[pref.key] = pref.value;
    });
    
    return result;
  }

  // Cache methods
  async setCache(key: string, data: any, ttlSeconds: number = 3600): Promise<void> {
    if (!this.db) throw new Error('Storage not initialized');
    
    const expiry = Date.now() + (ttlSeconds * 1000);
    await this.db.put('cache', { key, data, expiry });
  }

  async getCache(key: string): Promise<any | null> {
    if (!this.db) throw new Error('Storage not initialized');
    
    const result = await this.db.get('cache', key);
    if (!result) return null;
    
    if (result.expiry < Date.now()) {
      await this.db.delete('cache', key);
      return null;
    }
    
    return result.data;
  }

  async clearExpiredCache(): Promise<void> {
    if (!this.db) throw new Error('Storage not initialized');
    
    const tx = this.db.transaction('cache', 'readwrite');
    const index = tx.store.index('expiry');
    
    for await (const cursor of index.iterate()) {
      if (cursor.value.expiry < Date.now()) {
        cursor.delete();
      }
    }
  }

  // Utility methods
  async getStorageUsage(): Promise<{ used: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        quota: estimate.quota || 0
      };
    }
    return { used: 0, quota: 0 };
  }

  async clearAll(): Promise<void> {
    if (!this.db) throw new Error('Storage not initialized');
    
    const tx = this.db.transaction(['projects', 'media', 'preferences', 'cache'], 'readwrite');
    await Promise.all([
      tx.objectStore('projects').clear(),
      tx.objectStore('media').clear(),
      tx.objectStore('preferences').clear(),
      tx.objectStore('cache').clear()
    ]);
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private async generateProjectThumbnail(_project: any): Promise<string | undefined> {
    // TODO: Generate actual thumbnail from project
    return undefined;
  }

  private async generateMediaThumbnail(file: File): Promise<string | undefined> {
    if (file.type.startsWith('image/')) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Generate 150x150 thumbnail
            canvas.width = 150;
            canvas.height = 150;
            
            if (ctx) {
              ctx.drawImage(img, 0, 0, 150, 150);
              resolve(canvas.toDataURL('image/jpeg', 0.8));
            } else {
              resolve(undefined);
            }
          };
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      });
    }
    return undefined;
  }
}