# Data Synchronization Fix: Shipments → Products Cascade

## Issue Identified

**Problem:** Products were not automatically getting their `shipmentStatus` field populated when shipments were created, even though they had matching `shipmentCode` values.

**Root Cause:** The cascade update logic only existed in the shipment **UPDATE** (PUT) endpoint, not in the shipment **CREATE** (POST) endpoint.

## Investigation Results

### What We Found

1. **Product Import Behavior:**
   - When products are imported via CSV, the `Shipment Status` field is populated from the import data
   - If the CSV doesn't include a `Shipment Status` column, it defaults to `null`
   - Products do NOT automatically look up their shipment to get the status

2. **Shipment Update Behavior (WORKING):**
   - Located in `/src/app/api/shipments/[id]/route.ts` (lines 125-140)
   - When a shipment is updated, it correctly cascades changes to all products with matching `shipmentCode`
   - Updates: `cvNumber`, `noOfSacks`, `totalCBM`, `weight`, `shipmentStatus`

3. **Shipment Create Behavior (WAS BROKEN):**
   - Located in `/src/app/api/shipments/route.ts`
   - When shipments were created (both single and bulk), there was NO cascade to products
   - This left products with `shipmentStatus = null` even though a shipment existed

### User's Workaround

The user had to:
1. Change the shipment status to something else (e.g., "For Pickup")
2. Change it back to "Sorting"
3. This triggered the UPDATE endpoint's cascade logic, which properly synced the status to products

## Fix Implemented

### Changes Made

**File:** `/src/app/api/shipments/route.ts`

#### 1. Bulk Import Cascade (Lines ~167-187)

```typescript
if (existing) {
  // Update existing shipment and restore if soft-deleted
  const wasDeleted = existing.deletedAt !== null;
  await tx.shipment.update({
    where: { id: existing.id },
    data: {
      ...shipmentData,
      deletedAt: null,
    },
  });

  // ✅ NEW: Cascade update to products
  await tx.product.updateMany({
    where: { shipmentCode: shipmentCode },
    data: {
      cvNumber: shipmentData.cvNumber,
      noOfSacks: shipmentData.noOfSacks,
      totalCBM: shipmentData.totalCBM,
      weight: shipmentData.weight,
      shipmentStatus: shipmentData.shipmentStatus,
    },
  });

  if (wasDeleted) {
    restored++;
  } else {
    updated++;
  }
} else {
  // Create new shipment
  await tx.shipment.create({
    data: shipmentData,
  });

  // ✅ NEW: Cascade create to products
  await tx.product.updateMany({
    where: { shipmentCode: shipmentCode },
    data: {
      cvNumber: shipmentData.cvNumber,
      noOfSacks: shipmentData.noOfSacks,
      totalCBM: shipmentData.totalCBM,
      weight: shipmentData.weight,
      shipmentStatus: shipmentData.shipmentStatus,
    },
  });

  created++;
}
```

#### 2. Single Shipment Creation Cascade (Lines ~225-245)

```typescript
} else {
  // Single shipment creation
  const shipmentData = convertShipmentDataToDB(body);
  const createdShipment = await prisma.shipment.create({
    data: shipmentData,
  });

  // ✅ NEW: Cascade update to products with this shipment code
  if (shipmentData.shipmentCode) {
    await prisma.product.updateMany({
      where: {
        shipmentCode: shipmentData.shipmentCode,
      },
      data: {
        cvNumber: shipmentData.cvNumber,
        noOfSacks: shipmentData.noOfSacks,
        totalCBM: shipmentData.totalCBM,
        weight: shipmentData.weight,
        shipmentStatus: shipmentData.shipmentStatus,
      },
    });

    logger.debug(
      `Cascaded shipment data to products with code: ${shipmentData.shipmentCode}`
    );
  }

  const convertedShipment = convertShipmentDBToData(
    createdShipment as ShipmentDB
  );

  logger.info('✅ Created single shipment');

  return NextResponse.json(convertedShipment, { status: 201 });
}
```

## Expected Behavior After Fix

### Scenario 1: Import Products First, Then Shipment
1. User imports products via CSV (without Shipment Status column)
2. Products have `shipmentStatus = null`
3. User creates/imports shipment with matching `Shipment Code`
4. **✅ NEW:** All products with that `shipmentCode` automatically get updated with:
   - CV Number
   - No. Of Sacks
   - Total CBM
   - Weight
   - **Shipment Status**

### Scenario 2: Import Shipment First, Then Products
1. User imports shipment with status "Sorting"
2. User imports products with matching `Shipment Code` (without status)
3. Products have `shipmentStatus = null` initially
4. User would still need to update the shipment to trigger cascade
5. **Alternative solution needed:** Consider adding shipment lookup during product creation

### Scenario 3: Update Existing Shipment
1. User changes shipment status from "Sorting" to "For Pickup"
2. **✅ ALREADY WORKING:** All products with that `shipmentCode` get updated
3. This behavior is unchanged

## Testing Checklist

- [ ] Import products without Shipment Status
- [ ] Create a new shipment with matching Shipment Code
- [ ] Verify products now have the shipment's status
- [ ] Bulk import shipments
- [ ] Verify all products get updated
- [ ] Update existing shipment status
- [ ] Verify cascade still works (regression test)

## Potential Future Enhancements

1. **Bi-directional Sync on Product Creation:**
   - When a product is created, look up its shipment and populate shipment fields
   - Would eliminate the need for manual workarounds in Scenario 2

2. **Background Sync Job:**
   - Periodic job to find products with `shipmentStatus = null` but valid `shipmentCode`
   - Automatically populate from shipment data

3. **API Endpoint for Manual Sync:**
   - `/api/products/sync-shipment-data` endpoint
   - Allows admin to trigger sync for all products

## Related Files

- `/src/app/api/shipments/route.ts` - Shipment creation (POST) - **FIXED**
- `/src/app/api/shipments/[id]/route.ts` - Shipment update (PUT) - Already working
- `/src/app/api/products/route.ts` - Product creation (POST) - Could be enhanced
- `/src/modules/clothing/operations/sorting-distribution/services/SortingDistributionService.ts` - Filters by `Shipment Status`

## Session Date

October 29, 2025
