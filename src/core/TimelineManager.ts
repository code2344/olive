import { EventEmitter } from '../utils/EventEmitter';
import { Clip, Keyframe } from '../types';

export interface TimelineTrack {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'subtitle';
  height: number;
  visible: boolean;
  locked: boolean;
  muted?: boolean;
  clips: TimelineClip[];
}

export interface TimelineClip {
  id: string;
  trackId: string;
  startTime: number;
  duration: number;
  trimIn: number;
  trimOut: number;
  speed: number;
  volume?: number;
  opacity?: number;
  sourceClip: Clip;
  selected: boolean;
  keyframes: Keyframe[];
}

export interface TimelineState {
  currentTime: number;
  totalDuration: number;
  zoom: number;
  scrollX: number;
  timelineWidth: number;
  pixelsPerSecond: number;
  snapToGrid: boolean;
  gridInterval: number;
  isPlaying: boolean;
  loop: boolean;
  selectionStart?: number;
  selectionEnd?: number;
}

export interface TimelineMarker {
  id: string;
  time: number;
  name: string;
  color: string;
}

export class TimelineManager extends EventEmitter {
  private tracks: Map<string, TimelineTrack> = new Map();
  private trackOrder: string[] = [];
  private clips: Map<string, TimelineClip> = new Map();
  private markers: Map<string, TimelineMarker> = new Map();
  private state: TimelineState;
  private selectedClips: Set<string> = new Set();
  private playbackTimer?: number;
  private frameRate: number;

  constructor(frameRate: number = 30) {
    super();
    this.frameRate = frameRate;
    this.state = {
      currentTime: 0,
      totalDuration: 300, // 5 minutes default
      zoom: 1,
      scrollX: 0,
      timelineWidth: 1000,
      pixelsPerSecond: 50,
      snapToGrid: true,
      gridInterval: 1, // 1 second
      isPlaying: false,
      loop: false
    };
  }

  // Track management
  createTrack(name: string, type: 'video' | 'audio' | 'subtitle'): TimelineTrack {
    const track: TimelineTrack = {
      id: this.generateId(),
      name,
      type,
      height: type === 'video' ? 80 : 40,
      visible: true,
      locked: false,
      muted: type === 'audio' ? false : undefined,
      clips: []
    };

    this.tracks.set(track.id, track);
    this.trackOrder.push(track.id);
    
    this.emit('track-created', track);
    return track;
  }

  removeTrack(trackId: string): boolean {
    const track = this.tracks.get(trackId);
    if (!track) return false;

    // Remove all clips from this track
    track.clips.forEach(clip => {
      this.clips.delete(clip.id);
      this.selectedClips.delete(clip.id);
    });

    this.tracks.delete(trackId);
    const index = this.trackOrder.indexOf(trackId);
    if (index > -1) {
      this.trackOrder.splice(index, 1);
    }

    this.emit('track-removed', trackId);
    return true;
  }

  moveTrack(trackId: string, newIndex: number): boolean {
    const currentIndex = this.trackOrder.indexOf(trackId);
    if (currentIndex === -1) return false;

    this.trackOrder.splice(currentIndex, 1);
    const clampedIndex = Math.max(0, Math.min(newIndex, this.trackOrder.length));
    this.trackOrder.splice(clampedIndex, 0, trackId);

    this.emit('track-moved', { trackId, fromIndex: currentIndex, toIndex: clampedIndex });
    return true;
  }

  // Clip management
  addClip(trackId: string, sourceClip: Clip, startTime: number): TimelineClip | null {
    const track = this.tracks.get(trackId);
    if (!track) return null;

    // Check for overlaps and adjust if necessary
    const adjustedStartTime = this.findAvailableTime(trackId, startTime, sourceClip.duration);

    const timelineClip: TimelineClip = {
      id: this.generateId(),
      trackId,
      startTime: adjustedStartTime,
      duration: sourceClip.duration,
      trimIn: sourceClip.trimIn,
      trimOut: sourceClip.trimOut,
      speed: sourceClip.speed,
      volume: 1,
      opacity: 1,
      sourceClip,
      selected: false,
      keyframes: [...sourceClip.keyframes]
    };

    this.clips.set(timelineClip.id, timelineClip);
    track.clips.push(timelineClip);

    // Update total duration if necessary
    const clipEndTime = timelineClip.startTime + timelineClip.duration;
    if (clipEndTime > this.state.totalDuration) {
      this.state.totalDuration = clipEndTime + 30; // Add 30 seconds buffer
    }

    this.emit('clip-added', timelineClip);
    return timelineClip;
  }

  removeClip(clipId: string): boolean {
    const clip = this.clips.get(clipId);
    if (!clip) return false;

    const track = this.tracks.get(clip.trackId);
    if (track) {
      const index = track.clips.findIndex(c => c.id === clipId);
      if (index > -1) {
        track.clips.splice(index, 1);
      }
    }

    this.clips.delete(clipId);
    this.selectedClips.delete(clipId);

    this.emit('clip-removed', clipId);
    return true;
  }

