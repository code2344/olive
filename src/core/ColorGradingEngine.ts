export interface ColorGradingSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  gamma: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  temperature: number;
  tint: number;
}

export interface LUTData {
  name: string;
  size: number;
  data: Float32Array;
  type: '1D' | '3D';
}

export class ColorGradingEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private imageData?: ImageData;
  private originalImageData?: ImageData;

  constructor(width: number = 1920, height: number = 1080) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    
    const context = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Could not get canvas context for color grading');
    }
    this.ctx = context;
  }

  loadImage(source: HTMLImageElement | HTMLCanvasElement | ImageData): void {
    if (source instanceof ImageData) {
      this.originalImageData = new ImageData(
        new Uint8ClampedArray(source.data),
        source.width,
        source.height
      );
      this.imageData = new ImageData(
        new Uint8ClampedArray(source.data),
        source.width,
        source.height
      );
    } else {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(source, 0, 0, this.canvas.width, this.canvas.height);
      this.originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      this.imageData = new ImageData(
        new Uint8ClampedArray(this.originalImageData.data),
        this.originalImageData.width,
        this.originalImageData.height
      );
    }
  }

  applyColorGrading(settings: Partial<ColorGradingSettings>): ImageData {
    if (!this.originalImageData || !this.imageData) {
      throw new Error('No image loaded for color grading');
    }

    // Start with original image data
    const data = new Uint8ClampedArray(this.originalImageData.data);
    
    // Apply each adjustment
    this.adjustBrightness(data, settings.brightness || 0);
    this.adjustContrast(data, settings.contrast || 0);
    this.adjustSaturation(data, settings.saturation || 0);
    this.adjustHue(data, settings.hue || 0);
    this.adjustGamma(data, settings.gamma || 1);
    this.adjustHighlightsAndShadows(data, settings.highlights || 0, settings.shadows || 0);
    this.adjustWhitesAndBlacks(data, settings.whites || 0, settings.blacks || 0);
    this.adjustTemperatureAndTint(data, settings.temperature || 0, settings.tint || 0);

    this.imageData = new ImageData(data, this.originalImageData.width, this.originalImageData.height);
    return this.imageData;
  }

  private adjustBrightness(data: Uint8ClampedArray, brightness: number): void {
    const adjustment = brightness * 255;
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] + adjustment));     // R
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + adjustment)); // G
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + adjustment)); // B
    }
  }

  private adjustContrast(data: Uint8ClampedArray, contrast: number): void {
    const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128));
      data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128));
      data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128));
    }
  }

  private adjustSaturation(data: Uint8ClampedArray, saturation: number): void {
    const adjustment = saturation + 1;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Convert to grayscale
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      
      // Apply saturation
      data[i] = Math.max(0, Math.min(255, gray + adjustment * (r - gray)));
      data[i + 1] = Math.max(0, Math.min(255, gray + adjustment * (g - gray)));
      data[i + 2] = Math.max(0, Math.min(255, gray + adjustment * (b - gray)));
    }
  }

  private adjustHue(data: Uint8ClampedArray, hue: number): void {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      
      // Convert RGB to HSV
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;
      
      if (delta === 0) continue; // Grayscale pixel, no hue to adjust
      
      let h = 0;
      if (max === r) h = ((g - b) / delta) % 6;
      else if (max === g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
      
      h = h * 60; // Convert to degrees
      if (h < 0) h += 360;
      
      // Adjust hue
      h = (h + hue * 360) % 360;
      
      // Convert back to RGB
      const s = max === 0 ? 0 : delta / max;
      const v = max;
      
      const c = v * s;
      const x = c * (1 - Math.abs((h / 60) % 2 - 1));
      const m = v - c;
      
      let newR = 0, newG = 0, newB = 0;
      
      if (h >= 0 && h < 60) { newR = c; newG = x; newB = 0; }
      else if (h >= 60 && h < 120) { newR = x; newG = c; newB = 0; }
      else if (h >= 120 && h < 180) { newR = 0; newG = c; newB = x; }
      else if (h >= 180 && h < 240) { newR = 0; newG = x; newB = c; }
      else if (h >= 240 && h < 300) { newR = x; newG = 0; newB = c; }
      else if (h >= 300 && h < 360) { newR = c; newG = 0; newB = x; }
      
      data[i] = Math.round((newR + m) * 255);
      data[i + 1] = Math.round((newG + m) * 255);
      data[i + 2] = Math.round((newB + m) * 255);
    }
  }

  private adjustGamma(data: Uint8ClampedArray, gamma: number): void {
    const gammaCorrection = 1 / gamma;
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.round(255 * Math.pow(data[i] / 255, gammaCorrection));
      data[i + 1] = Math.round(255 * Math.pow(data[i + 1] / 255, gammaCorrection));
      data[i + 2] = Math.round(255 * Math.pow(data[i + 2] / 255, gammaCorrection));
    }
  }

  private adjustHighlightsAndShadows(data: Uint8ClampedArray, highlights: number, shadows: number): void {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      
      // Calculate luminance
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      
      let adjustment = 0;
      if (luminance > 0.5) {
        // Highlights
        adjustment = highlights * (luminance - 0.5) * 2;
      } else {
        // Shadows
        adjustment = shadows * (0.5 - luminance) * 2;
      }
      
      data[i] = Math.max(0, Math.min(255, data[i] + adjustment * 255));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + adjustment * 255));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + adjustment * 255));
    }
  }

  private adjustWhitesAndBlacks(data: Uint8ClampedArray, whites: number, blacks: number): void {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      
      // Adjust whites (highlights of highlights)
      const whiteAdjustment = whites * Math.pow(Math.max(r, g, b), 3);
      
      // Adjust blacks (shadows of shadows)
      const blackAdjustment = blacks * Math.pow(1 - Math.max(r, g, b), 3);
      
      data[i] = Math.max(0, Math.min(255, data[i] + (whiteAdjustment + blackAdjustment) * 255));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + (whiteAdjustment + blackAdjustment) * 255));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + (whiteAdjustment + blackAdjustment) * 255));
    }
  }

  private adjustTemperatureAndTint(data: Uint8ClampedArray, temperature: number, tint: number): void {
    // Temperature: cool (blue) to warm (orange)
    // Tint: green to magenta
    
    const tempR = temperature > 0 ? 1 + temperature * 0.5 : 1;
    const tempB = temperature < 0 ? 1 - temperature * 0.5 : 1;
    
    const tintG = tint > 0 ? 1 + tint * 0.3 : 1;
    const tintM = tint < 0 ? 1 - tint * 0.3 : 1; // Affects R and B
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] * tempR * tintM));     // R
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * tintG));     // G
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * tempB * tintM)); // B
    }
  }

  applyLUT(lutData: LUTData): ImageData {
    if (!this.imageData) {
      throw new Error('No image loaded for LUT application');
    }

    const data = new Uint8ClampedArray(this.imageData.data);
    
    if (lutData.type === '3D') {
      this.apply3DLUT(data, lutData);
    } else {
      this.apply1DLUT(data, lutData);
    }

    return new ImageData(data, this.imageData.width, this.imageData.height);
  }

  private apply3DLUT(data: Uint8ClampedArray, lutData: LUTData): void {
    const size = lutData.size;
    const lut = lutData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      
      // Map to LUT coordinates
      const rIndex = Math.floor(r * (size - 1));
      const gIndex = Math.floor(g * (size - 1));
      const bIndex = Math.floor(b * (size - 1));
      
      // Calculate LUT array index
      const lutIndex = (rIndex * size * size + gIndex * size + bIndex) * 3;
      
      if (lutIndex + 2 < lut.length) {
        data[i] = Math.round(lut[lutIndex] * 255);
        data[i + 1] = Math.round(lut[lutIndex + 1] * 255);
        data[i + 2] = Math.round(lut[lutIndex + 2] * 255);
      }
    }
  }

  private apply1DLUT(data: Uint8ClampedArray, lutData: LUTData): void {
    const size = lutData.size;
    const lut = lutData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      // Apply LUT to each channel separately
      const rIndex = Math.floor((data[i] / 255) * (size - 1));
      const gIndex = Math.floor((data[i + 1] / 255) * (size - 1));
      const bIndex = Math.floor((data[i + 2] / 255) * (size - 1));
      
      if (rIndex < size && gIndex < size && bIndex < size) {
        data[i] = Math.round(lut[rIndex] * 255);
        data[i + 1] = Math.round(lut[gIndex] * 255);
        data[i + 2] = Math.round(lut[bIndex] * 255);
      }
    }
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getResult(): ImageData | undefined {
    return this.imageData;
  }

  renderToCanvas(): void {
    if (this.imageData) {
      this.ctx.putImageData(this.imageData, 0, 0);
    }
  }

  reset(): void {
    if (this.originalImageData) {
      this.imageData = new ImageData(
        new Uint8ClampedArray(this.originalImageData.data),
        this.originalImageData.width,
        this.originalImageData.height
      );
      this.renderToCanvas();
    }
  }

  static createPreviewLUT(name: string): LUTData {
    // Create a simple preview LUT for demonstration
    const size = 16;
    const data = new Float32Array(size * size * size * 3);
    
    for (let r = 0; r < size; r++) {
      for (let g = 0; g < size; g++) {
        for (let b = 0; b < size; b++) {
          const index = (r * size * size + g * size + b) * 3;
          
          // Normalize to 0-1 range
          const nr = r / (size - 1);
          const ng = g / (size - 1);
          const nb = b / (size - 1);
          
          // Apply a simple color transformation for preview
          switch (name) {
            case 'Cinematic':
              data[index] = Math.min(1, nr * 1.1);
              data[index + 1] = ng * 0.95;
              data[index + 2] = Math.min(1, nb * 1.05);
              break;
            case 'Vintage':
              data[index] = Math.min(1, nr * 1.2 + 0.1);
              data[index + 1] = ng * 0.9;
              data[index + 2] = nb * 0.8;
              break;
            default:
              data[index] = nr;
              data[index + 1] = ng;
              data[index + 2] = nb;
          }
        }
      }
    }
    
    return { name, size, data, type: '3D' };
  }
}