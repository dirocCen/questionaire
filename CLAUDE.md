# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概况

基于 jsPsych 7.3 的心理学实验网站，嵌入 Credamo 问卷平台使用。实验模拟用户与 AI 的互动场景，采用 2×2 被试间设计（自主性 × 体验感），分 A/B/C/D 四种条件。

输出为单文件 `index.html`，无构建工具、无后端框架。

## 技术栈

- **jsPsych 7.3**：从 jsDelivr CDN 加载
- **纯 HTML + CSS + JavaScript**：单文件架构
- **字体**：Google Fonts — `Noto Sans SC`（中文）+ `IBM Plex Mono`（系统感文本）
- **配色**：深色专业风格，CSS 变量定义在 `:root`
- **数据上传**：fetch POST 至外部 endpoint + localStorage 备份

## 实验流程架构

```
Phase 1（互动任务）→ Phase 2（失败后果）→ Phase 3a（质询输入）→ Phase 3b（加载动画，2.5s 自动推进）→ Phase 3c（AI 回复，条件分支 A/B/C/D）→ 数据上传 → 跳回 Credamo
```

- URL 参数 `?id=` 捕获 ResponseID，缺失时生成 `DEBUG_` 前缀 ID
- 条件随机分配：A（低自主×低体验）、B（高自主×低体验）、C（低自主×高体验）、D（高自主×高体验）

## 关键约束

- **所有对话文字、通知文字、AI 回复文字必须与 `jspsych_experiment_prompt_v2.md` 完全一致**，不得修改任何措辞
- 加粗词汇（`font-weight: 700`）严格按文档标注执行
- 打字机效果需处理 `<strong>` 标签不被拆断（按节点而非字符推进）
- Phase 3c 的"继续"按钮必须在打字机完成后才淡入显示
- 最小输入长度 5 字符，不足时发送按钮禁用

## 数据字段

每行数据携带 `response_id`、`condition`、`timestamp`。各阶段额外记录：
- Phase 3a: `user_question`, `used_example`, `input_length`, `input_time_ms`
- Phase 3c: `ai_response_condition`, `reading_time_ms`

## 开发与测试

无构建步骤，需通过 HTTP 服务器访问（`file://` 协议下部分功能受限）。启动方式：
```bash
python3 -m http.server 8765
# 访问 http://localhost:8765/index.html?id=TEST123
```
- 带参数访问：`index.html?id=TEST123`
- 无参数访问验证 DEBUG 模式
- 各阶段有自检 console.log（`[PHASE1 CHECK]` 等）
- 移动端需验证 375px 宽度布局

## 构建过程中遇到的错误与修复

### 1. jsPsych 7.3 CDN 路径 404
- **错误**：`jspsych@7.3/dist/jspsych.js` 返回 404
- **原因**：jsPsych 7.3 的浏览器入口文件不是 `dist/jspsych.js`，而是 `dist/index.browser.min.js`（由 package.json 的 `unpkg` 字段指定）
- **修复**：使用以下正确路径：
  - 核心：`jspsych@7.3.4/dist/index.browser.min.js`
  - 插件：`@jspsych/plugin-html-keyboard-response@1.1.3/dist/index.browser.min.js`
  - CSS：`jspsych@7.3.4/css/jspsych.css`

### 2. jsPsych 默认 CSS 导致文本居中对齐
- **错误**：所有阶段的正文内容被居中显示，实验文案应为左对齐
- **原因**：jsPsych 7 的默认 CSS 对 `.jspsych-content` 设置了 `text-align: center`
- **修复**：在自定义 CSS 中覆盖 `.jspsych-content { text-align: left; }`

### 3. 使用 jsPsychHtmlButtonResponse 的局限
- **问题**：prompt 文档建议 Phase 1/2 使用 `jsPsychHtmlButtonResponse`，但该插件将按钮渲染在 stimulus 外部，无法嵌入自定义聊天界面布局中
- **决策**：全部阶段统一使用 `jsPsychHtmlKeyboardResponse` + `choices: 'NO_KEYS'`，通过自定义按钮调用 `jsPsych.finishTrial()` 推进，获得完全的布局控制权
