/**
 * OpenAPI 3.0 Specification for Business Management System
 *
 * This file contains the complete API documentation spec.
 * Auto-generated types and validation are provided by Zod schemas.
 */

import { OPENAPI_COMPONENTS } from './openapiComponents';

const OPENAPI_INFO_DESCRIPTION = `
# Business Management System API

Complete REST API for managing business operations, employee data, and financial records.

## Features
- **Operations Management**: Customers, Products, Transactions, Prices, Shipments
- **Employee Management**: Team, Attendance, Payroll, Schedules, Leaves, Expenses
- **Financial Management**: Thirteenth Month Pay, Cash Advances

## Authentication
Authentication is currently **DEFERRED** and will be implemented before production deployment.
All endpoints are accessible without authentication in development.

## Error Responses
All endpoints return standardized error responses:

\`\`\`json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": "Additional context",
  "timestamp": "2025-10-27T14:00:00.000Z"
}
\`\`\`

## Status Codes
- \`200 OK\` - Success
- \`201 Created\` - Resource created
- \`400 Bad Request\` - Validation error
- \`404 Not Found\` - Resource not found
- \`409 Conflict\` - Duplicate resource
- \`500 Internal Server Error\` - Server error
`;

const OPENAPI_SERVERS = [
  {
    url: 'http://localhost:3000/api',
    description: 'Development server',
  },
  {
    url: 'https://yourdomain.com/api',
    description: 'Production server',
  },
] as const;

const OPENAPI_TAGS = [
  { name: 'System', description: 'System health and utilities' },
  { name: 'Customers', description: 'Customer management' },
  { name: 'Products', description: 'Product catalog' },
  { name: 'Prices', description: 'Product pricing' },
  { name: 'Transactions', description: 'Sales transactions' },
  { name: 'Shipments', description: 'Shipment tracking' },
  { name: 'Employees', description: 'Employee management' },
  { name: 'Attendance', description: 'Attendance tracking' },
  { name: 'Schedules', description: 'Work schedules' },
  { name: 'Payroll', description: 'Payroll processing' },
  { name: 'Leave Requests', description: 'Leave management' },
  { name: 'Expenses', description: 'Employee expenses' },
  { name: 'Cash Advances', description: 'Cash advances' },
  { name: 'Thirteenth Month', description: 'Thirteenth month pay' },
  { name: 'Reports', description: 'Document generation' },
  { name: 'Backup', description: 'Database backup/restore' },
] as const;

