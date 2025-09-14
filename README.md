# E-commerce Microservices System

A comprehensive e-commerce microservices architecture built with Node.js, TypeScript, Express, MongoDB, Redis, and RabbitMQ. This system implements modern microservices patterns with distributed locking, caching, message queuing, and robust error handling.

## Architecture Overview

This system implements the microservices pattern with the following services:

- **Customer Service** (Port 3001): Manages customer information, profiles, and addresses
- **Product Service** (Port 3002): Handles product catalog, inventory management, and stock operations
- **Order Service** (Port 3003): Processes orders, coordinates with other services, and manages order lifecycle
- **Payment Service** (Port 3004): Handles payment processing and publishes transaction events
- **Transaction Worker**: Consumes transaction events and saves transaction history

## System Flow

The system follows this comprehensive workflow:

1. **Order Creation**: Customer submits an order with `customerId`, `productId`, and `quantity`
2. **Distributed Locking**: Order service acquires Redis lock to prevent race conditions
3. **Validation**: Order service validates customer exists and product is available
4. **Stock Reservation**: Product stock is reserved to prevent overselling
5. **Order Processing**: If valid, order is created with `pending` status
6. **Payment Initiation**: Order service calls payment service with order details
7. **Payment Processing**: Payment service processes payment with idempotency protection
8. **Transaction Publishing**: Payment service publishes transaction details to RabbitMQ
9. **Order Status Update**: Order status is updated to `completed` or `failed` based on payment result
10. **Transaction Storage**: Worker service consumes messages and saves transaction history
11. **Stock Management**: Failed payments release reserved stock back to inventory

## Technologies Used

- **Backend**: Node.js 20+, TypeScript, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Caching**: Redis for distributed locking and caching
- **Message Queue**: RabbitMQ with CloudAMQP support
- **Containerization**: Docker & Docker Compose
- **Validation**: Zod for runtime type checking
- **Logging**: Winston for structured logging
- **Security**: Helmet, CORS, HPP protection
- **Code Quality**: ESLint, Prettier, strict TypeScript
- **HTTP Client**: Custom retry logic with circuit breaker pattern

## Prerequisites

- Node.js 20+
- Docker and Docker Compose
- Git
- MongoDB (local or cloud)
- Redis (local or cloud)
- RabbitMQ (local or CloudAMQP)

## Project Structure

```
ecommerce-microservices/
├── shared/                          # Shared utilities and types
│   ├── config/                      # Environment configuration
│   ├── middleware/                  # Express middleware (error handling, validation)
│   ├── types/                       # TypeScript type definitions
│   └── utils/                       # Utility functions
│       ├── cache-manager.ts         # Redis caching utilities
│       ├── http-client.ts           # HTTP client with retry logic
│       ├── logger.ts                # Structured logging
│       ├── rabbitmq-manager.ts      # Shared RabbitMQ connection manager
│       ├── redis-client.ts          # Redis client wrapper
│       └── redis-lock-manager.ts    # Distributed locking
├── services/
│   ├── customer-service/            # Customer management service
│   ├── product-service/             # Product catalog service
│   ├── order-service/               # Order processing service
│   ├── payment-service/             # Payment processing service
│   └── transaction-worker/          # Transaction event worker
├── scripts/
│   └── seed-database.js             # Database seeding script
├── docker-compose.yml               # Container orchestration
├── init-mongo.js                    # Database initialization script
└── env.example                      # Environment variables template
```

## Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd ecommerce-microservices
```

### 2. Environment Configuration

```bash

cp env.example .env


nano .env
```

### 3. Start Services

```bash

npm run dev


npm run dev:detached


npm run logs


npm run down
```

### 4. Access Services

- **Customer Service**: http://localhost:3001
- **Product Service**: http://localhost:3002
- **Order Service**: http://localhost:3003
- **Payment Service**: http://localhost:3004
- **MongoDB**: localhost:27017
- **Redis**: localhost:6379
- **RabbitMQ Management**: http://localhost:15672 (admin/password)

### 5. Test the Complete Flow

```bash

curl -X POST http://localhost:3001/api/v1/customers \
  -H "Content-Type: application/json" \
  -d '{
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
  }'


curl -X POST http://localhost:3002/api/v1/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MacBook Pro 14-inch",
    "description": "Apple MacBook Pro with M2 chip",
    "price": 199900,
    "category": "Electronics",
    "brand": "Apple",
    "stock": 50
  }'


