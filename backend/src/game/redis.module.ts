import { Module, Global, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        const logger = new Logger('RedisModule');
        try {
          const redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379,
            retryStrategy: () => {
              // Don't retry - fail silently if Redis is not available
              return null;
            },
            maxRetriesPerRequest: 0,
            enableOfflineQueue: false,
            lazyConnect: true,
            showFriendlyErrorStack: false,
          });

          redis.on('error', (err) => {
            // Only log if it's not a connection refused (Redis not running)
            if (err.message && !err.message.includes('ECONNREFUSED')) {
              logger.warn(`Redis error: ${err.message}`);
            }
          });

          redis.on('connect', () => {
            logger.log('Redis connected successfully');
          });

          // Try to connect, but don't fail if it doesn't
          redis.connect().catch(() => {
            logger.warn('Redis connection failed. Using in-memory storage.');
          });

          return redis;
        } catch (error) {
          logger.warn('Redis initialization failed. Using in-memory storage.');
          return null;
        }
      },
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
