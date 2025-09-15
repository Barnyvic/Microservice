# E-commerce Microservices

A comprehensive microservices architecture for e-commerce applications built with Node.js, TypeScript, MongoDB, Redis, and RabbitMQ.

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Git

### Single Command Setup

```bash
chmod +x microservices.sh
./microservices.sh setup
./microservices.sh start
```

## Microservices Management Script

The `microservices.sh` script provides a unified interface for managing all aspects of the e-commerce microservices system.

### Script Commands

#### Basic Operations

```bash
./microservices.sh setup
```

Creates the `.env` file with default configuration and starts the infrastructure services (MongoDB, Redis, RabbitMQ).

```bash
./microservices.sh start
```

Starts all services in hybrid mode (Docker infrastructure + local Node.js services). This is the default and recommended mode.

```bash
./microservices.sh start-docker
```

Starts all services including microservices in Docker containers. Requires Docker to be running.

```bash
./microservices.sh start-local
```

Starts all services locally without Docker. Requires MongoDB, Redis, and RabbitMQ to be installed locally.

```bash
./microservices.sh stop
```

Stops all running services (both local and Docker).

```bash
./microservices.sh restart
```

Stops all services, waits 5 seconds, then starts them again in hybrid mode.

#### Monitoring and Debugging

```bash
./microservices.sh status
```

Displays the current status of all services including:

- Docker services status
- Local services health checks
- Service URLs and ports
- Infrastructure connection details

```bash
./microservices.sh test
```

Runs comprehensive API tests against all services:

- Health check endpoints
- Customer service endpoints
- Product service endpoints
- Payment service endpoints
- Order service endpoints

```bash
./microservices.sh logs [service-name]
```

Shows logs for a specific service. Available services:

- customer-service
- product-service
- order-service
- payment-service
- transaction-worker
- mongodb
- redis
- rabbitmq

#### Maintenance

```bash
./microservices.sh clean
```

Performs complete cleanup:

- Stops all services
- Removes Docker containers and volumes
- Cleans up PID files
- Removes orphaned containers

```bash
./microservices.sh help
```

Displays the help message with all available commands and usage examples.

### Script Features

#### Automatic Infrastructure Management

- Checks if Docker infrastructure is running
- Automatically starts MongoDB, Redis, and RabbitMQ if needed
- Waits for services to be ready before proceeding

#### Service Health Monitoring

- Built-in health check validation
- Automatic retry logic for service startup
- Port conflict detection and handling

#### Comprehensive Testing

- Automated API endpoint testing
- HTTP status code validation
- Response body validation
- Color-coded test results

#### Log Management

- Service-specific log viewing
- Docker container log access
- Process status monitoring

## Architecture Overview

### Service Architecture

The system consists of five main components:

#### Customer Service (Port 3001)

- **Purpose**: Customer management and authentication
- **Database**: MongoDB collection `customers`
- **Features**: CRUD operations, email validation, address management
- **Caching**: Redis-based caching with 5-minute TTL
- **Endpoints**:
  - `GET /api/v1/customers` - List customers with pagination
  - `GET /api/v1/customers/email/{email}` - Get customer by email
  - `POST /api/v1/customers` - Create new customer
  - `PUT /api/v1/customers/{id}` - Update customer
  - `DELETE /api/v1/customers/{id}` - Delete customer
  - `GET /healthz` - Health check
  - `GET /readyz` - Readiness check

#### Product Service (Port 3002)

- **Purpose**: Product catalog and inventory management
- **Database**: MongoDB collection `products`
- **Features**: Product CRUD, inventory tracking, search functionality
- **Caching**: Redis-based caching with tag-based invalidation
- **Endpoints**:
  - `GET /api/v1/products` - List products with pagination
  - `GET /api/v1/products/{id}` - Get product by ID
  - `POST /api/v1/products` - Create new product
  - `PUT /api/v1/products/{id}` - Update product
  - `DELETE /api/v1/products/{id}` - Delete product
  - `GET /healthz` - Health check
  - `GET /readyz` - Readiness check

