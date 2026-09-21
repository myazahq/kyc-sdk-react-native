# Bundled typefaces

The seven faces the SDK draws with, and nothing else: Karla 400/500/600/700
(body) and Space Grotesk 500/600/700 (headings). Both families are Google
Fonts under the SIL Open Font License 1.1; the licence for each sits beside
the files (`OFL-Karla.txt`, `OFL-SpaceGrotesk.txt`).

They are vendored rather than imported from the `@expo-google-fonts` packages
because Metro bundles every `require` in a package index whether or not the
export is used, so those two packages put all 19 of their font files (1.85 MB)
into every integrator's app for the seven faces the SDK uses. Add a weight here
only when `config/font-resolve.ts` resolves to it.
