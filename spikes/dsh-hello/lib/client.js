window.__ModuleLoader__.load({
	id: "dsh-hello-huaxia",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		// src/client/index.tsx
		/** Panel id used by BOTH the sidebar row and the keyed `main` cell. */
		const PANEL_ID = "huaxia-calendar";
		/** Today's Gregorian date, formatted for a Chinese-language surface. */
		function todayLabel() {
			const now = /* @__PURE__ */ new Date();
			return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
		}
		/** 农历/节气 data is a later milestone; Phase 0 only proves the seat renders. */
		function lunarPlaceholder() {
			return "农历数据待接入（lunar-javascript 本地实算）";
		}
		/** Sidebar icon seat: receives `{ size, active }` from the sidebar shell. */
		function CalendarIcon(props) {
			const size = props.size ?? 16;
			return (0, react.createElement)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.4,
				"aria-hidden": true
			}, (0, react.createElement)("rect", {
				x: 1.5,
				y: 2.5,
				width: 13,
				height: 12,
				rx: 2
			}), (0, react.createElement)("path", { d: "M1.5 6h13M5 1.5v2M11 1.5v2" }), (0, react.createElement)("path", {
				d: "M5 9.5h2v2H5z",
				fill: "currentColor",
				stroke: "none"
			}));
		}
		/** `main` keyed panel body: gets no Session binding, only global standard props. */
		function CalendarPanel() {
			return (0, react.createElement)("div", {
				"data-huaxia-calendar-panel": "",
				style: {
					padding: "24px",
					fontFamily: "system-ui"
				}
			}, (0, react.createElement)("h1", { style: {
				margin: "0 0 8px",
				fontSize: "20px"
			} }, todayLabel()), (0, react.createElement)("p", { style: {
				margin: "0 0 4px",
				color: "#666"
			} }, lunarPlaceholder()), (0, react.createElement)("p", { style: {
				margin: 0,
				color: "#666"
			} }, "每日卦象 / 历史叙事 / 任务清单 / Token — M0–M1 接入"));
		}
		/** `shell.overlay` entry: the frame-wide layer is click-through; opt back in. */
		function TodayPill() {
			return (0, react.createElement)("div", {
				"data-huaxia-today-pill": "",
				style: {
					position: "fixed",
					right: "16px",
					bottom: "16px",
					padding: "8px 12px",
					borderRadius: "12px",
					background: "rgba(20,20,20,0.82)",
					color: "#fff",
					font: "12px system-ui",
					pointerEvents: "auto",
					boxShadow: "0 4px 16px rgba(0,0,0,0.24)"
				}
			}, todayLabel());
		}
		const name = "dsh-hello-huaxia";
		/** Services that must be ready before `apply` runs (the slot registry). */
		const inject = ["slots"];
		/**
		* Register the calendar's seats.
		*
		* `ctx.slots.inject(slot, () => ctx.slots.register(...))` is declaration-aware:
		* it runs now when the slot is already declared, otherwise inside the declaring
		* plugin's `register()` call. `ctx.effect` ties the registration to this
		* plugin's fiber, so disabling/unloading the plugin disposes it (and collapses
		* any child slots it declared) with no manual teardown.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
				name: "sidebar.panellist",
				id: PANEL_ID,
				order: 100,
				label: "华夏日历"
			}, CalendarIcon)), "huaxia-calendar: sidebar row");
			ctx.effect(() => ctx.slots.inject("main", () => ctx.slots.register({
				name: "main",
				key: PANEL_ID
			}, CalendarPanel)), "huaxia-calendar: main panel");
			ctx.effect(() => ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: `${PANEL_ID}.today`
			}, TodayPill)), "huaxia-calendar: today pill");
		}
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
