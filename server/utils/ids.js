import crypto from 'node:crypto';

export const uuid = () => crypto.randomUUID();

export function code() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}