interface SseOptions {
  url: string;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
}

interface SseCallback {
  onMessage?: (data: any) => void;
  onError?: (error: Event) => void;
  onCustomEvent?: (event: MessageEvent) => void;
}

export class SseInstance {
  private url: string;
  private eventSource: EventSource | null = null;
  private reconnectDelay: number;
  private maxReconnectDelay: number;
  private isConnected: boolean = false;
  private callbacks: SseCallback = {};

  constructor(options: SseOptions) {
    this.url = options.url;
    this.reconnectDelay = options.reconnectDelay || 1000;
    this.maxReconnectDelay = options.maxReconnectDelay || 30000;
    this.connect();
  }

  private connect(): void {
    const token = localStorage.getItem('token');
    const url = `${this.url}?token=${token}`;

    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      this.isConnected = true;
      this.reconnectDelay = 1000;
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.callbacks.onMessage?.(data);
      } catch (error) {
        console.error('SSE message parse error:', error);
      }
    };

    this.eventSource.onerror = (event) => {
      this.isConnected = false;
      this.callbacks.onError?.(event);
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    setTimeout(() => {
      this.connect();
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }, this.reconnectDelay);
  }

  on(event: string, callback: (data: any) => void): void {
    if (this.eventSource) {
      this.eventSource.addEventListener(event, (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          callback(data);
        } catch (error) {
          console.error('SSE event parse error:', error);
        }
      });
    }
  }

  setCallbacks(callbacks: SseCallback): void {
    this.callbacks = callbacks;
  }

  close(): void {
    this.isConnected = false;
    this.eventSource?.close();
    this.eventSource = null;
  }

  get connected(): boolean {
    return this.isConnected;
  }
}

export function createSseInstance(url: string, options: Omit<SseOptions, 'url'> = {}): SseInstance {
  return new SseInstance({ url, ...options });
}

export default SseInstance;
