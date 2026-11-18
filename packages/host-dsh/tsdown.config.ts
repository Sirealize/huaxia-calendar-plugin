/**
 * 构建出 DSH 客户端 bundle 的产物契约。
 *
 * DSH 仓库自己的预设（`packages/client/tsdown.client.ts`）会把每个客户端 bundle
 * 包进 `window.__ModuleLoader__.load({ id, factory })`，并把平台模块留在外面，
 * 由宿主的冻结模块表供给。那个预设**没有发布到 npm**，所以这里用 banner/footer
 * 手写同构的包装 —— 契约是包装本身，不是工具。
 *
 * 两半：
 * - `lib/index.js`  ：宿主半侧（Node ESM Cordis 插件），供 Node loader 加载；
 * - `lib/client.js` ：浏览器半侧（模块加载器 bundle），由 web shell 从 /plugins 提供。
 */
import { defineConfig } from 'tsdown'

/** bundle id 必须与包名一致（spike 已验证）。 */
const ID = 'huaxia-calendar-dsh'

const BANNER =
  `window.__ModuleLoader__.load({id:${JSON.stringify(ID)},factory:(require)=>{` +
  `var module={exports:{}};var exports=module.exports;`

const FOOTER = `;return module.exports;}})`

/** 宿主 shell 共享进模块表的平台模块（PLATFORM_MODULES）。 */
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
  /** 宿主半侧：普通 ESM Cordis 插件。 */
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
  /**
   * 浏览器半侧：模块加载器 bundle。
   *
   * 平台模块必须 external（React 由宿主给，插件不能打包自己的 React）；
   * `@shishu/*` 是日历算法与内容包，必须**打进来**，因为宿主模块表里没有它们，
   * 而运行时又要求全离线。
   */
  {
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    clean: false,
    dts: false,
    jsx: 'automatic',
    deps: {
      neverBundle: PLATFORM_MODULES,
      alwaysBundle: [/^@shishu\//],
    },
    outputOptions: { banner: BANNER, footer: FOOTER, exports: 'named', entryFileNames: 'client.js' },
  },
])
