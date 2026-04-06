import { ApiResponse } from '@/core/api';
import { prisma } from '@/lib/db';
import { createTransitBuildRoutes } from '@/modules/shipments/api/transitBuildRouteFactory';

async function hasGmTransitBuildTable(): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<
      Array<{ regclass: string | null }>
    >`SELECT to_regclass('general_merchandise.inventory_transit_build_entries')::text as regclass`;
    return Boolean(result?.[0]?.regclass);
  } catch (_error) {
    return false;
  }
}

const { GET, POST, PATCH, DELETE } = createTransitBuildRoutes({
  shipmentModel: prisma.generalMerchandiseShipment,
  productModel: prisma.generalMerchandiseProduct,
  transitBuildModel: prisma.generalMerchandiseInventoryTransitBuildEntry,
  $transaction: (ops) => prisma.$transaction(ops),
  preCheck: async () => {
    const ok = await hasGmTransitBuildTable();
    if (!ok) {
      return {
        ok: false as const,
        response: ApiResponse.badRequest(
          'GM transit build-up table is not available',
          { table: 'general_merchandise.inventory_transit_build_entries' }
        ),
      };
    }
    return { ok: true as const };
  },
});

export { GET, POST, PATCH, DELETE };
