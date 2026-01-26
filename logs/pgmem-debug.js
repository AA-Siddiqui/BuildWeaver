const { newDb } = require('pg-mem');

const db = newDb();
const pg = db.adapters.createPg();

(async () => {
  const client = new pg.Client();
  await client.connect();
  await client.query("CREATE TABLE users ( id uuid PRIMARY KEY, email text UNIQUE NOT NULL, created_at timestamptz DEFAULT now());");
  await client.query("CREATE TABLE orders (id uuid PRIMARY KEY, user_id uuid REFERENCES users(id));");

  const columns = await client.query(
    "SELECT table_name, column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name in ('users','orders')"
  );
  console.log('columns', columns.rows);

  const constraints = await client.query(
    "SELECT tc.constraint_name, tc.constraint_type, kcu.column_name, tc.table_schema FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE tc.table_name='users'"
  );
  console.log('constraints', constraints.rows);

  const constraintUsage = await client.query(
    "SELECT * FROM information_schema.constraint_column_usage WHERE table_name='users'"
  );
  console.log('constraint_column_usage', constraintUsage.rows);

  const pgConstraint = await client.query(
    "SELECT con.contype, pg_get_constraintdef(con.oid) as def FROM pg_constraint con JOIN pg_class cls ON cls.oid = con.conrelid JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace WHERE cls.relname='users'"
  );
  console.log('pg_constraint', pgConstraint.rows);

  const pgIndex = await client.query(
    "SELECT idx.indisunique, att.attname FROM pg_index idx JOIN pg_class cls ON cls.oid = idx.indrelid JOIN pg_attribute att ON att.attrelid = cls.oid AND att.attnum = ANY(idx.indkey)"
  );
  console.log('pg_index', pgIndex.rows);

  await client.end();
})();
