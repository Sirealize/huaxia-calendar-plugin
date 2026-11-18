/**
 * Phase 0 spike build: emit the DSH client-bundle format by hand.
 *
 * The DSH repo's own preset (packages/client/tsdown.client.ts) wraps every
 * client bundle in `window.__ModuleLoader__.load({ id, factory })` and leaves
 * the platform modules external so the loader's frozen module table supplies
 * them. That preset is NOT published to npm, so this config reproduces the
 * wrapper with a banner/footer pair — the contract is the wrapper, not the tool.
 */
import { defineConfig } from 'tsdown'

const ID = 'dsh-hello-huaxia'

const BANNER =
  `window.__ModuleLoader__.load({id:${JSON.stringify(ID)},factory:(require)=>{` +
  `var module={exports:{}};var exports=module.exports;`

const FOOTER = `;return module.exports;}})`

/** Modules the DSH shell shares into its frozen module table (PLATFORM_MODULES). */
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
]

export default defineConfig([
  /** Host half: a plain ESM Cordis plugin, loaded by the Node loader. */
  {
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: 'esm',
    platform: 'node',
    target: 'node24',
    clean: false,
    dts: true,
    outputOptions: { entryFileNames: '[name].js' },
  },
  /** Browser half: the module-loader bundle the web shell serves at /plugins. */
  {
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    clean: false,
    dts: false,
    jsx: 'automatic',
    external: PLATFORM_MODULES,
    outputOptions: { banner: BANNER, footer: FOOTER, exports: 'named', entryFileNames: 'client.js' },
  },
])
