import fs from 'fs';
import path from 'path';

export function resolveVitestEnvFile(preferredFile: string) {
  const preferredPath = path.resolve(process.cwd(), preferredFile);
  if (fs.existsSync(preferredPath)) {
    return preferredPath;
  }

  if (preferredFile === '.env.test') {
    const examplePath = path.resolve(process.cwd(), '.env.test.example');
    if (fs.existsSync(examplePath)) {
      return examplePath;
    }
  }

  return preferredPath;
}