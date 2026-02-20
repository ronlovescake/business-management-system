/**
 * OpenAPI 3.0 Specification for Business Management System
 *
 * This file contains the complete API documentation spec.
 * Auto-generated types and validation are provided by Zod schemas.
 */

export const openApiSpec: Record<string, unknown> = {
  openapi: '3.0.0',
  info: {
    title: 'Business Management System API',
    version: '1.0.0',
    description: `
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
    `,
    contact: {
      name: 'API Support',
      email: 'support@example.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000/api',
      description: 'Development server',
    },
    {
      url: 'https://yourdomain.com/api',
      description: 'Production server',
    },
  ],
  tags: [
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
  ],
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
                        example: '2025-10-27-backup.sql',
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
                      example: '2025-10-27-backup.sql',
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
                    example: '2025-10-27-backup.sql',
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
  components: {
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
          details: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
        },
        required: ['error'],
      },
      Customer: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          businessName: { type: 'string' },
          phone: { type: 'string', nullable: true },
          email: { type: 'string', nullable: true },
          address: { type: 'string', nullable: true },
          notes: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          deletedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      CustomerInput: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          businessName: { type: 'string', minLength: 1, maxLength: 255 },
          phone: { type: 'string', nullable: true },
          email: { type: 'string', format: 'email', nullable: true },
          address: { type: 'string', nullable: true },
          notes: { type: 'string', nullable: true },
        },
        required: ['name', 'businessName'],
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          productCode: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string', nullable: true },
          unit: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          deletedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      ProductInput: {
        type: 'object',
        properties: {
          productCode: { type: 'string', minLength: 1, maxLength: 50 },
          description: { type: 'string', minLength: 1, maxLength: 500 },
          category: { type: 'string', nullable: true },
          unit: { type: 'string', minLength: 1, maxLength: 20 },
        },
        required: ['productCode', 'description', 'unit'],
      },
      Price: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          productId: { type: 'string' },
          customerId: { type: 'string' },
          price: { type: 'number', format: 'decimal' },
          effectiveDate: { type: 'string', format: 'date' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      PriceInput: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          customerId: { type: 'string' },
          price: { type: 'number', minimum: 0 },
          effectiveDate: { type: 'string', format: 'date' },
        },
        required: ['productId', 'customerId', 'price', 'effectiveDate'],
      },
      Transaction: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          customerId: { type: 'string' },
          transactionDate: { type: 'string', format: 'date' },
          status: {
            type: 'string',
            enum: ['Pending', 'Completed', 'Cancelled'],
          },
          totalAmount: { type: 'number', format: 'decimal' },
          notes: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      TransactionInput: {
        type: 'object',
        properties: {
          customerId: { type: 'string' },
          transactionDate: { type: 'string', format: 'date' },
          status: { type: 'string', enum: ['Pending', 'Completed'] },
          products: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string' },
                quantity: { type: 'number', minimum: 1 },
                price: { type: 'number', minimum: 0 },
              },
            },
          },
        },
        required: ['customerId', 'transactionDate', 'products'],
      },
      Shipment: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          transactionId: { type: 'string' },
          shipmentDate: { type: 'string', format: 'date' },
          status: { type: 'string' },
          trackingNumber: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ShipmentInput: {
        type: 'object',
        properties: {
          transactionId: { type: 'string' },
          shipmentDate: { type: 'string', format: 'date' },
          trackingNumber: { type: 'string', nullable: true },
        },
        required: ['transactionId', 'shipmentDate'],
      },
      Employee: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          position: { type: 'string' },
          department: { type: 'string' },
          hireDate: { type: 'string', format: 'date' },
          salary: { type: 'number', format: 'decimal' },
          status: { type: 'string', enum: ['Active', 'Inactive'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      EmployeeInput: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          position: { type: 'string', minLength: 1 },
          department: { type: 'string', minLength: 1 },
          hireDate: { type: 'string', format: 'date' },
          salary: { type: 'number', minimum: 0 },
          status: { type: 'string', enum: ['Active', 'Inactive'] },
        },
        required: ['name', 'position', 'department', 'hireDate', 'salary'],
      },
      AttendanceInput: {
        type: 'object',
        properties: {
          employeeId: { type: 'string' },
          date: { type: 'string', format: 'date' },
          timeIn: { type: 'string', format: 'time' },
          timeOut: { type: 'string', format: 'time' },
          status: { type: 'string', enum: ['Present', 'Absent', 'Leave'] },
        },
        required: ['employeeId', 'date', 'status'],
      },
      ScheduleInput: {
        type: 'object',
        properties: {
          employeeId: { type: 'string' },
          date: { type: 'string', format: 'date' },
          shiftType: { type: 'string' },
          startTime: { type: 'string', format: 'time' },
          endTime: { type: 'string', format: 'time' },
        },
        required: ['employeeId', 'date', 'shiftType'],
      },
      PayrollInput: {
        type: 'object',
        properties: {
          employeeId: { type: 'string' },
          payPeriodStart: { type: 'string', format: 'date' },
          payPeriodEnd: { type: 'string', format: 'date' },
          basicSalary: { type: 'number', minimum: 0 },
          deductions: { type: 'number', minimum: 0, default: 0 },
          netSalary: { type: 'number', minimum: 0 },
        },
        required: [
          'employeeId',
          'payPeriodStart',
          'payPeriodEnd',
          'basicSalary',
          'netSalary',
        ],
      },
      LeaveRequestInput: {
        type: 'object',
        properties: {
          employeeId: { type: 'string' },
          leaveType: { type: 'string' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          reason: { type: 'string' },
        },
        required: ['employeeId', 'leaveType', 'startDate', 'endDate', 'reason'],
      },
      ExpenseInput: {
        type: 'object',
        properties: {
          employeeId: { type: 'string' },
          category: { type: 'string' },
          amount: { type: 'number', minimum: 0 },
          date: { type: 'string', format: 'date' },
          description: { type: 'string' },
          receipt: {
            type: 'string',
            nullable: true,
            description: 'Base64 encoded image',
          },
        },
        required: ['employeeId', 'category', 'amount', 'date', 'description'],
      },
      CashAdvanceInput: {
        type: 'object',
        properties: {
          employeeId: { type: 'string' },
          amount: { type: 'number', minimum: 0 },
          requestDate: { type: 'string', format: 'date' },
          reason: { type: 'string' },
        },
        required: ['employeeId', 'amount', 'requestDate', 'reason'],
      },
    },
  },
};
