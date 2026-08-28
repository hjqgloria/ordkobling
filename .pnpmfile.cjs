function readPackage(pkg, context) {
  // Force all sub-dependencies to patched versions across the board
  if (pkg.dependencies) {
    if (pkg.dependencies.postcss && pkg.dependencies.postcss !== '8.5.26') {
      pkg.dependencies.postcss = '8.5.26';
    }
    if (pkg.dependencies.undici && pkg.dependencies.undici !== '7.29.0') {
      pkg.dependencies.undici = '7.29.0';
    }
    if (pkg.dependencies.nanoid && pkg.dependencies.nanoid !== '3.3.18') {
      pkg.dependencies.nanoid = '3.3.18';
    }
  }
  return pkg;
}

module.exports = {
  hooks: {
    readPackage
  }
};