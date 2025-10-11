export type ShogunIpfsServices = "PINATA" | "IPFS-CLIENT" | "CUSTOM";
export interface PinataServiceConfig {
    pinataJwt: string;
    pinataGateway?: string;
    apiKey?: string;
}
export interface IpfsServiceConfig {
    url: string;
    apiKey?: string;
}
export interface CustomGatewayConfig {
    url: string;
    token?: string;
}
export type { StorageService } from "./services/base-storage";
export interface StorageServiceWithMetadata {
    get(hash: string): Promise<{
        data: any;
        metadata: any;
    }>;
    getMetadata(hash: string): Promise<any>;
}
export type ShogunIpfsConfig = {
    service: ShogunIpfsServices;
    config: PinataServiceConfig | IpfsServiceConfig | CustomGatewayConfig;
};
export interface UploadOutput {
    id: string;
    url?: string;
    metadata?: Record<string, any>;
}
export interface UploadOptions {
    name?: string;
    type?: string;
    metadata?: Record<string, any>;
}
