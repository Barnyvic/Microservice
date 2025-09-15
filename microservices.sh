#!/bin/bash


RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' 

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICES=("customer-service" "product-service" "order-service" "payment-service" "transaction-worker")
PORTS=(3001 3002 3003 3004)
INFRASTRUCTURE=("mongodb" "redis" "rabbitmq")

show_help() {
    echo -e "${BLUE}E-commerce Microservices Management Script${NC}"
    echo -e "${BLUE}==========================================${NC}"
    echo ""
    echo -e "${YELLOW}Usage:${NC}"
    echo "  ./microservices.sh [COMMAND] [OPTIONS]"
    echo ""
    echo -e "${YELLOW}Commands:${NC}"
    echo "  ${GREEN}setup${NC}           - Initial setup (create .env, start infrastructure)"
    echo "  ${GREEN}start${NC}           - Start all services (hybrid mode: Docker infra + local services)"
    echo "  ${GREEN}start-docker${NC}    - Start all services in Docker containers"
    echo "  ${GREEN}start-local${NC}     - Start all services locally (no Docker)"
    echo "  ${GREEN}stop${NC}            - Stop all services"
    echo "  ${GREEN}restart${NC}         - Restart all services"
    echo "  ${GREEN}status${NC}          - Show status of all services"
    echo "  ${GREEN}test${NC}            - Test all API endpoints"
    echo "  ${GREEN}logs${NC} [service]  - Show logs for a service"
    echo "  ${GREEN}clean${NC}           - Clean up (stop services, remove containers)"
    echo "  ${GREEN}help${NC}            - Show this help message"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  ./microservices.sh setup"
    echo "  ./microservices.sh start"
    echo "  ./microservices.sh test"
    echo "  ./microservices.sh logs customer-service"
    echo "  ./microservices.sh stop"
    echo ""
}

create_env() {
    if [ ! -f .env ]; then
        echo -e "${BLUE}Creating .env file...${NC}"
        cat > .env << EOF
# Environment Configuration
NODE_ENV=development

# Database Configuration
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=password
MONGO_DB_NAME=ecommerce

# Message Broker Configuration
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=password

# Redis Configuration
REDIS_PASSWORD=password
REDIS_DB=0

# CORS Configuration
CORS_ORIGIN=*

# Logging Configuration
LOG_LEVEL=info

# Security (Generate secure values in production)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
API_KEY=your-secure-api-key-change-in-production
EOF
        echo -e "${GREEN}.env file created${NC}"
    else
        echo -e "${GREEN}.env file already exists${NC}"
    fi
}

check_infrastructure() {
    echo -e "${BLUE}Checking infrastructure...${NC}"
    local all_running=true
    
    for infra in "${INFRASTRUCTURE[@]}"; do
        if ! docker-compose ps | grep -q "$infra.*Up"; then
            all_running=false
            break
        fi
    done
    
    if [ "$all_running" = false ]; then
        echo -e "${YELLOW}Infrastructure not running. Starting infrastructure...${NC}"
        docker-compose up -d "${INFRASTRUCTURE[@]}"
        echo -e "${BLUE}Waiting for infrastructure to be ready...${NC}"
        sleep 15
    else
        echo -e "${GREEN}Infrastructure is running${NC}"
    fi
}

build_shared() {
    echo -e "${BLUE}Building shared library...${NC}"
    cd shared
    npm install
    npm run build
    cd ..
    echo -e "${GREEN}Shared library built${NC}"
}

start_service_local() {
    local service_name=$1
    local port=$2
    local service_dir="services/$service_name"
    
    echo -e "${BLUE}Starting $service_name on port $port...${NC}"
    cd "$service_dir"
    npm install
    npm run dev &
    local pid=$!
    echo "$pid" > "../../${service_name}.pid"
    cd "$SCRIPT_DIR"
    
    echo -e "${BLUE}Waiting for $service_name to be ready...${NC}"
    for i in {1..30}; do
        if curl -s "http://localhost:$port/healthz" > /dev/null 2>&1; then
            echo -e "${GREEN}$service_name is ready!${NC}"
            return 0
        fi
        sleep 2
    done
    
    echo -e "${RED}$service_name failed to start${NC}"
    return 1
}

