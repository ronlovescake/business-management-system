import type { Product, Prisma } from '@prisma/client';

export type ProductDTO = {
  id?: number;
  'Shipment Code': string | null;
  'CV Number': string | null;
  'No. Of Sacks': number;
  'Total CBM': number;
  Weight: number;
  'Shipment Status': string | null;
  'Posting Date': string | null;
  'Order Date': string | null;
  Payment: string | null;
  Product: string | null;
  'Product Code': string | null;
  'Age Range': string | null;
  Unit: string | null;
  'Unit Price': number;
  Quantity: number;
  'Alibaba Shipping Cost': number;
  'Exchange Rates': number;
  PHP: number;
  'Sub Total (PHP)': number;
  'Transaction Fee': number;
  'Grand Total': number;
  "Forwarder's Fee": number;
  Lalamove: number;
  'Packaging Cost': number;
  'Suggested Price': number;
  'Actual Price': number;
  'Base Price': number;
  COGS: number;
  'Projected Sales': number;
  'Projected Profit': number;
  'Projected Profit (%)': number;
  'Total Markup': number;
  'Link To Post': string | null;
  'Bulk Quantity': number;
  'Bulk Weight': number;
  'Weight Per Piece': number;
  createdAt?: string;
};

export function mapToDTO(product: Product): ProductDTO {
  return {
    id: product.id,
    'Shipment Code': product.shipmentCode,
    'CV Number': product.cvNumber,
    'No. Of Sacks': product.noOfSacks ?? 0,
    'Total CBM': product.totalCBM ?? 0,
    Weight: product.weight ?? 0,
    'Shipment Status': product.shipmentStatus,
    'Posting Date': product.postingDate,
    'Order Date': product.orderDate,
    Payment: product.payment,
    Product: product.product,
    'Product Code': product.productCode,
    'Age Range': product.ageRange,
    Unit: product.unit,
    'Unit Price': product.unitPrice ?? 0,
    Quantity: product.quantity ?? 0,
    'Alibaba Shipping Cost': product.alibabaShippingCost ?? 0,
    'Exchange Rates': product.exchangeRates ?? 0,
    PHP: product.php ?? 0,
    'Sub Total (PHP)': product.subTotalPHP ?? 0,
    'Transaction Fee': product.transactionFee ?? 0,
    'Grand Total': product.grandTotal ?? 0,
    "Forwarder's Fee": product.forwardersFee ?? 0,
    Lalamove: product.lalamove ?? 0,
    'Packaging Cost': product.packagingCost ?? 0,
    'Suggested Price': product.suggestedPrice ?? 0,
    'Actual Price': product.actualPrice ?? 0,
    'Base Price': product.basePrice ?? 0,
    COGS: product.cogs ?? 0,
    'Projected Sales': product.projectedSales ?? 0,
    'Projected Profit': product.projectedProfit ?? 0,
    'Projected Profit (%)': product.projectedProfitPercent ?? 0,
    'Total Markup': product.totalMarkup ?? 0,
    'Link To Post': product.linkToPost,
    'Bulk Quantity': product.bulkQuantity ?? 0,
    'Bulk Weight': product.bulkWeight ?? 0,
    'Weight Per Piece': product.weightPerPiece ?? 0,
    createdAt: product.createdAt?.toISOString?.() ?? undefined,
  };
}

export function mapFromDTO(payload: ProductDTO): Prisma.ProductCreateInput {
  return {
    shipmentCode: payload['Shipment Code'],
    cvNumber: payload['CV Number'],
    noOfSacks: payload['No. Of Sacks'],
    totalCBM: payload['Total CBM'],
    weight: payload.Weight,
    shipmentStatus: payload['Shipment Status'],
    postingDate: payload['Posting Date'],
    orderDate: payload['Order Date'],
    payment: payload.Payment,
    product: payload.Product,
    productCode: payload['Product Code'],
    ageRange: payload['Age Range'],
    unit: payload.Unit,
    unitPrice: payload['Unit Price'],
    quantity: payload.Quantity,
    alibabaShippingCost: payload['Alibaba Shipping Cost'],
    exchangeRates: payload['Exchange Rates'],
    php: payload.PHP,
    subTotalPHP: payload['Sub Total (PHP)'],
    transactionFee: payload['Transaction Fee'],
    grandTotal: payload['Grand Total'],
    forwardersFee: payload["Forwarder's Fee"],
    lalamove: payload.Lalamove,
    packagingCost: payload['Packaging Cost'],
    suggestedPrice: payload['Suggested Price'],
    actualPrice: payload['Actual Price'],
    basePrice: payload['Base Price'],
    cogs: payload.COGS,
    projectedSales: payload['Projected Sales'],
    projectedProfit: payload['Projected Profit'],
    projectedProfitPercent: payload['Projected Profit (%)'],
    totalMarkup: payload['Total Markup'],
    linkToPost: payload['Link To Post'],
    bulkQuantity: payload['Bulk Quantity'],
    bulkWeight: payload['Bulk Weight'],
    weightPerPiece: payload['Weight Per Piece'],
  };
}
