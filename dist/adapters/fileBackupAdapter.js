"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileBackupAdapter = void 0;
const versioning_1 = require("../versioning");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const js_sha3_1 = require("js-sha3");
const encryption_1 = require("../utils/encryption");
class FileBackupAdapter {
    constructor(storage, options = {}) {
        this.options = options;
        if (!storage.uploadJson) {
            throw new Error("Storage service must support uploadJson operation");
        }
        this.originalStorage = storage;
        this.storage = storage;
    }
    getStorage() {
        return this.originalStorage;
    }
    isBinaryFile(filename) {
        const binaryExtensions = [
            ".png",
            ".jpg",
            ".jpeg",
            ".gif",
            ".bmp",
            ".pdf",
            ".doc",
            ".docx",
            ".xls",
            ".xlsx",
            ".zip",
            ".rar",
            ".7z",
            ".tar",
            ".gz",
        ];
        const ext = path_1.default.extname(filename).toLowerCase();
        return binaryExtensions.includes(ext);
    }
    getMimeType(filename) {
        const ext = path_1.default.extname(filename).toLowerCase();
        const mimeTypes = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".bmp": "image/bmp",
            ".pdf": "application/pdf",
        };
        return mimeTypes[ext] || "application/octet-stream";
    }
    generateBackupName(metadata) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").replace("Z", "");
        const type = metadata?.type || "backup";
        const size = metadata?.versionInfo?.size || 0;
        // Formatta la dimensione
        const sizeFormatted = this.formatSize(size);
        // Aggiungi tag personalizzati se presenti
        const tags = this.options.tags ? `-${this.options.tags.join("-")}` : "";
        return `mogu-${type}-${sizeFormatted}${tags}-${timestamp}`;
    }
    formatSize(bytes) {
        if (bytes < 1024)
            return `${bytes}B`;
        if (bytes < 1024 * 1024)
            return `${(bytes / 1024).toFixed(1)}KB`;
        if (bytes < 1024 * 1024 * 1024)
            return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
    }
    serializeMetadata(metadata) {
        const serialized = {};
        const serialize = (obj) => {
            if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") {
                return obj;
            }
            if (obj instanceof Date) {
                return obj.toISOString();
            }
            return JSON.stringify(obj);
        };
        if (metadata && typeof metadata === "object") {
            for (const [key, value] of Object.entries(metadata)) {
                serialized[key] = serialize(value);
            }
        }
        return serialized;
    }
    async createBackupMetadata(data, options, name) {
        const now = Date.now();
        return {
            timestamp: options?.timestamp || now,
            type: options?.type || "backup",
            name: name || this.generateBackupName({ type: options?.type }),
            description: options?.description,
            metadata: options?.metadata,
            versionInfo: {
                hash: "",
                timestamp: now,
                size: Buffer.from(JSON.stringify(data)).length,
                metadata: {
                    createdAt: new Date(now).toISOString(),
                    modifiedAt: new Date(now).toISOString(),
                    checksum: "",
                },
            },
        };
    }
    async delete(hash) {
        if (!this.storage.unpin) {
            throw new Error("Storage service does not support delete operation");
        }
        try {
            // Verifica se il backup esiste usando isPinned
            const exists = await this.originalStorage.isPinned(hash);
            if (!exists) {
                return false;
            }
            // Se il backup esiste, procedi con l'eliminazione
            await this.storage.unpin(hash);
            return true;
        }
        catch (error) {
            console.error("Delete operation failed:", error);
            return false;
        }
    }
    async processDirectory(dirPath, baseDir = "", backupData, options) {
        try {
            const files = await fs_extra_1.default.readdir(dirPath, { withFileTypes: true });
            for (const file of files) {
                if (options?.excludePatterns?.some((pattern) => file.name.match(pattern)))
                    continue;
                const fullPath = path_1.default.join(dirPath, file.name);
                const relativePath = path_1.default.join(baseDir, file.name).replace(/\\/g, "/");
                if (file.isDirectory()) {
                    await this.processDirectory(fullPath, relativePath, backupData, options);
                    continue;
                }
                const stats = await fs_extra_1.default.stat(fullPath);
                if (options?.maxFileSize && stats.size > options.maxFileSize)
                    continue;
                // Use streaming approach for larger files
                if (stats.size > 1024 * 1024) { // 1MB threshold
                    await this.processLargeFile(fullPath, relativePath, backupData, options);
                }
                else {
                    await this.processSmallFile(fullPath, relativePath, backupData, options);
                }
            }
        }
        catch (error) {
            throw new Error(`Failed to process directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async processLargeFile(fullPath, relativePath, backupData, options) {
        let fileStream = null;
        try {
            const isBinary = this.isBinaryFile(fullPath);
            const mimeType = this.getMimeType(fullPath);
            if (options?.encryption?.enabled && options.encryption.key) {
                // For encrypted large files, we still need to load full content
                // This can be optimized with streaming encryption in a future version
                const content = await fs_extra_1.default.readFile(fullPath);
                const encryption = new encryption_1.Encryption(options.encryption.key, options.encryption.algorithm);
                const { encrypted, iv, authTag } = encryption.encrypt(content);
                backupData[relativePath] = {
                    isEncrypted: true,
                    encrypted: encrypted.toString('base64'),
                    iv: iv.toString('base64'),
                    authTag: authTag?.toString('base64'),
                    mimeType
                };
            }
            else {
                // Use streams to read file in chunks if not encrypted
                fileStream = fs_extra_1.default.createReadStream(fullPath);
                const chunks = [];
                await new Promise((resolve, reject) => {
                    fileStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
                    fileStream.on('error', (err) => reject(err));
                    fileStream.on('end', () => {
                        const buffer = Buffer.concat(chunks);
                        backupData[relativePath] = {
                            type: isBinary ? "binary" : "text",
                            content: isBinary ? buffer.toString('base64') : buffer.toString('utf8'),
                            mimeType
                        };
                        resolve();
                    });
                });
            }
        }
        catch (error) {
            throw new Error(`Failed to process file ${fullPath}: ${error instanceof Error ? error.message : String(error)}`);
        }
        finally {
            if (fileStream) {
                fileStream.close();
            }
        }
    }
    async processSmallFile(fullPath, relativePath, backupData, options) {
        try {
            const content = await fs_extra_1.default.readFile(fullPath);
            const isBinary = this.isBinaryFile(fullPath);
            const mimeType = this.getMimeType(fullPath);
            let fileData;
            if (options?.encryption?.enabled && options.encryption.key) {
                const encryption = new encryption_1.Encryption(options.encryption.key, options.encryption.algorithm);
                const { encrypted, iv, authTag } = encryption.encrypt(content);
                fileData = {
                    isEncrypted: true,
                    encrypted: encrypted.toString('base64'),
                    iv: iv.toString('base64'),
                    authTag: authTag?.toString('base64'),
                    mimeType
                };
            }
            else {
                fileData = {
                    type: isBinary ? "binary" : "text",
                    content: isBinary ? content.toString('base64') : content.toString('utf8'),
                    mimeType
                };
            }
            backupData[relativePath] = fileData;
        }
        catch (error) {
            throw new Error(`Failed to process file ${fullPath}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async backup(sourcePath, options) {
        const backupData = {};
        // Use the extracted processDirectory method with proper resource management
        await this.processDirectory(sourcePath, "", backupData, options);
        const versionManager = new versioning_1.VersionManager(sourcePath);
        const versionInfo = await versionManager.createVersionInfo(Buffer.from(JSON.stringify(backupData)));
        const metadata = {
            timestamp: Date.now(),
            type: "file-backup",
            versionInfo,
        };
        const uploadData = {
            data: backupData,
            metadata,
        };
        const result = await this.storage.uploadJson(uploadData, {
            pinataMetadata: {
                name: path_1.default.basename(sourcePath),
            },
        });
        if (!result || !result.id) {
            throw new Error("Storage service did not return a valid hash");
        }
        return {
            hash: result.id,
            versionInfo,
            name: path_1.default.basename(sourcePath),
        };
    }
    async restore(hash, targetPath, options) {
        const backup = await this.get(hash);
        if (!backup?.data)
            throw new Error("Invalid backup data");
        const encryption = options?.encryption?.enabled && options.encryption.key
            ? new encryption_1.Encryption(options.encryption.key, options.encryption.algorithm)
            : null;
        // Assicurati che la directory principale esista
        await fs_extra_1.default.ensureDir(targetPath);
        for (const [fileName, fileData] of Object.entries(backup.data)) {
            const filePath = path_1.default.join(targetPath, fileName);
            try {
                // Assicurati che la directory del file esista
                await fs_extra_1.default.ensureDir(path_1.default.dirname(filePath));
                if (fileData.isEncrypted && encryption && fileData.encrypted && fileData.iv) {
                    // Decripta il contenuto
                    const encrypted = Buffer.from(fileData.encrypted, 'base64');
                    const iv = Buffer.from(fileData.iv, 'base64');
                    const authTag = fileData.authTag ? Buffer.from(fileData.authTag, 'base64') : undefined;
                    const decrypted = encryption.decrypt(encrypted, iv, authTag);
                    // Write file with proper error handling
                    await fs_extra_1.default.writeFile(filePath, decrypted);
                }
                else if (fileData.type === 'binary' && fileData.content) {
                    const content = Buffer.from(fileData.content, 'base64');
                    await fs_extra_1.default.writeFile(filePath, content);
                }
                else if (fileData.type === 'text' && fileData.content) {
                    await fs_extra_1.default.writeFile(filePath, fileData.content);
                }
                else {
                    throw new Error(`Invalid file data for ${fileName}`);
                }
            }
            catch (error) {
                throw new Error(`Failed to restore file ${fileName}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        return true;
    }
    async get(hash) {
        if (!this.storage.get) {
            throw new Error("Storage service does not support get operation");
        }
        const result = await this.storage.get(hash);
        if (!result?.data || !result?.metadata) {
            throw new Error("Invalid backup format");
        }
        return result;
    }
    async compare(hash, sourcePath) {
        try {
            // Recupera il backup
            const backup = await this.get(hash);
            if (!backup?.data || !backup?.metadata?.versionInfo) {
                throw new Error("Invalid backup: missing metadata");
            }
            // Prepara i dati locali nello stesso formato del backup
            const localData = {};
            const processDirectory = async (dirPath, baseDir = "") => {
                const files = await fs_extra_1.default.readdir(dirPath, { withFileTypes: true });
                for (const file of files) {
                    const fullPath = path_1.default.join(dirPath, file.name);
                    const relativePath = path_1.default.join(baseDir, file.name).replace(/\\/g, "/");
                    if (file.isDirectory()) {
                        await processDirectory(fullPath, relativePath);
                        continue;
                    }
                    const content = await fs_extra_1.default.readFile(fullPath);
                    const isBinary = this.isBinaryFile(file.name);
                    localData[relativePath] = {
                        type: isBinary ? "binary" : "text",
                        content: isBinary ? content.toString("base64") : content.toString("utf8"),
                        mimeType: this.getMimeType(file.name),
                    };
                }
            };
            await processDirectory(sourcePath);
            // Crea buffer dei dati nello stesso formato
            const localBuffer = Buffer.from(JSON.stringify(localData));
            const remoteBuffer = Buffer.from(JSON.stringify(backup.data));
            // Usa VersionManager per confrontare
            const versionManager = new versioning_1.VersionManager(sourcePath);
            return versionManager.compareVersions(localBuffer, backup.metadata.versionInfo);
        }
        catch (error) {
            console.error("Error during comparison:", error);
            throw error;
        }
    }
    async compareDetailed(hash, sourcePath) {
        try {
            // Leggi i file locali
            const files = await fs_extra_1.default.readdir(sourcePath);
            const localData = {};
            for (const file of files) {
                const filePath = path_1.default.join(sourcePath, file);
                const stats = await fs_extra_1.default.stat(filePath);
                if (stats.isDirectory())
                    continue;
                const content = await fs_extra_1.default.readFile(filePath);
                localData[file] = {
                    type: this.isBinaryFile(file) ? "binary" : "text",
                    content: content.toString("base64"),
                };
            }
            // Recupera il backup
            const backup = await this.get(hash);
            if (!backup?.data) {
                throw new Error("Invalid backup: missing data");
            }
            const differences = [];
            const totalChanges = { added: 0, modified: 0, deleted: 0 };
            // Calcola checksum e dimensioni
            const calculateChecksum = (data) => (0, js_sha3_1.sha3_256)(JSON.stringify(data));
            const getFileSize = (data) => Buffer.from(JSON.stringify(data)).length;
            // Trova file modificati e aggiunti
            for (const [filePath, localContent] of Object.entries(localData)) {
                const remoteContent = backup.data[filePath];
                if (!remoteContent) {
                    differences.push({
                        path: filePath,
                        type: "added",
                        newChecksum: calculateChecksum(localContent),
                        size: { new: getFileSize(localContent) },
                    });
                    totalChanges.added++;
                }
                else {
                    const localChecksum = calculateChecksum(localContent);
                    const remoteChecksum = calculateChecksum(remoteContent);
                    if (localChecksum !== remoteChecksum) {
                        differences.push({
                            path: filePath,
                            type: "modified",
                            oldChecksum: remoteChecksum,
                            newChecksum: localChecksum,
                            size: {
                                old: getFileSize(remoteContent),
                                new: getFileSize(localContent),
                            },
                        });
                        totalChanges.modified++;
                    }
                }
            }
            // Trova file eliminati
            for (const filePath of Object.keys(backup.data)) {
                if (!localData[filePath]) {
                    differences.push({
                        path: filePath,
                        type: "deleted",
                        oldChecksum: calculateChecksum(backup.data[filePath]),
                        size: { old: getFileSize(backup.data[filePath]) },
                    });
                    totalChanges.deleted++;
                }
            }
            // Crea version info
            const localDataBuffer = Buffer.from(JSON.stringify(localData));
            const localVersion = await new versioning_1.VersionManager(sourcePath).createVersionInfo(localDataBuffer);
            const remoteVersion = backup.metadata.versionInfo;
            return {
                isEqual: differences.length === 0,
                isNewer: localVersion.timestamp > remoteVersion.timestamp,
                localVersion,
                remoteVersion,
                timeDiff: Math.abs(localVersion.timestamp - remoteVersion.timestamp),
                formattedDiff: new versioning_1.VersionManager(sourcePath).formatTimeDifference(localVersion.timestamp, remoteVersion.timestamp),
                differences,
                totalChanges,
            };
        }
        catch (error) {
            console.error("Error during detailed comparison:", error);
            throw error;
        }
    }
    async upload(data, options) {
        if (!this.storage.uploadJson) {
            throw new Error("Storage service does not support uploadJson operation");
        }
        return this.storage.uploadJson(data, options);
    }
}
exports.FileBackupAdapter = FileBackupAdapter;
