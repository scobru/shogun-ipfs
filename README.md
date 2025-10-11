# Shogun IPFS 🏓

🌐 **shogun-ipfs** is a lightweight, unified wrapper for IPFS storage services that provides a simplified interface for interacting with IPFS networks.

📦 With support for **multiple storage providers** (Pinata, IPFS Client, Custom Gateways), shogun-ipfs makes it easy to upload, retrieve, and manage content on IPFS without having to deal with the complexities of different API implementations.

🚀 Perfect for developers who need an easy-to-use, reliable way to integrate IPFS storage into their decentralized applications.

## Features

- 🚀 **Simple to Use**: Unified API for all IPFS operations
- 📦 **Multiple Storage Providers**: Support for Pinata, IPFS nodes, and custom gateways (e.g., Shogun Relay)
- 🔧 **Buffer Support**: Direct upload of in-memory buffers (perfect for encrypted data)
- 🛡️ **Robust Error Handling**: Comprehensive error management with automatic retries
- 🔄 **Rate Limiting**: Built-in protection against API throttling
- 📝 **Structured Logging**: Detailed operation tracking with Winston
- 🧩 **Flexible Configuration**: Customizable settings for different environments
- 🔐 **Auth Support**: Token-based authentication for secured endpoints

## Quick Start

```bash
yarn add shogun-ipfs
```

or

```bash
npm install shogun-ipfs
```

```typescript
import { ShogunIpfs } from "shogun-ipfs";

// Initialize with Pinata (managed IPFS service)
const storage = ShogunIpfs({
  service: "PINATA",
  config: {
    pinataJwt: process.env.PINATA_JWT || "",
    pinataGateway: "gateway.pinata.cloud",
  },
});

// Or with IPFS Client (local node)
const storage = ShogunIpfs({
  service: "IPFS-CLIENT",
  config: {
    url: "http://localhost:5001",
  },
});

// Or with Custom Gateway (e.g., Shogun Relay)
const storage = ShogunIpfs({
  service: "CUSTOM",
  config: {
    url: "https://relay.shogun-eco.xyz/api/v1/ipfs",
    token: "your-admin-token",
  },
});

// Upload JSON data
const result = await storage.uploadJson({ name: "test", value: "example data" });
console.log("Content uploaded:", result.id);

// Upload a file from filesystem
const fileResult = await storage.uploadFile("./path/to/image.jpg");
console.log("File uploaded:", fileResult.id);

// Upload a buffer (perfect for encrypted data!)
const encryptedBuffer = Buffer.from("encrypted-data");
const bufferResult = await storage.uploadBuffer(encryptedBuffer);
console.log("Buffer uploaded:", bufferResult.id);

// Retrieve data
const data = await storage.get(result.id);
console.log("Retrieved data:", data);

// Check if content is pinned
const isPinned = await storage.isPinned(result.id);
console.log("Is pinned:", isPinned);

// Unpin when no longer needed
const unpinned = await storage.unpin(result.id);
if (unpinned) {
  console.log("Content unpinned successfully");
}
```

## Storage Providers

`shogun-ipfs` supports three storage providers with automatic endpoint discovery and failover:

### 📌 **PINATA** - Managed IPFS Service
Managed IPFS pinning service with global CDN and automatic replication.

**Best for**: Production apps, public files, guaranteed availability

### 🖥️ **IPFS-CLIENT** - Local/Remote IPFS Node
Direct connection to any IPFS node via HTTP API (Kubo, js-ipfs, etc.)

**Best for**: Self-hosted solutions, private networks, full control

### 🌐 **CUSTOM** - Custom Gateway/Relay
Any IPFS-compatible API endpoint (Shogun Relay, Infura, custom implementations)

**Best for**: Custom infrastructure, relay networks, hybrid setups

### PINATA Configuration

```typescript
const storage = ShogunIpfs({
  service: "PINATA",
  config: {
    pinataJwt: process.env.PINATA_JWT || "",
    pinataGateway: "gateway.pinata.cloud", // Optional
  },
});
```

### IPFS-CLIENT Configuration

```typescript
const storage = ShogunIpfs({
  service: "IPFS-CLIENT",
  config: {
    url: "http://localhost:5001", // Your IPFS node HTTP API endpoint
    apiKey: "optional-api-key",   // Optional authentication
  },
});
```

### CUSTOM Gateway Configuration

```typescript
const storage = ShogunIpfs({
  service: "CUSTOM",
  config: {
    url: "https://relay.shogun-eco.xyz/api/v1/ipfs", // Base URL
    token: "your-admin-token", // Optional authentication
  },
});

// The service automatically tries multiple endpoints:
// - /upload (relay format)
// - /api/v0/add (standard IPFS API)
// - /add (simplified format)
```

## Main Operations

### Upload Operations

```typescript
// Upload JSON data directly
const jsonResult = await storage.uploadJson({
  name: "test",
  data: { key: "value" },
});
console.log("JSON uploaded:", jsonResult.id);

// Upload a buffer (NEW! Perfect for encrypted data)
const encryptedData = Buffer.from("encrypted-content");
const bufferResult = await storage.uploadBuffer(encryptedData, {
  filename: "encrypted-file.bin" // Optional
});
console.log("Buffer uploaded:", bufferResult.id);

// Upload a file from filesystem
const fileResult = await storage.uploadFile("./path/to/file.txt");
console.log("File uploaded:", fileResult.id);
```

