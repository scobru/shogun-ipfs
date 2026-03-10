import { StorageService } from "./base-storage";
import type { UploadOutput, CustomGatewayConfig } from "../types";
/**
 * Custom Gateway Service for IPFS
 * Supports any IPFS-compatible API endpoint (e.g., Shogun Relay)
 */
export declare class CustomGatewayService extends StorageService {
    serviceBaseUrl: string;
    readonly serviceInstance: null;
    private readonly token?;
    private lastRequestTime;
    private rateLimitMs;
    constructor(config: CustomGatewayConfig);
    private enforceRateLimit;
    getEndpoint(): string;
    /**
     * Upload a Buffer to the custom gateway
     */
    uploadBuffer(buffer: Buffer, options?: any): Promise<UploadOutput>;
    /**
     * Upload a file from filesystem
     */
    uploadFile(filePath: string, options?: any): Promise<UploadOutput>;
    /**
     * Upload JSON data
     */
    uploadJson(jsonData: Record<string, unknown>, options?: any): Promise<UploadOutput>;
    /**
     * Download raw data from the custom gateway
     */
    getRaw(hash: string): Promise<Buffer>;
    /**
     * Download JSON data from the custom gateway
     */
    getJson<T>(hash: string): Promise<T>;
    /**
     * Download data from the custom gateway (legacy wrapper)
     */
    get(hash: string): Promise<{
        data: any;
        metadata: any;
    }>;
    /**
     * Unpin a hash from the custom gateway
     */
    unpin(hash: string): Promise<boolean>;
    /**
     * Get metadata for a hash
     */
    getMetadata(hash: string): Promise<any>;
    /**
     * Check if a hash is accessible (pinned)
     */
    isPinned(hash: string): Promise<boolean>;
}
