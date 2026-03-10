"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PinataService = void 0;
const base_storage_1 = require("./base-storage");
const pinata_web3_1 = require("pinata-web3");
const fs_1 = __importDefault(require("fs"));
const logger_1 = require("../../utils/logger");
// CID validation - More permissive pattern for various IPFS CID formats
// Supports both v0 (base58) and v1 (base32) CIDs
const CID_PATTERN = /^(Qm[1-9A-HJ-NP-Za-km-z]{44,}|b[a-zA-Z0-9]{58,})/;
class PinataService extends base_storage_1.StorageService {
    constructor(config) {
        super();
        this.serviceBaseUrl = "ipfs://";
        this.lastRequestTime = 0;
        this.rateLimitMs = 500; // 500ms between requests (2 requests per second)
        if (!config.pinataJwt) {
            throw new Error("Invalid or missing Pinata JWT token");
        }
        this.serviceInstance = new pinata_web3_1.PinataSDK({
            pinataJwt: config.pinataJwt,
            pinataGateway: config.pinataGateway || "gateway.pinata.cloud",
        });
        this.gateway = config.pinataGateway || "gateway.pinata.cloud";
    }
    // Rate limiting utility for Pinata API calls
    async enforceRateLimit() {
        const now = Date.now();
        const elapsed = now - this.lastRequestTime;
        if (elapsed < this.rateLimitMs) {
            const delay = this.rateLimitMs - elapsed;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        this.lastRequestTime = Date.now();
    }
    async getRaw(hash) {
        try {
            if (!hash || typeof hash !== "string") {
                throw new Error("Invalid hash");
            }
            await this.enforceRateLimit();
            const response = await this.serviceInstance.gateways.get(hash);
            if (!response) {
                throw new Error("No response from Pinata");
            }
            // Pinata gateways.get can return different things depending on the response headers
            // If it's already a Buffer or Uint8Array, we're good
            if (Buffer.isBuffer(response))
                return response;
            if (response instanceof Uint8Array)
                return Buffer.from(response);
            // If it's a string, convert to Buffer
            if (typeof response === 'string')
                return Buffer.from(response);
            // If it's an object (likely already parsed JSON), stringify it back to buffer
            if (typeof response === 'object')
                return Buffer.from(JSON.stringify(response));
            throw new Error(`Unsupported response type from Pinata: ${typeof response}`);
        }
        catch (error) {
            logger_1.logger.error("Failed to fetch raw data from Pinata", error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    async getJson(hash) {
        const buffer = await this.getRaw(hash);
        try {
            return JSON.parse(buffer.toString());
        }
        catch (e) {
            throw new Error(`Failed to parse JSON for CID ${hash}: ${e instanceof Error ? e.message : 'Invalid JSON'}`);
        }
    }
    async get(hash) {
        try {
            const buffer = await this.getRaw(hash);
            const str = buffer.toString();
            let parsed;
            try {
                parsed = JSON.parse(str);
            }
            catch (e) {
                // Not JSON, return as raw
                return {
                    data: buffer,
                    metadata: {
                        timestamp: Date.now(),
                        type: "raw",
                        size: buffer.length
                    }
                };
            }
            // Check for legacy nested structure: { data: { data: ..., metadata: ... } }
            if (parsed && typeof parsed === 'object' && parsed.data && parsed.data.data) {
                const legacyData = parsed;
                return {
                    data: legacyData.data.data,
                    metadata: legacyData.data.metadata || {
                        timestamp: Date.now(),
                        type: "json"
                    }
                };
            }
            // Standard JSON response
            return {
                data: parsed,
                metadata: {
                    timestamp: Date.now(),
                    type: "json",
                    size: buffer.length
                }
            };
        }
        catch (error) {
            logger_1.logger.error("Failed to fetch data from Pinata", error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    getEndpoint() {
        return `https://${this.gateway}/ipfs/`;
    }
    async unpin(hash) {
        try {
            if (!hash || typeof hash !== "string" || !CID_PATTERN.test(hash)) {
                logger_1.logger.warn(`Invalid CID format: ${hash}`);
                return false;
            }
            const isPinnedBefore = await this.isPinned(hash);
            if (!isPinnedBefore) {
                logger_1.logger.info(`CID not pinned, nothing to unpin: ${hash}`);
                return false;
            }
            await this.enforceRateLimit();
            await this.serviceInstance.unpin([hash]);
            return true;
        }
        catch (error) {
            if (error instanceof Error) {
                if (error.message.includes("is not pinned") ||
                    error.message.includes("NOT_FOUND") ||
                    error.message.includes("url does not contain CID")) {
                    logger_1.logger.warn(`Pin not found: ${hash}`, error);
                    return false;
                }
                if (error.message.includes("INVALID_CREDENTIALS")) {
                    const authError = new Error("Authentication error with Pinata: verify your JWT token");
                    logger_1.logger.error("Authentication error", authError);
                    throw authError;
                }
            }
            logger_1.logger.error(`Unpin operation failed for ${hash}`, error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    async uploadJson(jsonData, options) {
        try {
            const content = JSON.stringify(jsonData);
            await this.enforceRateLimit();
            const response = await this.serviceInstance.upload.json(jsonData, {
                metadata: options?.pinataMetadata,
            });
            return {
                id: response.IpfsHash,
                metadata: {
                    timestamp: Date.now(),
                    size: content.length,
                    type: "json",
                    ...response,
                },
            };
        }
        catch (error) {
            if (error instanceof Error && error.message.includes("INVALID_CREDENTIALS")) {
                const authError = new Error("Authentication error with Pinata: verify your JWT token");
                logger_1.logger.error("Authentication error", authError);
                throw authError;
            }
            logger_1.logger.error("JSON upload failed", error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    async uploadBuffer(buffer, options) {
        try {
            const fileName = options?.filename || "file.bin";
            // Convert Buffer to Uint8Array to satisfy File constructor types (avoids SharedArrayBuffer issue)
            const uint8Array = new Uint8Array(buffer);
            const file = new File([uint8Array], fileName, { type: "application/octet-stream" });
            await this.enforceRateLimit();
            const response = await this.serviceInstance.upload.file(file, {
                metadata: options?.pinataMetadata,
            });
            return {
                id: response.IpfsHash,
                metadata: {
                    timestamp: Date.now(),
                    size: buffer.length,
                    type: "buffer",
                    ...response,
                },
            };
        }
        catch (error) {
            logger_1.logger.error('Buffer upload failed', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    async uploadFile(path, options) {
        try {
            const fileContent = await fs_1.default.promises.readFile(path);
            const fileName = path.split("/").pop() || "file";
            return this.uploadBuffer(fileContent, { ...options, filename: fileName });
        }
        catch (error) {
            logger_1.logger.error(`File upload failed for ${path}`, error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    async getMetadata(hash) {
        try {
            if (!hash || typeof hash !== "string") {
                throw new Error("Invalid hash");
            }
            await this.enforceRateLimit();
            const response = await this.serviceInstance.gateways.get(hash);
            return response;
        }
        catch (error) {
            logger_1.logger.error(`Failed to fetch metadata for ${hash}`, error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    async isPinned(hash) {
        try {
            if (!hash || typeof hash !== "string" || !CID_PATTERN.test(hash)) {
                logger_1.logger.warn(`Invalid CID format: ${hash}`);
                return false;
            }
            try {
                await this.enforceRateLimit();
                const response = await this.serviceInstance.gateways.get(hash);
                return !!response;
            }
            catch (error) {
                if (error instanceof Error &&
                    (error.message.includes("NOT_FOUND") || error.message.includes("url does not contain CID"))) {
                    return false;
                }
                throw error;
            }
        }
        catch (error) {
            if (error instanceof Error && error.message.includes("INVALID_CREDENTIALS")) {
                const authError = new Error("Authentication error with Pinata: verify your JWT token");
                logger_1.logger.error("Authentication error", authError);
                throw authError;
            }
            logger_1.logger.warn(`isPinned check failed for ${hash}`, error);
            return false;
        }
    }
}
exports.PinataService = PinataService;
