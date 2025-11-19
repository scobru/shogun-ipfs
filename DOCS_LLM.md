# shogun-ipfs DOCUMENTATION FOR LLM

## SYSTEM OVERVIEW
shogun-ipfs is a lightweight, unified wrapper for IPFS storage services. It provides a simplified interface for uploading and retrieving data from IPFS networks using multiple storage providers with automatic endpoint discovery and failover.

**Version**: 1.1.0  
**Key Feature**: Unified API for Pinata, IPFS nodes, and custom IPFS-compatible gateways (e.g., Shogun Relay)

## CORE COMPONENTS

### STORAGE SERVICES (3 PROVIDERS)

1. **PINATA** - Managed IPFS Service
   - Requires: `pinataJwt`, `pinataGateway` (optional)
   - Handles: Managed pinning, global CDN, automatic replication
   - Rate limit: 2 req/sec (500ms between requests)

2. **IPFS-CLIENT** - Local/Remote IPFS Node
   - Requires: `url` (HTTP API endpoint)
   - Provides: Direct IPFS network access via http-client
   - Rate limit: 5 req/sec (200ms between requests)

3. **CUSTOM** - Custom Gateway/Relay (NEW!)
   - Requires: `url` (base endpoint)
   - Optional: `token` (authentication)
   - Auto-discovery: Tries multiple endpoints (/upload, /api/v0/add, /add)
   - Rate limit: 10 req/sec (100ms between requests)
   - Perfect for: Shogun Relay, Infura, custom implementations

## CONFIGURATION STRUCTURE
```typescript
type ShogunIpfsServices = "PINATA" | "IPFS-CLIENT" | "CUSTOM";

interface PinataServiceConfig {
  pinataJwt: string;
  pinataGateway?: string;
}

interface IpfsServiceConfig {
  url: string;
  apiKey?: string;
}

interface CustomGatewayConfig {
  url: string;      // Base URL (e.g., "https://relay.shogun-eco.xyz/api/v1/ipfs")
  token?: string;   // Optional authentication token
}

type ShogunIpfsConfig = {
  service: ShogunIpfsServices;
  config: PinataServiceConfig | IpfsServiceConfig | CustomGatewayConfig;
};
```

## MAIN OPERATIONS

### FACTORY FUNCTION
```typescript
import { ShogunIpfs } from "shogun-ipfs";

// Returns a StorageService instance
const storage = ShogunIpfs(config: ShogunIpfsConfig): StorageService
```

### UPLOAD OPERATIONS
```typescript
// Upload JSON data
storage.uploadJson(data: Record<string, unknown>, options?: any): Promise<UploadOutput>
// Returns: { id: "Qm...", metadata: { timestamp, size, type: "json" } }

// Upload a buffer (NEW! - Perfect for encrypted data)
storage.uploadBuffer(buffer: Buffer, options?: any): Promise<UploadOutput>
// Options: { filename?: string, pinataMetadata?: {...} }
// Returns: { id: "Qm...", metadata: { timestamp, size, type: "buffer" } }

// Upload a file from filesystem
storage.uploadFile(filePath: string, options?: any): Promise<UploadOutput>
// Returns: { id: "Qm...", metadata: { timestamp, size, type: "file" } }
```

### RETRIEVAL OPERATIONS
```typescript
// Get data by CID/hash (includes metadata)
storage.get(hash: string): Promise<{ data: any; metadata: any }>
// Returns: { data: <content>, metadata: { timestamp, type } }

// Get metadata only
storage.getMetadata(hash: string): Promise<any>
// Returns provider-specific metadata

// Get endpoint URL
storage.getEndpoint(): string
// Returns base URL for the storage provider
```

### PIN MANAGEMENT
```typescript
// Check if a hash is pinned
storage.isPinned(hash: string): Promise<boolean>
// Returns: true if pinned, false otherwise

// Unpin a hash
storage.unpin(hash: string): Promise<boolean>
// Returns: true if unpinned, false if not found or already unpinned
```

## ENDPOINT AUTO-DISCOVERY (CUSTOM GATEWAY)

When using `CUSTOM` service, shogun-ipfs automatically tries multiple endpoints:

**Upload Endpoints** (tried in order):
1. `{baseUrl}/upload` - Relay format (Shogun Relay)
2. `{baseUrl}/api/v0/add` - Standard IPFS API
3. `{baseUrl}/add` - Simplified format

**Download Endpoints** (tried in order):
1. `{baseUrl}/content/{hash}` - Relay format with metadata
2. `{baseUrl}/ipfs/{hash}` - Standard gateway format
3. `{baseUrl}/api/v0/cat?arg={hash}` - IPFS API format

