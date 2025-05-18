# shogun-ipfs DOCUMENTATION FOR LLM

## SYSTEM OVERVIEW
shogun-ipfs is a lightweight wrapper for IPFS storage services. It provides a simplified interface for uploading and retrieving data from IPFS networks using different storage providers.

## CORE COMPONENTS

1. STORAGE SERVICES
- PINATA: Primary IPFS storage service
  - Requires: pinataJwt, pinataGateway (optional)
  - Handles: file upload, download, pinning
- IPFS-CLIENT: Direct IPFS node connection
  - Requires: url
  - Provides: direct IPFS network access

## CONFIGURATION STRUCTURE
```typescript
interface ShogunIpfsConfig {
  storage: {
    service: 'PINATA' | 'IPFS-CLIENT';
    config: {
      pinataJwt?: string;
      pinataGateway?: string;
      url?: string;
    }
  };
  features?: {
    useIPFS?: boolean;
  };
  paths?: {
    storage?: string;
    logs?: string;
  };
  performance?: {
    chunkSize?: number;
    maxConcurrent?: number;
    cacheEnabled?: boolean;
    cacheSize?: number;
  };
}
```

## MAIN OPERATIONS

1. UPLOAD
```typescript
// Upload JSON data
shogunipfs.uploadJson(data: Record<string, unknown>, options?: any): Promise<UploadOutput>

// Upload a buffer
shogunipfs.uploadBuffer(buffer: Buffer, options?: any): Promise<UploadOutput>

// Upload a file
shogunipfs.uploadFile(filePath: string, options?: any): Promise<UploadOutput>
```

2. RETRIEVE
```typescript
// Get data by CID/hash
shogunipfs.getData(hash: string): Promise<any>

// Get metadata for a CID/hash
shogunipfs.getMetadata(hash: string): Promise<any>
```

3. PIN MANAGEMENT
```typescript
// Check if a hash is pinned
shogunipfs.isPinned(hash: string): Promise<boolean>

// Unpin a hash
shogunipfs.unpin(hash: string): Promise<boolean>
```

## ERROR HANDLING
The system implements comprehensive error handling:
- Storage service errors (connection, authentication)
- File system errors
- Rate limiting and throttling protection

## USAGE EXAMPLES

1. Basic Usage with Pinata
```typescript
const ipfs = new ShogunIpfs({
  storage: {
    service: 'PINATA',
    config: {
      pinataJwt: 'your-jwt-token'
    }
  }
});

// Upload JSON data
const result = await ipfs.uploadJson({ name: 'test', data: [1, 2, 3] });
console.log('Uploaded to:', result.id);

// Retrieve the data
const data = await ipfs.getData(result.id);
```

2. File Upload
```typescript
// Upload a file
const fileResult = await ipfs.uploadFile('./path/to/image.jpg');
console.log('File uploaded to:', fileResult.id);

// Check pinned status
const isPinned = await ipfs.isPinned(fileResult.id);
console.log('Is pinned:', isPinned);
```

## BEST PRACTICES

1. STORAGE
- Monitor IPFS pinning status
- Regular cleanup of unused content (unpin)
- Use rate limiting awareness for API services

2. PERFORMANCE
- Consider file sizes when uploading
- Use appropriate performance settings
- Implement caching for frequently accessed data

## LIMITATIONS AND CONSIDERATIONS

1. PERFORMANCE
- Large file handling requires adequate memory
- IPFS operations depend on network conditions
- Cache size affects memory usage

2. SECURITY
- IPFS content is public by default
- Pinata JWT token must be kept secure
- No built-in encryption (implement separately if needed)

3. COMPATIBILITY
- Node.js environment required
- IPFS network access needed
- File system permissions required for file operations

## LLM INTEGRATION

1. FETCHING DOCUMENTATION
```bash
# Fetch the LLM documentation
curl -L https://raw.githubusercontent.com/scobru/shogun-ipfs/main/DOCS_LLM.txt
```

2. LLM PROMPT EXAMPLES
```text
# For configuration help
"Show me how to configure shogun-ipfs with Pinata storage"

# For operation guidance
"How do I upload and retrieve JSON data using shogun-ipfs?"

# For error handling
"What are the best practices for handling connection errors in shogun-ipfs?"
```

3. STRUCTURED QUERIES
The documentation is organized in sections that can be queried independently:
- SYSTEM OVERVIEW: General understanding
- CORE COMPONENTS: Technical details
- CONFIGURATION: Setup instructions
- MAIN OPERATIONS: API usage
- ERROR HANDLING: Troubleshooting
- BEST PRACTICES: Optimization tips

4. API PATTERNS
When working with shogun-ipfs through an LLM, follow these patterns:
```typescript
// Pattern 1: Basic initialization
const ipfs = new ShogunIpfs({
  storage: {
    service: 'PINATA',
    config: {
      pinataJwt: process.env.PINATA_JWT
    }
  }
});

// Pattern 2: Error handling wrapper
try {
  const result = await ipfs.uploadJson(data);
  console.log('Uploaded to:', result.id);
} catch (error) {
  console.error('Upload failed:', error.message);
}

// Pattern 3: Checking operation success
const unpinned = await ipfs.unpin(hash);
if (!unpinned) {
  console.warn('Failed to unpin or hash not found');
}
```

5. COMMON LLM TASKS
- Configuration validation
- Error message interpretation
- IPFS operation patterns
- Performance optimization
- Integration patterns