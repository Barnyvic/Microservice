# Postman Collections for E-commerce Microservices

This directory contains comprehensive Postman collections for testing all microservices in the e-commerce system.

## Collections Overview

### 1. Individual Service Collections

#### Customer Service API (`Customer-Service.postman_collection.json`)

- **Base URL**: `http://localhost:3001`
- **Endpoints**:
  - Health checks (liveness, readiness)
  - Customer CRUD operations
  - Search and filtering
  - Error scenarios

#### Product Service API (`Product-Service.postman_collection.json`)

- **Base URL**: `http://localhost:3002`
- **Endpoints**:
  - Health checks
  - Product CRUD operations
  - Search and filtering by category/brand
  - Inventory management (availability, reserve, release)
  - Error scenarios

#### Order Service API (`Order-Service.postman_collection.json`)

- **Base URL**: `http://localhost:3004`
- **Endpoints**:
  - Health checks
  - Order creation and management
  - Order status updates
  - Customer order history
  - Error scenarios

#### Payment Service API (`Payment-Service.postman_collection.json`)

- **Base URL**: `http://localhost:3003`
- **Endpoints**:
  - Health checks
  - Payment processing
  - Transaction history
  - Message queue status
  - Error scenarios

### 2. End-to-End Workflow (`E2E-Ecommerce-Workflow.postman_collection.json`)

- **Complete e-commerce flow testing**
- **Automated variable management**
- **Comprehensive test scenarios**

## Setup Instructions

### 1. Import Collections into Postman

1. Open Postman
2. Click "Import" button
3. Select all JSON files from this directory
4. Click "Import" to add all collections

### 2. Environment Setup

Create a new environment in Postman with these variables:

```json
{
  "customerServiceUrl": "http://localhost:3001",
  "productServiceUrl": "http://localhost:3002",
  "orderServiceUrl": "http://localhost:3004",
  "paymentServiceUrl": "http://localhost:3003"
}
```

### 3. Start the Services

Before running the tests, ensure all services are running:

```bash
# Start all services
npm run dev:services

# Or start individual services
npm run dev:customer
npm run dev:product
npm run dev:order
npm run dev:payment
```

## Testing Workflows

### Quick Start - End-to-End Flow

1. **Run the E2E Workflow Collection**:
   - Open "E2E E-commerce Workflow" collection
   - Click "Run" to execute the entire flow
   - This will test the complete customer journey

### Individual Service Testing

#### Customer Service Testing

1. Open "Customer Service API" collection
2. Run "Create Customer" request
3. Use the returned `customerId` for other requests
4. Test all CRUD operations

#### Product Service Testing

1. Open "Product Service API" collection
2. Run "Create Product" request
3. Test product search and filtering
4. Test inventory management features

#### Order Service Testing

1. Ensure you have valid `customerId` and `productId`
2. Run "Create Order" request
3. Test order management and status updates

#### Payment Service Testing

1. Ensure you have valid `orderId`
2. Run "Process Payment" request
3. Verify payment status and history

## Key Features

### Automated Variable Management

- Collections automatically capture and store IDs from responses
- Variables are shared between requests in the same collection
- No manual copying of IDs needed

### Comprehensive Error Testing

- Each collection includes error scenario tests
- Tests for validation errors, not found cases, and business logic errors
- Helps ensure robust error handling

### Health Check Integration

- All collections include health check endpoints
- Verify service availability before running tests
- Monitor service readiness and dependencies

### Realistic Test Data

- Uses realistic e-commerce data
- Tests with actual product and customer information
- Simulates real-world usage patterns

## Test Data

### Sample Customer

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "+1234567890",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA"
  }
}
```

### Sample Product

```json
{
  "name": "MacBook Pro 14-inch",
  "description": "Apple MacBook Pro with M2 chip, 14-inch display",
  "price": 199900,
  "category": "Electronics",
  "brand": "Apple",
  "stock": 50,
  "specifications": {
    "processor": "Apple M2",
    "memory": "16GB",
    "storage": "512GB SSD",
    "display": "14-inch Liquid Retina XDR"
  },
  "weight": 1.6,
  "dimensions": {
    "length": 31.26,
    "width": 22.12,
    "height": 1.55
  }
}
```

## Troubleshooting

### Common Issues

1. **Service Not Available**

   - Check if services are running on correct ports
   - Verify environment variables in Postman
   - Check service health endpoints

2. **Database Connection Issues**

   - Ensure MongoDB is running and accessible
   - Check database connection string in `.env` file
   - Verify database seeding is complete

3. **Message Queue Issues**

   - Check RabbitMQ connection
   - Verify message queue status endpoint
   - Ensure transaction worker is running

4. **Validation Errors**
   - Check request body format
   - Verify required fields are present
   - Check data types and constraints

### Debug Tips

1. **Check Response Headers**

   - Look for error details in response headers
   - Check status codes for specific error types

2. **Review Console Logs**

   - Check service logs for detailed error information
   - Look for database connection issues
   - Verify message queue connectivity

3. **Test Individual Endpoints**
   - Start with health checks
   - Test basic CRUD operations
   - Gradually test complex workflows

## API Documentation

For detailed API documentation, refer to:

- Individual service README files
- OpenAPI/Swagger documentation (if available)
- Service source code comments

## Contributing

When adding new test cases:

1. Follow the existing naming conventions
2. Include both success and error scenarios
3. Add appropriate test assertions
4. Update this README if needed

## Support

For issues with the collections or services:

1. Check the troubleshooting section
2. Review service logs
3. Verify environment setup
4. Test with individual endpoints first
