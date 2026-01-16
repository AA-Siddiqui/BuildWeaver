import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ApplyDatabaseSchemaDto } from './apply-database-schema.dto';

describe('ApplyDatabaseSchemaDto', () => {
  const base = {
    id: 'db-1',
    name: 'Test DB',
    tables: [
      {
        id: 'table-1',
        name: 'Posts',
        position: { x: -10.5, y: 42.2 },
        fields: [
          { id: 'id', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true },
          { id: 'content', name: 'content', type: 'string', nullable: true, unique: false }
        ]
      }
    ],
    relationships: [],
    connection: {
      host: 'localhost',
      port: 5432,
      database: 'app',
      user: 'tester',
      password: 'secret',
      ssl: true
    }
  } as const;

  it('accepts table positions when whitelist validation is enabled', async () => {
    const dto = plainToInstance(ApplyDatabaseSchemaDto, base);
    const result = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(result).toHaveLength(0);
  });
});