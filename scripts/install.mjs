#!/usr/bin/env node
/**
 * M0′ 安装脚本：把已打包的 tarball 装进指定的 DSH profile。
 *
 * 用法：
 *   node scripts/install.mjs                        # 装进 web profile（默认）
 *   node scripts/install.mjs --profile my-profile   # 装进自定义 profile
 *   node scripts/install.mjs --dry-run              # 只打印将执行的命令
 *   DSH_HOME=/tmp/isolated node scripts/install.mjs web true   # 隔离环境自测
 *
 * 安全设计：
 *   - 默认只做「读取 profile 名 + 打印命令 + 执行一次 dsh plugin add」；
 *   - 不碰 `~/.dsh` 里除目标 profile 外的任何内容；
 *   - 可用 --dsh 指定 CLI 路径，便于测试或非标准安装。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST_DIR = join(ROOT, 'dist')

function parseArgs(argv) {
  const out = { profile: 'web', dryRun: false, dsh: '' }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--profile') out.profile = argv[++i]
    else if (arg === '--dry-run') out.dryRun = true
    else if (arg === '--dsh') out.dsh = argv[++i]
    else if (!arg.startsWith('--') && !out.profileExplicit) {
      out.profile = arg
      out.profileExplicit = true
    }
  }
  return out
}

const { profile, dryRun, dsh } = parseArgs(process.argv.slice(2))

function findDsh() {
  if (dsh) return dsh
  if (process.env.DSH_BIN) return process.env.DSH_BIN
  const candidates = [
    '/Users/wanghongmei/dsh-022/node_modules/.bin/dsh',
    join(process.env.HOME ?? '', '.local/bin/dsh'),
  ]
  for (const candidate of candidates) if (candidate && existsSync(candidate)) return candidate
  const which = spawnSync('which', ['dsh'], { encoding: 'utf8' })
  if (which.status === 0 && which.stdout.trim()) return which.stdout.trim()
  return ''
}

function run(cmd, args) {
  const line = `${cmd} ${args.join(' ')}`
  if (dryRun) {
    process.stdout.write(`[dry-run] ${line}\n`)
    return
  }
  process.stdout.write(`\n$ ${line}\n`)
  const result = spawnSync(cmd, args, { stdio: 'inherit', env: process.env })
  if (result.status !== 0) {
    process.stderr.write(`\n✖ 安装失败。常见原因：\n`)
    process.stderr.write(`  · profile 名不对（现有 profile: ${join(process.env.DSH_HOME ?? '~/.dsh', 'profiles')}）\n`)
    process.stderr.write(`  · tarball 还没打包（先跑 npm run package）\n`)
    process.exit(result.status ?? 1)
  }
}

if (!existsSync(DIST_DIR)) {
  process.stderr.write('✖ 没有 dist/ 目录，请先执行：npm run package\n')
  process.exit(1)
}
const tarball = readdirSync(DIST_DIR).find((file) => file.endsWith('.tgz'))
if (!tarball) {
  process.stderr.write('✖ dist/ 下没有 .tgz，请先执行：npm run package\n')
  process.exit(1)
}
const resolvedDsh = findDsh()
if (!resolvedDsh) {
  process.stderr.write('✖ 找不到 dsh CLI。请用 --dsh <path> 指定，或设置 DSH_BIN 环境变量。\n')
  process.exit(1)
}

const tarballPath = join(DIST_DIR, tarball)
process.stdout.write(
  `目标 profile : ${profile}\n` +
    `DSH_HOME     : ${process.env.DSH_HOME ?? '(默认 ~/.dsh)'}\n` +
    `dsh CLI      : ${resolvedDsh}\n` +
    `插件包        : dist/${tarball}\n`,
)

run(resolvedDsh, ['plugin', '--profile', profile, 'add', tarballPath])

process.stdout.write(
  `\n✔ 安装完成。接下来：\n` +
    `  1) 重启 dsh GUI（或刷新浏览器页面），左栏应出现「华夏日历」入口；\n` +
    `  2) 点进去应看到月历 + 今日一屏；\n` +
    `  3) 卸载：dsh plugin --profile ${profile} remove huaxia-calendar-dsh\n`,
)
