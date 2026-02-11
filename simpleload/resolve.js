// List of fallback extensions
const alternativeExtensions = [
  [".js", ".ts"],
  [".cjs", ".cts"],
  [".mjs", ".mts"],
  [".jsx", ".tsx"],
];

export async function resolve(specifier, context, defaultResolve) {
  try {
    const resolved = await defaultResolve(specifier, context, defaultResolve);
    return resolved;
  } catch (err) {
    const alternativeGroupIndex = alternativeExtensions.findIndex((group) =>
      group.findIndex((ext) => specifier.endsWith(ext)) !== -1,
    );
    if (alternativeGroupIndex !== -1) {
      const specifierNoExt = specifier.slice(0, specifier.lastIndexOf("."));
      for (const ext of alternativeExtensions[alternativeGroupIndex]) {
        try {
          const resolvedCandidate = await defaultResolve(
            specifierNoExt + ext,
            context,
            defaultResolve,
          );
          return resolvedCandidate;
        } catch {
          // Ignore errors, try next extension
        }
      }
    }

    throw err;
  }
}
