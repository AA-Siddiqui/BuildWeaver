import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { dbSchema, Database } from '@buildweaver/db';
import { DRIZZLE, PG_POOL } from './database.constants';
import { DatabaseService } from './database.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const connectionString = config.get<string>('DATABASE_URL');
        if (!connectionString) {
          throw new Error('DATABASE_URL is not configured');
        }

        return new Pool({
          connectionString,
          ssl: config.get<string>('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : undefined
        });
      }
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool): Database => drizzle(pool, { schema: dbSchema })
    },
    DatabaseService
  ],
  exports: [DatabaseService, DRIZZLE]
})
export class DatabaseModule {}
