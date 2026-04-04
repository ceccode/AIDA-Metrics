import { promises as fs } from 'fs';
import { dirname } from 'path';
import type { ZodType } from 'zod';

export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Ignore if directory already exists
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

export async function writeJSON(filePath: string, data: unknown): Promise<void> {
  await ensureDir(dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function readJSON<T>(filePath: string, schema?: ZodType<T>): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(content);
  if (schema) {
    return schema.parse(data);
  }
  return data as T;
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
