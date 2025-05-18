# Shogun IPFS 🏓 

🌐 shogun-ipfs is a lightweight wrapper for IPFS storage services that provides a simplified interface for interacting with IPFS networks.

📦 With support for multiple storage providers, shogun-ipfs makes it easy to upload, retrieve, and manage content on IPFS without having to deal with the complexities of different API implementations.

🚀 Perfect for developers who need an easy-to-use, reliable way to integrate IPFS storage into their applications.

## Features

- 🚀 **Simple to Use**: Easy and consistent API for IPFS operations
- 📦 **Multiple Storage Providers**: Support for Pinata and direct IPFS nodes
- 🛡️ **Robust Error Handling**: Comprehensive error management
- 🔄 **Rate Limiting**: Built-in protection against API throttling
- 📝 **Structured Logging**: Detailed operation tracking
- 🧩 **Flexible Configuration**: Customizable settings for different environments

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

// Initialize shogun-ipfs
const ipfs = new ShogunIpfs({
  storage: {
    service: "PINATA" as const,
    config: {
      pinataJwt: process.env.PINATA_JWT || "",
      pinataGateway: process.env.PINATA_GATEWAY || "",
    },
  },
  performance: {
    maxConcurrent: 3,
    chunkSize: 1024 * 1024,
    cacheEnabled: true,
  },
});

// Upload JSON data
const result = await ipfs.uploadJson({ name: "test", value: "example data" });
console.log("Content uploaded:", result.id);

// Upload a file
const fileResult = await ipfs.uploadFile("./path/to/image.jpg");
console.log("File uploaded:", fileResult.id);

// Retrieve data
const data = await ipfs.getData(result.id);
console.log("Retrieved data:", data);

// Check if content is pinned
const isPinned = await ipfs.isPinned(result.id);
console.log("Is pinned:", isPinned);

// Unpin when no longer needed
const unpinned = await ipfs.unpin(result.id);
if (unpinned) {
  console.log("Content unpinned successfully");
} else {
  console.log("Content not found or unpin failed");
}
```

## Configuration

```typescript
const config = {
  storage: {
    service: "IPFS-CLIENT" as const, // or "IPFS-CLIENT"
    config: {
      pinataJwt: process.env.PINATA_JWT || "",
      pinataGateway: process.env.PINATA_GATEWAY || "",
      // For IPFS-CLIENT: url: "http://localhost:5001"
    },
  },
};

const ipfs = new ShogunIpfs(config);
```

## Storage Providers

Currently supported:

- **PINATA**: Managed IPFS storage with automatic hash validation and error handling. Requires a Pinata JWT token.
- **IPFS-CLIENT**: Direct IPFS node connection for decentralized storage. Requires a running IPFS node with its HTTP API endpoint.

### PINATA Configuration

```typescript
const config = {
  storage: {
    service: "PINATA" as const,
    config: {
      pinataJwt: process.env.PINATA_JWT || "",
      pinataGateway: process.env.PINATA_GATEWAY || "",
    },
  },
};
```

### IPFS-CLIENT Configuration

```typescript
const config = {
  storage: {
    service: "IPFS-CLIENT" as const,
    config: {
      url: "http://localhost:5001", // Your IPFS node HTTP API endpoint
    },
  },
};
```

## Main Operations

### Upload Operations

```typescript
// Upload JSON data directly
const jsonResult = await ipfs.uploadJson({
  name: "test",
  data: { key: "value" },
});
console.log("JSON uploaded:", jsonResult.id);

// Upload a buffer
const buffer = Buffer.from("Hello, IPFS!");
const bufferResult = await ipfs.uploadBuffer(buffer);
console.log("Buffer uploaded:", bufferResult.id);

// Upload a single file
const fileResult = await ipfs.uploadFile("./path/to/file.txt");
console.log("File uploaded:", fileResult.id);
```

### Retrieval Operations

```typescript
// Get data by hash
const data = await ipfs.getData("QmHash...");
console.log("Retrieved data:", data);

// Get metadata
const metadata = await ipfs.getMetadata("QmHash...");
console.log("Content metadata:", metadata);
```

### Pin Management

```typescript
// Check if content is pinned
const isPinned = await ipfs.isPinned("QmHash...");
console.log("Is content pinned?", isPinned);

// Unpin content
const unpinned = await ipfs.unpin("QmHash...");
if (unpinned) {
  console.log("Content unpinned successfully");
}

// Get storage service instance for advanced operations
const storage = ipfs.getStorage();
```

## Error Handling

shogun-ipfs implements comprehensive error handling for all operations:

```typescript
try {
  const result = await ipfs.uploadFile("./path/to/file.txt");
  console.log("Uploaded to:", result.id);
} catch (error) {
  if (error.message.includes("INVALID_CREDENTIALS")) {
    console.error("Authentication failed. Check your Pinata JWT token.");
  } else if (error.message.includes("NOT_FOUND")) {
    console.error("File not found or not accessible.");
  } else {
    console.error("Upload failed:", error.message);
  }
}
```

## Best Practices

1. **Rate Limiting Awareness**
   - The library implements rate limiting to avoid API throttling
   - For bulk operations, consider adding additional delay between calls

2. **Error Handling**
   - Always wrap operations in try/catch blocks
   - Check for specific error types to provide better user feedback

3. **Content Management**
   - Regularly check and unpin content that is no longer needed
   - Monitor the pinned content size, especially with paid services

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
