# E-commerce Microservices System

A comprehensive e-commerce microservices architecture built with Node.js, TypeScript, Express, MongoDB, and RabbitMQ.

## Architecture Overview

This system implements the microservices pattern with the following services:

- **Customer Service** (Port 3001): Manages customer information and profiles
- **Product Service** (Port 3002): Handles product catalog and inventory management
- **Order Service** (Port 3003): Processes orders and coordinates with other services
- **Payment Service** (Port 3004): Handles payment processing and publishes transaction events
- **Transaction Worker**: Consumes transaction events and saves transaction history

## System Flow

Based on the provided flowchart, the system follows this workflow:

1. **Order Creation**: Customer submits an order with `customerId`, `productId`, and `quantity`
2. **Validation**: Order service validates customer exists and product is available
3. **Order Processing**: If valid, order is created with `pending` status
4. **Payment Initiation**: Order service calls payment service with order details
5. **Transaction Publishing**: Payment service publishes transaction details to RabbitMQ
6. **Transaction Storage**: Worker service consumes messages and saves transaction history
7. **Response**: Order status and details are returned to the customer

## Technologies Used

- **Backend**: Node.js, TypeScript, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Message Queue**: RabbitMQ
- **Containerization**: Docker & Docker Compose
- **Validation**: Zod for runtime type checking
- **Logging**: Winston for structured logging
- **Security**: Helmet, CORS, HPP protection
- **Code Quality**: ESLint, Prettier, strict TypeScript

## Prerequisites

- Node.js 20+
- Docker and Docker Compose
- Git

## Project Structure

```
ecommerce-microservices/
├── shared/                          # Shared utilities and types
│   ├── config/                      # Configuration modules
│   ├── middleware/                  # Express middleware
│   ├── types/                       # TypeScript type definitions
│   └── utils/                       # Utility functions
├── services/
│   ├── customer-service/            # Customer management service
│   ├── product-service/             # Product catalog service
│   ├── order-service/               # Order processing service
│   ├── payment-service/             # Payment processing service
│   └── transaction-worker/          # Transaction event worker
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
# Copy environment template
cp env.example .env

# Edit .env file with your configurations (defaults work for local development)
nano .env
```

### 3. Start Services

```bash
# Start all services with Docker Compose
npm run dev

# Or run in detached mode
npm run dev:detached

# View logs
npm run logs
```

### 4. Access Services

- **Customer Service**: http://localhost:3001
- **Product Service**: http://localhost:3002
- **Order Service**: http://localhost:3003
- **Payment Service**: http://localhost:3004
- **MongoDB**: localhost:27017
- **RabbitMQ Management**: http://localhost:15672 (admin/password)

### 5. Test the Complete Flow

```bash
# 1. Create an order (this triggers the entire flow)
curl -X POST http://localhost:3003/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cust_001",
    "productId": "prod_001",
    "quantity": 1
  }'

# 2. Check order status
curl http://localhost:3003/api/v1/orders/{orderId}

# 3. View transaction history (processed by worker)
curl http://localhost:3004/api/v1/payments/order/{orderId}
```

## Environment Variables

| Variable              | Description          | Default     |
| --------------------- | -------------------- | ----------- |
| `NODE_ENV`            | Environment mode     | development |
| `MONGO_ROOT_USERNAME` | MongoDB username     | admin       |
| `MONGO_ROOT_PASSWORD` | MongoDB password     | password    |
| `MONGO_DB_NAME`       | Database name        | ecommerce   |
| `RABBITMQ_USER`       | RabbitMQ username    | admin       |
| `RABBITMQ_PASSWORD`   | RabbitMQ password    | password    |
| `CORS_ORIGIN`         | CORS allowed origins | \*          |
| `LOG_LEVEL`           | Logging level        | info        |

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
GET /api/v1/customers?page=1&limit=10
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
GET /api/v1/products?page=1&limit=10&category=Electronics
```

#### Check Availability

```http
GET /api/v1/products/{productId}/availability?quantity=2
```

### Order Service API

#### Create Order

```http
POST /api/v1/orders
Content-Type: application/json

{
  "customerId": "cust_001",
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
GET /api/v1/orders?customerId=cust_001&page=1&limit=10
```

## Database Schema

### Collections

1. **customers**: Customer information and addresses
2. **products**: Product catalog with inventory
3. **orders**: Order records with status tracking
4. **transactions**: Transaction history from payment events

### Indexes

The system includes optimized indexes for:

- Customer email and customerId (unique)
- Product productId, category, brand
- Order orderId, customerId, status
- Transaction transactionId, orderId, customerId

## Message Queue

### RabbitMQ Configuration

- **Exchange**: `ecommerce.transactions`
- **Queue**: `transaction.save`
- **Routing Key**: `transaction.created`

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

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests for specific service
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

- Request/response tracking
- Error logging with stack traces
- Performance metrics
- Correlation IDs for request tracing

## Development

### Local Development Setup

```bash
# Install dependencies for a specific service
cd services/customer-service
npm install

# Run service in development mode
npm run dev

# Build service
npm run build

# Lint and format
npm run lint
npm run lint:fix
```

### Code Quality

The project enforces:

- Strict TypeScript configuration
- ESLint with TypeScript rules
- Prettier for code formatting
- Maximum function length (50 lines)
- Maximum parameters (4 per function)
- Maximum line length (80 characters)

## Production Deployment

### Docker Production Build

```bash
# Build production images
docker-compose build

# Run in production mode
NODE_ENV=production docker-compose up -d
```

### Environment Configuration

For production deployment:

1. Set secure environment variables
2. Use production MongoDB cluster
3. Configure proper CORS origins
4. Set up monitoring and logging
5. Implement proper secret management

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3001-3004, 27017, 5672, 15672 are available
2. **MongoDB connection**: Check MongoDB container status and credentials
3. **RabbitMQ connection**: Verify RabbitMQ container is running
4. **Service communication**: Check docker network connectivity

### Logs and Debugging

```bash
# View all service logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f customer-service

# Check container status
docker-compose ps

# Access container shell
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

Built with ❤️ using Node.js, TypeScript, and microservices architecture.
