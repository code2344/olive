import { EventEmitter } from '../../utils/EventEmitter';
import { CanvasInteractionManager, CanvasInteractionEvent } from '../../core/CanvasInteractionManager';

export class DrawingEngine extends EventEmitter {
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D;
  private interactionManager: CanvasInteractionManager;
  private isDrawing = false;
  private currentTool = 'brush';
  private brushSize = 10;
  private brushOpacity = 1;
  private currentColor = '#000000';
  private pressure = 1;
  private layers: ImageData[] = [];
  private currentLayer = 0;

  constructor() {
    super();
    this.interactionManager = new CanvasInteractionManager();
    this.setupInteractionHandlers();
  }

  async initialize(): Promise<void> {
    try {
      // Create main drawing canvas
      this.canvas = document.createElement('canvas');
      this.canvas.width = 2048;
      this.canvas.height = 2048;
      
      this.ctx = this.canvas.getContext('2d', {
        alpha: true,
        willReadFrequently: false
      }) || undefined;

      if (!this.ctx) {
        throw new Error('Canvas 2D context not available');
      }

      this.setupDrawingContext();
      this.interactionManager.initialize(this.canvas);
      console.log('✅ Drawing Engine initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Drawing Engine:', error);
      throw error;
    }
  }

  private setupDrawingContext(): void {
    if (!this.ctx) return;

    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
  }

  private setupInteractionHandlers(): void {
    this.interactionManager.on('stroke-start', (event: CanvasInteractionEvent) => {
      this.startStroke(event.x, event.y, event.pressure);
    });

    this.interactionManager.on('stroke-continue', (event: CanvasInteractionEvent) => {
      this.continueStroke(event.x, event.y, event.pressure);
    });

    this.interactionManager.on('stroke-end', (_event: CanvasInteractionEvent) => {
      this.endStroke();
    });
  }

  getCanvas(): HTMLCanvasElement | undefined {
    return this.canvas;
  }

  getContext(): CanvasRenderingContext2D | undefined {
    return this.ctx;
  }

  setTool(tool: string): void {
    this.currentTool = tool;
    this.interactionManager.setTool(tool);
    this.emit('tool-changed', tool);
  }

  setBrushSize(size: number): void {
    this.brushSize = Math.max(1, Math.min(500, size));
    this.emit('brush-size-changed', this.brushSize);
  }

  setBrushOpacity(opacity: number): void {
    this.brushOpacity = Math.max(0, Math.min(1, opacity));
    this.emit('brush-opacity-changed', this.brushOpacity);
  }

  setColor(color: string): void {
    this.currentColor = color;
    this.emit('color-changed', color);
  }

  startStroke(x: number, y: number, pressure: number = 1): void {
    if (!this.ctx) return;

    this.isDrawing = true;
    this.pressure = pressure;
    
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    
    this.updateBrushSettings();
    this.emit('stroke-started', { x, y, pressure });
  }

  continueStroke(x: number, y: number, pressure: number = 1): void {
    if (!this.ctx || !this.isDrawing) return;

    this.pressure = pressure;
    this.updateBrushSettings();
    
    switch (this.currentTool) {
      case 'brush':
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        break;
      case 'eraser':
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        this.ctx.globalCompositeOperation = 'source-over';
        break;
      default:
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
    }

    this.emit('stroke-continued', { x, y, pressure });
  }

  endStroke(): void {
    if (!this.ctx || !this.isDrawing) return;

    this.isDrawing = false;
    this.ctx.closePath();
    this.emit('stroke-ended');
  }

  private updateBrushSettings(): void {
    if (!this.ctx) return;

    const adjustedSize = this.brushSize * this.pressure;
    const adjustedOpacity = this.brushOpacity * this.pressure;
    
    this.ctx.lineWidth = adjustedSize;
    this.ctx.globalAlpha = adjustedOpacity;
    this.ctx.strokeStyle = this.currentColor;
  }

  drawShape(type: 'rectangle' | 'circle' | 'line', startX: number, startY: number, endX: number, endY: number): void {
    if (!this.ctx) return;

    this.ctx.beginPath();
    this.updateBrushSettings();

    switch (type) {
      case 'rectangle':
        this.ctx.rect(startX, startY, endX - startX, endY - startY);
        break;
      case 'circle':
        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        this.ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
        break;
      case 'line':
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        break;
    }

    this.ctx.stroke();
    this.emit('shape-drawn', { type, startX, startY, endX, endY });
  }

