# Changelog - shogun-ipfs

## [1.1.0] - 2025-10-11

### ✨ New Features

#### 🌐 Custom Gateway Support
- Added `CUSTOM` service type for any IPFS-compatible gateway/relay
- Automatic endpoint discovery (tries `/upload`, `/api/v0/add`, `/add`)
- Token-based authentication for secured endpoints
- **Perfect for Shogun Relay integration!**

#### 🔧 Buffer Upload Support
- Added `uploadBuffer(buffer: Buffer, options?)` to all storage services
- Direct in-memory uploads without temporary files
- Essential for encrypted data workflows (SHIP-05)
- Improved performance for SHIP-05 encrypted storage

### 🔄 API Changes

**New Service Type**:
```typescript
type ShogunIpfsServices = "PINATA" | "IPFS-CLIENT" | "CUSTOM"; // ← CUSTOM added!
```

**New Config Interface**:
```typescript
interface CustomGatewayConfig {
  url: string;      // Base URL (e.g., "https://relay.shogun-eco.xyz/api/v1/ipfs")
  token?: string;   // Optional authentication token
}
```

**New Method** (all services):
```typescript
uploadBuffer(buffer: Buffer, options?: { filename?: string }): Promise<UploadOutput>
```

**Updated Factory**:
```typescript
// Now supports CUSTOM!
const storage = ShogunIpfs({
  service: "CUSTOM",
  config: {
    url: "https://relay.shogun-eco.xyz/api/v1/ipfs",
    token: "admin-token"
  }
});
```

### 🧹 Dependencies Cleanup

**Removed** (unused):
- `axios` - Not needed (using native fetch/http)
- `dayjs` - Not used in core
- `dotenv` - Not part of library API
- `fs-extra` - Using native fs
- `lru-cache` - Cache not implemented in exported API
- `morgan` - HTTP logging not needed

**Added**:
- `form-data` - For multipart uploads in Node.js

**Kept** (essential):
- `ipfs-http-client` - For IPFS-CLIENT service
- `pinata-web3` - For PINATA service
- `winston` - For logging

### 📊 Rate Limiting

| Service | Rate Limit | Between Requests |
|---------|------------|------------------|
| PINATA | 2 req/sec | 500ms |
| IPFS-CLIENT | 5 req/sec | 200ms |
| **CUSTOM** | **10 req/sec** | **100ms** |

### 🔍 Auto-Discovery (CUSTOM Gateway)

**Upload** (tries in order):
1. `{baseUrl}/upload` - Relay format (Shogun Relay)
2. `{baseUrl}/api/v0/add` - Standard IPFS API
3. `{baseUrl}/add` - Simplified format

**Download** (tries in order):
1. `{baseUrl}/content/{hash}` - Relay format with metadata
2. `{baseUrl}/ipfs/{hash}` - Standard gateway format
3. `{baseUrl}/api/v0/cat?arg={hash}` - IPFS API format

**Unpin**:
- `{baseUrl}/pins/rm` with POST body `{cid: hash}`

### 📝 Documentation Updates

- Updated README.md with CUSTOM gateway examples
- Added SHIP-05 integration guide
- Updated DOCS_LLM.md with complete API reference
- Added comparison table for service selection
- Documented endpoint auto-discovery behavior

### 🎯 Integration with Shogun Ecosystem

Now fully compatible with:
- **SHIP-05**: Decentralized File Storage
- **Shogun Relay**: Custom IPFS gateway
- **SHIP-00**: SEA encryption integration

### 🔧 Breaking Changes

None! All changes are backward compatible.

Existing code using PINATA or IPFS-CLIENT will continue to work without modifications.

### 📦 Migration Guide

If you want to use the new CUSTOM service:

**Before** (manual fetch):
```typescript
const response = await fetch(`${url}/upload`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});
```

**After** (with shogun-ipfs):
```typescript
const storage = ShogunIpfs({
  service: "CUSTOM",
  config: { url, token }
});

const result = await storage.uploadBuffer(buffer);
// Automatically tries multiple endpoints!
```

### 🐛 Bug Fixes

- Fixed `uploadFile` to use `uploadBuffer` internally (DRY principle)
- Improved error messages for configuration validation
- Added proper TypeScript types for all services

---

## [1.0.1] - Previous Release

Initial release with PINATA and IPFS-CLIENT support.

