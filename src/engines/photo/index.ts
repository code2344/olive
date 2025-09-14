import { EventEmitter } from '../../utils/EventEmitter';

export class PhotoEngine extends EventEmitter {
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D;

  async initialize(): Promise<void> {
    try {
      // Create main canvas for photo editing
      this.canvas = document.createElement('canvas');
      this.canvas.width = 4096;
      this.canvas.height = 4096;
      
      this.ctx = this.canvas.getContext('2d', {
        alpha: true,
        willReadFrequently: false
      }) || undefined;

      if (!this.ctx) {
        throw new Error('Canvas 2D context not available');
      }

      console.log('✅ Photo Engine initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Photo Engine:', error);
      throw error;
    }
  }

  getCanvas(): HTMLCanvasElement | undefined {
    return this.canvas;
  }

  getContext(): CanvasRenderingContext2D | undefined {
    return this.ctx;
  }

  async applyFilter(imageData: ImageData, filterType: string, intensity: number = 1): Promise<ImageData> {
    // Basic filter implementation - will be expanded
    const result = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    switch (filterType) {
      case 'brightness':
        this.adjustBrightness(result, intensity);
        break;
      case 'contrast':
        this.adjustContrast(result, intensity);
        break;
      case 'saturation':
        this.adjustSaturation(result, intensity);
        break;
      default:
        console.warn(`Unknown filter type: ${filterType}`);
    }

    return result;
  }

  private adjustBrightness(imageData: ImageData, value: number): void {
    const data = imageData.data;
    const adjustment = value * 255;
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] + adjustment));     // R
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + adjustment)); // G
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + adjustment)); // B
      // Alpha channel (i + 3) remains unchanged
    }
  }

  private adjustContrast(imageData: ImageData, value: number): void {
    const data = imageData.data;
    const factor = (259 * (value * 255 + 255)) / (255 * (259 - value * 255));
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128));
      data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128));
      data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128));
    }
  }

  private adjustSaturation(imageData: ImageData, value: number): void {
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Convert to grayscale
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      
      // Apply saturation
      data[i] = Math.max(0, Math.min(255, gray + value * (r - gray)));
      data[i + 1] = Math.max(0, Math.min(255, gray + value * (g - gray)));
      data[i + 2] = Math.max(0, Math.min(255, gray + value * (b - gray)));
    }
  }

  async dispose(): Promise<void> {
    // Clean up resources
  }
}