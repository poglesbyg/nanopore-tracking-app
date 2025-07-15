/**
 * PDF.js Worker Configuration Utility
 * Handles multiple fallback strategies for loading PDF.js workers
 */

export interface WorkerConfig {
  workerSrc: string
  method: 'local' | 'cdn' | 'bundled'
  secure: boolean
}

export class PdfWorkerManager {
  private static instance: PdfWorkerManager
  private workerConfig: WorkerConfig | null = null
  private fallbackUrls: string[] = []

  private constructor() {
    // Initialize fallback URLs in order of preference
    this.fallbackUrls = [
      // Local bundled version (most secure)
      '/pdf.worker.min.js',
      // Local node_modules version
      '/node_modules/pdfjs-dist/build/pdf.worker.min.js',
      // CDN fallbacks (less secure but more reliable)
      'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
    ]
  }

  static getInstance(): PdfWorkerManager {
    if (!PdfWorkerManager.instance) {
      PdfWorkerManager.instance = new PdfWorkerManager()
    }
    return PdfWorkerManager.instance
  }

  /**
   * Configure PDF.js worker with intelligent fallback
   */
  async configureWorker(pdfjs: any, version?: string): Promise<WorkerConfig> {
    if (this.workerConfig) {
      return this.workerConfig
    }

    // Try local import method first (most secure)
    try {
      const workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.js',
        import.meta.url
      ).toString()
      
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
      this.workerConfig = {
        workerSrc,
        method: 'local',
        secure: true
      }
      console.log('PDF.js worker configured with local import')
      return this.workerConfig
    } catch (error) {
      console.warn('Local import method failed:', error)
    }

    // Try static files approach
    for (const url of this.fallbackUrls) {
      try {
        const finalUrl = version && url.includes('pdfjs-dist@') 
          ? url.replace('3.11.174', version)
          : url

        // Test if the worker file is accessible
        const response = await fetch(finalUrl, { method: 'HEAD' })
        if (response.ok) {
          pdfjs.GlobalWorkerOptions.workerSrc = finalUrl
          this.workerConfig = {
            workerSrc: finalUrl,
            method: finalUrl.startsWith('http') ? 'cdn' : 'bundled',
            secure: !finalUrl.startsWith('http') || finalUrl.startsWith('https')
          }
          console.log(`PDF.js worker configured with: ${finalUrl}`)
          return this.workerConfig
        }
      } catch (error) {
        console.warn(`Failed to load worker from ${url}:`, error)
      }
    }

    // Last resort: try versioned CDN
    if (version) {
      const fallbackUrl = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.js`
      try {
        pdfjs.GlobalWorkerOptions.workerSrc = fallbackUrl
        this.workerConfig = {
          workerSrc: fallbackUrl,
          method: 'cdn',
          secure: true
        }
        console.log(`PDF.js worker configured with versioned CDN: ${fallbackUrl}`)
        return this.workerConfig
      } catch (error) {
        console.error('All worker loading methods failed:', error)
      }
    }

    throw new Error('Unable to configure PDF.js worker with any available method')
  }

  /**
   * Get current worker configuration
   */
  getWorkerConfig(): WorkerConfig | null {
    return this.workerConfig
  }

  /**
   * Reset worker configuration (for testing)
   */
  resetConfig(): void {
    this.workerConfig = null
  }

  /**
   * Check if worker is configured securely
   */
  isSecure(): boolean {
    return this.workerConfig?.secure ?? false
  }

  /**
   * Get worker loading method
   */
  getMethod(): string {
    return this.workerConfig?.method ?? 'none'
  }

  /**
   * Add custom fallback URLs
   */
  addFallbackUrl(url: string, priority: number = this.fallbackUrls.length): void {
    this.fallbackUrls.splice(priority, 0, url)
  }

  /**
   * Validate worker configuration
   */
  async validateWorker(): Promise<boolean> {
    if (!this.workerConfig) {
      return false
    }

    try {
      const response = await fetch(this.workerConfig.workerSrc, { method: 'HEAD' })
      return response.ok
    } catch (error) {
      console.error('Worker validation failed:', error)
      return false
    }
  }
}

// Export singleton instance
export const pdfWorkerManager = PdfWorkerManager.getInstance()

// Export convenience function
export async function configurePdfWorker(pdfjs: any, version?: string): Promise<WorkerConfig> {
  return pdfWorkerManager.configureWorker(pdfjs, version)
} 