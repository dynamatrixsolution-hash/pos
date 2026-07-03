import { NextResponse } from "next/server";

export async function GET() {
  const openapiSpec = {
    openapi: "3.0.0",
    info: {
      title: "DynaPOS Enterprise REST API",
      description: "Production-ready, multi-tenant POS and Business Management platform endpoints.",
      version: "1.0.0",
    },
    servers: [
      {
        url: "/api/v1",
        description: "Local development server",
      },
    ],
    paths: {
      "/auth/register": {
        post: {
          summary: "Register a new business and owner account",
          tags: ["Auth"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    businessName: { type: "string" },
                    slug: { type: "string" },
                    currency: { type: "string", default: "USD" },
                    ownerName: { type: "string" },
                    email: { type: "string" },
                    password: { type: "string" },
                    phone: { type: "string" },
                  },
                  required: ["businessName", "slug", "ownerName", "email", "password"],
                },
              },
            },
          },
          responses: {
            201: { description: "Business successfully registered" },
            400: { description: "Validation failed or slug/email taken" },
          },
        },
      },
      "/auth/me": {
        get: {
          summary: "Get current logged in user details",
          tags: ["Auth"],
          responses: {
            200: { description: "Active session returned" },
            401: { description: "Unauthenticated" },
          },
        },
      },
      "/products": {
        get: {
          summary: "List all products",
          tags: ["Products"],
          parameters: [
            { name: "search", in: "query", schema: { type: "string" } },
            { name: "categoryId", in: "query", schema: { type: "string" } },
            { name: "lowStock", in: "query", schema: { type: "boolean" } },
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          ],
          responses: {
            200: { description: "List of products with pagination" },
            401: { description: "Unauthorized" },
          },
        },
        post: {
          summary: "Create a new product",
          tags: ["Products"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    sku: { type: "string" },
                    barcode: { type: "string" },
                    costPrice: { type: "number" },
                    sellingPrice: { type: "number" },
                    wholesalePrice: { type: "number" },
                    alertQuantity: { type: "integer" },
                    categoryId: { type: "string", format: "uuid" },
                    batchTracking: { type: "boolean", default: false },
                    expiryTracking: { type: "boolean", default: false },
                  },
                  required: ["name"],
                },
              },
            },
          },
          responses: {
            201: { description: "Product created" },
          },
        },
      },
      "/products/{id}": {
        get: {
          summary: "Get product details",
          tags: ["Products"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            200: { description: "Product information" },
            404: { description: "Product not found" },
          },
        },
        put: {
          summary: "Update product details",
          tags: ["Products"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            200: { description: "Product updated" },
          },
        },
        delete: {
          summary: "Soft delete a product",
          tags: ["Products"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            200: { description: "Product deleted" },
          },
        },
      },
      "/categories": {
        get: { summary: "List categories", tags: ["Taxonomy"] },
        post: {
          summary: "Create category",
          tags: ["Taxonomy"],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } } },
          responses: { 201: { description: "Category created" } },
        },
      },
      "/customers": {
        get: { summary: "List customers", tags: ["Customers"] },
        post: { summary: "Create customer", tags: ["Customers"] },
      },
      "/suppliers": {
        get: { summary: "List suppliers", tags: ["Suppliers"] },
        post: { summary: "Create supplier", tags: ["Suppliers"] },
      },
      "/sales": {
        get: { summary: "Get sales history", tags: ["POS & Sales"] },
        post: {
          summary: "Process checkout transaction (POS Sales)",
          tags: ["POS & Sales"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    customerId: { type: "string" },
                    branchId: { type: "string" },
                    items: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          productId: { type: "string" },
                          quantity: { type: "number" },
                          price: { type: "number" },
                        },
                      },
                    },
                    subtotal: { type: "number" },
                    total: { type: "number" },
                    paidAmount: { type: "number" },
                    paymentMethod: { type: "string" },
                  },
                  required: ["branchId", "items", "subtotal", "total", "paidAmount"],
                },
              },
            },
          },
          responses: {
            201: { description: "Sale successfully completed" },
            400: { description: "Insufficient stock or validation failure" },
          },
        },
      },
      "/purchases": {
        get: { summary: "Get purchase intake list", tags: ["Purchases"] },
        post: { summary: "Record supplier purchase invoice", tags: ["Purchases"] },
      },
      "/inventory/adjust": {
        post: {
          summary: "Manually adjust branch inventory (damaged, checkins, checkouts)",
          tags: ["Inventory"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    productId: { type: "string" },
                    branchId: { type: "string" },
                    type: { type: "string", enum: ["STOCK_IN", "STOCK_OUT", "DAMAGE", "ADJUSTMENT"] },
                    quantity: { type: "number" },
                    notes: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "Stock adjusted" } },
        },
      },
      "/inventory/transfer": {
        get: { summary: "View branch stock transfers", tags: ["Inventory"] },
        post: { summary: "Transfer stock between branches", tags: ["Inventory"] },
      },
      "/branches": {
        get: { summary: "List business branches", tags: ["Settings & Branches"] },
        post: { summary: "Create business branch", tags: ["Settings & Branches"] },
      },
      "/expenses": {
        get: { summary: "List expenses", tags: ["Accounts & Expenses"] },
        post: { summary: "Record expense payment", tags: ["Accounts & Expenses"] },
      },
      "/ledger/customer/{id}": {
        get: {
          summary: "Get customer account statement",
          tags: ["Accounts & Expenses"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { 200: { description: "Ledger transaction statements" } },
        },
      },
      "/ledger/supplier/{id}": {
        get: {
          summary: "Get supplier account statement",
          tags: ["Accounts & Expenses"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { 200: { description: "Ledger transaction statements" } },
        },
      },
      "/reports/dashboard": {
        get: {
          summary: "Get dashboard aggregate analytics",
          tags: ["Reports & Metrics"],
          responses: { 200: { description: "Metrics, charts, and alerts" } },
        },
      },
    },
  };

  return NextResponse.json(openapiSpec);
}