start_local() {
    echo -e "${BLUE}Starting all services locally...${NC}"
    
    check_infrastructure
    build_shared
    
    for i in "${!SERVICES[@]}"; do
        if [ "${SERVICES[$i]}" != "transaction-worker" ]; then
            start_service_local "${SERVICES[$i]}" "${PORTS[$i]}"
        fi
    done
    
    echo -e "${BLUE}Starting Transaction Worker...${NC}"
    cd services/transaction-worker
    npm install
    npm run dev &
    local worker_pid=$!
    echo "$worker_pid" > "../../transaction-worker.pid"
    cd "$SCRIPT_DIR"
    
    show_status
}

start_docker() {
    echo -e "${BLUE}Starting all services in Docker...${NC}"
    
    create_env
    docker-compose up --build -d
    
    echo -e "${BLUE}Waiting for services to be ready...${NC}"
    sleep 30
    
    show_status
}

start_hybrid() {
    echo -e "${BLUE}Starting E-commerce Microservices (Hybrid Mode)...${NC}"
    echo -e "${BLUE}Infrastructure: Docker (MongoDB, Redis, RabbitMQ)${NC}"
    echo -e "${BLUE}Services: Local (Node.js)${NC}"
    
    check_infrastructure
    build_shared
    start_local
}

stop_services() {
    echo -e "${BLUE}Stopping all services...${NC}"
    
    echo -e "${BLUE}Stopping local services...${NC}"
    for service in "${SERVICES[@]}"; do
        if [ -f "${service}.pid" ]; then
            local pid=$(cat "${service}.pid")
            if kill -0 "$pid" 2>/dev/null; then
                echo -e "${YELLOW}Stopping $service (PID: $pid)...${NC}"
                kill "$pid"
                rm "${service}.pid"
            else
                echo -e "${YELLOW}$service is not running${NC}"
                rm "${service}.pid"
            fi
        fi
    done
    
    echo -e "${BLUE}Stopping Docker services...${NC}"
    docker-compose down
    
    echo -e "${GREEN}All services stopped!${NC}"
}

show_status() {
    echo -e "${BLUE}Service Status${NC}"
    echo -e "${BLUE}=================${NC}"
    
    echo -e "${YELLOW}Docker Services:${NC}"
    docker-compose ps
    
    echo ""
    echo -e "${YELLOW}Local Services:${NC}"
    
    for i in "${!SERVICES[@]}"; do
        if [ "${SERVICES[$i]}" != "transaction-worker" ]; then
            local port="${PORTS[$i]}"
            if curl -s "http://localhost:$port/healthz" > /dev/null 2>&1; then
                echo -e "${GREEN}${SERVICES[$i]} (port $port) - Running${NC}"
            else
                echo -e "${RED}${SERVICES[$i]} (port $port) - Not running${NC}"
            fi
        fi
    done
    
    if [ -f "transaction-worker.pid" ]; then
        local worker_pid=$(cat "transaction-worker.pid")
        if kill -0 "$worker_pid" 2>/dev/null; then
            echo -e "${GREEN}transaction-worker (PID: $worker_pid) - Running${NC}"
        else
            echo -e "${RED}transaction-worker - Not running${NC}"
        fi
    else
        echo -e "${RED}transaction-worker - Not running${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}Service URLs:${NC}"
    echo "  • Customer Service: http://localhost:3001"
    echo "  • Product Service:  http://localhost:3002"
    echo "  • Payment Service:  http://localhost:3003"
    echo "  • Order Service:    http://localhost:3004"
    echo ""
    echo -e "${YELLOW}Infrastructure:${NC}"
    echo "  • MongoDB:          localhost:27017"
    echo "  • Redis:            localhost:6379"
    echo "  • RabbitMQ:         localhost:5672 (Management: http://localhost:15672)"
}

