/**
 * Offline contract check for the built client bundle.
 *
 * The DSH shell loads lib/client.js through `window.__ModuleLoader__`, which
 * calls the registered factory with a `require` bound to the shell's frozen
 * module table. This harness reproduces exactly that seam — no browser, no DSH
 * checkout — and asserts what the bundle registers:
 *
 *   node verify.mjs
 *
 * It is the executable form of the claim "we understand the slot contract".
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const bundle = readFileSync(new URL('./lib/client.js', import.meta.url), 'utf8')

/** Captured loader registration. */
let registered
/** A stand-in for the shell's frozen module table (react only for this spike). */
const reactStub = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  Fragment: Symbol('Fragment'),
}
const requireStub = (id) => {
  if (id === 'react') return reactStub
  throw new Error(`bundle required a module outside the platform table: ${id}`)
}

globalThis.window = {
  __ModuleLoader__: {
    load: (record) => {
      registered = record
    },
  },
}

// Execute the bundle: registering the factory is the only side effect.
// eslint-disable-next-line no-new-func
new Function(bundle)()

if (registered === undefined) throw new Error('bundle did not call window.__ModuleLoader__.load')
if (registered.id !== 'dsh-hello-huaxia') throw new Error(`unexpected bundle id: ${registered.id}`)

const exports = registered.factory(requireStub)
if (typeof exports.apply !== 'function') throw new Error('bundle exports no apply()')
if (exports.name !== 'dsh-hello-huaxia') throw new Error(`unexpected plugin name: ${exports.name}`)
if (!Array.isArray(exports.inject) || !exports.inject.includes('slots')) {
  throw new Error(`plugin must inject the slot service, got ${JSON.stringify(exports.inject)}`)
}

/** Collected slot registrations, in call order. */
const registrations = []
/** Slots whose declaration the plugin waited for. */
const injected = []
const ctx = {
  effect: (factory, _label) => {
    const disposer = factory()
    if (typeof disposer !== 'function') throw new Error('ctx.effect factory must return a disposer')
    return disposer
  },
  slots: {
    inject: (key, callback) => {
      injected.push(key)
      return callback()
    },
    register: (options, component) => {
      registrations.push({ options, component })
      return () => {}
    },
  },
}

exports.apply(ctx)

const expected = [
  { name: 'sidebar.panellist', id: 'huaxia-calendar', order: 100 },
  { name: 'main', key: 'huaxia-calendar' },
  { name: 'shell.overlay', id: 'huaxia-calendar.today' },
]
if (registrations.length !== expected.length) {
  throw new Error(`expected ${expected.length} registrations, got ${registrations.length}`)
}
for (const [i, want] of expected.entries()) {
  const got = registrations[i].options
  for (const [k, v] of Object.entries(want)) {
    if (got[k] !== v) throw new Error(`registration #${i + 1}: ${k} = ${JSON.stringify(got[k])}, want ${JSON.stringify(v)}`)
  }
  if (typeof registrations[i].component !== 'function') throw new Error(`registration #${i + 1} has no component`)
}

// The components must render without touching host globals.
for (const { options, component } of registrations) {
  const tree = options.name === 'sidebar.panellist'
    ? component({ size: 16, active: false })
    : component({})
  if (tree === undefined || tree === null) throw new Error(`${options.name} rendered nothing`)
}

console.log('bundle id          :', registered.id)
console.log('plugin name        :', exports.name)
console.log('module inject      :', exports.inject.join(', '))
console.log('slot declarations  :', injected.join(', '))
for (const { options } of registrations) {
  const key = options.key ?? options.id
  console.log(`registered         : ${options.name.padEnd(20)} ${String(key).padEnd(22)} ${options.label ?? ''}`)
}
console.log('\nOK: bundle loads through the module-loader seam and claims 3 seats.')