curl -X POST http://localhost:3003/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "68c5ee4f6603fb3c28a87a6f",
    "productId": "prod_001",
    "quantity": 1
  }'

curl http://localhost:3003/api/v1/orders/{orderId}


curl http://localhost:3004/api/v1/payments/order/{orderId}
```

## Environment Variables

| Variable               | Description                | Default                                                |
| ---------------------- | -------------------------- | ------------------------------------------------------ |
| `NODE_ENV`             | Environment mode           | development                                            |
| `MONGO_ROOT_USERNAME`  | MongoDB username           | admin                                                  |
| `MONGO_ROOT_PASSWORD`  | MongoDB password           | password                                               |
| `MONGO_DB_NAME`        | Database name              | ecommerce                                              |
| `MONGODB_URI`          | MongoDB connection string  | mongodb://admin:password@localhost:27017/ecommerce     |
| `RABBITMQ_USER`        | RabbitMQ username          | admin                                                  |
| `RABBITMQ_PASSWORD`    | RabbitMQ password          | password                                               |
| `RABBITMQ_URI`         | RabbitMQ connection string | amqps://username:password@host.rmq.cloudamqp.com/vhost |
| `REDIS_HOST`           | Redis host                 | localhost                                              |
| `REDIS_PORT`           | Redis port                 | 6379                                                   |
| `REDIS_PASSWORD`       | Redis password             | (empty)                                                |
| `REDIS_DB`             | Redis database number      | 0                                                      |
| `CORS_ORIGIN`          | CORS allowed origins       | http://localhost:3000                                  |
| `LOG_LEVEL`            | Logging level              | info                                                   |
| `CUSTOMER_SERVICE_URL` | Customer service URL       | http://localhost:3001                                  |
| `PRODUCT_SERVICE_URL`  | Product service URL        | http://localhost:3002                                  |
| `PAYMENT_SERVICE_URL`  | Payment service URL        | http://localhost:3004                                  |
| `ORDER_SERVICE_URL`    | Order service URL          | http://localhost:3003                                  |

## API Documentation

### Customer Service API

#### Create Customer

```http
POST /api/v1/customers
Content-Type: application/json

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

#### Get Customer

```http
GET /api/v1/customers/{customerId}
```

#### List Customers

```http
GET /api/v1/customers?page=1&limit=10&search=john
```

#### Update Customer

```http
PUT /api/v1/customers/{customerId}
Content-Type: application/json

{
  "firstName": "Jane",
  "lastName": "Smith"
}
```

### Product Service API

#### Create Product

```http
POST /api/v1/products
Content-Type: application/json

{
  "name": "MacBook Pro 14-inch",
  "description": "Apple MacBook Pro with M2 chip",
  "price": 199900,
  "category": "Electronics",
  "brand": "Apple",
  "stock": 50,
  "weight": 1.6,
  "dimensions": {
    "length": 31.26,
    "width": 22.12,
    "height": 1.55
  }
}
```

#### Get Product

```http
GET /api/v1/products/{productId}
```

#### List Products

```http
GET /api/v1/products?page=1&limit=10&category=Electronics&brand=Apple
```

#### Check Availability

```http
GET /api/v1/products/{productId}/availability?quantity=2
```

#### Reserve Stock

```http
POST /api/v1/products/{productId}/reserve
Content-Type: application/json

{
  "quantity": 2,
  "orderId": "ord_123456789"
}
```

#### Release Stock

```http
POST /api/v1/products/{productId}/release
Content-Type: application/json

{
  "quantity": 2,
  "orderId": "ord_123456789"
}
```

### Order Service API

#### Create Order

```http
POST /api/v1/orders
Content-Type: application/json

{
  "customerId": "68c5ee4f6603fb3c28a87a6f",
  "productId": "prod_001",
  "quantity": 1
}
```

#### Get Order

```http
GET /api/v1/orders/{orderId}
```

#### List Orders

```http
GET /api/v1/orders?customerId=cust_001&page=1&limit=10&status=completed
```

#### Cancel Order

```http
POST /api/v1/orders/{orderId}/cancel
Content-Type: application/json

{
  "reason": "customer_request"
}
```

### Payment Service API

#### Process Payment

```http
POST /api/v1/payments/process
Content-Type: application/json

{
  "orderId": "ord_123456789",
  "amount": 199900,
  "paymentMethod": "credit_card",
  "idempotencyKey": "unique-key-123"
}
```

