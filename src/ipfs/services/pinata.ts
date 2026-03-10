import { StorageService } from "./base-storage";
import type { UploadOutput, PinataServiceConfig } from "../types";
import { PinataSDK } from "pinata-web3";
import fs from "fs";
import { logger } from "../../utils/logger";

// CID validation - More permissive pattern for various IPFS CID formats
// Supports both v0 (base58) and v1 (base32) CIDs
const CID_PATTERN = /^(Qm[1-9A-HJ-NP-Za-km-z]{44,}|b[a-zA-Z0-9]{58,})/;

interface PinataOptions {
  pinataMetadata?: {
    name?: string;
    keyvalues?: Record<string, string | number | null>;
  };
}

export class PinataService extends StorageService {
  public serviceBaseUrl = "ipfs://";
  public readonly serviceInstance: PinataSDK;
  private readonly gateway: string;
  private lastRequestTime = 0;
  private rateLimitMs = 500; // 500ms between requests (2 requests per second)

  constructor(config: PinataServiceConfig) {
    super();
    if (!config.pinataJwt) {
      throw new Error("Invalid or missing Pinata JWT token");
    }

    this.serviceInstance = new PinataSDK({
      pinataJwt: config.pinataJwt,
      pinataGateway: config.pinataGateway || "gateway.pinata.cloud",
    });
    this.gateway = config.pinataGateway || "gateway.pinata.cloud";
  }

  // Rate limiting utility for Pinata API calls
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.rateLimitMs) {
      const delay = this.rateLimitMs - elapsed;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }


  public async getRaw(hash: string): Promise<Buffer> {
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
      if (Buffer.isBuffer(response)) return response;
      if (response instanceof Uint8Array) return Buffer.from(response);

      // If it's a string, convert to Buffer
      if (typeof response === 'string') return Buffer.from(response);

      // If it's an object (likely already parsed JSON), stringify it back to buffer
      if (typeof response === 'object') return Buffer.from(JSON.stringify(response));

      throw new Error(`Unsupported response type from Pinata: ${typeof response}`);
    } catch (error) {
      logger.error("Failed to fetch raw data from Pinata", error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  public async getJson<T>(hash: string): Promise<T> {
    const buffer = await this.getRaw(hash);
    try {
      return JSON.parse(buffer.toString()) as T;
    } catch (e) {
      throw new Error(`Failed to parse JSON for CID ${hash}: ${e instanceof Error ? e.message : 'Invalid JSON'}`);
    }
  }

  public async get(hash: string): Promise<{ data: any; metadata: any }> {
    try {
      const buffer = await this.getRaw(hash);
      const str = buffer.toString();

      let parsed;
      try {
        parsed = JSON.parse(str);
      } catch (e) {
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
        const legacyData = parsed as { data: { data: unknown; metadata?: unknown } };
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
    } catch (error) {
      logger.error("Failed to fetch data from Pinata", error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  public getEndpoint(): string {
    return `https://${this.gateway}/ipfs/`;
  }

  public async unpin(hash: string): Promise<boolean> {
    try {
      if (!hash || typeof hash !== "string" || !CID_PATTERN.test(hash)) {
        logger.warn(`Invalid CID format: ${hash}`);
        return false;
      }

      const isPinnedBefore = await this.isPinned(hash);
      if (!isPinnedBefore) {
        logger.info(`CID not pinned, nothing to unpin: ${hash}`);
        return false;
      }

      await this.enforceRateLimit();
      await this.serviceInstance.unpin([hash]);
      return true;
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message.includes("is not pinned") ||
          error.message.includes("NOT_FOUND") ||
          error.message.includes("url does not contain CID")
        ) {
          logger.warn(`Pin not found: ${hash}`, error);
          return false;
        }
        if (error.message.includes("INVALID_CREDENTIALS")) {
          const authError = new Error("Authentication error with Pinata: verify your JWT token");
          logger.error("Authentication error", authError);
          throw authError;
        }
      }
      logger.error(`Unpin operation failed for ${hash}`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  public async uploadJson(jsonData: Record<string, unknown>, options?: PinataOptions): Promise<UploadOutput> {
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
    } catch (error) {
      if (error instanceof Error && error.message.includes("INVALID_CREDENTIALS")) {
        const authError = new Error("Authentication error with Pinata: verify your JWT token");
        logger.error("Authentication error", authError);
        throw authError;
      }
      logger.error("JSON upload failed", error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  public async uploadBuffer(buffer: Buffer, options?: any): Promise<UploadOutput> {
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
    } catch (error) {
      logger.error('Buffer upload failed', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  public async uploadFile(path: string, options?: PinataOptions): Promise<UploadOutput> {
    try {
      const fileContent = await fs.promises.readFile(path);
      const fileName = path.split("/").pop() || "file";

      return this.uploadBuffer(fileContent, { ...options, filename: fileName });
    } catch (error) {
      logger.error(`File upload failed for ${path}`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  public async getMetadata(hash: string): Promise<any> {
    try {
      if (!hash || typeof hash !== "string") {
        throw new Error("Invalid hash");
      }
      await this.enforceRateLimit();
      const response = await this.serviceInstance.gateways.get(hash);
      return response;
    } catch (error) {
      logger.error(`Failed to fetch metadata for ${hash}`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  public async isPinned(hash: string): Promise<boolean> {
    try {
      if (!hash || typeof hash !== "string" || !CID_PATTERN.test(hash)) {
        logger.warn(`Invalid CID format: ${hash}`);
        return false;
      }

      try {
        await this.enforceRateLimit();
        const response = await this.serviceInstance.gateways.get(hash);
        return !!response;
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message.includes("NOT_FOUND") || error.message.includes("url does not contain CID"))
        ) {
          return false;
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("INVALID_CREDENTIALS")) {
        const authError = new Error("Authentication error with Pinata: verify your JWT token");
        logger.error("Authentication error", authError);
        throw authError;
      }
      logger.warn(`isPinned check failed for ${hash}`, error);
      return false;
    }
  }
}
