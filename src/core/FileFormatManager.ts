export interface SupportedFormat {
  name: string;
  extensions: string[];
  mimeTypes: string[];
  category: 'image' | 'video' | 'audio' | 'project';
  canRead: boolean;
  canWrite: boolean;
  description: string;
}

export interface ImportOptions {
  quality?: number;
  resize?: { width: number; height: number };
  convertFormat?: string;
}

export interface ExportOptions {
  format: string;
  quality: number;
  compression?: string;
  metadata?: Record<string, any>;
}

export class FileFormatManager {
  private static readonly SUPPORTED_FORMATS: SupportedFormat[] = [
    // Image formats
    {
      name: 'JPEG',
      extensions: ['.jpg', '.jpeg'],
      mimeTypes: ['image/jpeg'],
      category: 'image',
      canRead: true,
      canWrite: true,
      description: 'Joint Photographic Experts Group'
    },
    {
      name: 'PNG',
      extensions: ['.png'],
      mimeTypes: ['image/png'],
      category: 'image',
      canRead: true,
      canWrite: true,
      description: 'Portable Network Graphics'
    },
    {
      name: 'WebP',
      extensions: ['.webp'],
      mimeTypes: ['image/webp'],
      category: 'image',
      canRead: true,
      canWrite: true,
      description: 'Web Picture format'
    },
    {
      name: 'GIF',
      extensions: ['.gif'],
      mimeTypes: ['image/gif'],
      category: 'image',
      canRead: true,
      canWrite: true,
      description: 'Graphics Interchange Format'
    },
    {
      name: 'BMP',
      extensions: ['.bmp'],
      mimeTypes: ['image/bmp'],
      category: 'image',
      canRead: true,
      canWrite: true,
      description: 'Bitmap Image File'
    },
    {
      name: 'SVG',
      extensions: ['.svg'],
      mimeTypes: ['image/svg+xml'],
      category: 'image',
      canRead: true,
      canWrite: true,
      description: 'Scalable Vector Graphics'
    },
    {
      name: 'TIFF',
      extensions: ['.tiff', '.tif'],
      mimeTypes: ['image/tiff'],
      category: 'image',
      canRead: true,
      canWrite: false,
      description: 'Tagged Image File Format'
    },
    
    // Video formats
    {
      name: 'MP4',
      extensions: ['.mp4'],
      mimeTypes: ['video/mp4'],
      category: 'video',
      canRead: true,
      canWrite: true,
      description: 'MPEG-4 Part 14'
    },
    {
      name: 'WebM',
      extensions: ['.webm'],
      mimeTypes: ['video/webm'],
      category: 'video',
      canRead: true,
      canWrite: true,
      description: 'Web Media'
    },
    {
      name: 'MOV',
      extensions: ['.mov'],
      mimeTypes: ['video/quicktime'],
      category: 'video',
      canRead: true,
      canWrite: false,
      description: 'QuickTime Movie'
    },
    {
      name: 'AVI',
      extensions: ['.avi'],
      mimeTypes: ['video/x-msvideo'],
      category: 'video',
      canRead: true,
      canWrite: false,
      description: 'Audio Video Interleave'
    },
    
    // Audio formats
    {
      name: 'MP3',
      extensions: ['.mp3'],
      mimeTypes: ['audio/mpeg'],
      category: 'audio',
      canRead: true,
      canWrite: true,
      description: 'MPEG Audio Layer III'
    },
    {
      name: 'WAV',
      extensions: ['.wav'],
      mimeTypes: ['audio/wav'],
      category: 'audio',
      canRead: true,
      canWrite: true,
      description: 'Waveform Audio File Format'
    },
    {
      name: 'OGG',
      extensions: ['.ogg'],
      mimeTypes: ['audio/ogg'],
      category: 'audio',
      canRead: true,
      canWrite: true,
      description: 'Ogg Vorbis'
    },
    
    // Project formats
    {
      name: 'Olive Project',
      extensions: ['.olive'],
      mimeTypes: ['application/x-olive-project'],
      category: 'project',
      canRead: true,
      canWrite: true,
      description: 'Olive native project format'
    }
  ];

  static getSupportedFormats(category?: string): SupportedFormat[] {
    if (category) {
      return this.SUPPORTED_FORMATS.filter(format => format.category === category);
    }
    return [...this.SUPPORTED_FORMATS];
  }

  static getFormatByExtension(extension: string): SupportedFormat | null {
    const normalizedExt = extension.toLowerCase();
    return this.SUPPORTED_FORMATS.find(format => 
      format.extensions.includes(normalizedExt)
    ) || null;
  }

  static getFormatByMimeType(mimeType: string): SupportedFormat | null {
    return this.SUPPORTED_FORMATS.find(format => 
      format.mimeTypes.includes(mimeType)
    ) || null;
  }

  static canImport(file: File): boolean {
    const format = this.getFormatByMimeType(file.type) || 
                   this.getFormatByExtension(this.getFileExtension(file.name));
    return format ? format.canRead : false;
  }

  static canExport(format: string): boolean {
    const formatInfo = this.SUPPORTED_FORMATS.find(f => 
      f.name.toLowerCase() === format.toLowerCase() ||
      f.extensions.includes(format.toLowerCase())
    );
    return formatInfo ? formatInfo.canWrite : false;
  }

