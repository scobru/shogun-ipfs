import { StorageService } from "./base-storage";
import type { UploadOutput, PinataServiceConfig } from "../types";
import { PinataSDK } from "pinata-web3";
interface PinataOptions {
    pinataMetadata?: {
        name?: string;
        keyvalues?: Record<string, string | number | null>;
    };
}
export declare class PinataService extends StorageService {
    serviceBaseUrl: string;
    readonly serviceInstance: PinataSDK;
    private readonly gateway;
    private lastRequestTime;
    private rateLimitMs;
    constructor(config: PinataServiceConfig);
    private enforceRateLimit;
    get(hash: string): Promise<{
        data: any;
        metadata: any;
    }>;
    getEndpoint(): string;
    unpin(hash: string): Promise<boolean>;
    uploadJson(jsonData: Record<string, unknown>, options?: PinataOptions): Promise<UploadOutput>;
    uploadFile(path: string, options?: PinataOptions): Promise<UploadOutput>;
    getMetadata(hash: string): Promise<any>;
    isPinned(hash: string): Promise<boolean>;
}
export {};
