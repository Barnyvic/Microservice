import mongoose from 'mongoose';
import env from '@shared/config/env';
import { logger } from '@shared/utils/logger';

mongoose.set('strictQuery', false);

const url: string = env.MONGODB_URI;

export const connectDatabase = async (): Promise<void> => {
  if (!url) {
    throw new Error('MongoDB connection URL is not provided');
  }

  try {
    await mongoose.connect(url);
    logger.info('Payment service database connected successfully');
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw new Error(
      'Sorry, we could not connect to the database at the moment'
    );
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    logger.info('Payment service database disconnected');
  } catch (error) {
    logger.error('Error disconnecting from database:', error);
    throw error;
  }
};

export const isDatabaseHealthy = (): boolean => {
  return mongoose.connection?.readyState === 1;
};
