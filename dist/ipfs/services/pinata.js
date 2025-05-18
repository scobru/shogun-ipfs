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
    async get(hash) {
        try {
            if (!hash || typeof hash !== "string") {
                throw new Error("Invalid hash");
            }
            await this.enforceRateLimit();
            const response = await this.serviceInstance.gateways.get(hash);
            if (!response || typeof response !== "object") {
                throw new Error("Invalid response from Pinata");
            }
            // If the response is a JSON string, try to parse it
            let parsedResponse = response;
            if (typeof response === "string") {
                try {
                    parsedResponse = JSON.parse(response);
                }
                catch (e) {
                    throw new Error("Invalid data received from Pinata");
                }
            }
            // Verify that the response has the correct structure
            const responseData = parsedResponse;
            if (!responseData.data?.data) {
                throw new Error("Invalid data structure in backup");
            }
            // Extract data from the nested structure
            const resultData = {
                data: responseData.data.data,
                metadata: responseData.data.metadata || {
                    timestamp: Date.now(),
                    type: "json",
                },
            };
            // Verify that file data has the correct structure
            const fileData = resultData.data;
            for (const [path, data] of Object.entries(fileData)) {
                if (typeof data !== "object" || data === null) {
                    throw new Error(`Invalid data for file ${path}: data must be an object`);
                }
                // If data is encrypted, it has a different structure
                if (data.iv && data.mimeType) {
                    data.type = data.mimeType;
                    data.content = data;
                    continue;
                }
                if (!data.type) {
                    throw new Error(`Invalid data for file ${path}: missing 'type' field`);
                }
                if (!data.content) {
                    throw new Error(`Invalid data for file ${path}: missing 'content' field`);
                }
            }
            return resultData;
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
    async uploadFile(path, options) {
        try {
            const fileContent = await fs_1.default.promises.readFile(path);
            const fileName = path.split("/").pop() || "file";
            const file = new File([fileContent], fileName, { type: "application/octet-stream" });
            await this.enforceRateLimit();
            const response = await this.serviceInstance.upload.file(file, {
                metadata: options?.pinataMetadata,
            });
            return {
                id: response.IpfsHash,
                metadata: {
                    timestamp: Date.now(),
                    type: "file",
                    ...response,
                },
            };
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
