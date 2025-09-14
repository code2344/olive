import { EventEmitter } from '../utils/EventEmitter';
import { ProjectManager } from './ProjectManager';
import { UIManager } from '../ui/UIManager';
import { VideoEngine } from '../engines/video';
import { PhotoEngine } from '../engines/photo';
import { DrawingEngine } from '../engines/drawing';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';
import { StorageManager } from '../utils/StorageManager';

export class OliveApp extends EventEmitter {
  private projectManager: ProjectManager;
  private uiManager: UIManager;
  private videoEngine: VideoEngine;
  private photoEngine: PhotoEngine;
  private drawingEngine: DrawingEngine;
  private performanceMonitor: PerformanceMonitor;
  private storageManager: StorageManager;
  private isInitialized = false;
  private readyCallbacks: (() => void)[] = [];

  constructor() {
    super();
    
    // Initialize core systems
    this.storageManager = new StorageManager();
    this.performanceMonitor = new PerformanceMonitor();
    this.projectManager = new ProjectManager(this.storageManager);
    
    // Initialize engines
    this.videoEngine = new VideoEngine();
    this.photoEngine = new PhotoEngine();
    this.drawingEngine = new DrawingEngine();
    
    // Initialize UI manager
    this.uiManager = new UIManager({
      projectManager: this.projectManager,
      videoEngine: this.videoEngine,
      photoEngine: this.photoEngine,
      drawingEngine: this.drawingEngine,
      performanceMonitor: this.performanceMonitor
    });

    this.setupEventListeners();
  }

  async start(): Promise<void> {
    try {
      console.log('🚀 Starting Olive Multimedia Editor...');
      
      // Initialize storage
      await this.storageManager.initialize();
      
      // Initialize engines
      await Promise.all([
        this.videoEngine.initialize(),
        this.photoEngine.initialize(),
        this.drawingEngine.initialize()
      ]);
      
      // Initialize UI
      await this.uiManager.initialize();
      
      // Start performance monitoring
      this.performanceMonitor.start();
      
      // Check for saved projects
      await this.projectManager.loadRecentProjects();
      
      this.isInitialized = true;
      console.log('✅ Olive Multimedia Editor ready!');
      
      // Trigger ready callbacks
      this.readyCallbacks.forEach(callback => callback());
      this.readyCallbacks = [];
      
      this.emit('ready');
      
    } catch (error) {
      console.error('❌ Failed to start Olive:', error);
      this.emit('error', error);
    }
  }

  onReady(callback: () => void): void {
    if (this.isInitialized) {
      callback();
    } else {
      this.readyCallbacks.push(callback);
    }
  }

  private setupEventListeners(): void {
    // Global error handling
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      this.emit('error', event.error);
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.emit('error', event.reason);
    });

    // Performance monitoring
    this.performanceMonitor.on('warning', (metrics: any) => {
      console.warn('Performance warning:', metrics);
      this.emit('performance-warning', metrics);
    });

    // Auto-save functionality
    setInterval(() => {
      if (this.projectManager.hasUnsavedChanges()) {
        this.projectManager.autoSave();
      }
    }, 30000); // Auto-save every 30 seconds

    // Keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      this.handleGlobalKeyboard(event);
    });

    // Beforeunload warning for unsaved changes
    window.addEventListener('beforeunload', (event) => {
      if (this.projectManager.hasUnsavedChanges()) {
        event.preventDefault();
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    });
  }

  private handleGlobalKeyboard(event: KeyboardEvent): void {
    const { ctrlKey, metaKey, shiftKey, key } = event;
    const isCmd = ctrlKey || metaKey;

    // Prevent default browser shortcuts that conflict with editor
    if (isCmd) {
      switch (key.toLowerCase()) {
        case 's':
          event.preventDefault();
          this.projectManager.saveCurrentProject();
          break;
        case 'o':
          event.preventDefault();
          this.uiManager.showOpenDialog();
          break;
        case 'n':
          event.preventDefault();
          this.uiManager.showNewProjectDialog();
          break;
        case 'z':
          event.preventDefault();
          if (shiftKey) {
            this.projectManager.redo();
          } else {
            this.projectManager.undo();
          }
          break;
        case 'c':
          if (!this.isTextInputFocused()) {
            event.preventDefault();
            this.projectManager.copy();
          }
          break;
        case 'v':
          if (!this.isTextInputFocused()) {
            event.preventDefault();
            this.projectManager.paste();
          }
          break;
        case 'x':
          if (!this.isTextInputFocused()) {
            event.preventDefault();
            this.projectManager.cut();
          }
          break;
        case 'a':
          if (!this.isTextInputFocused()) {
            event.preventDefault();
            this.projectManager.selectAll();
          }
          break;
      }
    }

    // Other shortcuts
    switch (key) {
      case ' ':
        if (!this.isTextInputFocused()) {
          event.preventDefault();
          this.projectManager.togglePlayback();
        }
        break;
      case 'Delete':
      case 'Backspace':
        if (!this.isTextInputFocused()) {
          event.preventDefault();
          this.projectManager.deleteSelected();
        }
        break;
    }
  }

  private isTextInputFocused(): boolean {
    const activeElement = document.activeElement;
    return !!(activeElement && (activeElement instanceof HTMLInputElement || 
           activeElement instanceof HTMLTextAreaElement ||
           activeElement.getAttribute('contenteditable') === 'true'));
  }

  // Public API methods
  getProjectManager(): ProjectManager {
    return this.projectManager;
  }

  getUIManager(): UIManager {
    return this.uiManager;
  }

  getVideoEngine(): VideoEngine {
    return this.videoEngine;
  }

  getPhotoEngine(): PhotoEngine {
    return this.photoEngine;
  }

  getDrawingEngine(): DrawingEngine {
    return this.drawingEngine;
  }

  getPerformanceMonitor(): PerformanceMonitor {
    return this.performanceMonitor;
  }

  async dispose(): Promise<void> {
    this.performanceMonitor.stop();
    
    await Promise.all([
      this.videoEngine.dispose(),
      this.photoEngine.dispose(),
      this.drawingEngine.dispose(),
      this.uiManager.dispose()
    ]);
    
    this.removeAllListeners();
  }
}