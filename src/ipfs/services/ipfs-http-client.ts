import { StorageService } from "./base-storage";
import type { UploadOutput, IpfsServiceConfig } from "../types";
import { create as createIpfsClient, IPFSHTTPClient } from "ipfs-http-client";
import { logger } from "../../utils/logger";
import fs from "fs";

export class IpfsService extends StorageService {
  public serviceBaseUrl = "ipfs://";
  public readonly serviceInstance: IPFSHTTPClient;
  private readonly gateway: string;
  private lastRequestTime = 0;
  private rateLimitMs = 200; // 5 requests per second maximum
  private apiKey: string;

  constructor(config: IpfsServiceConfig) {
    super();
    if (!config.url) {
      throw new Error("Invalid or missing IPFS URL");
    }

    this.serviceInstance = createIpfsClient({ url: config.url });
    this.gateway = config.url;
    this.apiKey = config.apiKey || "";
  }

  // Rate limiting utility for IPFS API calls
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
    return this.gateway;
  }

  public async get(hash: string): Promise<{ data: any; metadata: any }> {
    try {
      if (!hash || typeof hash !== "string") {
        throw new Error("Invalid hash");
      }

      await this.enforceRateLimit();
      const chunks = [];
      for await (const chunk of this.serviceInstance.cat(hash)) {
        chunks.push(chunk);
      }
      const data = Buffer.concat(chunks);
      const str = data.toString();

      let parsedData;
      try {
        parsedData = JSON.parse(str);
      } catch (e) {
        throw new Error("Invalid data format: cannot parse JSON");
      }

      return parsedData;
    } catch (error) {
      logger.error(`Failed to retrieve data for CID ${hash}`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  public async uploadJson(jsonData: Record<string, unknown>): Promise<UploadOutput> {
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
    } catch (error) {
      logger.error("JSON upload failed", error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Carica un file su IPFS
   * @param filePath - Percorso del file da caricare
   * @param options - Opzioni aggiuntive (nome, metadati, ecc.)
   * @returns UploadOutput con l'ID del file caricato e i metadati
   */
  public async uploadFile(filePath: string): Promise<UploadOutput> {
    try {
      const content = await fs.promises.readFile(filePath);
      
      await this.enforceRateLimit();
      const result = await this.serviceInstance.add(content);
      
      return {
        id: result.cid.toString(),
        metadata: {
          timestamp: Date.now(),
          size: content.length,
          type: "file",
        },
      };
    } catch (error) {
      logger.error(`File upload failed for ${filePath}`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }


  public async getMetadata(hash: string): Promise<any> {
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
    } catch (error) {
      logger.error(`Failed to fetch metadata for ${hash}`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  public async isPinned(hash: string): Promise<boolean> {
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
    } catch (error) {
      logger.warn(`isPinned check failed for ${hash}`, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  public async unpin(hash: string): Promise<boolean> {
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
    } catch (error) {
      logger.error(`Failed to unpin ${hash}`, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  public async pin(hash: string): Promise<boolean> {
    try {
      if (!hash || typeof hash !== "string") {
        return false;
      } 

      await this.enforceRateLimit();
      const pinned = await this.serviceInstance.pin.add(hash , {
        headers: {
          "Authorization": `Bearer ${this.apiKey}`
        }
      });
      console.log(pinned);
      return true;
    } catch (error) {
      logger.error(`Failed to pin ${hash}`, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

}
