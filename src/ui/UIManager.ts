import { EventEmitter } from '../utils/EventEmitter';
import { ProjectManager } from '../core/ProjectManager';
import { VideoEngine } from '../engines/video';
import { PhotoEngine } from '../engines/photo';
import { DrawingEngine } from '../engines/drawing';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';

export interface UIManagerDependencies {
  projectManager: ProjectManager;
  videoEngine: VideoEngine;
  photoEngine: PhotoEngine;
  drawingEngine: DrawingEngine;
  performanceMonitor: PerformanceMonitor;
}

export class UIManager extends EventEmitter {
  private container?: HTMLElement;

  constructor(
    private dependencies: UIManagerDependencies
  ) {
    super();
  }

  async initialize(): Promise<void> {
    try {
      this.container = document.getElementById('app') || undefined;
      if (!this.container) {
        throw new Error('App container not found');
      }

      this.createLayout();
      this.setupEventListeners();
      
      console.log('✅ UI Manager initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize UI Manager:', error);
      throw error;
    }
  }

  private createLayout(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="app-layout">
        <header class="app-header">
          <div class="header-left">
            <div class="logo">
              <div class="logo-icon">PS</div>
              <span class="logo-text">ProStudio</span>
            </div>
            <nav class="main-nav">
              <button class="nav-button" data-action="new-project">New</button>
              <button class="nav-button" data-action="open-project">Open</button>
              <button class="nav-button" data-action="save-project">Save</button>
              <button class="nav-button" data-action="export">Export</button>
            </nav>
          </div>
          <div class="header-center">
            <div class="playback-controls">
              <button class="control-button" data-action="play-pause">⏯️</button>
              <button class="control-button" data-action="stop">⏹️</button>
              <button class="control-button" data-action="previous">⏮️</button>
              <button class="control-button" data-action="next">⏭️</button>
            </div>
            <div class="time-display">
              <span class="current-time">00:00:00</span>
              <span class="separator">/</span>
              <span class="total-time">00:05:00</span>
            </div>
          </div>
          <div class="header-right">
            <div class="mode-switch">
              <button class="mode-button active" data-mode="video">Video</button>
              <button class="mode-button" data-mode="photo">Photo</button>
              <button class="mode-button" data-mode="draw">Draw</button>
            </div>
            <div class="performance-indicator">
              <span class="fps-counter">60 FPS</span>
              <span class="memory-usage">5 MB</span>
            </div>
            <button class="control-button" data-action="settings">⚙️</button>
          </div>
        </header>

        <div class="app-body">
          <aside class="sidebar">
            <div class="tab-container">
              <div class="tab-buttons">
                <button class="tab-button active" data-tab="tools">Tools</button>
                <button class="tab-button" data-tab="layers">Layers</button>
                <button class="tab-button" data-tab="effects">Effects</button>
                <button class="tab-button" data-tab="media">Media</button>
              </div>
              <div class="tab-content">
                <div class="tab-panel active" data-panel="tools">
                  <div class="tool-section">
                    <h3>Drawing Tools</h3>
                    <div class="tool-grid">
                      <button class="tool-button active" data-tool="brush" title="Brush">🖌️</button>
                      <button class="tool-button" data-tool="eraser" title="Eraser">🧽</button>
                      <button class="tool-button" data-tool="bucket" title="Fill">🪣</button>
                      <button class="tool-button" data-tool="picker" title="Color Picker">🎨</button>
                    </div>
                  </div>
                  <div class="tool-section">
                    <h3>Shape Tools</h3>
                    <div class="tool-grid">
                      <button class="tool-button" data-tool="rectangle" title="Rectangle">▭</button>
                      <button class="tool-button" data-tool="circle" title="Circle">○</button>
                      <button class="tool-button" data-tool="line" title="Line">╱</button>
                      <button class="tool-button" data-tool="text" title="Text">T</button>
                    </div>
                  </div>
                  <div class="tool-properties">
                    <div class="property-group">
                      <label>Brush Size</label>
                      <input type="range" min="1" max="100" value="10" class="brush-size-slider">
                      <span class="value-display">10px</span>
                    </div>
                    <div class="property-group">
                      <label>Opacity</label>
                      <input type="range" min="0" max="100" value="100" class="opacity-slider">
                      <span class="value-display">100%</span>
                    </div>
                    <div class="property-group">
                      <label>Color</label>
                      <input type="color" value="#000000" class="color-picker">
                    </div>
                  </div>
                </div>
                <div class="tab-panel" data-panel="layers">
                  <div class="layers-container">
                    <div class="layers-header">
                      <h3>Layers</h3>
                      <button class="add-layer-button" title="Add Layer">+</button>
                    </div>
                    <div class="layers-list">
                      <!-- Layers will be populated dynamically -->
                    </div>
                  </div>
                </div>
                <div class="tab-panel" data-panel="effects">
                  <div class="effects-container">
                    <h3>Effects</h3>
                    <div class="effects-categories">
                      <button class="category-button active">Color</button>
                      <button class="category-button">Blur</button>
                      <button class="category-button">Distortion</button>
                      <button class="category-button">Artistic</button>
                    </div>
                    <div class="effects-list">
                      <!-- Effects will be populated dynamically -->
                    </div>
                  </div>
                </div>
                <div class="tab-panel" data-panel="media">
                  <div class="media-container">
                    <div class="media-header">
                      <h3>Media Library</h3>
                      <button class="import-button">Import</button>
                    </div>
                    <div class="media-grid">
                      <!-- Media items will be populated dynamically -->
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <main class="main-content">
            <div class="canvas-container">
              <!-- Canvases will be inserted here -->
            </div>
          </main>
        </div>

        <footer class="timeline">
          <div class="timeline-header">
            <div class="timeline-controls">
              <button class="zoom-button" data-action="add-track">+</button>
              <div class="zoom-controls">
                <button class="zoom-button" data-action="zoom-timeline-out">-</button>
                <span class="zoom-level">100%</span>
                <button class="zoom-button" data-action="zoom-timeline-in">+</button>
              </div>
            </div>
          </div>
          <div class="timeline-tracks">
            <!-- Timeline tracks will be populated dynamically -->
          </div>
        </footer>
      </div>
    `;

    // Insert canvases
    this.insertCanvases();
    
    // Apply styles
    this.applyStyles();
  }

  private insertCanvases(): void {
    const canvasContainer = this.container?.querySelector('.canvas-container');
    if (!canvasContainer) return;

    // Insert video canvas
    const videoCanvas = this.dependencies.videoEngine.getCanvas();
    if (videoCanvas) {
      videoCanvas.className = 'main-canvas video-canvas';
      videoCanvas.style.display = 'block';
      canvasContainer.appendChild(videoCanvas);
    }

    // Insert photo canvas
    const photoCanvas = this.dependencies.photoEngine.getCanvas();
    if (photoCanvas) {
      photoCanvas.className = 'main-canvas photo-canvas';
      photoCanvas.style.display = 'none';
      canvasContainer.appendChild(photoCanvas);
    }

    // Insert drawing canvas
    const drawingCanvas = this.dependencies.drawingEngine.getCanvas();
    if (drawingCanvas) {
      drawingCanvas.className = 'main-canvas drawing-canvas';
      drawingCanvas.style.display = 'none';
      canvasContainer.appendChild(drawingCanvas);
    }
  }

  private applyStyles(): void {
    // All styles are now handled by the main CSS file
    // Remove any existing inline styles
    const existingStyles = document.querySelectorAll('style[data-ui-manager]');
    existingStyles.forEach(style => style.remove());
  }
  private setupEventListeners(): void {
    if (!this.container) return;

    // Tab switching
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      
      if (target.classList.contains('tab-button')) {
        this.switchTab(target.dataset.tab!);
      }
      
      if (target.classList.contains('mode-button')) {
        this.switchMode(target.dataset.mode!);
      }
      
      if (target.classList.contains('tool-button')) {
        this.selectTool(target.dataset.tool!);
      }
      
      if (target.dataset.action) {
        this.handleAction(target.dataset.action);
      }
    });

    // Tool property changes
    const brushSizeSlider = this.container.querySelector('.brush-size-slider') as HTMLInputElement;
    if (brushSizeSlider) {
      brushSizeSlider.addEventListener('input', (e) => {
        const value = parseInt((e.target as HTMLInputElement).value);
        this.dependencies.drawingEngine.setBrushSize(value);
        this.updateValueDisplay(brushSizeSlider, value + 'px');
      });
    }

    const opacitySlider = this.container.querySelector('.opacity-slider') as HTMLInputElement;
    if (opacitySlider) {
      opacitySlider.addEventListener('input', (e) => {
        const value = parseInt((e.target as HTMLInputElement).value);
        this.dependencies.drawingEngine.setBrushOpacity(value / 100);
        this.updateValueDisplay(opacitySlider, value + '%');
      });
    }

    const colorPicker = this.container.querySelector('.color-picker') as HTMLInputElement;
    if (colorPicker) {
      colorPicker.addEventListener('change', (e) => {
        const color = (e.target as HTMLInputElement).value;
        this.dependencies.drawingEngine.setColor(color);
      });
    }

    // Performance monitoring
    this.dependencies.performanceMonitor.on('metrics', (metrics: any) => {
      this.updatePerformanceDisplay(metrics);
    });
  }

  private switchTab(tab: string): void {
    // Update tab buttons
    this.container?.querySelectorAll('.tab-button').forEach(btn => {
      const element = btn as HTMLElement;
      element.classList.toggle('active', element.dataset.tab === tab);
    });

    // Update tab panels
    this.container?.querySelectorAll('.tab-panel').forEach(panel => {
      const element = panel as HTMLElement;
      element.classList.toggle('active', element.dataset.panel === tab);
    });
  }

  private switchMode(mode: string): void {
    // Update mode buttons
    this.container?.querySelectorAll('.mode-button').forEach(btn => {
      const element = btn as HTMLElement;
      element.classList.toggle('active', element.dataset.mode === mode);
    });

    // Show/hide canvases
    this.container?.querySelectorAll('.canvas-container canvas').forEach(canvas => {
      const shouldShow = canvas.classList.contains(mode + '-canvas');
      (canvas as HTMLElement).style.display = shouldShow ? 'block' : 'none';
    });

    this.emit('mode-changed', mode);
  }

  private selectTool(tool: string): void {
    // Update tool buttons
    this.container?.querySelectorAll('.tool-button').forEach(btn => {
      const element = btn as HTMLElement;
      element.classList.toggle('active', element.dataset.tool === tool);
    });

    this.dependencies.drawingEngine.setTool(tool);
    this.emit('tool-changed', tool);
  }

  private handleAction(action: string): void {
    switch (action) {
      case 'new-project':
        this.showNewProjectDialog();
        break;
      case 'open-project':
        this.showOpenDialog();
        break;
      case 'save-project':
        this.dependencies.projectManager.saveCurrentProject();
        break;
      case 'play-pause':
        this.dependencies.projectManager.togglePlayback();
        break;
      // Add more actions as needed
    }
  }

  private updateValueDisplay(input: HTMLInputElement, value: string): void {
    const display = input.parentElement?.querySelector('.value-display');
    if (display) {
      display.textContent = value;
    }
  }

  private updatePerformanceDisplay(metrics: any): void {
    const fpsCounter = this.container?.querySelector('.fps-counter');
    const memoryUsage = this.container?.querySelector('.memory-usage');
    
    if (fpsCounter) {
      fpsCounter.textContent = `${Math.round(metrics.fps)} FPS`;
    }
    
    if (memoryUsage) {
      memoryUsage.textContent = `${Math.round(metrics.memoryUsage)} MB`;
    }
  }

  showNewProjectDialog(): void {
    // TODO: Implement project creation dialog
    console.log('Show new project dialog');
  }

  showOpenDialog(): void {
    // TODO: Implement project open dialog
    console.log('Show open project dialog');
  }

  async dispose(): Promise<void> {
    // Clean up resources
  }
}