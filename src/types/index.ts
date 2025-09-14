// Project and media types
export interface Project {
  id: string;
  name: string;
  description?: string;
  width: number;
  height: number;
  frameRate: number;
  sampleRate: number;
  duration: number;
  layers: Layer[];
  settings: ProjectSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectSettings {
  backgroundColor: string;
  colorSpace: 'sRGB' | 'Rec709' | 'DCI-P3';
  bitDepth: 8 | 10 | 16;
  audioChannels: number;
}

// Layer system types
export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: BlendMode;
  transform: Transform;
  effects: Effect[];
  clips: Clip[];
  parentId?: string;
}

export type LayerType = 'video' | 'audio' | 'image' | 'text' | 'shape' | 'adjustment';

export type BlendMode = 
  | 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light' | 'hard-light'
  | 'color-dodge' | 'color-burn' | 'darken' | 'lighten' | 'difference' | 'exclusion';

export interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  anchorX: number;
  anchorY: number;
  skewX: number;
  skewY: number;
}

// Timeline and clips
export interface Clip {
  id: string;
  name: string;
  type: ClipType;
  startTime: number;
  duration: number;
  trimIn: number;
  trimOut: number;
  speed: number;
  mediaPath?: string;
  mediaData?: MediaData;
  keyframes: Keyframe[];
}

export type ClipType = 'video' | 'audio' | 'image' | 'text' | 'shape' | 'color';

export interface MediaData {
  width?: number;
  height?: number;
  duration?: number;
  frameRate?: number;
  sampleRate?: number;
  channels?: number;
  format: string;
  size: number;
  url: string;
}

// Animation system
export interface Keyframe {
  id: string;
  time: number;
  property: string;
  value: any;
  easing: EasingFunction;
  interpolation: InterpolationType;
}

export type EasingFunction = 
  | 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out'
  | 'cubic-bezier';

export type InterpolationType = 'linear' | 'bezier' | 'step' | 'hold';

// Effects system
export interface Effect {
  id: string;
  name: string;
  type: EffectType;
  enabled: boolean;
  parameters: Record<string, any>;
  keyframes: Keyframe[];
}

export type EffectType = 
  | 'blur' | 'sharpen' | 'brightness' | 'contrast' | 'saturation' | 'hue'
  | 'color-correction' | 'chromakey' | 'noise-reduction' | 'stabilization'
  | 'distortion' | 'transition' | 'generator';

// Tools and editing
export interface Tool {
  id: string;
  name: string;
  type: ToolType;
  icon: string;
  shortcut?: string;
  options: ToolOptions;
}

export type ToolType = 
  | 'selection' | 'move' | 'crop' | 'brush' | 'eraser' | 'text' | 'shape'
  | 'gradient' | 'clone' | 'heal' | 'blur-tool' | 'sharpen-tool';

export interface ToolOptions {
  size?: number;
  hardness?: number;
  opacity?: number;
  flow?: number;
  pressure?: boolean;
  spacing?: number;
  shape?: BrushShape;
}

export type BrushShape = 'round' | 'square' | 'custom';

// Drawing and vector graphics
export interface VectorPath {
  id: string;
  points: PathPoint[];
  closed: boolean;
  fill?: Fill;
  stroke?: Stroke;
}

export interface PathPoint {
  x: number;
  y: number;
  handleIn?: { x: number; y: number };
  handleOut?: { x: number; y: number };
}

export interface Fill {
  type: 'solid' | 'gradient' | 'pattern';
  color?: string;
  gradient?: Gradient;
  pattern?: Pattern;
}

export interface Stroke {
  color: string;
  width: number;
  style: 'solid' | 'dashed' | 'dotted';
  cap: 'butt' | 'round' | 'square';
  join: 'miter' | 'round' | 'bevel';
}

export interface Gradient {
  type: 'linear' | 'radial' | 'conic';
  stops: GradientStop[];
  angle?: number;
  centerX?: number;
  centerY?: number;
}

export interface GradientStop {
  offset: number;
  color: string;
}

export interface Pattern {
  url: string;
  repeat: 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';
  scale: number;
}

// Color and image processing
export interface ColorSpace {
  name: string;
  primaries: [number, number][];
  whitePoint: [number, number];
  gamma: number;
}

export interface LUT {
  id: string;
  name: string;
  type: '1D' | '3D';
  size: number;
  data: Float32Array;
}

// User interface
export interface UITheme {
  name: string;
  colors: Record<string, string>;
  fonts: Record<string, string>;
  spacing: Record<string, number>;
  borderRadius: Record<string, number>;
  shadows: Record<string, string>;
}

export interface UIState {
  currentTool: string;
  selectedLayers: string[];
  timelinePosition: number;
  zoom: number;
  panX: number;
  panY: number;
  showGrid: boolean;
  snapToGrid: boolean;
  theme: string;
}

// Events and actions
export interface AppEvent {
  type: string;
  data?: any;
  timestamp: number;
}

export interface UndoAction {
  id: string;
  type: string;
  description: string;
  undo: () => void;
  redo: () => void;
  timestamp: number;
}

// Performance and rendering
export interface RenderSettings {
  quality: 'draft' | 'preview' | 'final';
  resolution: number;
  antialiasing: boolean;
  colorManagement: boolean;
  threading: boolean;
}

export interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  renderTime: number;
  cpuUsage: number;
  gpuUsage?: number;
}

// File and export
export interface ExportSettings {
  format: string;
  quality: number;
  width: number;
  height: number;
  frameRate?: number;
  bitRate?: number;
  audioQuality?: number;
  colorSpace: string;
}

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  width?: number;
  height?: number;
  duration?: number;
}

// Collaboration
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'owner' | 'editor' | 'viewer';
}

export interface CollaborationSession {
  id: string;
  projectId: string;
  users: User[];
  cursor: Record<string, { x: number; y: number; visible: boolean }>;
  changes: CollaborationChange[];
}

export interface CollaborationChange {
  id: string;
  userId: string;
  type: string;
  data: any;
  timestamp: number;
}