import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { users, User } from '@buildweaver/db';

@Injectable()
export class UsersService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  async create(email: string, passwordHash: string): Promise<User> {
    const [user] = await this.db
      .insert(users)
      .values({ email: email.toLowerCase(), passwordHash })
      .returning();

    return user;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async findById(id: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user;
  }
}
