import { auditLogStore } from '../stores';
import { AuditLogEntry } from '../types';

export async function logAction(
  userId: string,
  username: string,
  actionType: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown>,
  ipAddress: string
): Promise<AuditLogEntry> {
  return auditLogStore.append({
    timestamp: new Date().toISOString(),
    userId,
    username,
    actionType,
    entityType,
    entityId,
    details,
    ipAddress,
  });
}
