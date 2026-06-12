export function enrichProjectMeta(proj) {
  return {
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
  };
}
