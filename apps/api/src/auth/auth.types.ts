import { UserRole, UserStatus } from '../database/entities/user.entity';

export type PublicUser = {
  id: string;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
};

export type ClientContext = {
  ipAddress: string | null;
  userAgent: string | null;
};