#### Order Service (Port 3003)

- **Purpose**: Order processing and management
- **Database**: MongoDB collection `orders`
- **Features**: Order creation, status tracking, payment integration
- **Caching**: Redis-based caching for order lookups
- **Endpoints**:
  - `GET /api/v1/orders` - List orders with pagination
  - `GET /api/v1/orders/{id}` - Get order by ID
  - `POST /api/v1/orders` - Create new order
  - `PUT /api/v1/orders/{id}` - Update order
  - `GET /healthz` - Health check
  - `GET /readyz` - Readiness check

#### Payment Service (Port 3004)

- **Purpose**: Payment processing and transaction management
- **Database**: MongoDB collection `payments`
- **Features**: Payment processing, transaction history, status tracking
- **Caching**: Redis-based caching for payment lookups
- **Endpoints**:
  - `GET /api/v1/payments` - List payments with pagination
  - `GET /api/v1/payments/{id}` - Get payment by ID
  - `POST /api/v1/payments` - Process payment
  - `GET /healthz` - Health check
  - `GET /readyz` - Readiness check

#### Transaction Worker

- **Purpose**: Background processing of payment transactions
- **Features**: RabbitMQ message consumption, transaction logging
- **Database**: MongoDB collection `transactions`
- **Message Queue**: Processes payment events from RabbitMQ

### Infrastructure Components

#### MongoDB (Port 27017)

- **Purpose**: Primary database for all services
- **Authentication**: Username: admin, Password: password
- **Database**: ecommerce
- **Collections**: customers, products, orders, payments, transactions

#### Redis (Port 6379)

- **Purpose**: Caching and distributed locking
- **Authentication**: Password: password
- **Database**: 0
- **Features**: Cache-aside pattern, tag-based invalidation, distributed locks

#### RabbitMQ (Port 5672)

- **Purpose**: Message queuing for asynchronous processing
- **Management UI**: http://localhost:15672
- **Authentication**: Username: admin, Password: password
- **Queues**: payment-processing, transaction-logging

## Shared Library

The `shared/` directory contains common utilities used across all microservices:

### Configuration (`shared/config/`)

- **env.ts**: Environment variable validation using Zod
- **database.ts**: Database connection management

### Middleware (`shared/middleware/`)

- **error-handler.ts**: Centralized error handling with custom error classes
- **validation.ts**: Request validation using Zod schemas

### Types (`shared/types/`)

- **index.ts**: Shared TypeScript interfaces and types

### Utilities (`shared/utils/`)

- **logger.ts**: Structured logging with Winston
- **http-client.ts**: HTTP client with retry logic
- **redis-client.ts**: Redis connection management
- **cache-manager.ts**: High-level caching abstraction
- **redis-lock-manager.ts**: Distributed locking mechanism
- **rabbitmq-manager.ts**: Message queue management
- **seed-database.ts**: Database seeding utilities

## API Documentation

### Request/Response Format

All APIs follow RESTful conventions with JSON request/response bodies.

#### Pagination

```json
{
  "page": 1,
  "limit": 10,
  "total": 100,
  "totalPages": 10,
  "data": [...]
}
```

#### Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {...}
  }
}
```

### Authentication

Currently, the system uses API key authentication. Include the API key in the request header:

```bash
curl -H "X-API-Key: your-secure-api-key-change-in-production" \
     http://localhost:3001/api/v1/customers