**Unpin Endpoint**:
- `{baseUrl}/pins/rm` with POST body `{cid: hash}`

This ensures compatibility with virtually any IPFS-compatible endpoint!

## ERROR HANDLING

Comprehensive error handling with automatic retries:

**Authentication Errors**:
- `INVALID_CREDENTIALS` - Check JWT token or admin token
- `401 Unauthorized` - Token missing or incorrect

**Upload Errors**:
- `All upload endpoints failed` - Custom gateway unreachable
- `NOT_FOUND` - File not found (filesystem)
- `Upload failed (XXX)` - HTTP status code details

**Download Errors**:
- `All download endpoints failed` - Content not accessible
- `Invalid hash` - Malformed CID

**Pin Errors**:
- Returns `false` instead of throwing (graceful degradation)
- Logs warnings for debugging

## RATE LIMITING

Built-in rate limiting per provider:
- **PINATA**: 500ms between requests (2 req/sec)
- **IPFS-CLIENT**: 200ms between requests (5 req/sec)  
- **CUSTOM**: 100ms between requests (10 req/sec)

Prevents API throttling and ensures stable operation.

## USAGE EXAMPLES

### 1. Pinata (Managed Service)
```typescript
import { ShogunIpfs } from "shogun-ipfs";

const storage = ShogunIpfs({
  service: "PINATA",
  config: {
    pinataJwt: "your-jwt-token",
    pinataGateway: "gateway.pinata.cloud"
  }
});

// Upload JSON
const result = await storage.uploadJson({ name: "test", data: [1, 2, 3] });
console.log("Uploaded:", result.id); // "Qm..."

// Retrieve data
const downloaded = await storage.get(result.id);
console.log("Data:", downloaded.data);
```

### 2. IPFS Client (Local Node)
```typescript
const storage = ShogunIpfs({
  service: "IPFS-CLIENT",
  config: {
    url: "http://localhost:5001"
  }
});

// Upload file
const result = await storage.uploadFile("./data.json");
console.log("Uploaded:", result.id);
```

### 3. Custom Gateway (Shogun Relay) - NEW!
```typescript
const storage = ShogunIpfs({
  service: "CUSTOM",
  config: {
    url: "https://relay.shogun-eco.xyz/api/v1/ipfs",
    token: "admin-token" // Optional
  }
});

// Upload encrypted buffer
const encryptedData = Buffer.from("encrypted-content");
const result = await storage.uploadBuffer(encryptedData, {
  filename: "encrypted.bin"
});

// Download
const downloaded = await storage.get(result.id);
console.log("Downloaded:", downloaded.data);

// Unpin
await storage.unpin(result.id);
```

### 4. SHIP-05 Integration (Encrypted Storage)
```typescript
import { ShogunIpfs } from "shogun-ipfs";

// Configure for encrypted storage with relay
const storage = ShogunIpfs({
  service: "CUSTOM",
  config: {
    url: "https://relay.shogun-eco.xyz/api/v1/ipfs",
    token: process.env.ADMIN_TOKEN
  }
});

// Encrypt data with SEA (SHIP-00)
const keyPair = await identity.getKeyPair();
const encryptedData = await identity.shogun.db.crypto.encrypt(
  fileData,
  keyPair
);

// Upload encrypted buffer
const encryptedBuffer = Buffer.from(encryptedData);
const result = await storage.uploadBuffer(encryptedBuffer, {
  filename: "encrypted-file.bin"
});

// Store metadata in GunDB
gun.get("user_files").get(result.id).put({
  hash: result.id,
  filename: "document.pdf",
  encrypted: true,
  uploadedAt: Date.now()
});

// Download and decrypt later
const downloaded = await storage.get(result.id);
const decrypted = await identity.shogun.db.crypto.decrypt(
  downloaded.data,
  keyPair
);
```

## DEPENDENCIES

Minimal and focused dependencies:
```json
{
  "form-data": "^4.0.0",          // For multipart uploads
  "ipfs-http-client": "56.0.3",   // For IPFS-CLIENT service
  "pinata-web3": "^0.5.2",        // For PINATA service
  "winston": "^3.17.0"            // For logging
}
```

**Removed**: axios, dayjs, dotenv, fs-extra, lru-cache, morgan (not needed for core functionality)

## BEST PRACTICES

1. **Choose the Right Provider**
   - **Pinata**: Production apps with guaranteed uptime
   - **IPFS-CLIENT**: Self-hosted solutions, local development
   - **CUSTOM**: Relay networks, custom infrastructure (Shogun Relay)

