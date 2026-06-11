// country-flag-icons ships no types for its per-country `string/3x2/*` modules.
// Each default-exports the raw SVG markup as a string.
declare module 'country-flag-icons/string/3x2/*' {
  const svg: string;
  export default svg;
}
