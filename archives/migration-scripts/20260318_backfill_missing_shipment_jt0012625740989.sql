-- Backfill the missing shipment row for shipment code JT0012625740989.
--
-- Why this exists:
-- - Multiple products and transactions were linked to shipment code JT0012625740989.
-- - The linked shipment row was missing from public.shipments.
-- - Transaction edits for those products could fail because product-level
--   shipmentStatus was "Delivered" while shipment lookup data was missing.
--
-- Safety:
-- - Non-destructive: inserts only when the shipment row does not already exist.
-- - Sources values from active linked product rows.
-- - Leaves existing shipment rows unchanged.

WITH linked_products AS (
  SELECT
    p."shipmentCode" AS shipment_code,
    NULLIF(MAX(NULLIF(TRIM(p."cvNumber"), '')), '') AS cv_number,
    COALESCE(MAX(p."noOfSacks"), 0)::integer AS no_of_sacks,
    COALESCE(MAX(p."totalCBM"), 0)::double precision AS total_cbm,
    COALESCE(MAX(p."weight"), 0)::double precision AS weight,
    COALESCE(MAX(NULLIF(TRIM(p."shipmentStatus"), '')), 'Delivered') AS shipment_status
  FROM public.products p
  WHERE p."deletedAt" IS NULL
    AND p."shipmentCode" = 'JT0012625740989'
  GROUP BY p."shipmentCode"
),
candidate AS (
  SELECT
    lp.shipment_code,
    lp.cv_number,
    lp.no_of_sacks,
    lp.total_cbm,
    lp.weight,
    lp.shipment_status,
    'Backfilled on 2026-03-18 from linked product records after missing shipment linkage blocked transaction updates.'::text AS notes
  FROM linked_products lp
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.shipments s
    WHERE s."deletedAt" IS NULL
      AND s."shipmentCode" = lp.shipment_code
  )
)
INSERT INTO public.shipments (
  "shipmentCode",
  "cvNumber",
  "noOfSacks",
  "totalCBM",
  "weight",
  fee,
  "shipmentStatus",
  "dateCreated",
  "dateDelivered",
  duration,
  notes,
  "createdAt",
  "updatedAt"
)
SELECT
  c.shipment_code,
  c.cv_number,
  c.no_of_sacks,
  c.total_cbm,
  c.weight,
  0,
  c.shipment_status,
  NULL,
  NULL,
  NULL,
  c.notes,
  NOW(),
  NOW()
FROM candidate c
RETURNING id, "shipmentCode", "shipmentStatus", "noOfSacks", "totalCBM", weight, fee;