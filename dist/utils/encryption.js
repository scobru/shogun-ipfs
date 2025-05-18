"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Encryption = void 0;
const crypto_1 = __importDefault(require("crypto"));
class Encryption {
    constructor(key, algorithm = 'aes-256-gcm') {
        this.algorithm = algorithm;
        this.key = crypto_1.default.createHash('sha256').update(key).digest();
    }
    encrypt(data) {
        const iv = crypto_1.default.randomBytes(16);
        const cipher = crypto_1.default.createCipheriv(this.algorithm, this.key, iv);
        const input = Buffer.isBuffer(data) ? data : Buffer.from(data);
        const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
        // For GCM mode, we need to get the auth tag
        const authTag = this.algorithm.includes('gcm') ? cipher.getAuthTag() : undefined;
        return { encrypted, iv, authTag };
    }
    decrypt(encrypted, iv, authTag) {
        const decipher = crypto_1.default.createDecipheriv(this.algorithm, this.key, iv);
        // For GCM mode, we need to set the auth tag
        if (this.algorithm.includes('gcm') && authTag) {
            decipher.setAuthTag(authTag);
        }
        return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    }
}
exports.Encryption = Encryption;
