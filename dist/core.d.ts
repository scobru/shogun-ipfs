import type { ShogunIpfsConfig } from "./types/core";
import type { BackupOptions, BackupResult } from "./types/backup";
import type { VersionComparison, DetailedComparison } from "./versioning";
import { StorageService } from "./ipfs/services/base-storage";
/**
 * ShogunIpfs - Modern Decentralized Backup System
 * @class
 * @description
 * ShogunIpfs is a decentralized backup system.
 * It provides encrypted backup, versioning, and restore capabilities.
 *
 * @example
 * ```typescript
 * const ShogunIpfs = new ShogunIpfs({
 *   storage: {
 *     service: 'PINATA',
 *     config: {
 *       pinataJwt: 'your-jwt-token',
 *       pinataGateway: 'your-gateway'
 *     }
 *   },
 *   features: {
 *     encryption: {
 *       enabled: true,
 *       algorithm: 'aes-256-gcm'
 *     }
 *   }
 * });
 *
 * // Create a backup
 * const backup = await ShogunIpfs.backup('./data');
 *
 * // Restore from backup
 * await ShogunIpfs.restore(backup.hash, './restore');
 *
 * // Compare versions
 * const changes = await ShogunIpfs.compare(backup.hash, './data');
 *
 * // Delete a backup when no longer needed
 * const deleted = await ShogunIpfs.delete(backup.hash);
 * ```
 */
export declare class ShogunIpfs {
    private config;
    private fileBackup;
    private storage;
    /**
     * Checks if the necessary dependencies are available
     * @private
     * @throws {Error} If a required dependency is missing or incompatible
     */
    private checkDependencies;
    /**
     * Checks if a version meets the minimum requirement
     * @private
     * @param {string} current - Current version
     * @param {string} minimum - Minimum required version
     * @returns {boolean} True if the current version meets or exceeds the minimum
     */
    private isVersionCompatible;
    private createStorageService;
    /**
     * Creates a new instance of ShogunIpfs
     * @param {ShogunIpfsConfig} config - Configuration object
     * @throws {Error} If the configuration is invalid
     */
    constructor(config: ShogunIpfsConfig);
    /**
     * Compare a local directory with an existing backup
     * @param {string} hash - Hash of the backup to compare
     * @param {string} sourcePath - Path of the local directory
     * @returns {Promise<VersionComparison>} Comparison result
     * @throws {Error} If comparison fails
     */
    compare(hash: string, sourcePath: string): Promise<VersionComparison>;
    /**
     * Compare a local directory with an existing backup in detail
     * @param {string} hash - Hash of the backup to compare
     * @param {string} sourcePath - Path of the local directory
     * @returns {Promise<DetailedComparison>} Detailed comparison result
     * @throws {Error} If comparison fails
     */
    compareDetailed(hash: string, sourcePath: string): Promise<DetailedComparison>;
    /**
     * Delete an existing backup
     * @param {string} hash - Hash of the backup to delete
     * @returns {Promise<boolean>} true if deletion was successful
     * @throws {Error} If deletion fails
     */
    delete(hash: string): Promise<boolean>;
    /**
     * Create a backup of a directory
     * @param {string} sourcePath - Path of the directory to backup
     * @param {BackupOptions} [options] - Backup options
     * @returns {Promise<BackupResult>} Backup result
     * @throws {Error} If backup fails
     */
    backup(sourcePath: string, options?: BackupOptions): Promise<BackupResult>;
    /**
     * Restore a backup
     * @param {string} hash - Hash of the backup to restore
     * @param {string} targetPath - Path where to restore
     * @param {BackupOptions} [options] - Restore options
     * @returns {Promise<boolean>} true if restore was successful
     * @throws {Error} If restore fails
     */
    restore(hash: string, targetPath: string, options?: BackupOptions): Promise<boolean>;
    /**
     * Get the storage service instance
     * @returns {StorageService} The storage service instance
     */
    getStorage(): StorageService;
    /**
     * Upload JSON data directly to storage
     * @param {Record<string, unknown>} jsonData - The JSON data to upload
     * @param {any} options - Upload options
     * @returns {Promise<{ id: string; metadata: Record<string, unknown> }>} Upload result
     */
    uploadJson(jsonData: Record<string, unknown>, options?: any): Promise<import("./ipfs/types").UploadOutput>;
    /**
     * Upload a buffer to storage
     * @param {Buffer} buffer - The buffer to upload
     * @param {any} options - Upload options
     * @returns {Promise<{ id: string; metadata: Record<string, unknown> }>} Upload result
     */
    uploadBuffer(buffer: Buffer, options?: any): Promise<import("./ipfs/types").UploadOutput>;
    /**
     * Upload a file to storage
     * @param {string} filePath - The path to the file to upload
     * @param {any} options - Upload options
     * @returns {Promise<{ id: string; metadata: Record<string, unknown> }>} Upload result
     */
    uploadFile(filePath: string, options?: any): Promise<import("./ipfs/types").UploadOutput>;
    /**
     * Get data from storage by hash
     * @param {string} hash - The hash to retrieve
     * @returns {Promise<any>} The retrieved data
     */
    getData(hash: string): Promise<any>;
    /**
     * Get metadata from storage by hash
     * @param {string} hash - The hash to get metadata for
     * @returns {Promise<any>} The metadata
     */
    getMetadata(hash: string): Promise<any>;
    /**
     * Check if a hash is pinned in storage
     * @param {string} hash - The hash to check
     * @returns {Promise<boolean>} True if pinned, false otherwise
     */
    isPinned(hash: string): Promise<boolean>;
    /**
     * Unpin a hash from storage
     * @param {string} hash - The hash to unpin
     * @returns {Promise<boolean>} - Returns true if the hash was unpinned, false otherwise
     */
    unpin(hash: string): Promise<boolean>;
    backupFiles: (sourcePath: string, options?: BackupOptions) => Promise<BackupResult>;
    restoreFiles: (hash: string, targetPath: string, options?: BackupOptions) => Promise<boolean>;
}
