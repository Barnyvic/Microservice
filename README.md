# E-commerce Microservices

A comprehensive microservices architecture for e-commerce applications built with Node.js, TypeScript, MongoDB, Redis, and RabbitMQ.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Git

### Single Command Setup

```bash
# Make the script executable (if not already)
chmod +x microservices.sh

# Setup and start everything
./microservices.sh setup
./microservices.sh start
```

## 📋 Management Commands

The `microservices.sh` script provides a unified interface for all operations:

### Basic Commands

```bash
./microservices.sh setup           # Initial setup (create .env, start infrastructure)
./microservices.sh start           # Start all services (hybrid mode)
./microservices.sh stop            # Stop all services
./microservices.sh restart         # Restart all services
./microservices.sh status          # Show status of all services
```

### Testing & Debugging

```bash
./microservices.sh test            # Test all API endpoints
./microservices.sh logs [service]  # Show logs for a service
```

### Advanced Commands

```bash
./microservices.sh start-docker    # Start all services in Docker containers
./microservices.sh start-local     # Start all services locally (no Docker)
./microservices.sh clean           # Clean up (stop services, remove containers)
./microservices.sh help            # Show help message
```

## 🏗️ Architecture

### Services

- **Customer Service** (Port 3001) - Customer management
- **Product Service** (Port 3002) - Product catalog and inventory
- **Payment Service** (Port 3003) - Payment processing
- **Order Service** (Port 3004) - Order management
- **Transaction Worker** - Background processing

### Infrastructure

- **MongoDB** (Port 27017) - Primary database
- **Redis** (Port 6379) - Caching and session storage
- **RabbitMQ** (Port 5672) - Message queue
  - Management UI: http://localhost:15672
  - Username: admin
  - Password: password

## 🔧 API Endpoints

### Customer Service (Port 3001)

- `GET /api/v1/customers` - List customers
- `GET /api/v1/customers/email/{email}` - Get customer by email
- `POST /api/v1/customers` - Create customer
- `PUT /api/v1/customers/{id}` - Update customer
- `DELETE /api/v1/customers/{id}` - Delete customer

### Product Service (Port 3002)

- `GET /api/v1/products` - List products
- `GET /api/v1/products/{id}` - Get product by ID
- `POST /api/v1/products` - Create product
- `PUT /api/v1/products/{id}` - Update product
- `DELETE /api/v1/products/{id}` - Delete product

### Payment Service (Port 3003)

- `GET /api/v1/payments` - List payments
- `GET /api/v1/payments/{id}` - Get payment by ID
- `POST /api/v1/payments` - Process payment

### Order Service (Port 3004)

- `GET /api/v1/orders` - List orders
- `GET /api/v1/orders/{id}` - Get order by ID
- `POST /api/v1/orders` - Create order
- `PUT /api/v1/orders/{id}` - Update order

## 🧪 Testing

### Health Checks

```bash
curl http://localhost:3001/healthz  # Customer Service
curl http://localhost:3002/healthz  # Product Service
curl http://localhost:3003/healthz  # Payment Service
curl http://localhost:3004/healthz  # Order Service
```

### API Testing

```bash
./microservices.sh test
```

## 📊 Monitoring

### Service Status

```bash
./microservices.sh status
```

### View Logs

```bash
./microservices.sh logs customer-service
./microservices.sh logs mongodb
```

## 🛠️ Development

### Project Structure

```
├── services/
│   ├── customer-service/
│   ├── product-service/
│   ├── payment-service/
│   ├── order-service/
│   └── transaction-worker/
├── shared/
│   ├── config/
│   ├── middleware/
│   ├── types/
│   └── utils/
├── docker-compose.yml
├── microservices.sh
└── README.md
```

### Key Features

- **TypeScript** - Type-safe development
- **Express.js** - Web framework
- **MongoDB** - Document database with Mongoose ODM
- **Redis** - Caching and distributed locking
- **RabbitMQ** - Message queuing for async processing
- **Docker** - Containerization
- **Structured Logging** - Winston-based logging
- **Error Handling** - Comprehensive error management
- **Validation** - Zod-based request validation
- **Health Checks** - Service monitoring

## 🔒 Environment Variables

The script automatically creates a `.env` file with the following configuration:

```env
NODE_ENV=development
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=password
MONGO_DB_NAME=ecommerce
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=password
REDIS_PASSWORD=password
REDIS_DB=0
CORS_ORIGIN=*
LOG_LEVEL=info
```

## 🚨 Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3001-3004, 27017, 6379, 5672 are available
2. **Docker not running**: Start Docker Desktop
3. **Services not starting**: Check logs with `./microservices.sh logs [service]`
4. **Database connection issues**: Verify MongoDB is running with `./microservices.sh status`

### Clean Restart

```bash
./microservices.sh clean
./microservices.sh setup
./microservices.sh start
```

## 📝 License

This project is licensed under the MIT License.
