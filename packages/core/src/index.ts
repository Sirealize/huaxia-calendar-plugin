/**
 * @shishu/core 公共 API。
 *
 * 纯函数、零运行时依赖、零联网；浏览器与 Node 双端可用（宿主侧用 esbuild/vite 等打包 TS）。
 */
export * from './types.ts';

export {
  solarToLunar,
  getGanZhi,
} from './calendar.ts';

export {
  getSolarTerms,
  getSolarTermOn,
  getNextSolarTerm,
  getPreviousSolarTerm,
  SOLAR_TERM_META,
  SOLAR_TERM_NAMES,
  type SolarTermMeta,
} from './solar-terms.ts';

export {
  getFestivals,
  BUILTIN_FESTIVALS,
  SOLAR_FESTIVALS,
  LUNAR_FESTIVALS,
  SOLAR_TERM_FESTIVALS,
  CHU_XI_DEF,
  type FestivalDef,
  type SolarFestivalDef,
  type LunarFestivalDef,
  type SolarTermFestivalDef,
  type FestivalDefBase,
} from './festivals.ts';

export {
  BEIJING_UTC_OFFSET_MINUTES,
  VERIFIED_YEAR_RANGE,
  beijingFieldsToEpochMs,
  epochMsToBeijingFields,
  beijingFieldsToIso,
  type VendorLunar,
  type VendorSolar,
} from './engine.ts';

export * from './data/schemas.ts';
export * from './data/hexagram-names.ts';
export * from './data/validate.ts';
