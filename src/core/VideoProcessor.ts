export interface VideoCodec {
  name: string;
  mimeType: string;
  extension: string;
  quality: 'low' | 'medium' | 'high' | 'lossless';
}

export interface AudioCodec {
  name: string;
  mimeType: string;
  extension: string;
  sampleRate: number;
  bitRate: number;
}

export interface ExportOptions {
  videoCodec: VideoCodec;
  audioCodec?: AudioCodec;
  width: number;
  height: number;
  frameRate: number;
  bitRate: number;
  quality: number;
  startTime?: number;
  endTime?: number;
}

export class VideoProcessor {
  private static readonly SUPPORTED_VIDEO_CODECS: VideoCodec[] = [
    { name: 'H.264', mimeType: 'video/mp4', extension: 'mp4', quality: 'high' },
    { name: 'H.265', mimeType: 'video/mp4', extension: 'mp4', quality: 'high' },
    { name: 'VP9', mimeType: 'video/webm', extension: 'webm', quality: 'high' },
    { name: 'AV1', mimeType: 'video/webm', extension: 'webm', quality: 'high' }
  ];

  private static readonly SUPPORTED_AUDIO_CODECS: AudioCodec[] = [
    { name: 'AAC', mimeType: 'audio/mp4', extension: 'mp4', sampleRate: 48000, bitRate: 128 },
    { name: 'Opus', mimeType: 'audio/webm', extension: 'webm', sampleRate: 48000, bitRate: 128 },
    { name: 'MP3', mimeType: 'audio/mpeg', extension: 'mp3', sampleRate: 44100, bitRate: 128 }
  ];

  static getSupportedVideoCodecs(): VideoCodec[] {
    return [...this.SUPPORTED_VIDEO_CODECS];
  }

  static getSupportedAudioCodecs(): AudioCodec[] {
    return [...this.SUPPORTED_AUDIO_CODECS];
  }

  static async checkCodecSupport(codec: VideoCodec): Promise<boolean> {
    if (!('MediaRecorder' in window)) return false;
    
    try {
      return MediaRecorder.isTypeSupported(codec.mimeType);
    } catch {
      return false;
    }
  }

  static async exportVideo(
    canvas: HTMLCanvasElement,
    audio: MediaStream | null,
    options: ExportOptions,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        // Get video stream from canvas
        const videoStream = canvas.captureStream(options.frameRate);
        
        // Combine with audio if provided
        const tracks = [...videoStream.getVideoTracks()];
        if (audio) {
          tracks.push(...audio.getAudioTracks());
        }
        
        const combinedStream = new MediaStream(tracks);
        
        // Configure MediaRecorder
        const mediaRecorder = new MediaRecorder(combinedStream, {
          mimeType: options.videoCodec.mimeType,
          videoBitsPerSecond: options.bitRate,
          audioBitsPerSecond: options.audioCodec?.bitRate || 128000
        });

        const chunks: Blob[] = [];
        let recordingStartTime = Date.now();

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
            
            // Calculate progress
            if (onProgress) {
              const duration = options.endTime ? options.endTime - (options.startTime || 0) : 10;
              const elapsed = (Date.now() - recordingStartTime) / 1000;
              const progress = Math.min(elapsed / duration, 1);
              onProgress(progress);
            }
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: options.videoCodec.mimeType });
          resolve(blob);
        };

        mediaRecorder.onerror = (event) => {
          reject(new Error('MediaRecorder error: ' + event));
        };

        // Start recording
        mediaRecorder.start();

        // Stop recording after specified duration or default 10 seconds
        const duration = options.endTime ? 
          (options.endTime - (options.startTime || 0)) * 1000 : 
          10000;
        
        setTimeout(() => {
          mediaRecorder.stop();
          tracks.forEach(track => track.stop());
        }, duration);

      } catch (error) {
        reject(error);
      }
    });
  }

  static async extractFrames(
    videoFile: File,
    frameRate: number = 1
  ): Promise<ImageData[]> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      const frames: ImageData[] = [];
      let currentTime = 0;

      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const extractFrame = () => {
          if (currentTime >= video.duration) {
            resolve(frames);
            return;
          }
          
          video.currentTime = currentTime;
        };

        video.onseeked = () => {
          ctx.drawImage(video, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          frames.push(imageData);
          
          currentTime += 1 / frameRate;
          
          if (currentTime < video.duration) {
            setTimeout(extractFrame, 100); // Small delay to ensure frame is ready
          } else {
            resolve(frames);
          }
        };

        extractFrame();
      };

      video.onerror = () => {
        reject(new Error('Failed to load video'));
      };

      video.src = URL.createObjectURL(videoFile);
    });
  }

  static async processVideoWithEffects(
    inputFrames: ImageData[],
    effects: Array<(frame: ImageData) => ImageData>,
    onProgress?: (progress: number) => void
  ): Promise<ImageData[]> {
    const processedFrames: ImageData[] = [];
    
    for (let i = 0; i < inputFrames.length; i++) {
      let frame = inputFrames[i];
      
      // Apply all effects to the frame
      for (const effect of effects) {
        frame = effect(frame);
      }
      
      processedFrames.push(frame);
      
      if (onProgress) {
        onProgress((i + 1) / inputFrames.length);
      }
    }
    
    return processedFrames;
  }

  static createVideoFromFrames(
    frames: ImageData[],
    frameRate: number,
    options: ExportOptions
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      canvas.width = options.width;
      canvas.height = options.height;

      // Capture stream from canvas
      const stream = canvas.captureStream(frameRate);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: options.videoCodec.mimeType,
        videoBitsPerSecond: options.bitRate
      });

      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: options.videoCodec.mimeType });
        resolve(blob);
      };

      mediaRecorder.start();

      // Render frames
      let frameIndex = 0;
      const renderFrame = () => {
        if (frameIndex >= frames.length) {
          mediaRecorder.stop();
          return;
        }

        // Create temporary canvas for the frame
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        if (tempCtx) {
          const frame = frames[frameIndex];
          tempCanvas.width = frame.width;
          tempCanvas.height = frame.height;
          tempCtx.putImageData(frame, 0, 0);
          
          // Draw to main canvas with scaling
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
        }

        frameIndex++;
        setTimeout(renderFrame, 1000 / frameRate);
      };

      renderFrame();
    });
  }
}