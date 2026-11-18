#!/usr/bin/env node
/**
 * M0′ 打包脚本：把 DSH 插件构建成可分发 tarball。
 *
 * 为什么不用 npm publish / git 渠道：
 *   - git 渠道需要作者提供自包含 prepare 脚本，且用户必须在 pnpm-workspace.yaml 里
 *     授权 allowBuilds 才能执行安装期构建（Phase 0 实测会先失败一次）；
 *   - tarball 渠道零构建、零网络，是内网/离线场景唯一干净路径（规划 F06 运行时离线）。
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PKG_DIR = join(ROOT, 'packages/host-dsh')
const DIST_DIR = join(ROOT, 'dist')
const RELEASE_DIR = join(ROOT, 'release')

function run(cmd, args, cwd) {
  process.stdout.write(`\n$ ${cmd} ${args.join(' ')}  (cwd: ${cwd})\n`)
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: process.env })
  if (result.status !== 0) {
    process.stderr.write(`\n✖ 失败：${cmd} ${args.join(' ')}\n`)
    process.exit(result.status ?? 1)
  }
}

if (!existsSync(PKG_DIR)) {
  process.stderr.write('✖ 找不到 packages/host-dsh\n')
  process.exit(1)
}

// 1) 构建（产物契约：lib/client.js 必须走 __ModuleLoader__ 接缝，lib/index.js 是宿主半侧）
run('npm', ['run', 'build'], PKG_DIR)

// 2) 自检：构建产物存在 + 离线校验 bundle 接缝
run('npm', ['run', 'verify'], PKG_DIR)

// 3) 打包
mkdirSync(DIST_DIR, { recursive: true })
for (const file of readdirSync(DIST_DIR)) {
  if (file.endsWith('.tgz')) rmSync(join(DIST_DIR, file))
}
run('npm', ['pack', '--pack-destination', DIST_DIR], PKG_DIR)

const tarball = readdirSync(DIST_DIR).find((file) => file.endsWith('.tgz'))

// 4) 同步一份到 release/：这是给使用者直接在 GUI「添加插件」里粘贴路径用的安装包
mkdirSync(RELEASE_DIR, { recursive: true })
for (const file of readdirSync(RELEASE_DIR)) {
  if (file.endsWith('.tgz')) rmSync(join(RELEASE_DIR, file))
}
const releasePath = join(RELEASE_DIR, tarball)
copyFileSync(join(DIST_DIR, tarball), releasePath)

process.stdout.write(
  `\n✔ 打包完成：release/${tarball}\n` +
    `\n在 DeepSeek Harness 里安装（不用命令行）：\n` +
    `  1) 左侧栏「插件」→「添加插件」右边小箭头 →「安装第三方插件」\n` +
    `  2) 粘贴这个完整路径：\n     ${releasePath}\n` +
    `  3) 点「安装」→「立即启用」→ 重启一次 GUI\n` +
    `\n命令行方式（脚本化/批量部署）：node scripts/install.mjs --profile web\n`,
)
