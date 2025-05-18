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


  public async get(hash: string): Promise<{ data: any; metadata: any }> {
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
        } catch (e) {
          throw new Error("Invalid data received from Pinata");
        }
      }

      // Verify that the response has the correct structure
      const responseData = parsedResponse as { data?: { data?: unknown; metadata?: unknown } };

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
      const fileData = resultData.data as Record<string, any>;

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

  public async uploadFile(path: string, options?: PinataOptions): Promise<UploadOutput> {
    try {
      const fileContent = await fs.promises.readFile(path);
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