test_apis() {
    echo -e "${BLUE}Testing E-commerce Microservices API Endpoints${NC}"
    echo -e "${BLUE}==================================================${NC}"
    
    test_endpoint() {
        local method=$1
        local url=$2
        local data=$3
        local description=$4
        
        echo -e "\n${CYAN}Testing: $description${NC}"
        echo "URL: $method $url"
        
        if [ "$method" = "GET" ]; then
            response=$(curl -s -w "\n%{http_code}" "$url")
        else
            response=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$url")
        fi
        
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | head -n -1)
        
        if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
            echo -e "${GREEN}SUCCESS (HTTP $http_code)${NC}"
            echo "$body" | head -c 200
            if [ ${#body} -gt 200 ]; then
                echo "..."
            fi
        else
            echo -e "${RED}FAILED (HTTP $http_code)${NC}"
            echo "$body"
        fi
        echo "---"
    }
    
    echo -e "\n${YELLOW}Health Checks${NC}"
    test_endpoint "GET" "http://localhost:3001/healthz" "" "Customer Service Health"
    test_endpoint "GET" "http://localhost:3002/healthz" "" "Product Service Health"
    test_endpoint "GET" "http://localhost:3003/healthz" "" "Payment Service Health"
    test_endpoint "GET" "http://localhost:3004/healthz" "" "Order Service Health"
    
    echo -e "\n${YELLOW}Customer Service Tests${NC}"
    test_endpoint "GET" "http://localhost:3001/api/v1/customers" "" "List Customers"
    test_endpoint "GET" "http://localhost:3001/api/v1/customers/email/john.doe@example.com" "" "Get Customer by Email"
    
    echo -e "\n${YELLOW}Product Service Tests${NC}"
    test_endpoint "GET" "http://localhost:3002/api/v1/products" "" "List Products"
    test_endpoint "GET" "http://localhost:3002/api/v1/products/prod_001" "" "Get Product by ID"
    
    echo -e "\n${YELLOW}Payment Service Tests${NC}"
    test_endpoint "GET" "http://localhost:3003/api/v1/payments" "" "List Payments"
    
    echo -e "\n${YELLOW}Order Service Tests${NC}"
    test_endpoint "GET" "http://localhost:3004/api/v1/orders" "" "List Orders"
    
    echo -e "\n${GREEN}API Testing Complete!${NC}"
}

show_logs() {
    local service=$1
    
    if [ -z "$service" ]; then
        echo -e "${YELLOW}Available services:${NC}"
        echo "  • customer-service"
        echo "  • product-service"
        echo "  • order-service"
        echo "  • payment-service"
        echo "  • transaction-worker"
        echo "  • mongodb"
        echo "  • redis"
        echo "  • rabbitmq"
        echo ""
        echo -e "${YELLOW}Usage:${NC} ./microservices.sh logs [service-name]"
        return
    fi
    
    echo -e "${BLUE}Showing logs for $service...${NC}"
    
    if [[ " ${SERVICES[@]} " =~ " ${service} " ]]; then
        if [ -f "${service}.pid" ]; then
            local pid=$(cat "${service}.pid")
            if kill -0 "$pid" 2>/dev/null; then
                echo -e "${YELLOW}Service $service is running (PID: $pid)${NC}"
                echo -e "${YELLOW}Check the terminal where you started the service for logs${NC}"
            else
                echo -e "${RED}Service $service is not running${NC}"
            fi
        else
            echo -e "${RED}Service $service is not running${NC}"
        fi
    else
        docker-compose logs -f "$service"
    fi
}

clean_up() {
    echo -e "${BLUE}Cleaning up...${NC}"
      
    stop_services
    

    echo -e "${BLUE}Removing Docker containers and volumes...${NC}"
    docker-compose down -v --remove-orphans
    
    
    rm -f *.pid
    
    echo -e "${GREEN}Cleanup complete!${NC}"
}


restart_services() {
    echo -e "${BLUE}Restarting all services...${NC}"
    stop_services
    sleep 5
    start_hybrid
}

case "${1:-help}" in
    "setup")
        create_env
        check_infrastructure
        echo -e "${GREEN}Setup complete!${NC}"
        ;;
    "start"|"start-hybrid")
        start_hybrid
        ;;
    "start-docker")
        start_docker
        ;;
    "start-local")
        start_local
        ;;
    "stop")
        stop_services
        ;;
    "restart")
        restart_services
        ;;
    "status")
        show_status
        ;;
    "test")
        test_apis
        ;;
    "logs")
        show_logs "$2"
        ;;
    "clean")
        clean_up
        ;;
    "help"|*)
        show_help
        ;;
esac
