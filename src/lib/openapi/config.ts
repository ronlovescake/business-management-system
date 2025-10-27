/**
 * OpenAPI Configuration
 * 
 * Generates OpenAPI 3.0 specification from Zod schemas
 * for API documentation and testing.
 */

import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';

// Create a registry for all API routes
export const registry = new OpenAPIRegistry();

// OpenAPI Document Configuration
export const openAPIConfig = {
  openapi: '3.0.0',
  info: {
    title: 'Business Management System API',
    version: '1.0.0',
    description: `
# Business Management System API Documentation

Complete API documentation for the Business Management System.

## Features
- **Operations Management**: Customers, Products, Transactions, Prices, Shipments
- **Employee Management**: Team, Attendance, Payroll, Schedules, Leaves, Expenses
- **Financial Management**: Thirteenth Month Pay, Cash Advances, Employee Loans

## Authentication
Authentication is currently **DEFERRED** and will be implemented before production deployment.
All endpoints are currently accessible without authentication (development only).

## Error Responses
All endpoints return standardized error responses:

\`\`\`json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": "Additional context",
  "field": "fieldName",  // For validation errors
  "suggestions": ["How to fix"],
  "timestamp": "2025-10-27T14:00:00.000Z",
  "requestId": "uuid"
}
\`\`\`

## Common Status Codes
- \`200 OK\` - Success
- \`201 Created\` - Resource created successfully
- \`400 Bad Request\` - Invalid input or validation error
- \`404 Not Found\` - Resource not found
- \`409 Conflict\` - Duplicate resource or constraint violation
- \`429 Too Many Requests\` - Rate limit exceeded (when implemented)
- \`500 Internal Server Error\` - Server error

## Request/Response Format
- All requests and responses use \`application/json\`
- Dates are in ISO 8601 format
- Soft deletes: Deleted records have \`deletedAt\` timestamp
    `,
    contact: {
      name: 'API Support',
      email: 'support@example.com', // TODO: Update with actual contact
    },
    license: {
      name: 'Proprietary',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000/api',
      description: 'Development server',
    },
    {
      url: 'https://yourdomain.com/api',
      description: 'Production server (to be deployed)',
    },
  ],
  tags: [
    {
      name: 'Customers',
      description: 'Customer management operations',
    },
    {
      name: 'Products',
      description: 'Product catalog management',
    },
    {
      name: 'Prices',
      description: 'Product pricing management',
    },
    {
      name: 'Transactions',
      description: 'Sales transactions and orders',
    },
    {
      name: 'Shipments',
      description: 'Shipment tracking and management',
    },
    {
      name: 'Employees',
      description: 'Employee directory and profiles',
    },
    {
      name: 'Attendance',
      description: 'Employee attendance tracking',
    },
    {
      name: 'Schedules',
      description: 'Work schedule management',
    },
    {
      name: 'Payroll',
      description: 'Payroll processing and management',
    },
    {
      name: 'Leave Requests',
      description: 'Leave request management',
    },
    {
      name: 'Expenses',
      description: 'Employee expense tracking',
    },
    {
      name: 'Cash Advances',
      description: 'Employee cash advance management',
    },
    {
      name: 'Thirteenth Month Pay',
      description: 'Thirteenth month pay calculations',
    },
    {
      name: 'Reports',
      description: 'Report generation (invoices, packing lists, distribution)',
    },
    {
      name: 'System',
      description: 'System utilities (health check, backup, restore)',
    },
  ],
  components: {
    securitySchemes: {
      // Future: JWT authentication
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token (to be implemented)',
      },
    },
    schemas: {
      // Common error response
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Human-readable error message',
          },
          code: {
            type: 'string',
            description: 'Machine-readable error code',
          },
          details: {
            type: 'string',
            description: 'Additional error context',
          },
          field: {
            type: 'string',
            description: 'Field name for validation errors',
          },
          suggestions: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Recovery suggestions',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'ISO 8601 timestamp',
          },
          requestId: {
            type: 'string',
            description: 'Request tracking ID',
          },
        },
        required: ['error'],
      },
      // Common success response wrapper
      SuccessResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          data: {
            type: 'object',
            description: 'Response data',
          },
          message: {
            type: 'string',
            description: 'Optional success message',
          },
        },
      },
    },
  },
  // Future: Security requirements (will be applied globally when auth is implemented)
  // security: [{ bearerAuth: [] }],
};

/**
 * Generate OpenAPI specification
 */
export function generateOpenAPISpec() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument(openAPIConfig);
}
