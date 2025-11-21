import { User } from '@buildweaver/db';

export interface AuthResult {
  token: string;
  user: Omit<User, 'passwordHash'>;
}
