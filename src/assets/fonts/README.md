# Bundled typefaces

The eight faces the SDK draws with, and nothing else: Bricolage Grotesque
400/500/600/700 for headings and the Toden mark, and Geist 400/500/600/700 for
body and interface text. Both are static files under the SIL Open Font
License 1.1; each licence sits beside its fonts (`OFL-BricolageGrotesque.txt`,
`OFL-Geist.txt`). Bricolage is the project's own release
(github.com/ateliertriay/bricolage); Geist is the Google Fonts static build.

They are vendored rather than imported from the `@expo-google-fonts` packages
because Metro bundles every `require` in a package index whether or not the
export is used, so such a package puts every weight it ships into every
integrator's app for the few faces the SDK uses. Add a weight here
only when `config/font-resolve.ts` resolves to it.
