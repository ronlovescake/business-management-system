/**
 * General Merchandise Dispatch Orders API Route
 * Handles CRUD operations for GM dispatch orders
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { Prisma } from '@prisma/client';

const gmPrisma = prisma as unknown as {
  generalMerchandiseDispatchOrder: typeof prisma.dispatchOrder;
};

/**
 * GET /api/general-merchandise/dispatch/orders
 * Retrieve all dispatch orders from the latest import
 * Transforms database camelCase fields back to XLSX column names
 */
export async function GET() {
  try {
    const orders = await gmPrisma.generalMerchandiseDispatchOrder.findMany({
      orderBy: {
        importedAt: 'desc',
      },
    });

    // Transform database records back to XLSX format (camelCase → 'Column Name')
    const transformedOrders = orders.map((order) => ({
      'Order ID': order.orderId,
      'Order Status': order.orderStatus,
      'Return/Refund Status': order.returnRefundStatus,
      'Tracking Number': order.trackingNumber,
      'Shipping Option': order.shippingOption,
      'Shipment Method': order.shipmentMethod,
      'Estimated Ship Out Date': order.estimatedShipOutDate,
      'Ship Time': order.shipTime,
      'Order Creation Date': order.orderCreationDate,
      'Order Paid Time': order.orderPaidTime,
      'Parent SKU Reference No': order.parentSkuReferenceNo,
      'Product Name': order.productName,
      'SKU Reference No': order.skuReferenceNo,
      'Variation Name': order.variationName,
      'Original Price': order.originalPrice,
      'Deal Price': order.dealPrice,
      Quantity: order.quantity,
      'Product Subtotal': order.productSubtotal,
      'Total Discount': order.totalDiscount,
      'Price Discount From Seller': order.priceDiscountFromSeller,
      'Shopee Rebate': order.shopeeRebate,
      'SKU Total Weight': order.skuTotalWeight,
      'Number of Products in Order (Seller)': order.numberOfProductsSeller,
      'Original Shipping Fee': order.originalShippingFee,
      'Shipping Fee Rebate (Seller)': order.shippingFeeRebateSeller,
      'Reverse Shipping Fee': order.reverseShippingFee,
      'Service Fee': order.serviceFee,
      'Grand Total': order.grandTotal,
      'Estimated Shipping Fee': order.estimatedShippingFee,
      'Username (Buyer)': order.usernameBuyer,
      'Receiver Name': order.receiverName,
      'Phone Number': order.phoneNumber,
      'Delivery Address': order.deliveryAddress,
      Town: order.town,
      District: order.district,
      Province: order.province,
      Region: order.region,
      Country: order.country,
      'Zip Code': order.zipCode,
      'Remark from buyer': order.remarkFromBuyer,
      'Order Complete Time': order.orderCompleteTime,
      Note: order.note,
      // Internal fields
      _linkedCustomerId: order.linkedCustomerId,
      _importedAt: order.importedAt,
    }));

    logger.info(`Retrieved ${orders.length} GM dispatch orders`);

    return NextResponse.json({
      success: true,
      data: transformedOrders,
      count: transformedOrders.length,
    });
  } catch (error) {
    logger.error('Error fetching GM dispatch orders:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch dispatch orders',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/general-merchandise/dispatch/orders
 * Replace all existing dispatch orders with new import
 * This truncates existing data and inserts new orders
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orders } = body;

    if (!Array.isArray(orders)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request format. Expected { orders: [...] }',
        },
        { status: 400 }
      );
    }

    // Use transaction to ensure atomicity (all-or-nothing)
    const result = await prisma.$transaction(async (tx) => {
      const gmTx = tx as unknown as typeof gmPrisma;
      // Step 1: Delete all existing dispatch orders
      const deleteResult =
        await gmTx.generalMerchandiseDispatchOrder.deleteMany({});
      logger.info(`Deleted ${deleteResult.count} existing GM dispatch orders`);

      // Step 2: Transform and validate incoming data
      const ordersToCreate: Prisma.DispatchOrderCreateManyInput[] = orders.map(
        (order: Record<string, unknown>) => ({
          orderId: String(order['Order ID'] || ''),
          orderStatus: order['Order Status']
            ? String(order['Order Status'])
            : null,
          returnRefundStatus: order['Return/Refund Status']
            ? String(order['Return/Refund Status'])
            : null,
          trackingNumber: order['Tracking Number']
            ? String(order['Tracking Number'])
            : null,
          shippingOption: order['Shipping Option']
            ? String(order['Shipping Option'])
            : null,
          shipmentMethod: order['Shipment Method']
            ? String(order['Shipment Method'])
            : null,
          estimatedShipOutDate: order['Estimated Ship Out Date']
            ? String(order['Estimated Ship Out Date'])
            : null,
          shipTime: order['Ship Time'] ? String(order['Ship Time']) : null,
          orderCreationDate: order['Order Creation Date']
            ? String(order['Order Creation Date'])
            : null,
          orderPaidTime: order['Order Paid Time']
            ? String(order['Order Paid Time'])
            : null,
          parentSkuReferenceNo: order['Parent SKU Reference No']
            ? String(order['Parent SKU Reference No'])
            : null,
          productName: order['Product Name']
            ? String(order['Product Name'])
            : null,
          skuReferenceNo: order['SKU Reference No']
            ? String(order['SKU Reference No'])
            : null,
          variationName: order['Variation Name']
            ? String(order['Variation Name'])
            : null,
          originalPrice:
            order['Original Price'] !== undefined &&
            order['Original Price'] !== null
              ? Number(order['Original Price'])
              : null,
          dealPrice:
            order['Deal Price'] !== undefined && order['Deal Price'] !== null
              ? Number(order['Deal Price'])
              : null,
          quantity:
            order['Quantity'] !== undefined && order['Quantity'] !== null
              ? Number(order['Quantity'])
              : null,
          productSubtotal:
            order['Product Subtotal'] !== undefined &&
            order['Product Subtotal'] !== null
              ? Number(order['Product Subtotal'])
              : null,
          totalDiscount:
            order['Total Discount'] !== undefined &&
            order['Total Discount'] !== null
              ? Number(order['Total Discount'])
              : null,
          priceDiscountFromSeller:
            order['Price Discount From Seller'] !== undefined &&
            order['Price Discount From Seller'] !== null
              ? Number(order['Price Discount From Seller'])
              : null,
          shopeeRebate:
            order['Shopee Rebate'] !== undefined &&
            order['Shopee Rebate'] !== null
              ? Number(order['Shopee Rebate'])
              : null,
          skuTotalWeight:
            order['SKU Total Weight'] !== undefined &&
            order['SKU Total Weight'] !== null
              ? Number(order['SKU Total Weight'])
              : null,
          numberOfProductsSeller:
            order['Number of Products in Order (Seller)'] !== undefined &&
            order['Number of Products in Order (Seller)'] !== null
              ? Number(order['Number of Products in Order (Seller)'])
              : null,
          originalShippingFee:
            order['Original Shipping Fee'] !== undefined &&
            order['Original Shipping Fee'] !== null
              ? Number(order['Original Shipping Fee'])
              : null,
          shippingFeeRebateSeller:
            order['Shipping Fee Rebate (Seller)'] !== undefined &&
            order['Shipping Fee Rebate (Seller)'] !== null
              ? Number(order['Shipping Fee Rebate (Seller)'])
              : null,
          reverseShippingFee:
            order['Reverse Shipping Fee'] !== undefined &&
            order['Reverse Shipping Fee'] !== null
              ? Number(order['Reverse Shipping Fee'])
              : null,
          serviceFee:
            order['Service Fee'] !== undefined && order['Service Fee'] !== null
              ? Number(order['Service Fee'])
              : null,
          grandTotal:
            order['Grand Total'] !== undefined && order['Grand Total'] !== null
              ? Number(order['Grand Total'])
              : null,
          estimatedShippingFee:
            order['Estimated Shipping Fee'] !== undefined &&
            order['Estimated Shipping Fee'] !== null
              ? Number(order['Estimated Shipping Fee'])
              : null,
          usernameBuyer: order['Username (Buyer)']
            ? String(order['Username (Buyer)'])
            : null,
          receiverName: order['Receiver Name']
            ? String(order['Receiver Name'])
            : null,
          phoneNumber: order['Phone Number']
            ? String(order['Phone Number'])
            : null,
          deliveryAddress: order['Delivery Address']
            ? String(order['Delivery Address'])
            : null,
          town: order['Town'] ? String(order['Town']) : null,
          district: order['District'] ? String(order['District']) : null,
          province: order['Province'] ? String(order['Province']) : null,
          region: order['Region'] ? String(order['Region']) : null,
          country: order['Country'] ? String(order['Country']) : null,
          zipCode: order['Zip Code'] ? String(order['Zip Code']) : null,
          remarkFromBuyer: order['Remark from buyer']
            ? String(order['Remark from buyer'])
            : null,
          orderCompleteTime: order['Order Complete Time']
            ? String(order['Order Complete Time'])
            : null,
          note: order['Note'] ? String(order['Note']) : null,
          linkedCustomerId: null, // Will be set when customer is linked
        })
      );

      // Step 3: Bulk insert new orders
      const createResult =
        await gmTx.generalMerchandiseDispatchOrder.createMany({
          data: ordersToCreate,
          skipDuplicates: false, // Since we deleted all, no duplicates expected
        });

      logger.info(`Created ${createResult.count} new GM dispatch orders`);

      return {
        deleted: deleteResult.count,
        created: createResult.count,
      };
    });

    return NextResponse.json({
      success: true,
      message: 'Dispatch orders replaced successfully',
      data: result,
    });
  } catch (error) {
    logger.error('Error saving GM dispatch orders:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save dispatch orders',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/general-merchandise/dispatch/orders
 * Delete all dispatch orders (clear database)
 */
export async function DELETE() {
  try {
    const result = await gmPrisma.generalMerchandiseDispatchOrder.deleteMany(
      {}
    );

    logger.info(`Deleted ${result.count} GM dispatch orders`);

    return NextResponse.json({
      success: true,
      message: 'All dispatch orders deleted',
      deleted: result.count,
    });
  } catch (error) {
    logger.error('Error deleting GM dispatch orders:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete dispatch orders',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