```

### Rate Limiting

Each service implements rate limiting to prevent abuse:

- Customer Service: 100 requests per minute
- Product Service: 200 requests per minute
- Order Service: 50 requests per minute
- Payment Service: 30 requests per minute

## Environment Configuration

The system uses environment variables for configuration. The `microservices.sh` script automatically creates a `.env` file with default values:

```env
NODE_ENV=development
PORT=3000
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=password
MONGO_DB_NAME=ecommerce
MONGODB_URI=mongodb://admin:password@localhost:27017/ecommerce?authSource=admin
RABBITMQ_URI=amqp://admin:password@localhost:5672
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=password
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=password
REDIS_DB=0
CORS_ORIGIN=*
LOG_LEVEL=info
JWT_SECRET=your-super-secret-jwt-key-change-in-production
API_KEY=your-secure-api-key-change-in-production
```

## Development Workflow

### Local Development

1. **Start the system**:

   ```bash
   ./microservices.sh start
   ```

2. **Make changes** to any service in the `services/` directory

3. **Test changes**:

   ```bash
   ./microservices.sh test
   ```

4. **View logs**:

   ```bash
   ./microservices.sh logs [service-name]
   ```

5. **Stop the system**:
   ```bash
   ./microservices.sh stop
   ```

### Docker Development

1. **Start everything in Docker**:

   ```bash
   ./microservices.sh start-docker
   ```

2. **View Docker logs**:

   ```bash
   ./microservices.sh logs [service-name]
   ```

3. **Clean up**:
   ```bash
   ./microservices.sh clean
   ```

## Monitoring and Observability

### Health Checks

Each service provides health check endpoints:

- `GET /healthz` - Basic health check
- `GET /readyz` - Readiness check (includes database connectivity)

### Logging

All services use structured logging with the following levels:

- **ERROR**: System errors and exceptions
- **WARN**: Warning messages and recoverable errors
- **INFO**: General information and business events
- **DEBUG**: Detailed debugging information

### Metrics

The system tracks the following metrics:

- Request count and response times
- Database query performance
- Cache hit/miss ratios
- Error rates by service
- Queue processing times

## Security Considerations

### Data Protection

- All sensitive data is encrypted at rest
- API keys are stored securely
- Database connections use authentication

### Input Validation

- All inputs are validated using Zod schemas
- SQL injection prevention through parameterized queries
- XSS protection through input sanitization

### Network Security

- CORS configuration for cross-origin requests
- Rate limiting to prevent abuse
- Request size limits

## Performance Optimization

### Caching Strategy

- **Cache-aside pattern** for frequently accessed data
- **Tag-based invalidation** for related data updates
- **TTL-based expiration** for time-sensitive data

### Database Optimization

- **Indexes** on frequently queried fields
- **Connection pooling** for database connections
- **Query optimization** with proper indexing

### Message Queue Optimization

- **Asynchronous processing** for non-critical operations
- **Dead letter queues** for failed message processing
- **Message persistence** for reliability

## Troubleshooting

### Common Issues

#### Port Conflicts

```bash
netstat -ano | findstr ":300[1-4]"
```

Kill processes using the required ports.

#### Docker Issues

```bash
docker-compose ps
docker-compose logs [service-name]
```

#### Service Startup Issues

```bash
./microservices.sh logs [service-name]
./microservices.sh status
```

#### Database Connection Issues

```bash
./microservices.sh logs mongodb
curl http://localhost:3001/readyz
```

### Clean Restart

```bash
./microservices.sh clean
./microservices.sh setup
./microservices.sh start
```

### Debug Mode

Set `LOG_LEVEL=debug` in the `.env` file for detailed logging.

## Production Deployment

### Environment Setup

1. Update all passwords and secrets in `.env`
2. Set `NODE_ENV=production`
3. Configure proper CORS origins
4. Set up SSL certificates
5. Configure monitoring and alerting

### Scaling Considerations

- Use load balancers for service instances
- Implement horizontal scaling for stateless services
- Use Redis Cluster for caching
- Implement database sharding if needed

### Monitoring

- Set up application performance monitoring (APM)
- Configure log aggregation
- Implement health check monitoring
- Set up alerting for critical failures

## License

This project is licensed under the MIT License.