export const openApiSpec: Record<string, unknown> = {
  openapi: '3.0.0',
  info: {
    title: 'Business Management System API',
    version: '1.0.0',
    description: OPENAPI_INFO_DESCRIPTION,
    contact: {
      name: 'API Support',
      email: 'support@example.com',
    },
  },
  servers: OPENAPI_SERVERS,
  tags: OPENAPI_TAGS,
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check endpoint',
        description: 'Check if the API is running and database is connected',
        responses: {
          '200': {
            description: 'System is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                    uptime: { type: 'number', example: 123456 },
                    database: { type: 'string', example: 'connected' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/backup': {
      get: {
        tags: ['Backup'],
        summary: 'List database backups',
        description: 'Get all available database backup files',
        responses: {
          '200': {
            description: 'List of backups',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      filename: {
                        type: 'string',
                        example: 'backup-2025-10-27.dump',
                      },
                      timestamp: { type: 'string', format: 'date-time' },
                      size: { type: 'number', example: 1024000 },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Backup'],
        summary: 'Create database backup',
        description: 'Create a new backup of the entire database',
        responses: {
          '201': {
            description: 'Backup created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    filename: {
                      type: 'string',
                      example: 'backup-2025-10-27.dump',
                    },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/restore': {
      post: {
        tags: ['Backup'],
        summary: 'Restore database from backup',
        description: 'Restore database from a backup file',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  filename: {
                    type: 'string',
                    example: 'backup-2025-10-27.json',
                  },
                },
                required: ['filename'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Database restored successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/customers': {
      get: {
        tags: ['Customers'],
        summary: 'List all customers',
        description: 'Retrieve all customers with optional filtering',
        parameters: [
          {
            name: 'search',
            in: 'query',
            description: 'Search by name or business name',
            schema: { type: 'string' },
          },
          {
            name: 'deleted',
            in: 'query',
            description: 'Include deleted customers',
            schema: { type: 'boolean', default: false },
          },
        ],
        responses: {
          '200': {
            description: 'List of customers',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Customer' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Customers'],
        summary: 'Create new customer',
        description: 'Create a new customer record',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CustomerInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Customer created successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Customer' },
              },
            },
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '409': {
            description: 'Customer already exists',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/customers/{id}': {
      get: {
        tags: ['Customers'],
        summary: 'Get customer by ID',
        description: 'Retrieve a single customer with full details',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Customer ID',
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Customer details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Customer' },
              },
            },
          },
          '404': {
            description: 'Customer not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      put: {
        tags: ['Customers'],
        summary: 'Update customer',
        description: 'Update customer information',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CustomerInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Customer updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Customer' },
              },
            },
          },
          '404': {
            description: 'Customer not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Customers'],
        summary: 'Delete customer',
        description: 'Soft delete a customer (sets deletedAt timestamp)',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Customer deleted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Customer not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/products': {
      get: {
        tags: ['Products'],
        summary: 'List all products',
        description: 'Retrieve all products with optional filtering',
        parameters: [
          {
            name: 'search',
            in: 'query',
            description: 'Search by product code or description',
            schema: { type: 'string' },
          },
          {
            name: 'deleted',
            in: 'query',
            description: 'Include deleted products',
            schema: { type: 'boolean', default: false },
          },
        ],
        responses: {
          '200': {
            description: 'List of products',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Product' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Products'],
        summary: 'Create new product',
        description: 'Create a new product in the catalog',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ProductInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Product created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Product' },
              },
            },
          },
        },
      },
    },
    '/products/{id}': {
      get: {
        tags: ['Products'],
        summary: 'Get product by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Product details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Product' },
              },
            },
          },
        },
      },
      put: {
        tags: ['Products'],
        summary: 'Update product',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ProductInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Product updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Product' },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Products'],
        summary: 'Delete product',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Product deleted',
          },
        },
      },
    },
    '/prices': {
      get: {
        tags: ['Prices'],
        summary: 'List all prices',
        responses: {
          '200': {
            description: 'List of prices',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Price' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Prices'],
        summary: 'Create new price',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PriceInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Price created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Price' },
              },
            },
          },
        },
      },
    },
    '/transactions': {
      get: {
        tags: ['Transactions'],
        summary: 'List all transactions',
        parameters: [
          {
            name: 'startDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'endDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'customerId',
            in: 'query',
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'List of transactions',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Transaction' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Transactions'],
        summary: 'Create new transaction',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TransactionInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Transaction created',
          },
        },
      },
    },
    '/shipments': {
      get: {
        tags: ['Shipments'],
        summary: 'List all shipments',
        responses: {
          '200': {
            description: 'List of shipments',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Shipment' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Shipments'],
        summary: 'Create new shipment',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ShipmentInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Shipment created',
          },
        },
      },
    },
    '/employees': {
      get: {
        tags: ['Employees'],
        summary: 'List all employees',
        parameters: [
          {
            name: 'deleted',
            in: 'query',
            schema: { type: 'boolean', default: false },
          },
        ],
        responses: {
          '200': {
            description: 'List of employees',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Employee' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Employees'],
        summary: 'Create new employee',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/EmployeeInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Employee created',
          },
        },
      },
    },
    '/employees/{id}': {
      get: {
        tags: ['Employees'],
        summary: 'Get employee by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Employee details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Employee' },
              },
            },
          },
        },
      },
      put: {
        tags: ['Employees'],
        summary: 'Update employee',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/EmployeeInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Employee updated',
          },
        },
      },
      delete: {
        tags: ['Employees'],
        summary: 'Delete employee',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Employee deleted',
          },
        },
      },
    },
    '/attendance': {
      get: {
        tags: ['Attendance'],
        summary: 'List attendance records',
        parameters: [
          {
            name: 'startDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'endDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
        ],
        responses: {
          '200': {
            description: 'List of attendance records',
          },
        },
      },
      post: {
        tags: ['Attendance'],
        summary: 'Create attendance record',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AttendanceInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Attendance recorded',
          },
        },
      },
    },
    '/schedules': {
      get: {
        tags: ['Schedules'],
        summary: 'List work schedules',
        parameters: [
          {
            name: 'startDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'endDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
        ],
        responses: {
          '200': {
            description: 'List of schedules',
          },
        },
      },
      post: {
        tags: ['Schedules'],
        summary: 'Create schedule',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ScheduleInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Schedule created',
          },
        },
      },
    },
    '/payroll': {
      get: {
        tags: ['Payroll'],
        summary: 'List payroll records',
        parameters: [
          {
            name: 'payPeriodStart',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'payPeriodEnd',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
        ],
        responses: {
          '200': {
            description: 'List of payroll records',
          },
        },
      },
      post: {
        tags: ['Payroll'],
        summary: 'Create payroll record',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PayrollInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Payroll created',
          },
        },
      },
    },
    '/leave-requests': {
      get: {
        tags: ['Leave Requests'],
        summary: 'List leave requests',
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['Pending', 'Approved', 'Rejected'],
            },
          },
        ],
        responses: {
          '200': {
            description: 'List of leave requests',
          },
        },
      },
      post: {
        tags: ['Leave Requests'],
        summary: 'Create leave request',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LeaveRequestInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Leave request created',
          },
        },
      },
    },
    '/leave-requests/{id}': {
      put: {
        tags: ['Leave Requests'],
        summary: 'Update leave request status',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: {
                    type: 'string',
                    enum: ['Approved', 'Rejected'],
                  },
                  remarks: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Leave request updated',
          },
        },
      },
    },
    '/expenses': {
      get: {
        tags: ['Expenses'],
        summary: 'List employee expenses',
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['Pending', 'Approved', 'Rejected'],
            },
          },
        ],
        responses: {
          '200': {
            description: 'List of expenses',
          },
        },
      },
      post: {
        tags: ['Expenses'],
        summary: 'Create expense',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ExpenseInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Expense created',
          },
        },
      },
    },
    '/expenses/{id}': {
      put: {
        tags: ['Expenses'],
        summary: 'Update expense status',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: {
                    type: 'string',
                    enum: ['Approved', 'Rejected'],
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Expense updated',
          },
        },
      },
    },
    '/cash-advances': {
      get: {
        tags: ['Cash Advances'],
        summary: 'List cash advances',
        responses: {
          '200': {
            description: 'List of cash advances',
          },
        },
      },
      post: {
        tags: ['Cash Advances'],
        summary: 'Create cash advance',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CashAdvanceInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Cash advance created',
          },
        },
      },
    },
    '/thirteenth-month-pay': {
      get: {
        tags: ['Thirteenth Month'],
        summary: 'List thirteenth month pay records',
        responses: {
          '200': {
            description: 'List of thirteenth month pay records',
          },
        },
      },
      post: {
        tags: ['Thirteenth Month'],
        summary: 'Calculate thirteenth month pay',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  year: { type: 'number', example: 2025 },
                  employeeIds: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Thirteenth month pay calculated',
          },
        },
      },
    },
    '/generate-invoice': {
      post: {
        tags: ['Reports'],
        summary: 'Generate invoice PDF',
        description: 'Generate invoice PDFs for transactions',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  transactions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'number' },
                        Customers: { type: 'string' },
                        'Product Code': { type: 'string' },
                        Quantity: { type: 'number' },
                        'Unit Price': { type: 'number' },
                        Adjustment: { type: 'number' },
                        'Line Total': { type: 'number' },
                        'Order Status': { type: 'string' },
                        'Invoice Date': { type: 'string' },
                      },
                    },
                  },
                  customers: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        'Customer Name': { type: 'string' },
                        'Phone Number': { type: 'string' },
                        Address: { type: 'string' },
                      },
                    },
                  },
                  invoiceType: {
                    type: 'string',
                    enum: [
                      'Onhand',
                      'In Transit',
                      'Reservation Fee',
                      'Reservation Fee 20',
                    ],
                  },
                },
                required: ['transactions'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Invoice generated',
            content: {
              'application/pdf': {
                schema: {
                  type: 'string',
                  format: 'binary',
                },
              },
            },
          },
        },
      },
    },
    '/generate-packing-list': {
      post: {
        tags: ['Reports'],
        summary: 'Generate packing list PDF',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  transactions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        Customers: { type: 'string' },
                        'Product Code': { type: 'string' },
                        Quantity: { type: 'number' },
                        Notes: { type: 'string' },
                      },
                      required: ['Customers', 'Product Code', 'Quantity'],
                    },
                  },
                },
                required: ['transactions'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Packing list generated',
            content: {
              'application/pdf': {
                schema: {
                  type: 'string',
                  format: 'binary',
                },
              },
            },
          },
        },
      },
    },
  },
  components: OPENAPI_COMPONENTS,
};
