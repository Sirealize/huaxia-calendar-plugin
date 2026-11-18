/**
 * 宿主半侧（Node Cordis 插件）。
 *
 * 日历是纯浏览器端能力（农历/节气本地实算，不需要 Node 服务），所以这一半是
 * 一个刻意空实现的 Cordis 插件：它存在的意义是让 `dsh.bundle.patch` 有一行可
 * 插入，从而让整个 bundle 能通过 profile 安装（spike 已验证的 bundle 约定）。
 */
export const name = 'huaxia-calendar-dsh'

export function apply(): void {
  // M0′ 没有宿主侧要注册的东西；将来的 Token 按天聚合会落在这里。
}
