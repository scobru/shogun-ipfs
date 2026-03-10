"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpfsService = void 0;
const base_storage_1 = require("./base-storage");
const ipfs_http_client_1 = require("ipfs-http-client");
const logger_1 = require("../../utils/logger");
const fs_1 = __importDefault(require("fs"));
class IpfsService extends base_storage_1.StorageService {
    constructor(config) {
        super();
        this.serviceBaseUrl = "ipfs://";
        this.lastRequestTime = 0;
        this.rateLimitMs = 200; // 5 requests per second maximum
        if (!config.url) {
            throw new Error("Invalid or missing IPFS URL");
        }
        this.serviceInstance = (0, ipfs_http_client_1.create)({ url: config.url });
        this.gateway = config.url;
        this.apiKey = config.apiKey || "";
    }
    // Rate limiting utility for IPFS API calls
    async enforceRateLimit() {
        const now = Date.now();
        const elapsed = now - this.lastRequestTime;
        if (elapsed < this.rateLimitMs) {
            const delay = this.rateLimitMs - elapsed;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        this.lastRequestTime = Date.now();
    }
    getEndpoint() {
        return this.gateway;
    }
    async getRaw(hash) {
        try {
            if (!hash || typeof hash !== "string") {
                throw new Error("Invalid hash");
            }
            await this.enforceRateLimit();
            const chunks = [];
            for await (const chunk of this.serviceInstance.cat(hash)) {
                chunks.push(chunk);
            }
            return Buffer.concat(chunks);
        }
        catch (error) {
            logger_1.logger.error(`Failed to retrieve raw data for CID ${hash}`, error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    async getJson(hash) {
        const data = await this.getRaw(hash);
        try {
            return JSON.parse(data.toString());
        }
        catch (e) {
            throw new Error(`Failed to parse JSON for CID ${hash}: ${e instanceof Error ? e.message : 'Invalid JSON'}`);
        }
    }
    async get(hash) {
        try {
            const data = await this.getRaw(hash);
            const str = data.toString();
            try {
                const parsedData = JSON.parse(str);
                return parsedData;
            }
            catch (e) {
                // Backward compatibility: if it's not JSON, return the raw data and basic metadata
                logger_1.logger.warn(`Data for CID ${hash} is not JSON, returning raw buffer`);
                return {
                    data: data,
                    metadata: {
                        timestamp: Date.now(),
                        type: "raw",
                        size: data.length
                    }
                };
            }
        }
        catch (error) {
            logger_1.logger.error(`Failed to retrieve data for CID ${hash}`, error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    async uploadJson(jsonData) {
        try {
            const content = JSON.stringify(jsonData);
            const buffer = Buffer.from(content);
            await this.enforceRateLimit();
            const result = await this.serviceInstance.add(buffer);
            return {
                id: result.cid.toString(),
                metadata: {
                    timestamp: Date.now(),
                    size: buffer.length,
                    type: "json",
                },
            };
        }
        catch (error) {
            logger_1.logger.error("JSON upload failed", error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    /**
     * Upload a Buffer to IPFS
     */
    async uploadBuffer(buffer, options) {
        try {
            await this.enforceRateLimit();
            const result = await this.serviceInstance.add(buffer);
            return {
                id: result.cid.toString(),
                metadata: {
                    timestamp: Date.now(),
                    size: buffer.length,
                    type: "buffer",
                },
            };
        }
        catch (error) {
            logger_1.logger.error('Buffer upload failed', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    /**
     * Carica un file su IPFS
     * @param filePath - Percorso del file da caricare
     * @param options - Opzioni aggiuntive (nome, metadati, ecc.)
     * @returns UploadOutput con l'ID del file caricato e i metadati
     */
    async uploadFile(filePath) {
        try {
            const content = await fs_1.default.promises.readFile(filePath);
            return this.uploadBuffer(content, { filename: filePath.split('/').pop() });
        }
        catch (error) {
            logger_1.logger.error(`File upload failed for ${filePath}`, error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    async getMetadata(hash) {
        try {
            if (!hash || typeof hash !== "string") {
                throw new Error("Invalid hash");
            }
            await this.enforceRateLimit();
            const stat = await this.serviceInstance.files.stat(`/ipfs/${hash}`);
            return {
                size: stat.size,
                cumulativeSize: stat.cumulativeSize,
                blocks: stat.blocks,
                type: stat.type,
            };
        }
        catch (error) {
            logger_1.logger.error(`Failed to fetch metadata for ${hash}`, error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    async isPinned(hash) {
        try {
            if (!hash || typeof hash !== "string") {
                return false;
            }
            await this.enforceRateLimit();
            const pins = await this.serviceInstance.pin.ls({ paths: [hash] });
            for await (const pin of pins) {
                if (pin.cid.toString() === hash) {
                    return true;
                }
            }
            return false;
        }
        catch (error) {
            logger_1.logger.warn(`isPinned check failed for ${hash}`, error instanceof Error ? error : new Error(String(error)));
            return false;
        }
    }
    async unpin(hash) {
        try {
            if (!hash || typeof hash !== "string") {
                return false;
            }
            const isPinnedBefore = await this.isPinned(hash);
            if (!isPinnedBefore) {
                return false;
            }
            await this.enforceRateLimit();
            await this.serviceInstance.pin.rm(hash);
            return true;
        }
        catch (error) {
            logger_1.logger.error(`Failed to unpin ${hash}`, error instanceof Error ? error : new Error(String(error)));
            return false;
        }
    }
    async pin(hash) {
        try {
            if (!hash || typeof hash !== "string") {
                return false;
            }
            await this.enforceRateLimit();
            const pinned = await this.serviceInstance.pin.add(hash, {
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`
                }
            });
            console.log(pinned);
            return true;
        }
        catch (error) {
            logger_1.logger.error(`Failed to pin ${hash}`, error instanceof Error ? error : new Error(String(error)));
            return false;
        }
    }
}
exports.IpfsService = IpfsService;
