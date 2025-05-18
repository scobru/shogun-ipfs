import { StorageService } from "./base-storage";
import type { UploadOutput, IpfsServiceConfig } from "../types";
import { IPFSHTTPClient } from "ipfs-http-client";
export declare class IpfsService extends StorageService {
    serviceBaseUrl: string;
    readonly serviceInstance: IPFSHTTPClient;
    private readonly gateway;
    private lastRequestTime;
    private rateLimitMs;
    private apiKey;
    constructor(config: IpfsServiceConfig);
    private enforceRateLimit;
    getEndpoint(): string;
    get(hash: string): Promise<{
        data: any;
        metadata: any;
    }>;
    uploadJson(jsonData: Record<string, unknown>): Promise<UploadOutput>;
    /**
     * Carica un file su IPFS
     * @param filePath - Percorso del file da caricare
     * @param options - Opzioni aggiuntive (nome, metadati, ecc.)
     * @returns UploadOutput con l'ID del file caricato e i metadati
     */
    uploadFile(filePath: string): Promise<UploadOutput>;
    getMetadata(hash: string): Promise<any>;
    isPinned(hash: string): Promise<boolean>;
    unpin(hash: string): Promise<boolean>;
    pin(hash: string): Promise<boolean>;
}
