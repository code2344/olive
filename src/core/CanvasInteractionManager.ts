import { EventEmitter } from '../utils/EventEmitter';

export interface CanvasInteractionEvent {
  x: number;
  y: number;
  pressure: number;
  pointerType: 'mouse' | 'pen' | 'touch';
  buttons: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}

export class CanvasInteractionManager extends EventEmitter {
  private canvas?: HTMLCanvasElement;
  private isPointerDown = false;

  initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.canvas) return;

    // Pointer events for modern devices
    this.canvas.addEventListener('pointerdown', this.handlePointerDown.bind(this));
    this.canvas.addEventListener('pointermove', this.handlePointerMove.bind(this));
    this.canvas.addEventListener('pointerup', this.handlePointerUp.bind(this));
    this.canvas.addEventListener('pointercancel', this.handlePointerUp.bind(this));

    // Prevent context menu
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Prevent touch scrolling
    this.canvas.addEventListener('touchstart', (e) => e.preventDefault());
    this.canvas.addEventListener('touchmove', (e) => e.preventDefault());
    this.canvas.addEventListener('touchend', (e) => e.preventDefault());
  }

  private handlePointerDown(event: PointerEvent): void {
    this.isPointerDown = true;
    const rect = this.canvas!.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const interactionEvent: CanvasInteractionEvent = {
      x,
      y,
      pressure: event.pressure || 1,
      pointerType: event.pointerType as any,
      buttons: event.buttons,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey
    };

    this.emit('stroke-start', interactionEvent);
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.isPointerDown) return;

    const rect = this.canvas!.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const interactionEvent: CanvasInteractionEvent = {
      x,
      y,
      pressure: event.pressure || 1,
      pointerType: event.pointerType as any,
      buttons: event.buttons,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey
    };

    this.emit('stroke-continue', interactionEvent);
  }

  private handlePointerUp(event: PointerEvent): void {
    if (!this.isPointerDown) return;

    this.isPointerDown = false;
    const rect = this.canvas!.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const interactionEvent: CanvasInteractionEvent = {
      x,
      y,
      pressure: event.pressure || 1,
      pointerType: event.pointerType as any,
      buttons: event.buttons,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey
    };

    this.emit('stroke-end', interactionEvent);
  }

  setTool(_tool: string): void {
    // Tool setting handled by parent engines
  }

  dispose(): void {
    if (this.canvas) {
      // Remove all event listeners
      this.canvas.removeEventListener('pointerdown', this.handlePointerDown.bind(this));
      this.canvas.removeEventListener('pointermove', this.handlePointerMove.bind(this));
      this.canvas.removeEventListener('pointerup', this.handlePointerUp.bind(this));
      this.canvas.removeEventListener('pointercancel', this.handlePointerUp.bind(this));
    }
    this.removeAllListeners();
  }
}