import type { UploadOutput } from "../types";
import { EventEmitter } from "events";

export abstract class StorageService extends EventEmitter {
  abstract readonly serviceBaseUrl: string;
  abstract readonly serviceInstance: any;
  
  // Core methods for storage operations
  abstract uploadJson(jsonData: Record<string, unknown>, options?: any): Promise<UploadOutput>;
  abstract uploadFile(filePath: string, options?: any): Promise<UploadOutput>;
  abstract unpin(hash: string): Promise<boolean>;
  abstract get(hash: string): Promise<{ data: any; metadata: any }>;
  abstract getMetadata(hash: string): Promise<any>;
  abstract isPinned(hash: string): Promise<boolean>;
  
  // Helper method that can be useful for creating endpoints
  getEndpoint?(): string;
}
