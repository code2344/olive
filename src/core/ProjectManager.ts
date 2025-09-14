import { EventEmitter } from '../utils/EventEmitter';
import { StorageManager } from '../utils/StorageManager';
import { Project, Layer, Clip, UndoAction, ProjectSettings } from '../types';

export class ProjectManager extends EventEmitter {
  private currentProject: Project | null = null;
  private recentProjects: any[] = [];
  private undoStack: UndoAction[] = [];
  private redoStack: UndoAction[] = [];
  private clipboard: any[] = [];
  private selectedItems: Set<string> = new Set();
  private hasChanges = false;

  constructor(private storageManager: StorageManager) {
    super();
  }

  async createNewProject(options: {
    name: string;
    width: number;
    height: number;
    frameRate: number;
    sampleRate?: number;
    duration?: number;
  }): Promise<Project> {
    const project: Project = {
      id: this.generateId(),
      name: options.name,
      width: options.width,
      height: options.height,
      frameRate: options.frameRate,
      sampleRate: options.sampleRate || 48000,
      duration: options.duration || 300, // 5 minutes default
      layers: [this.createDefaultVideoLayer(), this.createDefaultAudioLayer()],
      settings: this.getDefaultProjectSettings(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.currentProject = project;
    this.clearUndoHistory();
    this.hasChanges = true;
    
    this.emit('project-created', project);
    this.emit('project-changed', project);
    
    return project;
  }

  async loadProject(projectId: string): Promise<Project | null> {
    try {
      const projectData = await this.storageManager.loadProject(projectId);
      if (!projectData) return null;

      this.currentProject = projectData;
      this.clearUndoHistory();
      this.hasChanges = false;

      this.emit('project-loaded', this.currentProject);
      this.emit('project-changed', this.currentProject);

      return this.currentProject;
    } catch (error) {
      console.error('Failed to load project:', error);
      this.emit('error', error);
      return null;
    }
  }

  async saveCurrentProject(): Promise<boolean> {
    if (!this.currentProject) {
      console.warn('No project to save');
      return false;
    }

    try {
      this.currentProject.updatedAt = new Date();
      await this.storageManager.saveProject(this.currentProject);
      this.hasChanges = false;
      
      this.emit('project-saved', this.currentProject);
      return true;
    } catch (error) {
      console.error('Failed to save project:', error);
      this.emit('error', error);
      return false;
    }
  }

  async autoSave(): Promise<void> {
    if (this.hasChanges && this.currentProject) {
      console.log('Auto-saving project...');
      await this.saveCurrentProject();
    }
  }

  async loadRecentProjects(): Promise<void> {
    try {
      this.recentProjects = await this.storageManager.listProjects();
      this.emit('recent-projects-loaded', this.recentProjects);
    } catch (error) {
      console.error('Failed to load recent projects:', error);
      this.emit('error', error);
    }
  }

  // Layer management
  addLayer(type: 'video' | 'audio' | 'image' | 'text' | 'shape' | 'adjustment', name?: string): Layer {
    if (!this.currentProject) throw new Error('No active project');

    const layer: Layer = {
      id: this.generateId(),
      name: name || `${type} Layer ${this.currentProject.layers.length + 1}`,
      type,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      transform: this.getDefaultTransform(),
      effects: [],
      clips: []
    };

    const action: UndoAction = {
      id: this.generateId(),
      type: 'add-layer',
      description: `Add ${layer.name}`,
      undo: () => this.removeLayerById(layer.id),
      redo: () => this.insertLayer(layer),
      timestamp: Date.now()
    };

    this.currentProject.layers.push(layer);
    this.addUndoAction(action);
    this.markChanged();

    this.emit('layer-added', layer);
    return layer;
  }

  removeLayer(layerId: string): boolean {
    if (!this.currentProject) return false;

    const layerIndex = this.currentProject.layers.findIndex(l => l.id === layerId);
    if (layerIndex === -1) return false;

    const layer = this.currentProject.layers[layerIndex];
    
    const action: UndoAction = {
      id: this.generateId(),
      type: 'remove-layer',
      description: `Remove ${layer.name}`,
      undo: () => this.insertLayerAtIndex(layer, layerIndex),
      redo: () => this.removeLayerById(layerId),
      timestamp: Date.now()
    };

    this.currentProject.layers.splice(layerIndex, 1);
    this.selectedItems.delete(layerId);
    this.addUndoAction(action);
    this.markChanged();

    this.emit('layer-removed', layerId);
    return true;
  }

  // Clip management
  addClip(layerId: string, clip: Omit<Clip, 'id'>): Clip | null {
    if (!this.currentProject) return null;

    const layer = this.currentProject.layers.find(l => l.id === layerId);
    if (!layer) return null;

    const newClip: Clip = {
      ...clip,
      id: this.generateId()
    };

    const action: UndoAction = {
      id: this.generateId(),
      type: 'add-clip',
      description: `Add clip to ${layer.name}`,
      undo: () => this.removeClipById(newClip.id),
      redo: () => this.insertClip(layerId, newClip),
      timestamp: Date.now()
    };

    layer.clips.push(newClip);
    this.addUndoAction(action);
    this.markChanged();

    this.emit('clip-added', newClip, layerId);
    return newClip;
  }

  removeClip(clipId: string): boolean {
    if (!this.currentProject) return false;

    for (const layer of this.currentProject.layers) {
      const clipIndex = layer.clips.findIndex(c => c.id === clipId);
      if (clipIndex !== -1) {
        const clip = layer.clips[clipIndex];
        
        const action: UndoAction = {
          id: this.generateId(),
          type: 'remove-clip',
          description: `Remove ${clip.name}`,
          undo: () => this.insertClipAtIndex(layer.id, clip, clipIndex),
          redo: () => this.removeClipById(clipId),
          timestamp: Date.now()
        };

        layer.clips.splice(clipIndex, 1);
        this.selectedItems.delete(clipId);
        this.addUndoAction(action);
        this.markChanged();

        this.emit('clip-removed', clipId, layer.id);
        return true;
      }
    }
    return false;
  }

  // Selection management
  selectItem(itemId: string): void {
    this.selectedItems.add(itemId);
    this.emit('selection-changed', Array.from(this.selectedItems));
  }

  deselectItem(itemId: string): void {
    this.selectedItems.delete(itemId);
    this.emit('selection-changed', Array.from(this.selectedItems));
  }

  clearSelection(): void {
    this.selectedItems.clear();
    this.emit('selection-changed', []);
  }

  selectAll(): void {
    if (!this.currentProject) return;
    
    this.selectedItems.clear();
    this.currentProject.layers.forEach(layer => {
      this.selectedItems.add(layer.id);
      layer.clips.forEach(clip => {
        this.selectedItems.add(clip.id);
      });
    });
    
    this.emit('selection-changed', Array.from(this.selectedItems));
  }

  // Clipboard operations
  copy(): void {
    if (!this.currentProject || this.selectedItems.size === 0) return;

    this.clipboard = [];
    this.selectedItems.forEach(itemId => {
      const layer = this.currentProject!.layers.find(l => l.id === itemId);
      if (layer) {
        this.clipboard.push({ type: 'layer', data: JSON.parse(JSON.stringify(layer)) });
        return;
      }

      for (const layer of this.currentProject!.layers) {
        const clip = layer.clips.find(c => c.id === itemId);
        if (clip) {
          this.clipboard.push({ 
            type: 'clip', 
            data: JSON.parse(JSON.stringify(clip)),
            layerId: layer.id 
          });
          break;
        }
      }
    });

    this.emit('copied', this.clipboard.length);
  }

  cut(): void {
    this.copy();
    this.deleteSelected();
  }

  paste(): void {
    if (!this.currentProject || this.clipboard.length === 0) return;

    this.clipboard.forEach(item => {
      if (item.type === 'layer') {
        const newLayer = { ...item.data, id: this.generateId() };
        this.insertLayer(newLayer);
      } else if (item.type === 'clip') {
        const newClip = { ...item.data, id: this.generateId() };
        this.insertClip(item.layerId, newClip);
      }
    });

    this.emit('pasted', this.clipboard.length);
  }

  deleteSelected(): void {
    const itemsToDelete = Array.from(this.selectedItems);
    itemsToDelete.forEach(itemId => {
      // Try to remove as layer first
      if (!this.removeLayer(itemId)) {
        // If not a layer, try to remove as clip
        this.removeClip(itemId);
      }
    });
  }

  // Undo/Redo system
  undo(): boolean {
    if (this.undoStack.length === 0) return false;

    const action = this.undoStack.pop()!;
    try {
      action.undo();
      this.redoStack.push(action);
      this.markChanged();
      this.emit('undone', action);
      return true;
    } catch (error) {
      console.error('Failed to undo action:', error);
      return false;
    }
  }

  redo(): boolean {
    if (this.redoStack.length === 0) return false;

    const action = this.redoStack.pop()!;
    try {
      action.redo();
      this.undoStack.push(action);
      this.markChanged();
      this.emit('redone', action);
      return true;
    } catch (error) {
      console.error('Failed to redo action:', error);
      return false;
    }
  }

  private addUndoAction(action: UndoAction): void {
    this.undoStack.push(action);
    this.redoStack = []; // Clear redo stack when new action is added
    
    // Limit undo stack size
    if (this.undoStack.length > 100) {
      this.undoStack.shift();
    }
  }

  private clearUndoHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  // Playback control
  togglePlayback(): void {
    // This will be implemented by the timeline component
    this.emit('toggle-playback');
  }

  // Utility methods
  getCurrentProject(): Project | null {
    return this.currentProject;
  }

  getRecentProjects(): any[] {
    return this.recentProjects;
  }

  hasUnsavedChanges(): boolean {
    return this.hasChanges;
  }

  private markChanged(): void {
    this.hasChanges = true;
    if (this.currentProject) {
      this.currentProject.updatedAt = new Date();
      this.emit('project-changed', this.currentProject);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private getDefaultProjectSettings(): ProjectSettings {
    return {
      backgroundColor: '#000000',
      colorSpace: 'sRGB',
      bitDepth: 8,
      audioChannels: 2
    };
  }

  private getDefaultTransform() {
    return {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      anchorX: 0.5,
      anchorY: 0.5,
      skewX: 0,
      skewY: 0
    };
  }

  private createDefaultVideoLayer(): Layer {
    return {
      id: this.generateId(),
      name: 'Video 1',
      type: 'video',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      transform: this.getDefaultTransform(),
      effects: [],
      clips: []
    };
  }

  private createDefaultAudioLayer(): Layer {
    return {
      id: this.generateId(),
      name: 'Audio 1',
      type: 'audio',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      transform: this.getDefaultTransform(),
      effects: [],
      clips: []
    };
  }

  // Helper methods for undo/redo
  private removeLayerById(layerId: string): void {
    if (!this.currentProject) return;
    const index = this.currentProject.layers.findIndex(l => l.id === layerId);
    if (index !== -1) {
      this.currentProject.layers.splice(index, 1);
      this.emit('layer-removed', layerId);
    }
  }

  private insertLayer(layer: Layer): void {
    if (!this.currentProject) return;
    this.currentProject.layers.push(layer);
    this.emit('layer-added', layer);
  }

  private insertLayerAtIndex(layer: Layer, index: number): void {
    if (!this.currentProject) return;
    this.currentProject.layers.splice(index, 0, layer);
    this.emit('layer-added', layer);
  }

  private removeClipById(clipId: string): void {
    if (!this.currentProject) return;
    for (const layer of this.currentProject.layers) {
      const index = layer.clips.findIndex(c => c.id === clipId);
      if (index !== -1) {
        layer.clips.splice(index, 1);
        this.emit('clip-removed', clipId, layer.id);
        break;
      }
    }
  }

  private insertClip(layerId: string, clip: Clip): void {
    if (!this.currentProject) return;
    const layer = this.currentProject.layers.find(l => l.id === layerId);
    if (layer) {
      layer.clips.push(clip);
      this.emit('clip-added', clip, layerId);
    }
  }

  private insertClipAtIndex(layerId: string, clip: Clip, index: number): void {
    if (!this.currentProject) return;
    const layer = this.currentProject.layers.find(l => l.id === layerId);
    if (layer) {
      layer.clips.splice(index, 0, clip);
      this.emit('clip-added', clip, layerId);
    }
  }
}