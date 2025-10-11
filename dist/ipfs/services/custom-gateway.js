"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomGatewayService = void 0;
const base_storage_1 = require("./base-storage");
const logger_1 = require("../../utils/logger");
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
/**
 * Custom Gateway Service for IPFS
 * Supports any IPFS-compatible API endpoint (e.g., Shogun Relay)
 */
class CustomGatewayService extends base_storage_1.StorageService {
    constructor(config) {
        super();
        this.serviceInstance = null;
        this.lastRequestTime = 0;
        this.rateLimitMs = 100; // 10 requests per second
        if (!config.url) {
            throw new Error("Invalid or missing Custom Gateway URL");
        }
        // Remove trailing slashes
        this.serviceBaseUrl = config.url.replace(/\/+$/, '');
        this.token = config.token;
    }
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
        return this.serviceBaseUrl;
    }
    /**
     * Upload a Buffer to the custom gateway
     */
    async uploadBuffer(buffer, options) {
        await this.enforceRateLimit();
        const FormData = require("form-data");
        const { URL } = require('url');
        const filename = options?.filename || "file.bin";
        const formData = new FormData();
        formData.append("file", buffer, {
            filename: filename,
            contentType: "application/octet-stream"
        });
        // Try multiple endpoints in order
        const endpoints = ['/upload', '/api/v0/add', '/add'];
        for (const endpoint of endpoints) {
            try {
                const url = `${this.serviceBaseUrl}${endpoint}`;
                const parsedUrl = new URL(url);
                const protocol = parsedUrl.protocol === 'https:' ? https_1.default : http_1.default;
                const options = {
                    hostname: parsedUrl.hostname,
                    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                    path: parsedUrl.pathname + parsedUrl.search,
                    method: 'POST',
                    headers: {
                        ...formData.getHeaders(),
                    }
                };
                if (this.token) {
                    options.headers['Authorization'] = `Bearer ${this.token}`;
                    options.headers['token'] = this.token;
                }
                const result = await new Promise((resolve, reject) => {
                    const request = protocol.request(options, (response) => {
                        let data = '';
                        response.on('data', (chunk) => data += chunk);
                        response.on('end', () => {
                            if (response.statusCode === 200 || response.statusCode === 201) {
                                try {
                                    const json = JSON.parse(data);
                                    const hash = json.hash || json.Hash || json.cid || json.IpfsHash || json.file?.hash;
                                    if (hash) {
                                        resolve({
                                            id: hash,
                                            metadata: {
                                                timestamp: Date.now(),
                                                size: buffer.length,
                                                type: "buffer",
                                            }
                                        });
                                    }
                                    else {
                                        reject(new Error(`No hash in response: ${data.substring(0, 200)}`));
                                    }
                                }
                                catch (e) {
                                    reject(new Error(`Invalid JSON response: ${data.substring(0, 200)}`));
                                }
                            }
                            else {
                                reject(new Error(`Upload failed (${response.statusCode}): ${data.substring(0, 200)}`));
                            }
                        });
                    });
                    request.on('error', reject);
                    formData.pipe(request);
                });
                logger_1.logger.info(`Upload successful via ${endpoint}`);
                return result;
            }
            catch (error) {
                logger_1.logger.warn(`${endpoint} failed, trying next...`);
                if (endpoint === endpoints[endpoints.length - 1]) {
                    throw error; // Last endpoint, re-throw
                }
            }
        }
        throw new Error('All upload endpoints failed');
    }
    /**
     * Upload a file from filesystem
     */
    async uploadFile(filePath, options) {
        const fs = require('fs');
        const buffer = await fs.promises.readFile(filePath);
        return this.uploadBuffer(buffer, { ...options, filename: filePath.split('/').pop() });
    }
    /**
     * Upload JSON data
     */
    async uploadJson(jsonData, options) {
        const buffer = Buffer.from(JSON.stringify(jsonData));
        return this.uploadBuffer(buffer, { ...options, filename: 'data.json' });
    }
    /**
     * Download data from the custom gateway
     */
    async get(hash) {
        await this.enforceRateLimit();
        const { URL } = require('url');
        // Try multiple endpoints
        const endpoints = [
            `/content/${hash}`,
            `/ipfs/${hash}`,
            `/api/v0/cat?arg=${hash}`
        ];
        for (const endpoint of endpoints) {
            try {
                const url = `${this.serviceBaseUrl}${endpoint}`;
                const parsedUrl = new URL(url);
                const protocol = parsedUrl.protocol === 'https:' ? https_1.default : http_1.default;
                const options = {
                    hostname: parsedUrl.hostname,
                    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                    path: parsedUrl.pathname + parsedUrl.search,
                    method: endpoint.includes('api/v0') ? 'POST' : 'GET',
                    headers: {}
                };
                if (this.token) {
                    options.headers['Authorization'] = `Bearer ${this.token}`;
                    options.headers['token'] = this.token;
                }
                const data = await new Promise((resolve, reject) => {
                    const request = protocol.request(options, (response) => {
                        let data = '';
                        response.on('data', (chunk) => data += chunk);
                        response.on('end', () => {
                            if (response.statusCode === 200) {
                                resolve(data);
                            }
                            else {
                                reject(new Error(`Download failed (${response.statusCode})`));
                            }
                        });
                    });
                    request.on('error', reject);
                    request.end();
                });
                logger_1.logger.info(`Download successful via ${endpoint}`);
                // Try to parse as JSON
                try {
                    const parsed = JSON.parse(data);
                    return {
                        data: parsed,
                        metadata: {
                            timestamp: Date.now(),
                            type: "json"
                        }
                    };
                }
                catch {
                    // Return as raw data
                    return {
                        data: data,
                        metadata: {
                            timestamp: Date.now(),
                            type: "raw"
                        }
                    };
                }
            }
            catch (error) {
                logger_1.logger.warn(`${endpoint} failed, trying next...`);
                if (endpoint === endpoints[endpoints.length - 1]) {
                    throw error; // Last endpoint, re-throw
                }
            }
        }
        throw new Error('All download endpoints failed');
    }
    /**
     * Unpin a hash from the custom gateway
     */
    async unpin(hash) {
        await this.enforceRateLimit();
        const { URL } = require('url');
        // Try relay unpin endpoint
        try {
            const url = `${this.serviceBaseUrl}/pins/rm`;
            const parsedUrl = new URL(url);
            const protocol = parsedUrl.protocol === 'https:' ? https_1.default : http_1.default;
            const postData = JSON.stringify({ cid: hash });
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                path: parsedUrl.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };
            if (this.token) {
                options.headers['Authorization'] = `Bearer ${this.token}`;
                options.headers['token'] = this.token;
            }
            const success = await new Promise((resolve, reject) => {
                const request = protocol.request(options, (response) => {
                    let data = '';
                    response.on('data', (chunk) => data += chunk);
                    response.on('end', () => {
                        if (response.statusCode === 200) {
                            resolve(true);
                        }
                        else {
                            resolve(false);
                        }
                    });
                });
                request.on('error', () => resolve(false));
                request.write(postData);
                request.end();
            });
            return success;
        }
        catch (error) {
            logger_1.logger.warn(`Unpin failed for ${hash}`, error instanceof Error ? error : new Error(String(error)));
            return false;
        }
    }
    /**
     * Get metadata for a hash
     */
    async getMetadata(hash) {
        // Most custom gateways don't provide separate metadata endpoints
        // Return basic info
        return {
            hash,
            timestamp: Date.now(),
            type: "unknown"
        };
    }
    /**
     * Check if a hash is accessible (pinned)
     */
    async isPinned(hash) {
        try {
            await this.get(hash);
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.CustomGatewayService = CustomGatewayService;
