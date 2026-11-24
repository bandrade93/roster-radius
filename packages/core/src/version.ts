/** Version of the methodology the engine implements (METHODOLOGY.md). Reports state it. */
export const METHODOLOGY_VERSION = '0.1';

/** Version of this package, as in package.json (a test keeps them equal). Written into every saved document. */
export const CORE_VERSION = '0.0.1';

/**
 * Version of the saved JSON documents (docs/formats/report.md), separate from
 * the methodology and the package. Semantic versioning: a minor version only
 * adds fields, a major version removes or changes them. While the major is 0,
 * a minor version may also break readers.
 */
export const FORMAT_VERSION = '0.1.0';
