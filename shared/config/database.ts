import mongoose from 'mongoose';
import { logger } from '../utils/logger';

interface ConnectionInfo {
  connected: boolean;
  readyState?: number;
  host?: string;
  port?: number;
  name?: string;
}


class DatabaseConfig {
  private connection: typeof mongoose | null = null;
  private isConnected = false;

  
  async connect(uri: string): Promise<typeof mongoose> {
    try {
      if (this.isConnected) {
        logger.info('Database already connected');
        return this.connection!;
      }

      const options = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4,
        retryWrites: true,
        writeConcern: {
          w: 'majority' as const,
          wtimeout: 5000,
        },
      };

      this.connection = await mongoose.connect(uri, options);
      this.isConnected = true;

      logger.info('Database connected successfully', {
        host: this.connection.connection.host,
        port: this.connection.connection.port,
        name: this.connection.connection.name,
      });

      // Handle connection events
      mongoose.connection.on('error', (error: Error) => {
        logger.error('Database connection error:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('Database disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('Database reconnected');
        this.isConnected = true;
      });

      return this.connection;
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  
  async disconnect(): Promise<void> {
    try {
      if (this.connection) {
        await mongoose.disconnect();
        this.isConnected = false;
        logger.info('Database disconnected successfully');
      }
    } catch (error) {
      logger.error('Error disconnecting from database:', error);
      throw error;
    }
  }

  
  isHealthy(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  
  getConnectionInfo(): ConnectionInfo {
    if (!this.connection) {
      return { connected: false };
    }

    return {
      connected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name,
    };
  }
}

export default new DatabaseConfig();

