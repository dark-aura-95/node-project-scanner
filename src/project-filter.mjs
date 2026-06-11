export function matchesProjectQuery(proj, query) {
  if (!query) return true;

  const q = query.toLowerCase();
  return (
    proj.name.toLowerCase().includes(q) ||
    (proj.folderName || '').toLowerCase().includes(q) ||
    proj.relDir.toLowerCase().includes(q) ||
    proj.builder.toLowerCase().includes(q) ||
    (proj.git?.branch || '').toLowerCase().includes(q)
  );
}

export function filterProjects(projects, query) {
  if (!query) return [...projects];
  return projects.filter((p) => matchesProjectQuery(p, query));
}
