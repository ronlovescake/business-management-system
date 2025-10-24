# Batch Import - Quick Reference

## 🚀 Quick Start (Copy & Paste)

```typescript
import { useBatchImport } from '@/hooks/useBatchImport';

// In your component
const { startImport, progress, status, result, retryFailed, exportFailed } =
  useBatchImport<YourType>({
    maxRetries: 3,
    onSuccess: () => alert('Done!'),
    onError: (err) => alert(err),
  });

// Start import
await startImport(records, '/api/your-endpoint');

// Retry failed
if (result?.failed.length > 0) {
  await retryFailed();
}

// Export failed to CSV
exportFailed();
```

---

## 📊 Hook Returns

| Property                         | Type           | Use Case                      |
| -------------------------------- | -------------- | ----------------------------- |
| `startImport(records, endpoint)` | function       | Start batch import            |
| `retryFailed()`                  | function       | Retry failed batches          |
| `exportFailed()`                 | function       | Download failed records CSV   |
| `reset()`                        | function       | Clear all state               |
| `progress`                       | number (0-100) | Show progress bar             |
| `status`                         | string         | Display status message        |
| `isImporting`                    | boolean        | Disable buttons during import |
| `result`                         | object         | Show summary stats            |
| `error`                          | string         | Display error message         |

---

## 📈 Progress Bar Example

```tsx
{
  isImporting && (
    <div>
      <div className="w-full bg-gray-200 h-4 rounded">
        <div
          className="bg-blue-600 h-4 rounded"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p>{status}</p>
    </div>
  );
}
```

---

## 📊 Results Summary Example

```tsx
{
  result && (
    <div>
      <p>✅ Imported: {result.summary.recordsImported}</p>
      <p>❌ Failed: {result.summary.recordsFailed}</p>

      {result.failed.length > 0 && (
        <>
          <button onClick={retryFailed}>🔄 Retry</button>
          <button onClick={exportFailed}>📥 Export Failed</button>
        </>
      )}
    </div>
  );
}
```

---

## 🎯 Common Use Cases

### Case 1: Basic Import

```typescript
await startImport(records, '/api/transactions');
```

### Case 2: Import with Custom Batch Size

```typescript
const { startImport } = useBatchImport({ batchSize: 500 });
await startImport(records, '/api/transactions');
```

### Case 3: Import with More Retries

```typescript
const { startImport } = useBatchImport({ maxRetries: 5 });
await startImport(records, '/api/transactions');
```

### Case 4: Import with Callbacks

```typescript
const { startImport } = useBatchImport({
  onSuccess: () => {
    toast.success('Import complete!');
    router.refresh();
  },
  onError: (err) => {
    toast.error(`Import failed: ${err}`);
  },
});
```

---

## 🔧 Direct Utility Usage (No Hook)

```typescript
import {
  importInBatches,
  exportFailedRecordsToCSV,
} from '@/lib/utils/batchImport';

// Import
const result = await importInBatches(records, {
  endpoint: '/api/transactions',
  maxRetries: 3,
  onProgress: (status) => console.log(status),
});

// Export failures
if (result.failed.length > 0) {
  exportFailedRecordsToCSV(result.failed, 'failed-records.csv');
}
```

---

## 📋 Checklist

Before importing:

- [ ] CSV parsed correctly
- [ ] Records have correct TypeScript type
- [ ] API endpoint tested with Postman/curl
- [ ] API accepts JSON array: `{ records: T[] }`
- [ ] API returns proper error responses
- [ ] Batch size ≤ 1000 records
- [ ] Pre-validation done (optional but recommended)

During import:

- [ ] Progress bar showing
- [ ] Status message updating
- [ ] Import button disabled
- [ ] User can cancel if needed

After import:

- [ ] Show success/failure summary
- [ ] Display retry button if failures
- [ ] Display export button if failures
- [ ] Allow user to reset and try again

---

## ⚠️ Common Issues

| Issue            | Solution                                        |
| ---------------- | ----------------------------------------------- |
| Timeout          | Reduce batch size to 500                        |
| Memory crash     | Split CSV into smaller files                    |
| Too many retries | Check API error codes (400/409 shouldn't retry) |
| Progress stuck   | Check onProgress callback                       |
| TypeScript error | Ensure type extends `Record<string, unknown>`   |

---

## 🎨 UI Components

### Progress Bar (Tailwind)

```tsx
<div className="w-full bg-gray-200 rounded-full h-4">
  <div
    className="bg-blue-600 h-4 rounded-full transition-all"
    style={{ width: `${progress}%` }}
  />
</div>
```

### Status Badge

```tsx
<span
  className={
    isImporting
      ? 'bg-blue-100 text-blue-800'
      : error
        ? 'bg-red-100 text-red-800'
        : 'bg-green-100 text-green-800'
  }
>
  {status}
</span>
```

### Results Card

```tsx
<div className="grid grid-cols-2 gap-4">
  <div className="p-4 bg-green-50 rounded">
    <p className="text-sm text-green-700">Successful</p>
    <p className="text-2xl font-bold text-green-800">
      {result.summary.recordsImported}
    </p>
  </div>

  <div className="p-4 bg-red-50 rounded">
    <p className="text-sm text-red-700">Failed</p>
    <p className="text-2xl font-bold text-red-800">
      {result.summary.recordsFailed}
    </p>
  </div>
</div>
```

---

## 📞 API Requirements

Your endpoint must:

```typescript
POST /api/your-endpoint
Content-Type: application/json

Request Body:
{
  "records": [...] // Array of T (max 1000)
}

Response (Success):
{
  "success": true,
  "count": 1000
}

Response (Error):
{
  "error": "Error message"
}
```

---

## 🧪 Test Scenarios

```typescript
// Test 1: Small batch (< 1000)
await startImport(records.slice(0, 500), '/api/transactions');

// Test 2: Exact batch (1000)
await startImport(records.slice(0, 1000), '/api/transactions');

// Test 3: Multiple batches (5000)
await startImport(records.slice(0, 5000), '/api/transactions');

// Test 4: Large import (20000)
await startImport(allRecords, '/api/transactions');

// Test 5: With duplicates (should fail some)
await startImport(duplicateRecords, '/api/transactions');
await retryFailed(); // Should skip validation errors
exportFailed(); // Export remaining failures
```

---

## 💡 Pro Tips

1. **Always show progress**: Users abandon long operations without feedback
2. **Pre-validate CSV**: Catch format errors before hitting API
3. **Test with small batch first**: Verify API works before large import
4. **Provide retry option**: Network issues are common, let users retry
5. **Export failed records**: Users can fix and re-import easily
6. **Show detailed errors**: Help users understand what went wrong
7. **Disable UI during import**: Prevent double-submissions
8. **Add loading states**: Button text "Importing..." instead of "Import"
9. **Log to console**: Helps debugging (remove in production)
10. **Test error scenarios**: Duplicate records, invalid data, network failure

---

## 📚 Full Documentation

See `BATCH_IMPORT_GUIDE.md` for complete documentation.

---

**Quick Links**:

- Batch Import Utility: `/src/lib/utils/batchImport.ts`
- React Hook: `/src/hooks/useBatchImport.ts`
- Example Component: `/src/components/examples/TransactionImportExample.tsx`
