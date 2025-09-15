import mongoose from 'mongoose';
import { createLogger } from './logger';

const logger = createLogger('database-seeder');

interface SeedData {
  customers: any[];
  products: any[];
}

const seedData: SeedData = {
  customers: [
    {
      customerId: 'cust_001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'USA',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      customerId: 'cust_002',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      phone: '+1234567891',
      address: {
        street: '456 Oak Ave',
        city: 'Los Angeles',
        state: 'CA',
        zipCode: '90001',
        country: 'USA',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      customerId: 'cust_003',
      firstName: 'Bob',
      lastName: 'Johnson',
      email: 'bob.johnson@example.com',
      phone: '+1234567892',
      address: {
        street: '789 Pine Rd',
        city: 'Chicago',
        state: 'IL',
        zipCode: '60601',
        country: 'USA',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      customerId: 'cust_004',
      firstName: 'Alice',
      lastName: 'Williams',
      email: 'alice.williams@example.com',
      phone: '+1234567893',
      address: {
        street: '321 Elm St',
        city: 'Miami',
        state: 'FL',
        zipCode: '33101',
        country: 'USA',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      customerId: 'cust_005',
      firstName: 'Charlie',
      lastName: 'Brown',
      email: 'charlie.brown@example.com',
      phone: '+1234567894',
      address: {
        street: '654 Maple Ave',
        city: 'Seattle',
        state: 'WA',
        zipCode: '98101',
        country: 'USA',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  products: [
    {
      productId: 'prod_001',
      name: 'MacBook Pro 14-inch',
      description: 'Apple MacBook Pro with M2 chip, 14-inch display',
      price: 199900,
      category: 'Electronics',
      brand: 'Apple',
      stock: 50,
      specifications: {
        processor: 'Apple M2',
        memory: '16GB',
        storage: '512GB SSD',
        display: '14-inch Liquid Retina XDR',
      },
      images: ['macbook-pro-14-1.jpg', 'macbook-pro-14-2.jpg'],
      weight: 1.6,
      dimensions: {
        length: 31.26,
        width: 22.12,
        height: 1.55,
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      productId: 'prod_002',
      name: 'iPhone 15 Pro',
      description: 'Latest iPhone with titanium design and A17 Pro chip',
      price: 99900,
      category: 'Electronics',
      brand: 'Apple',
      stock: 100,
      specifications: {
        processor: 'A17 Pro',
        memory: '128GB',
        display: '6.1-inch Super Retina XDR',
        camera: '48MP Main, 12MP Ultra Wide, 12MP Telephoto',
      },
      images: ['iphone-15-pro-1.jpg', 'iphone-15-pro-2.jpg'],
      weight: 0.187,
      dimensions: {
        length: 14.67,
        width: 7.081,
        height: 0.829,
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      productId: 'prod_003',
      name: 'AirPods Pro (2nd generation)',
      description: 'Active Noise Cancellation wireless earbuds',
      price: 24900,
      category: 'Electronics',
      brand: 'Apple',
      stock: 200,
      specifications: {
        batteryLife: '6 hours listening, 30 hours with case',
        connectivity: 'Bluetooth 5.3',
        features: 'Active Noise Cancellation, Transparency mode',
      },
      images: ['airpods-pro-1.jpg', 'airpods-pro-2.jpg'],
      weight: 0.056,
      dimensions: {
        length: 4.5,
        width: 6.05,
        height: 2.15,
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      productId: 'prod_004',
      name: 'Dell XPS 13',
      description: 'Ultra-portable laptop with InfinityEdge display',
      price: 129900,
      category: 'Electronics',
      brand: 'Dell',
      stock: 30,
      specifications: {
        processor: 'Intel Core i7-1355U',
        memory: '16GB LPDDR5',
        storage: '512GB PCIe NVMe SSD',
        display: '13.4-inch FHD+ InfinityEdge',
      },
      images: ['dell-xps-13-1.jpg', 'dell-xps-13-2.jpg'],
      weight: 1.19,
      dimensions: {
        length: 29.57,
        width: 19.87,
        height: 1.55,
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      productId: 'prod_005',
      name: 'Sony WH-1000XM5',
      description: 'Industry-leading noise canceling headphones',
      price: 39900,
      category: 'Electronics',
      brand: 'Sony',
      stock: 75,
      specifications: {
        batteryLife: '30 hours',
        connectivity: 'Bluetooth 5.2, NFC',
        features: 'Industry-leading noise canceling, Quick Attention mode',
      },
      images: ['sony-wh1000xm5-1.jpg', 'sony-wh1000xm5-2.jpg'],
      weight: 0.25,
      dimensions: {
        length: 26.4,
        width: 19.5,
        height: 8.0,
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      productId: 'prod_006',
      name: 'Samsung Galaxy S24 Ultra',
      description: 'Premium Android smartphone with S Pen',
      price: 119900,
      category: 'Electronics',
      brand: 'Samsung',
      stock: 40,
      specifications: {
        processor: 'Snapdragon 8 Gen 3',
        memory: '256GB',
        display: '6.8-inch Dynamic AMOLED 2X',
        camera: '200MP Main, 50MP Periscope, 10MP Telephoto',
      },
      images: ['galaxy-s24-ultra-1.jpg', 'galaxy-s24-ultra-2.jpg'],
      weight: 0.232,
      dimensions: {
        length: 16.2,
        width: 7.9,
        height: 0.88,
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      productId: 'prod_007',
      name: 'Nintendo Switch OLED',
      description: 'Gaming console with vibrant OLED screen',
      price: 34900,
      category: 'Gaming',
      brand: 'Nintendo',
      stock: 60,
      specifications: {
        display: '7-inch OLED screen',
        storage: '64GB internal',
        battery: '4.5-9 hours',
        features: 'Handheld and docked modes',
      },
      images: ['switch-oled-1.jpg', 'switch-oled-2.jpg'],
      weight: 0.42,
      dimensions: {
        length: 24.2,
        width: 10.2,
        height: 1.4,
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
};

export async function seedDatabase(mongodbUri: string): Promise<void> {
  try {
    logger.info('Starting database seeding...');


    await (mongoose as any).connect(mongodbUri);
    logger.info('Connected to MongoDB');

    const db = (mongoose as any).connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }

    await Promise.all([
      db.collection('customers').deleteMany({}),
      db.collection('products').deleteMany({}),
    ]);
    logger.info('Cleared existing customer and product data');

    await Promise.all([
      
      db.collection('customers').createIndex({ email: 1 }, { unique: true }),
      db
        .collection('customers')
        .createIndex({ customerId: 1 }, { unique: true }),
      db.collection('customers').createIndex({ 'address.city': 1 }),
      db.collection('customers').createIndex({ 'address.state': 1 }),
      db.collection('customers').createIndex({ createdAt: -1 }),

      
      db.collection('products').createIndex({ productId: 1 }, { unique: true }),
      db
        .collection('products')
        .createIndex({ name: 'text', description: 'text' }),
      db.collection('products').createIndex({ category: 1 }),
      db.collection('products').createIndex({ brand: 1 }),
      db.collection('products').createIndex({ isActive: 1 }),
      db.collection('products').createIndex({ createdAt: -1 }),
    ]);
    logger.info('Created database indexes for customers and products');

    await Promise.all([
      db.collection('customers').insertMany(seedData.customers),
      db.collection('products').insertMany(seedData.products),
    ]);

    const counts = await Promise.all([
      db.collection('customers').countDocuments(),
      db.collection('products').countDocuments(),
    ]);

    logger.info('Database seeded successfully!', {
      customers: counts[0],
      products: counts[1],
    });
  } catch (error) {
    logger.error('Failed to seed database:', error);
    throw error;
  } finally {
    await (mongoose as any).disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

export async function checkIfSeeded(mongodbUri: string): Promise<boolean> {
  try {
    await (mongoose as any).connect(mongodbUri);
    const db = (mongoose as any).connection.db;

    if (!db) {
      return false;
    }

    const customerCount = await db.collection('customers').countDocuments();
    const productCount = await db.collection('products').countDocuments();

    await (mongoose as any).disconnect();

    return customerCount > 0 && productCount > 0;
  } catch (error) {
    logger.error('Failed to check if database is seeded:', error);
    return false;
  }
}
