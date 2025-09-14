import { EventEmitter } from '../utils/EventEmitter';
import { BlendMode } from '../types';

export interface LayerCanvas {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
}

export class LayerManager extends EventEmitter {
  private layers: Map<string, LayerCanvas> = new Map();
  private layerOrder: string[] = [];
  private compositeCanvas?: HTMLCanvasElement;
  private compositeContext?: CanvasRenderingContext2D;
  private activeLayerId?: string;
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    super();
    this.width = width;
    this.height = height;
    this.initializeComposite();
  }

  private initializeComposite(): void {
    this.compositeCanvas = document.createElement('canvas');
    this.compositeCanvas.width = this.width;
    this.compositeCanvas.height = this.height;
    
    this.compositeContext = this.compositeCanvas.getContext('2d') || undefined;
    if (!this.compositeContext) {
      throw new Error('Could not get composite canvas context');
    }
  }

  createLayer(id: string, name: string): LayerCanvas {
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get layer canvas context');
    }

    // Set up canvas for high-quality rendering
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    const layerCanvas: LayerCanvas = { canvas, context };
    this.layers.set(id, layerCanvas);
    this.layerOrder.push(id);

    if (!this.activeLayerId) {
      this.activeLayerId = id;
    }

    this.emit('layer-created', { id, name });
    this.composite();
    
    return layerCanvas;
  }

  removeLayer(id: string): boolean {
    if (!this.layers.has(id)) return false;

    this.layers.delete(id);
    const index = this.layerOrder.indexOf(id);
    if (index > -1) {
      this.layerOrder.splice(index, 1);
    }

    if (this.activeLayerId === id) {
      this.activeLayerId = this.layerOrder[0];
    }

    this.emit('layer-removed', id);
    this.composite();
    return true;
  }

  getLayer(id: string): LayerCanvas | undefined {
    return this.layers.get(id);
  }

  getActiveLayer(): LayerCanvas | undefined {
    return this.activeLayerId ? this.layers.get(this.activeLayerId) : undefined;
  }

  setActiveLayer(id: string): boolean {
    if (!this.layers.has(id)) return false;
    
    this.activeLayerId = id;
    this.emit('active-layer-changed', id);
    return true;
  }

  moveLayer(id: string, newIndex: number): boolean {
    const currentIndex = this.layerOrder.indexOf(id);
    if (currentIndex === -1) return false;

    // Remove from current position
    this.layerOrder.splice(currentIndex, 1);
    
    // Insert at new position
    const clampedIndex = Math.max(0, Math.min(newIndex, this.layerOrder.length));
    this.layerOrder.splice(clampedIndex, 0, id);

    this.emit('layer-moved', { id, fromIndex: currentIndex, toIndex: clampedIndex });
    this.composite();
    return true;
  }

  duplicateLayer(id: string, newId: string, newName: string): LayerCanvas | null {
    const sourceLayer = this.layers.get(id);
    if (!sourceLayer) return null;

    const newLayer = this.createLayer(newId, newName);
    
    // Copy the source layer content
    newLayer.context.drawImage(sourceLayer.canvas, 0, 0);
    
    this.emit('layer-duplicated', { sourceId: id, newId, newName });
    return newLayer;
  }

  mergeDown(id: string): boolean {
    const layerIndex = this.layerOrder.indexOf(id);
    if (layerIndex <= 0) return false; // Can't merge down the bottom layer

    const topLayer = this.layers.get(id);
    const bottomLayerId = this.layerOrder[layerIndex - 1];
    const bottomLayer = this.layers.get(bottomLayerId);

    if (!topLayer || !bottomLayer) return false;

    // Merge top layer into bottom layer
    bottomLayer.context.drawImage(topLayer.canvas, 0, 0);
    
    // Remove the top layer
    this.removeLayer(id);
    
    this.emit('layers-merged', { topId: id, bottomId: bottomLayerId });
    return true;
  }

  flatten(): HTMLCanvasElement {
    const flatCanvas = document.createElement('canvas');
    flatCanvas.width = this.width;
    flatCanvas.height = this.height;
    
    const flatContext = flatCanvas.getContext('2d');
    if (!flatContext) {
      throw new Error('Could not get flat canvas context');
    }

    // Draw all layers in order
    for (const layerId of this.layerOrder) {
      const layer = this.layers.get(layerId);
      if (layer) {
        flatContext.drawImage(layer.canvas, 0, 0);
      }
    }

    return flatCanvas;
  }

  composite(): void {
    if (!this.compositeContext) return;

    // Clear composite canvas
    this.compositeContext.clearRect(0, 0, this.width, this.height);

    // Composite all layers in order
    for (const layerId of this.layerOrder) {
      const layer = this.layers.get(layerId);
      if (layer) {
        this.compositeContext.drawImage(layer.canvas, 0, 0);
      }
    }

    this.emit('composite-updated');
  }

  applyBlendMode(layerId: string, blendMode: BlendMode): void {
    const layer = this.layers.get(layerId);
    if (!layer) return;

    // Store current content
    const imageData = layer.context.getImageData(0, 0, this.width, this.height);
    
    // Apply blend mode by setting globalCompositeOperation
    layer.context.globalCompositeOperation = this.getCompositeOperation(blendMode);
    
    // Redraw with new blend mode
    layer.context.clearRect(0, 0, this.width, this.height);
    layer.context.putImageData(imageData, 0, 0);
    
    this.composite();
    this.emit('blend-mode-applied', { layerId, blendMode });
  }

  private getCompositeOperation(blendMode: BlendMode): GlobalCompositeOperation {
    const modeMap: Record<BlendMode, GlobalCompositeOperation> = {
      'normal': 'source-over',
      'multiply': 'multiply',
      'screen': 'screen',
      'overlay': 'overlay',
      'soft-light': 'soft-light',
      'hard-light': 'hard-light',
      'color-dodge': 'color-dodge',
      'color-burn': 'color-burn',
      'darken': 'darken',
      'lighten': 'lighten',
      'difference': 'difference',
      'exclusion': 'exclusion'
    };

    return modeMap[blendMode] || 'source-over';
  }

  setLayerOpacity(layerId: string, opacity: number): void {
    const layer = this.layers.get(layerId);
    if (!layer) return;

    layer.context.globalAlpha = Math.max(0, Math.min(1, opacity));
    this.composite();
    this.emit('layer-opacity-changed', { layerId, opacity });
  }

  getCompositeCanvas(): HTMLCanvasElement | undefined {
    return this.compositeCanvas;
  }

  getLayerOrder(): string[] {
    return [...this.layerOrder];
  }

  getLayers(): Map<string, LayerCanvas> {
    return new Map(this.layers);
  }

  clearLayer(layerId: string): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.context.clearRect(0, 0, this.width, this.height);
      this.composite();
      this.emit('layer-cleared', layerId);
    }
  }

  resizeAll(newWidth: number, newHeight: number): void {
    this.width = newWidth;
    this.height = newHeight;

    // Resize composite canvas
    if (this.compositeCanvas) {
      this.compositeCanvas.width = newWidth;
      this.compositeCanvas.height = newHeight;
    }

    // Resize all layer canvases
    for (const [, layer] of this.layers) {
      // Store current content
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = layer.canvas.width;
      tempCanvas.height = layer.canvas.height;
      const tempContext = tempCanvas.getContext('2d');
      
      if (tempContext) {
        tempContext.drawImage(layer.canvas, 0, 0);
        
        // Resize layer canvas
        layer.canvas.width = newWidth;
        layer.canvas.height = newHeight;
        
        // Restore content (scaled)
        layer.context.drawImage(tempCanvas, 0, 0, newWidth, newHeight);
      }
    }

    this.composite();
    this.emit('layers-resized', { width: newWidth, height: newHeight });
  }

  dispose(): void {
    this.layers.clear();
    this.layerOrder = [];
    this.compositeCanvas = undefined;
    this.compositeContext = undefined;
    this.removeAllListeners();
  }
}