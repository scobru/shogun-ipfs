import { IBackupAdapter, BackupResult, BackupOptions } from "../types/backup";
import { VersionComparison, DetailedComparison } from "../versioning";
import type { BackupMetadata, BackupData } from "../types/core";
import { UploadOutput } from "../ipfs/types";
import { StorageService } from "../ipfs/services/base-storage";
export declare class FileBackupAdapter implements IBackupAdapter {
    protected options: BackupOptions;
    private storage;
    private originalStorage;
    constructor(storage: StorageService, options?: BackupOptions);
    getStorage(): StorageService;
    private isBinaryFile;
    private getMimeType;
    protected generateBackupName(metadata: BackupMetadata): string;
    protected formatSize(bytes: number): string;
    protected serializeMetadata(metadata: any): Record<string, string | number | boolean>;
    protected createBackupMetadata(data: any, options?: BackupOptions, name?: string): Promise<BackupMetadata>;
    delete(hash: string): Promise<boolean>;
    protected processDirectory(dirPath: string, baseDir: string | undefined, backupData: Record<string, any>, options?: BackupOptions): Promise<void>;
    protected processLargeFile(fullPath: string, relativePath: string, backupData: Record<string, any>, options?: BackupOptions): Promise<void>;
    protected processSmallFile(fullPath: string, relativePath: string, backupData: Record<string, any>, options?: BackupOptions): Promise<void>;
    backup(sourcePath: string, options?: BackupOptions): Promise<BackupResult>;
    restore(hash: string, targetPath: string, options?: BackupOptions): Promise<boolean>;
    get(hash: string): Promise<BackupData>;
    compare(hash: string, sourcePath: string): Promise<VersionComparison>;
    compareDetailed(hash: string, sourcePath: string): Promise<DetailedComparison>;
    upload(data: any, options?: BackupOptions): Promise<UploadOutput>;
}
