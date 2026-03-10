import { StorageService } from "./base-storage";
import type { UploadOutput, CustomGatewayConfig } from "../types";
import { logger } from "../../utils/logger";
import http from "http";
import https from "https";

/**
 * Custom Gateway Service for IPFS
 * Supports any IPFS-compatible API endpoint (e.g., Shogun Relay)
 */
export class CustomGatewayService extends StorageService {
  public serviceBaseUrl: string;
  public readonly serviceInstance: null = null;
  private readonly token?: string;
  private lastRequestTime = 0;
  private rateLimitMs = 100; // 10 requests per second

  constructor(config: CustomGatewayConfig) {
    super();

    if (!config.url) {
      throw new Error("Invalid or missing Custom Gateway URL");
    }

    // Remove trailing slashes
    this.serviceBaseUrl = config.url.replace(/\/+$/, '');
    this.token = config.token;
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.rateLimitMs) {
      const delay = this.rateLimitMs - elapsed;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  public getEndpoint(): string {
    return this.serviceBaseUrl;
  }

  /**
   * Upload a Buffer to the custom gateway
   */
  public async uploadBuffer(buffer: Buffer, options?: any): Promise<UploadOutput> {
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
        const protocol = parsedUrl.protocol === 'https:' ? https : http;

        const options: any = {
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

        const result = await new Promise<UploadOutput>((resolve, reject) => {
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
                  } else {
                    reject(new Error(`No hash in response: ${data.substring(0, 200)}`));
                  }
                } catch (e) {
                  reject(new Error(`Invalid JSON response: ${data.substring(0, 200)}`));
                }
              } else {
                reject(new Error(`Upload failed (${response.statusCode}): ${data.substring(0, 200)}`));
              }
            });
          });

          request.on('error', reject);
          formData.pipe(request);
        });

        logger.info(`Upload successful via ${endpoint}`);
        return result;

      } catch (error) {
        logger.warn(`${endpoint} failed, trying next...`);
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
  public async uploadFile(filePath: string, options?: any): Promise<UploadOutput> {
    const fs = require('fs');
    const buffer = await fs.promises.readFile(filePath);
    return this.uploadBuffer(buffer, { ...options, filename: filePath.split('/').pop() });
  }

  /**
   * Upload JSON data
   */
  public async uploadJson(jsonData: Record<string, unknown>, options?: any): Promise<UploadOutput> {
    const buffer = Buffer.from(JSON.stringify(jsonData));
    return this.uploadBuffer(buffer, { ...options, filename: 'data.json' });
  }

  /**
   * Download raw data from the custom gateway
   */
  public async getRaw(hash: string): Promise<Buffer> {
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
        const protocol = parsedUrl.protocol === 'https:' ? https : http;

        const options: any = {
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

        const buffer = await new Promise<Buffer>((resolve, reject) => {
          const request = protocol.request(options, (response) => {
            const chunks: Buffer[] = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => {
              if (response.statusCode === 200) {
                resolve(Buffer.concat(chunks));
              } else {
                reject(new Error(`Download failed (${response.statusCode})`));
              }
            });
          });

          request.on('error', reject);
          request.end();
        });

        logger.info(`Download successful via ${endpoint}`);
        return buffer;

      } catch (error) {
        logger.warn(`${endpoint} failed, trying next...`);
        if (endpoint === endpoints[endpoints.length - 1]) {
          throw error; // Last endpoint, re-throw
        }
      }
    }

    throw new Error('All download endpoints failed');
  }

  /**
   * Download JSON data from the custom gateway
   */
  public async getJson<T>(hash: string): Promise<T> {
    const buffer = await this.getRaw(hash);
    try {
      return JSON.parse(buffer.toString()) as T;
    } catch (e) {
      throw new Error(`Failed to parse JSON for CID ${hash}: ${e instanceof Error ? e.message : 'Invalid JSON'}`);
    }
  }

  /**
   * Download data from the custom gateway (legacy wrapper)
   */
  public async get(hash: string): Promise<{ data: any; metadata: any }> {
    try {
      const buffer = await this.getRaw(hash);
      const str = buffer.toString();

      try {
        const parsed = JSON.parse(str);
        return {
          data: parsed,
          metadata: {
            timestamp: Date.now(),
            type: "json"
          }
        };
      } catch {
        // Return as raw data
        return {
          data: buffer,
          metadata: {
            timestamp: Date.now(),
            type: "raw"
          }
        };
      }
    } catch (error) {
      logger.error(`Failed to retrieve data for CID ${hash}`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Unpin a hash from the custom gateway
   */
  public async unpin(hash: string): Promise<boolean> {
    await this.enforceRateLimit();

    const { URL } = require('url');

    // Try relay unpin endpoint
    try {
      const url = `${this.serviceBaseUrl}/pins/rm`;
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const postData = JSON.stringify({ cid: hash });

      const options: any = {
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

      const success = await new Promise<boolean>((resolve, reject) => {
        const request = protocol.request(options, (response) => {
          let data = '';
          response.on('data', (chunk) => data += chunk);
          response.on('end', () => {
            if (response.statusCode === 200) {
              resolve(true);
            } else {
              resolve(false);
            }
          });
        });

        request.on('error', () => resolve(false));
        request.write(postData);
        request.end();
      });

      return success;
    } catch (error) {
      logger.warn(`Unpin failed for ${hash}`, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Get metadata for a hash
   */
  public async getMetadata(hash: string): Promise<any> {
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
  public async isPinned(hash: string): Promise<boolean> {
    try {
      await this.get(hash);
      return true;
    } catch {
      return false;
    }
  }
}

