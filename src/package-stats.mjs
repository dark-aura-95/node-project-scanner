export function getPackageStats(json) {
  const deps = Object.keys(json.dependencies || {}).length;
  const devDeps = Object.keys(json.devDependencies || {}).length;
  const peer = Object.keys(json.peerDependencies || {}).length;
  const optional = Object.keys(json.optionalDependencies || {}).length;

  return {
    dependencies: deps,
    devDependencies: devDeps,
    peerDependencies: peer,
    optionalDependencies: optional,
    total: deps + devDeps + peer + optional,
    vulnerabilities: 0,
  };
}