  static async importFile(
    file: File, 
    options: ImportOptions = {}
  ): Promise<{ data: any; metadata: any }> {
    const format = this.getFormatByMimeType(file.type) || 
                   this.getFormatByExtension(this.getFileExtension(file.name));
    
    if (!format || !format.canRead) {
      throw new Error(`Unsupported file format: ${file.type}`);
    }

    switch (format.category) {
      case 'image':
        return this.importImage(file, options);
      case 'video':
        return this.importVideo(file, options);
      case 'audio':
        return this.importAudio(file, options);
      case 'project':
        return this.importProject(file, options);
      default:
        throw new Error(`Unknown format category: ${format.category}`);
    }
  }

  private static async importImage(
    file: File, 
    options: ImportOptions
  ): Promise<{ data: HTMLImageElement; metadata: any }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        const metadata = {
          width: img.naturalWidth,
          height: img.naturalHeight,
          format: file.type,
          size: file.size,
          name: file.name
        };

        // Apply resize if specified
        if (options.resize) {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            canvas.width = options.resize.width;
            canvas.height = options.resize.height;
            ctx.drawImage(img, 0, 0, options.resize.width, options.resize.height);
            
            const resizedImg = new Image();
            resizedImg.onload = () => resolve({ data: resizedImg, metadata });
            resizedImg.src = canvas.toDataURL();
          } else {
            resolve({ data: img, metadata });
          }
        } else {
          resolve({ data: img, metadata });
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  private static async importVideo(
    file: File, 
    _options: ImportOptions
  ): Promise<{ data: HTMLVideoElement; metadata: any }> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      
      video.onloadedmetadata = () => {
        const metadata = {
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration,
          format: file.type,
          size: file.size,
          name: file.name
        };

        resolve({ data: video, metadata });
      };

      video.onerror = () => reject(new Error('Failed to load video'));
      video.src = URL.createObjectURL(file);
    });
  }

  private static async importAudio(
    file: File, 
    _options: ImportOptions
  ): Promise<{ data: AudioBuffer; metadata: any }> {
    const arrayBuffer = await file.arrayBuffer();
    
    // Use Web Audio API to decode
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    try {
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const metadata = {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        format: file.type,
        size: file.size,
        name: file.name
      };

      return { data: audioBuffer, metadata };
    } catch (error) {
      throw new Error('Failed to decode audio file');
    }
  }

  private static async importProject(
    file: File, 
    _options: ImportOptions
  ): Promise<{ data: any; metadata: any }> {
    const text = await file.text();
    
    try {
      const projectData = JSON.parse(text);
      
      const metadata = {
        version: projectData.version || '1.0',
        created: projectData.created,
        modified: projectData.modified,
        size: file.size,
        name: file.name
      };

      return { data: projectData, metadata };
    } catch (error) {
      throw new Error('Invalid project file format');
    }
  }

  static async exportImage(
    canvas: HTMLCanvasElement,
    options: ExportOptions
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const format = options.format.toLowerCase();
      const quality = options.quality / 100;

      let mimeType: string;
      switch (format) {
        case 'jpeg':
        case 'jpg':
          mimeType = 'image/jpeg';
          break;
        case 'png':
          mimeType = 'image/png';
          break;
        case 'webp':
          mimeType = 'image/webp';
          break;
        default:
          mimeType = 'image/png';
      }

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to export image'));
        }
      }, mimeType, quality);
    });
  }

  static async exportProject(
    projectData: any,
    options: ExportOptions
  ): Promise<Blob> {
    const exportData = {
      ...projectData,
      version: '1.0',
      exported: new Date().toISOString(),
      metadata: options.metadata || {}
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    return new Blob([jsonString], { type: 'application/json' });
  }

  static getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.substring(lastDot) : '';
  }

  static generateFileName(baseName: string, format: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = this.getExtensionForFormat(format);
    return `${baseName}_${timestamp}${extension}`;
  }

  private static getExtensionForFormat(format: string): string {
    const formatInfo = this.SUPPORTED_FORMATS.find(f => 
      f.name.toLowerCase() === format.toLowerCase()
    );
    return formatInfo ? formatInfo.extensions[0] : '.unknown';
  }

  static async downloadFile(blob: Blob, filename: string): Promise<void> {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  static createFileFilter(category?: string): string {
    const formats = category ? 
      this.getSupportedFormats(category) : 
      this.getSupportedFormats();

    const extensions = formats
      .filter(f => f.canRead)
      .flatMap(f => f.extensions)
      .join(',');

    return extensions;
  }

  static validateFile(file: File): { isValid: boolean; error?: string } {
    // Check file size (max 500MB for videos, 50MB for images)
    const maxSize = file.type.startsWith('video/') ? 500 * 1024 * 1024 : 50 * 1024 * 1024;
    
    if (file.size > maxSize) {
      return {
        isValid: false,
        error: `File too large. Maximum size is ${maxSize / (1024 * 1024)}MB`
      };
    }

    // Check if format is supported
    if (!this.canImport(file)) {
      return {
        isValid: false,
        error: `Unsupported file format: ${file.type || 'unknown'}`
      };
    }

    return { isValid: true };
  }

  static async extractMetadata(file: File): Promise<any> {
    const format = this.getFormatByMimeType(file.type);
    if (!format) return {};

    const baseMetadata = {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified)
    };

    try {
      if (format.category === 'image') {
        const { metadata } = await this.importImage(file, {});
        return { ...baseMetadata, ...metadata };
      } else if (format.category === 'video') {
        const { metadata } = await this.importVideo(file, {});
        return { ...baseMetadata, ...metadata };
      } else if (format.category === 'audio') {
        const { metadata } = await this.importAudio(file, {});
        return { ...baseMetadata, ...metadata };
      }
    } catch (error) {
      console.warn('Failed to extract metadata:', error);
    }

    return baseMetadata;
  }
}