### Retrieval Operations

```typescript
// Get data by hash
const result = await storage.get("QmHash...");
console.log("Retrieved data:", result.data);
console.log("Metadata:", result.metadata);

// Get metadata only
const metadata = await storage.getMetadata("QmHash...");
console.log("Content metadata:", metadata);

// Get endpoint URL (useful for constructing links)
const endpoint = storage.getEndpoint();
console.log("Storage endpoint:", endpoint);
```

### Pin Management

```typescript
// Check if content is pinned
const isPinned = await storage.isPinned("QmHash...");
console.log("Is content pinned?", isPinned);

// Unpin content
const unpinned = await storage.unpin("QmHash...");
if (unpinned) {
  console.log("Content unpinned successfully");
} else {
  console.log("Content not found or already unpinned");
}
```

## Error Handling

shogun-ipfs implements comprehensive error handling with automatic retries for Custom Gateway:

```typescript
try {
  const result = await storage.uploadFile("./path/to/file.txt");
  console.log("Uploaded to:", result.id);
} catch (error) {
  if (error.message.includes("INVALID_CREDENTIALS")) {
    console.error("Authentication failed. Check your JWT token.");
  } else if (error.message.includes("NOT_FOUND")) {
    console.error("File not found or not accessible.");
  } else if (error.message.includes("All upload endpoints failed")) {
    console.error("Custom gateway unreachable. Check URL and network.");
  } else {
    console.error("Upload failed:", error.message);
  }
}
```

## Advanced Usage

### Using with SHIP-05 (Shogun Decentralized Storage)

```typescript
import { ShogunIpfs } from "shogun-ipfs";

// Configure for Shogun Relay
const ipfsStorage = ShogunIpfs({
  service: "CUSTOM",
  config: {
    url: "https://relay.shogun-eco.xyz/api/v1/ipfs",
    token: process.env.ADMIN_TOKEN,
  },
});

// Encrypt data with SEA, then upload
const encryptedData = await SEA.encrypt(fileData, userKey);
const encryptedBuffer = Buffer.from(encryptedData);

const result = await ipfsStorage.uploadBuffer(encryptedBuffer, {
  filename: "encrypted-file.bin"
});

console.log("Encrypted file uploaded:", result.id);

// Download and decrypt
const downloaded = await ipfsStorage.get(result.id);
const decrypted = await SEA.decrypt(downloaded.data, userKey);
```

### Endpoint Auto-Discovery (Custom Gateway)

When using `CUSTOM` service, shogun-ipfs automatically tries multiple endpoints:

**Upload attempts** (in order):
1. `/upload` - Relay format (Shogun Relay, custom implementations)
2. `/api/v0/add` - Standard IPFS API
3. `/add` - Simplified format

**Download attempts** (in order):
1. `/content/{hash}` - Relay format with metadata
2. `/ipfs/{hash}` - Standard gateway format
3. `/api/v0/cat?arg={hash}` - IPFS API format

This ensures compatibility with virtually any IPFS-compatible endpoint!

## API Reference

### StorageService Interface

All storage providers implement the same interface:

```typescript
interface StorageService {
  // Upload operations
  uploadJson(jsonData: Record<string, unknown>, options?: any): Promise<UploadOutput>;
  uploadFile(filePath: string, options?: any): Promise<UploadOutput>;
  uploadBuffer(buffer: Buffer, options?: any): Promise<UploadOutput>;
  
  // Download operations
  get(hash: string): Promise<{ data: any; metadata: any }>;
  getMetadata(hash: string): Promise<any>;
  
  // Pin management
  isPinned(hash: string): Promise<boolean>;
  unpin(hash: string): Promise<boolean>;
  
  // Utility
  getEndpoint?(): string;
}
```

### UploadOutput

```typescript
interface UploadOutput {
  id: string;              // IPFS hash (CID)
  url?: string;            // Optional URL to access the content
  metadata?: Record<string, any>; // Additional metadata (timestamp, size, etc.)
}
```

## Best Practices

1. **Choose the Right Provider**
   - **Pinata**: For production apps with guaranteed uptime
   - **IPFS-CLIENT**: For self-hosted solutions and local development
   - **CUSTOM**: For relay networks and custom infrastructure

2. **Rate Limiting Awareness**
   - Built-in rate limiting protects against API throttling
   - Pinata: 2 req/sec, IPFS-CLIENT: 5 req/sec, CUSTOM: 10 req/sec

3. **Error Handling**
   - Always wrap operations in try/catch blocks
   - Custom Gateway automatically retries failed endpoints

4. **Content Management**
   - Regularly unpin content that is no longer needed
   - Monitor pinned content size with paid services
   - Use `isPinned()` before `unpin()` for efficiency

5. **Buffer Uploads for Encrypted Data**
   - Use `uploadBuffer()` for in-memory encrypted data
   - Avoids creating temporary files
   - Better performance for SHIP-05 encrypted storage

## Development

```bash
# Install dependencies
yarn install

# Run tests
yarn test

# Build
yarn build
```

## License

MIT License

Copyright (c) 2024 scobru

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
