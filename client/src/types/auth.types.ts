export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'operator';
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'operator';
}

export interface UpdateUserData {
  email?: string;
  role?: 'admin' | 'operator';
  isActive?: boolean;
  password?: string;
}
