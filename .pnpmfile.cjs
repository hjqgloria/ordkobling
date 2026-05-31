function readPackage(pkg, context) {
  // Force postcss to at least 8.5.15 for ANY package that uses a version lower than that.
  // This ensures we patch the CVE without blocking future updates > 8.5.15.
  if (pkg.dependencies && pkg.dependencies.postcss) {
    const currentVersion = pkg.dependencies.postcss;
    // Only override if the version is specifically in the 8.4.x range or lower
    if (currentVersion.startsWith('8.4') || currentVersion.startsWith('^8.4') || currentVersion.startsWith('~8.4')) {
      pkg.dependencies.postcss = '^8.5.15';
    }
  }
  return pkg;
}

module.exports = {
  hooks: {
    readPackage
  }
};