  clear(): void {
    if (!this.ctx || !this.canvas) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.emit('canvas-cleared');
  }

  fill(x: number, y: number, color: string): void {
    if (!this.ctx || !this.canvas) return;

    // Simple flood fill implementation
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const targetColor = this.getPixelColor(imageData, x, y);
    const fillColor = this.hexToRgba(color);

    if (this.colorsMatch(targetColor, fillColor)) return;

    this.floodFill(imageData, x, y, targetColor, fillColor);
    this.ctx.putImageData(imageData, 0, 0);
    
    this.emit('area-filled', { x, y, color });
  }

  private getPixelColor(imageData: ImageData, x: number, y: number): [number, number, number, number] {
    const index = (y * imageData.width + x) * 4;
    return [
      imageData.data[index],
      imageData.data[index + 1],
      imageData.data[index + 2],
      imageData.data[index + 3]
    ];
  }

  private hexToRgba(hex: string): [number, number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b, 255];
  }

  private colorsMatch(color1: [number, number, number, number], color2: [number, number, number, number]): boolean {
    return color1[0] === color2[0] && color1[1] === color2[1] && color1[2] === color2[2] && color1[3] === color2[3];
  }

  private floodFill(
    imageData: ImageData,
    x: number,
    y: number,
    targetColor: [number, number, number, number],
    fillColor: [number, number, number, number]
  ): void {
    const stack: [number, number][] = [[x, y]];
    const { width, height } = imageData;

    while (stack.length > 0) {
      const [currentX, currentY] = stack.pop()!;
      
      if (currentX < 0 || currentX >= width || currentY < 0 || currentY >= height) continue;
      
      const currentColor = this.getPixelColor(imageData, currentX, currentY);
      if (!this.colorsMatch(currentColor, targetColor)) continue;

      // Set the new color
      const index = (currentY * width + currentX) * 4;
      imageData.data[index] = fillColor[0];
      imageData.data[index + 1] = fillColor[1];
      imageData.data[index + 2] = fillColor[2];
      imageData.data[index + 3] = fillColor[3];

      // Add adjacent pixels to stack
      stack.push([currentX + 1, currentY]);
      stack.push([currentX - 1, currentY]);
      stack.push([currentX, currentY + 1]);
      stack.push([currentX, currentY - 1]);
    }
  }

  async dispose(): Promise<void> {
    this.interactionManager.dispose();
    // Clean up resources
  }

  createNewLayer(): number {
    if (!this.canvas) return -1;
    
    const imageData = this.ctx!.createImageData(this.canvas.width, this.canvas.height);
    this.layers.push(imageData);
    return this.layers.length - 1;
  }

  switchToLayer(layerIndex: number): void {
    if (layerIndex >= 0 && layerIndex < this.layers.length) {
      this.currentLayer = layerIndex;
      this.emit('layer-changed', layerIndex);
    }
  }

  mergeDown(): void {
    if (this.currentLayer > 0 && this.layers.length > 1) {
      const currentLayerData = this.layers[this.currentLayer];
      const belowLayerData = this.layers[this.currentLayer - 1];
      
      // Simple merge by overlaying pixels
      for (let i = 0; i < currentLayerData.data.length; i += 4) {
        const alpha = currentLayerData.data[i + 3] / 255;
        if (alpha > 0) {
          belowLayerData.data[i] = Math.round(belowLayerData.data[i] * (1 - alpha) + currentLayerData.data[i] * alpha);
          belowLayerData.data[i + 1] = Math.round(belowLayerData.data[i + 1] * (1 - alpha) + currentLayerData.data[i + 1] * alpha);
          belowLayerData.data[i + 2] = Math.round(belowLayerData.data[i + 2] * (1 - alpha) + currentLayerData.data[i + 2] * alpha);
          belowLayerData.data[i + 3] = Math.min(255, belowLayerData.data[i + 3] + currentLayerData.data[i + 3]);
        }
      }
      
      this.layers.splice(this.currentLayer, 1);
      this.currentLayer--;
      this.emit('layer-merged');
    }
  }

  exportImage(): string | null {
    if (!this.canvas) return null;
    return this.canvas.toDataURL('image/png');
  }

  importImage(imageData: string): void {
    if (!this.ctx) return;
    
    const img = new Image();
    img.onload = () => {
      this.ctx!.clearRect(0, 0, this.canvas!.width, this.canvas!.height);
      this.ctx!.drawImage(img, 0, 0);
      this.emit('image-imported');
    };
    img.src = imageData;
  }
}