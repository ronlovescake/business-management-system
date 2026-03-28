import path from 'path';

export function getBackupDirectory() {
  const configuredDir = process.env.BACKUP_DIR?.trim();

  if (configuredDir) {
    return path.resolve(configuredDir);
  }

  return path.resolve(process.cwd(), 'backups');
}