  moveClip(clipId: string, newStartTime: number, newTrackId?: string): boolean {
    const clip = this.clips.get(clipId);
    if (!clip) return false;

    const oldTrackId = clip.trackId;
    const targetTrackId = newTrackId || oldTrackId;
    const targetTrack = this.tracks.get(targetTrackId);
    
    if (!targetTrack) return false;

    // Snap to grid if enabled
    const snappedTime = this.state.snapToGrid ? 
      this.snapToGrid(newStartTime) : newStartTime;

    // Check for conflicts
    const adjustedTime = this.findAvailableTime(targetTrackId, snappedTime, clip.duration, clipId);

    // Move between tracks if necessary
    if (oldTrackId !== targetTrackId) {
      const oldTrack = this.tracks.get(oldTrackId);
      if (oldTrack) {
        const index = oldTrack.clips.findIndex(c => c.id === clipId);
        if (index > -1) {
          oldTrack.clips.splice(index, 1);
        }
      }
      
      clip.trackId = targetTrackId;
      targetTrack.clips.push(clip);
    }

    clip.startTime = adjustedTime;

    this.emit('clip-moved', { clipId, oldStartTime: clip.startTime, newStartTime: adjustedTime, oldTrackId, newTrackId: targetTrackId });
    return true;
  }

  resizeClip(clipId: string, newDuration: number, trimStart: boolean = false): boolean {
    const clip = this.clips.get(clipId);
    if (!clip) return false;

    const minDuration = 0.1; // Minimum 100ms
    const maxDuration = clip.sourceClip.duration / clip.speed;
    const clampedDuration = Math.max(minDuration, Math.min(newDuration, maxDuration));

    if (trimStart) {
      const timeDiff = clampedDuration - clip.duration;
      clip.startTime -= timeDiff;
      clip.trimIn += timeDiff * clip.speed;
    } else {
      clip.trimOut = clip.sourceClip.duration - ((clampedDuration * clip.speed) + clip.trimIn);
    }

    clip.duration = clampedDuration;

    this.emit('clip-resized', { clipId, newDuration: clampedDuration, trimStart });
    return true;
  }

  splitClip(clipId: string, splitTime: number): { firstClip: TimelineClip; secondClip: TimelineClip } | null {
    const clip = this.clips.get(clipId);
    if (!clip) return null;

    const relativeTime = splitTime - clip.startTime;
    if (relativeTime <= 0 || relativeTime >= clip.duration) return null;

    // Create first clip (before split)
    const firstClip: TimelineClip = {
      ...clip,
      id: this.generateId(),
      duration: relativeTime,
      trimOut: clip.trimOut + (clip.duration - relativeTime) * clip.speed
    };

    // Create second clip (after split)
    const secondClip: TimelineClip = {
      ...clip,
      id: this.generateId(),
      startTime: splitTime,
      duration: clip.duration - relativeTime,
      trimIn: clip.trimIn + relativeTime * clip.speed
    };

    // Remove original clip
    this.removeClip(clipId);

    // Add new clips
    const track = this.tracks.get(clip.trackId);
    if (track) {
      this.clips.set(firstClip.id, firstClip);
      this.clips.set(secondClip.id, secondClip);
      track.clips.push(firstClip, secondClip);
    }

    this.emit('clip-split', { originalClipId: clipId, firstClip, secondClip });
    return { firstClip, secondClip };
  }

  // Selection management
  selectClip(clipId: string, addToSelection: boolean = false): void {
    if (!addToSelection) {
      this.clearSelection();
    }
    
    this.selectedClips.add(clipId);
    const clip = this.clips.get(clipId);
    if (clip) {
      clip.selected = true;
    }

    this.emit('selection-changed', Array.from(this.selectedClips));
  }

  deselectClip(clipId: string): void {
    this.selectedClips.delete(clipId);
    const clip = this.clips.get(clipId);
    if (clip) {
      clip.selected = false;
    }

    this.emit('selection-changed', Array.from(this.selectedClips));
  }

  clearSelection(): void {
    this.selectedClips.forEach(clipId => {
      const clip = this.clips.get(clipId);
      if (clip) {
        clip.selected = false;
      }
    });
    this.selectedClips.clear();
    this.emit('selection-changed', []);
  }

  selectArea(startTime: number, endTime: number): void {
    this.state.selectionStart = Math.min(startTime, endTime);
    this.state.selectionEnd = Math.max(startTime, endTime);
    this.emit('area-selected', { start: this.state.selectionStart, end: this.state.selectionEnd });
  }

  // Playback control
  play(): void {
    if (this.state.isPlaying) return;

    this.state.isPlaying = true;
    const startTime = Date.now();
    const initialCurrentTime = this.state.currentTime;

    const updatePlayhead = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      this.state.currentTime = initialCurrentTime + elapsed;

      if (this.state.currentTime >= this.state.totalDuration) {
        if (this.state.loop) {
          this.state.currentTime = 0;
        } else {
          this.pause();
          return;
        }
      }

      this.emit('playhead-updated', this.state.currentTime);
      
      if (this.state.isPlaying) {
        this.playbackTimer = requestAnimationFrame(updatePlayhead);
      }
    };