2. **Storage Management**
   - Monitor IPFS pinning status with `isPinned()`
   - Regular cleanup of unused content with `unpin()`
   - Be aware of built-in rate limiting

3. **Performance**
   - Use `uploadBuffer()` for in-memory encrypted data
   - Avoid temporary files when possible
   - Custom Gateway has highest rate limit (10 req/sec)

4. **Security**
   - IPFS content is public by default
   - Use SEA encryption (SHIP-00) for sensitive data
   - Keep JWT/admin tokens secure
   - Always use HTTPS for custom gateways

## LIMITATIONS

1. **Storage Service Specific**
   - PINATA: Requires paid account for high volumes
   - IPFS-CLIENT: Requires running IPFS node
   - CUSTOM: Depends on gateway availability

2. **Network Dependent**
   - IPFS operations depend on network conditions
   - Content availability depends on pins/replication
   - Custom gateways may have different performance characteristics

3. **Environment**
   - Node.js environment required (not browser-compatible)
   - File system access needed for `uploadFile()`
   - Network access required for all operations

## COMPARISON TABLE

| Feature | PINATA | IPFS-CLIENT | CUSTOM |
|---------|--------|-------------|--------|
| **Setup Difficulty** | Easy | Medium | Easy |
| **Requires Running Service** | No | Yes (IPFS daemon) | Yes (Gateway/Relay) |
| **Authentication** | JWT token | Optional API key | Optional token |
| **Rate Limit** | 2 req/sec | 5 req/sec | 10 req/sec |
| **Auto-Retry** | No | No | Yes (3 endpoints) |
| **Best For** | Production | Self-hosted | Relay networks |
| **uploadBuffer Support** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Endpoint Discovery** | N/A | N/A | ✅ Auto |

## INTEGRATION WITH SHIP-05

shogun-ipfs is designed to work seamlessly with SHIP-05 (Decentralized File Storage):

```typescript
// SHIP-05 uses shogun-ipfs internally
class SHIP_05 {
  private ipfsStorage: StorageService | null = null;

  private async initializeIPFS() {
    const ShogunIpfs = await import("shogun-ipfs");
    
    const config: ShogunIpfsConfig = {
      service: this.config.ipfsService, // "PINATA" | "IPFS-CLIENT" | "CUSTOM"
      config: {
        // Configuration mapped from SHIP_05_Config
        pinataJwt: this.config.ipfsConfig?.pinataJwt,
        url: this.config.ipfsConfig?.url,
        token: this.config.ipfsConfig?.customToken
      }
    };

    this.ipfsStorage = ShogunIpfs.ShogunIpfs(config);
  }

  async uploadFile(data: File | Buffer, encrypt: boolean) {
    if (encrypt) {
      // Encrypt with SEA (SHIP-00)
      const encrypted = await this.encryptData(data, {});
      const buffer = Buffer.from(encrypted);
      
      // Upload encrypted buffer
      return await this.ipfsStorage.uploadBuffer(buffer);
    } else {
      // Upload directly
      return await this.ipfsStorage.uploadBuffer(Buffer.from(data));
    }
  }
}
```

## LLM USAGE GUIDE

### Quick Reference for LLMs

**Initialization Pattern**:
```typescript
const storage = ShogunIpfs({ service: "CUSTOM", config: { url, token } });
```

**Upload Pattern**:
```typescript
const result = await storage.uploadBuffer(Buffer.from(data));
// Returns: { id: "Qm...", metadata: {...} }
```

**Download Pattern**:
```typescript
const { data, metadata } = await storage.get("Qm...");
```

**Common Error Messages**:
- `"Configurazione IPFS non valida: richiesto url"` → Missing `url` in IPFS-CLIENT config
- `"Configurazione Pinata non valida: richiesto pinataJwt"` → Missing JWT in PINATA config
- `"All upload endpoints failed"` → Custom gateway unreachable
- `"INVALID_CREDENTIALS"` → Wrong or expired token

### When to Use Which Service

| Use Case | Recommended Service | Example |
|----------|---------------------|---------|
| Production app with public files | PINATA | Image hosting, static assets |
| Local development/testing | IPFS-CLIENT | Testing IPFS integration |
| Shogun ecosystem apps | CUSTOM | SHIP-05 encrypted storage |
| Self-hosted infrastructure | IPFS-CLIENT | Private IPFS network |
| Relay-based architecture | CUSTOM | Shogun Relay integration |