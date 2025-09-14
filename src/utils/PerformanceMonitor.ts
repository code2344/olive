import { EventEmitter } from './EventEmitter';
import { PerformanceMetrics } from '../types';

export class PerformanceMonitor extends EventEmitter {
  private isRunning = false;
  private frameCount = 0;
  private lastTime = 0;
  private fpsHistory: number[] = [];
  private memoryHistory: number[] = [];
  private animationFrameId?: number;

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastTime = performance.now();
    this.frameCount = 0;
    this.tick();
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private tick = (): void => {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;
    
    this.frameCount++;

    // Calculate FPS every second
    if (deltaTime >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / deltaTime);
      this.fpsHistory.push(fps);
      
      // Keep only last 60 readings (1 minute at 1fps)
      if (this.fpsHistory.length > 60) {
        this.fpsHistory.shift();
      }

      // Get memory usage if available
      let memoryUsage = 0;
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // MB
        this.memoryHistory.push(memoryUsage);
        
        if (this.memoryHistory.length > 60) {
          this.memoryHistory.shift();
        }
      }

      const metrics: PerformanceMetrics = {
        fps,
        memoryUsage,
        renderTime: deltaTime / this.frameCount,
        cpuUsage: this.calculateCPUUsage()
      };

      this.emit('metrics', metrics);

      // Emit warnings for poor performance
      if (fps < 30) {
        this.emit('warning', { type: 'low-fps', value: fps });
      }
      
      if (memoryUsage > 512) { // 512MB warning threshold
        this.emit('warning', { type: 'high-memory', value: memoryUsage });
      }

      this.frameCount = 0;
      this.lastTime = currentTime;
    }

    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  private calculateCPUUsage(): number {
    // Simple CPU usage estimation based on frame timing
    const averageFPS = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
    return Math.max(0, Math.min(100, 100 - (averageFPS / 60) * 100));
  }

  getCurrentMetrics(): PerformanceMetrics {
    const fps = this.fpsHistory[this.fpsHistory.length - 1] || 0;
    const memoryUsage = this.memoryHistory[this.memoryHistory.length - 1] || 0;
    
    return {
      fps,
      memoryUsage,
      renderTime: 16.67, // Default 60fps
      cpuUsage: this.calculateCPUUsage()
    };
  }

  getFPSHistory(): number[] {
    return [...this.fpsHistory];
  }

  getMemoryHistory(): number[] {
    return [...this.memoryHistory];
  }

  getAverageFPS(): number {
    if (this.fpsHistory.length === 0) return 0;
    return this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
  }

  getPeakMemoryUsage(): number {
    if (this.memoryHistory.length === 0) return 0;
    return Math.max(...this.memoryHistory);
  }
}