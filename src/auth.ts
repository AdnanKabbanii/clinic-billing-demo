import type { NextFunction, Request, Response } from 'express';
import { serviceSql } from './db.js';

export interface AuthContext {
  userId: string;
  clinicId: string;
  role: 'admin' | 'staff';
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = req.header('x-user-id');
  if (!userId) return res.status(401).json({ error: 'unauthenticated' });

  const [user] = await serviceSql<{ id: string; clinic_id: string; role: 'admin' | 'staff' }[]>`
    SELECT id, clinic_id, role FROM users WHERE id = ${userId}
  `;
  if (!user) return res.status(401).json({ error: 'unauthenticated' });

  req.auth = { userId: user.id, clinicId: user.clinic_id, role: user.role };
  next();
}

export function requireRole(role: AuthContext['role']) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.auth?.role !== role) return res.status(403).json({ error: 'forbidden' });
    next();
  };
}
