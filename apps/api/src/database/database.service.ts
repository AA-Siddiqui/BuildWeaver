import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { Database } from '@buildweaver/db';
import { DRIZZLE, PG_POOL } from './database.constants';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  constructor(
    @Inject(DRIZZLE) private readonly database: Database,
    @Inject(PG_POOL) private readonly pool: Pool
  ) {}

  get db() {
    return this.database;
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
