import 'reflect-metadata';
import { createTestApp } from './test/utils/create-test-app';
import { DRIZZLE, PG_POOL } from './src/database/database.constants';
import { Database, users } from '@buildweaver/db';

(async () => {
	const app = await createTestApp();
	const drizzleDb = app.get(DRIZZLE) as Database;
	const pool = app.get(PG_POOL);
	try {
		const inserted = await drizzleDb
			.insert(users)
			.values({ email: 'debug@example.com', passwordHash: 'hash' })
			.returning();
		console.log('inserted', inserted);
		const found = await drizzleDb.select().from(users);
		console.log('all', found);
		const raw = await pool.query('select * from users');
		console.log('raw', raw.rows);
	} catch (err) {
		console.error(err);
	} finally {
		await app.close();
	}
})();
