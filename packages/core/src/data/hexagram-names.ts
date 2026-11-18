/**
 * 六十四卦骨架数据：卦序 + 卦名 + Unicode 卦象符号。
 *
 * 这是**公有领域事实数据**（周易通行本卦序，Unicode U+4DC0..U+4DFF 即按此序编码），
 * 不含卦辞/爻辞/白话解读——那些属于内容层，必须由数据包提供（见 schemas.ts）。
 *
 * 用途：内容生产时做完整性校验（64 卦缺一不可），以及体积预算的骨架部分。
 */

export interface HexagramSkeleton {
  id: number;
  name: string;
  /** Unicode 卦象符号。 */
  symbol: string;
}

/** 周易通行本六十四卦卦名（按卦序）。 */
export const HEXAGRAM_NAMES: readonly string[] = Object.freeze([
  '乾', '坤', '屯', '蒙', '需', '讼', '师', '比',
  '小畜', '履', '泰', '否', '同人', '大有', '谦', '豫',
  '随', '蛊', '临', '观', '噬嗑', '贲', '剥', '复',
  '无妄', '大畜', '颐', '大过', '坎', '离', '咸', '恒',
  '遁', '大壮', '晋', '明夷', '家人', '睽', '蹇', '解',
  '损', '益', '夬', '姤', '萃', '升', '困', '井',
  '革', '鼎', '震', '艮', '渐', '归妹', '丰', '旅',
  '巽', '兑', '涣', '节', '中孚', '小过', '既济', '未济',
] as const);

/** 六十四卦骨架（id 1-64，symbol 由 Unicode 码位 U+4DC0 + (id-1) 生成）。 */
export const HEXAGRAM_SKELETONS: readonly HexagramSkeleton[] = Object.freeze(
  HEXAGRAM_NAMES.map((name, i) => ({
    id: i + 1,
    name,
    symbol: String.fromCodePoint(0x4dc0 + i),
  })),
);