    this.playbackTimer = requestAnimationFrame(updatePlayhead);
    this.emit('playback-started');
  }

  pause(): void {
    if (!this.state.isPlaying) return;

    this.state.isPlaying = false;
    if (this.playbackTimer) {
      cancelAnimationFrame(this.playbackTimer);
      this.playbackTimer = undefined;
    }

    this.emit('playback-stopped');
  }

  stop(): void {
    this.pause();
    this.setCurrentTime(0);
  }

  setCurrentTime(time: number): void {
    this.state.currentTime = Math.max(0, Math.min(time, this.state.totalDuration));
    this.emit('playhead-updated', this.state.currentTime);
  }

  // Marker management
  addMarker(time: number, name: string, color: string = '#ff0000'): TimelineMarker {
    const marker: TimelineMarker = {
      id: this.generateId(),
      time: this.state.snapToGrid ? this.snapToGrid(time) : time,
      name,
      color
    };

    this.markers.set(marker.id, marker);
    this.emit('marker-added', marker);
    return marker;
  }

  removeMarker(markerId: string): boolean {
    if (this.markers.delete(markerId)) {
      this.emit('marker-removed', markerId);
      return true;
    }
    return false;
  }

  // Utility methods
  private findAvailableTime(trackId: string, preferredTime: number, duration: number, excludeClipId?: string): number {
    const track = this.tracks.get(trackId);
    if (!track) return preferredTime;

    let time = preferredTime;
    const step = this.state.snapToGrid ? this.state.gridInterval : 0.1;

    while (this.hasConflict(trackId, time, duration, excludeClipId)) {
      time += step;
    }

    return time;
  }

  private hasConflict(trackId: string, startTime: number, duration: number, excludeClipId?: string): boolean {
    const track = this.tracks.get(trackId);
    if (!track) return false;

    const endTime = startTime + duration;

    return track.clips.some(clip => {
      if (excludeClipId && clip.id === excludeClipId) return false;
      
      const clipEndTime = clip.startTime + clip.duration;
      return !(endTime <= clip.startTime || startTime >= clipEndTime);
    });
  }

  private snapToGrid(time: number): number {
    return Math.round(time / this.state.gridInterval) * this.state.gridInterval;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Getters
  getTracks(): TimelineTrack[] {
    return this.trackOrder.map(id => this.tracks.get(id)!).filter(Boolean);
  }

  getTrack(trackId: string): TimelineTrack | undefined {
    return this.tracks.get(trackId);
  }

  getClip(clipId: string): TimelineClip | undefined {
    return this.clips.get(clipId);
  }

  getSelectedClips(): TimelineClip[] {
    return Array.from(this.selectedClips).map(id => this.clips.get(id)!).filter(Boolean);
  }

  getClipsAtTime(time: number): TimelineClip[] {
    return Array.from(this.clips.values()).filter(clip => 
      time >= clip.startTime && time < clip.startTime + clip.duration
    );
  }

  getMarkers(): TimelineMarker[] {
    return Array.from(this.markers.values()).sort((a, b) => a.time - b.time);
  }

  getState(): TimelineState {
    return { ...this.state };
  }

  // State updates
  setZoom(zoom: number): void {
    this.state.zoom = Math.max(0.1, Math.min(10, zoom));
    this.state.pixelsPerSecond = 50 * this.state.zoom;
    this.emit('zoom-changed', this.state.zoom);
  }

  setScroll(scrollX: number): void {
    this.state.scrollX = Math.max(0, scrollX);
    this.emit('scroll-changed', this.state.scrollX);
  }

  setSnapToGrid(snap: boolean): void {
    this.state.snapToGrid = snap;
    this.emit('snap-changed', snap);
  }

  setLoop(loop: boolean): void {
    this.state.loop = loop;
    this.emit('loop-changed', loop);
  }

  // Export/Import
  exportTimeline(): any {
    return {
      tracks: this.getTracks(),
      clips: Array.from(this.clips.values()),
      markers: this.getMarkers(),
      state: this.state,
      frameRate: this.frameRate
    };
  }

  importTimeline(data: any): void {
    // Clear current timeline
    this.tracks.clear();
    this.clips.clear();
    this.markers.clear();
    this.trackOrder = [];
    this.selectedClips.clear();

    // Import tracks
    if (data.tracks) {
      data.tracks.forEach((track: TimelineTrack) => {
        this.tracks.set(track.id, track);
        this.trackOrder.push(track.id);
      });
    }

    // Import clips
    if (data.clips) {
      data.clips.forEach((clip: TimelineClip) => {
        this.clips.set(clip.id, clip);
      });
    }

    // Import markers
    if (data.markers) {
      data.markers.forEach((marker: TimelineMarker) => {
        this.markers.set(marker.id, marker);
      });
    }

    // Import state
    if (data.state) {
      this.state = { ...this.state, ...data.state };
    }

    if (data.frameRate) {
      this.frameRate = data.frameRate;
    }

    this.emit('timeline-imported');
  }

  dispose(): void {
    this.pause();
    this.tracks.clear();
    this.clips.clear();
    this.markers.clear();
    this.selectedClips.clear();
    this.removeAllListeners();
  }
}