#### Get Payment

```http
GET /api/v1/payments/{paymentId}
```

#### Get Payment by Order

```http
GET /api/v1/payments/order/{orderId}
```

#### List Payments

```http
GET /api/v1/payments?page=1&limit=10&status=completed
```

#### Get Queue Status

```http
GET /api/v1/payments/queue/status
```

## Database Schema

### Collections

1. **customers**: Customer information and addresses
2. **products**: Product catalog with inventory tracking
3. **orders**: Order records with status tracking and lifecycle management
4. **payments**: Payment records with transaction details
5. **transactionhistories**: Transaction history from payment events

### Indexes

The system includes optimized indexes for:

- Customer email and customerId (unique)
- Product productId, category, brand, name
- Order orderId, customerId, status, createdAt
- Payment paymentId, orderId, status, createdAt
- Transaction transactionId, orderId, customerId, status

## Message Queue

### RabbitMQ Configuration

- **Exchange**: `ecommerce.transactions`
- **Queue**: `transaction.save`
- **Routing Key**: `transaction.created`
- **Connection**: Singleton pattern with shared connection manager

### Transaction Event Schema

```json
{
  "transactionId": "txn_123456789",
  "orderId": "ord_123456789",
  "customerId": "cust_001",
  "productId": "prod_001",
  "amount": 199900,
  "status": "completed",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Key Features

### Distributed Locking

- Redis-based distributed locks prevent race conditions
- Automatic lock expiration and cleanup
- Lock acquisition with retry logic

### Caching

- Redis-based caching for improved performance
- Cache invalidation strategies
- TTL-based cache expiration

### Error Handling

- Comprehensive error handling with proper HTTP status codes
- 404 for not found resources
- 503 for service unavailable
- 400 for validation errors
- 409 for conflicts

### Idempotency

- Payment processing with idempotency keys
- Duplicate request prevention
- Safe retry mechanisms

### Stock Management

- Atomic stock reservation and release
- Overselling prevention
- Automatic stock return on payment failure

### Order Lifecycle

- Order status tracking (pending, processing, completed, failed, cancelled)
- Automatic status updates based on payment results
- Order cancellation with stock release

### Message Publishing

- Reliable message publishing to RabbitMQ
- Connection resilience and retry logic
- Graceful degradation when RabbitMQ is unavailable

## Testing

### Running Tests

```bash

npm test


npm run test:watch


cd services/customer-service && npm test
```

### API Testing

Use the provided API examples with tools like:

- Postman
- curl
- Thunder Client (VS Code)
- Insomnia

## Monitoring and Health Checks

### Health Endpoints

Each service provides health check endpoints:

- `GET /healthz` - Liveness probe
- `GET /readyz` - Readiness probe with dependency checks

### Logging

Structured JSON logging with:

- Request/response tracking with correlation IDs
- Error logging with stack traces
- Performance metrics and timing
- Service communication tracking
- Distributed tracing support

## Development

### Local Development Setup

```bash

cd services/customer-service
npm install


npm run dev


npm run build


npm run lint
npm run lint:fix
```

### Code Quality

The project enforces:

- Strict TypeScript configuration
- ESLint with TypeScript rules
- Prettier for code formatting
- SOLID principles compliance

## Production Deployment

### Docker Production Build

```bash

docker-compose build

NODE_ENV=production docker-compose up -d
```

### Environment Configuration

For production deployment:

1. Set secure environment variables
2. Use production MongoDB cluster
3. Configure proper CORS origins
4. Set up monitoring and logging
5. Implement proper secret management
6. Use CloudAMQP for RabbitMQ
7. Configure Redis cluster for high availability

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3001-3004, 27017, 6379, 5672, 15672 are available
2. **MongoDB connection**: Check MongoDB container status and credentials
3. **Redis connection**: Verify Redis container is running and accessible
4. **RabbitMQ connection**: Check RabbitMQ container or CloudAMQP configuration
5. **Service communication**: Verify docker network connectivity
6. **404 vs 503 errors**: Check error handling logic in service communication

### Logs and Debugging

```bash

docker-compose logs -f


docker-compose logs -f customer-service


docker-compose ps


docker-compose exec customer-service sh
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Run linting and tests
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:

1. Check the troubleshooting section
2. Review container logs
3. Verify environment configuration
4. Open an issue with detailed information

---

Built using Node.js, TypeScript, and microservices architecture with modern patterns and best practices.
