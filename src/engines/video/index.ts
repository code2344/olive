import { EventEmitter } from '../../utils/EventEmitter';

export class VideoEngine extends EventEmitter {
  private canvas?: HTMLCanvasElement;
  private gl?: WebGL2RenderingContext;

  async initialize(): Promise<void> {
    try {
      // Create main canvas
      this.canvas = document.createElement('canvas');
      this.canvas.width = 1920;
      this.canvas.height = 1080;
      
      // Get WebGL2 context
      this.gl = this.canvas.getContext('webgl2', {
        antialias: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true
      }) || undefined;

      if (!this.gl) {
        throw new Error('WebGL2 not supported');
      }

      this.setupWebGL();
      
      console.log('✅ Video Engine initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Video Engine:', error);
      throw error;
    }
  }

  private setupWebGL(): void {
    if (!this.gl) return;

    // Set viewport
    this.gl.viewport(0, 0, this.canvas!.width, this.canvas!.height);
    
    // Enable blending for compositing
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    
    // Clear color
    this.gl.clearColor(0, 0, 0, 1);
  }

  getCanvas(): HTMLCanvasElement | undefined {
    return this.canvas;
  }

  getContext(): WebGL2RenderingContext | undefined {
    return this.gl;
  }

  render(): void {
    if (!this.gl) return;
    
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    // Rendering logic will be implemented here
  }

  async dispose(): Promise<void> {
    if (this.gl) {
      // Clean up WebGL resources
      this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  }
}