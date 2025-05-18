import type { VersionInfo } from "../versioning";
import type { BackupData as MoguBackupData } from "./core";
import type { StorageService } from "../ipfs/services/base-storage";
export interface BackupOptions {
    encryption?: {
        enabled: boolean;
        key: string;
        algorithm?: string;
    };
    excludePatterns?: string[];
    maxFileSize?: number;
    type?: string;
    description?: string;
    metadata?: Record<string, any>;
    timestamp?: number;
    tags?: string[];
}
export interface BackupResult {
    hash: string;
    versionInfo: VersionInfo;
    name?: string;
}
export interface BackupMetadata {
    timestamp: number;
    type: string;
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    versionInfo: VersionInfo;
    sourcePath?: string;
    isEncrypted?: boolean;
    [key: string]: any;
}
export interface FileData {
    type?: "binary" | "text";
    content?: string;
    isEncrypted?: boolean;
    encrypted?: string;
    iv?: string;
    authTag?: string;
    mimeType?: string;
}
export interface BackupData extends MoguBackupData {
    data: Record<string, FileData>;
}
export interface StorageServiceWithMetadata extends StorageService {
    get(hash: string): Promise<MoguBackupData | any>;
    getMetadata(hash: string): Promise<any>;
}
export interface IBackupAdapter {
    backup(sourcePath: string, options?: BackupOptions): Promise<BackupResult>;
    restore(hash: string, targetPath: string, options?: BackupOptions): Promise<boolean>;
    get(hash: string): Promise<BackupData>;
    delete(hash: string): Promise<boolean>;
}
