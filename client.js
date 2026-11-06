window.__ModuleLoader__.load({
  id: '@local/chat-translator',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useLayoutEffect, useRef, useCallback } = React

    const API = '/chat-translator'
    const STORE_KEY = 'dsh.chat-translator.v2'
    const LEGACY_KEY = 'dsh.chat-translator.v1'
    const MIN_W = 280
    const MIN_H = 320
    const DEFAULT_W = 344
    const DEFAULT_H = 480
    const MAX_KEPT = 60

    const LANGS = [
      { code: 'zh', tag: '中', zh: '中文', en: 'Chinese', prompt: 'Simplified Chinese' },
      { code: 'en', tag: 'EN', zh: '英语', en: 'English', prompt: 'English' },
      { code: 'ja', tag: '日', zh: '日语', en: 'Japanese', prompt: 'Japanese' },
      { code: 'ko', tag: '한', zh: '韩语', en: 'Korean', prompt: 'Korean' },
      { code: 'es', tag: 'ES', zh: '西班牙语', en: 'Spanish', prompt: 'Spanish' },
      { code: 'fr', tag: 'FR', zh: '法语', en: 'French', prompt: 'French' },
      { code: 'de', tag: 'DE', zh: '德语', en: 'German', prompt: 'German' },
      { code: 'pt', tag: 'PT', zh: '葡萄牙语', en: 'Portuguese', prompt: 'Portuguese' },
      { code: 'ru', tag: 'RU', zh: '俄语', en: 'Russian', prompt: 'Russian' },
      { code: 'ar', tag: 'AR', zh: '阿拉伯语', en: 'Arabic', prompt: 'Arabic' },
      { code: 'th', tag: 'TH', zh: '泰语', en: 'Thai', prompt: 'Thai' },
      { code: 'vi', tag: 'VI', zh: '越南语', en: 'Vietnamese', prompt: 'Vietnamese' },
      { code: 'id', tag: 'ID', zh: '印尼语', en: 'Indonesian', prompt: 'Indonesian' },
      { code: 'tr', tag: 'TR', zh: '土耳其语', en: 'Turkish', prompt: 'Turkish' },
      { code: 'it', tag: 'IT', zh: '意大利语', en: 'Italian', prompt: 'Italian' },
    ]

    const LANG_BY_CODE = {}
    for (const language of LANGS) LANG_BY_CODE[language.code] = language

    const EXAMPLES = {
      zh: ['你好', '有现货吗？', '能给个优惠价吗？'],
      en: ['Hello', 'Do you have this in stock?', 'Can you give me a better price?'],
    }

    const CSS = `
.ct-panel {
  position: fixed;
  display: flex;
  flex-direction: column;
  min-width: 280px;
  min-height: 320px;
  max-width: calc(100vw - 8px);
  max-height: calc(100vh - 8px);
  background: #ffffff;
  color: #10243b;
  border: 1px solid #cfe0f5;
  border-radius: 14px;
  box-shadow: 0 20px 50px rgba(11, 79, 156, 0.22), 0 2px 8px rgba(11, 79, 156, 0.12);
  overflow: hidden;
  z-index: 40;
  pointer-events: auto;
  font: inherit;
  font-size: 13px;
  box-sizing: border-box;
}
.ct-panel *, .ct-panel *::before, .ct-panel *::after,
.ct-page *, .ct-page *::before, .ct-page *::after { box-sizing: border-box; }
.ct-head {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  flex: 0 0 auto;
  padding: 0 6px 0 10px;
  background: linear-gradient(135deg, #0b5cad 0%, #1268c3 55%, #2f86e0 100%);
  color: #ffffff;
  cursor: grab;
  user-select: none;
  touch-action: none;
}
.ct-head:active { cursor: grabbing; }
.ct-mark {
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.2);
}
.ct-titles { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; line-height: 1.2; }
.ct-title { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ct-sub {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.78);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.02em;
}
.ct-tools { display: flex; align-items: center; gap: 1px; flex: 0 0 auto; }
.ct-tool {
  width: 25px;
  height: 25px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.86);
  cursor: pointer;
}
.ct-tool:hover { background: rgba(255, 255, 255, 0.18); color: #ffffff; }
.ct-tool.is-on { color: #ffffff; background: rgba(255, 255, 255, 0.16); }
.ct-tool:disabled { opacity: 0.35; cursor: default; background: transparent; }
.ct-tool:focus-visible, .ct-send:focus-visible, .ct-fab:focus-visible, .ct-chip:focus-visible,
.ct-copy:focus-visible, .ct-link:focus-visible, .ct-danger:focus-visible,
.ct-swap:focus-visible, .ct-page-btn:focus-visible {
  outline: 2px solid #2f86e0;
  outline-offset: 1px;
}
.ct-langs {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 9px;
  background: #f5f9ff;
  border-bottom: 1px solid #d8e6f7;
}
.ct-select-wrap { position: relative; flex: 1 1 0; min-width: 0; }
.ct-select {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  height: 27px;
  padding: 0 20px 0 8px;
  border: 1px solid #cfdff2;
  border-radius: 7px;
  background: #ffffff;
  color: #10243b;
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
}
.ct-select:hover { border-color: #9dbde0; }
.ct-select:focus { outline: none; border-color: #1268c3; box-shadow: 0 0 0 2px rgba(18, 104, 195, 0.16); }
.ct-chev {
  position: absolute;
  right: 5px;
  top: 50%;
  transform: translateY(-50%);
  color: #5b7391;
  pointer-events: none;
  display: flex;
}
.ct-swap {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid #cfdff2;
  border-radius: 7px;
  background: #ffffff;
  color: #1268c3;
  cursor: pointer;
}
.ct-swap:hover { background: #e8f2fe; border-color: #9dbde0; }
.ct-banner {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 9px;
  background: #e8f2fe;
  border-bottom: 1px solid #d8e6f7;
  color: #0b5cad;
  font-size: 11.5px;
}
.ct-banner.is-undo { background: #eef7ee; border-bottom-color: #d6e8d6; color: #1f6b3a; }
.ct-banner-text { flex: 1 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ct-banner-actions { display: flex; align-items: center; gap: 4px; flex: 0 0 auto; }
.ct-link {
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 11.5px;
  font-weight: 600;
  padding: 2px 5px;
  border-radius: 5px;
  cursor: pointer;
}
.ct-link:hover { background: rgba(11, 92, 173, 0.12); }
.ct-link:disabled { opacity: 0.4; cursor: default; background: transparent; }
.ct-danger {
  border: 0;
  background: #c62828;
  color: #ffffff;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 5px;
  cursor: pointer;
}
.ct-danger:disabled { opacity: 0.4; cursor: default; }
.ct-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 8px 9px 10px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  background: #ffffff;
  scrollbar-width: thin;
}
.ct-list::-webkit-scrollbar { width: 8px; }
.ct-list::-webkit-scrollbar-thumb {
  background: #cfe0f5;
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.ct-empty { margin: auto; padding: 12px 8px; text-align: center; max-width: 280px; }
.ct-empty-title { margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #10243b; }
.ct-empty-sub { margin: 0 0 12px; font-size: 11.5px; line-height: 1.5; color: #5b7391; }
.ct-chips { display: flex; flex-wrap: wrap; gap: 5px; justify-content: center; }
.ct-chip {
  border: 1px solid #cfdff2;
  background: #f5f9ff;
  color: #0b5cad;
  border-radius: 999px;
  padding: 4px 9px;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.ct-chip:hover { border-color: #9dbde0; background: #e8f2fe; }
.ct-chip:disabled { opacity: 0.5; cursor: default; }
.ct-msg {
  display: flex;
  gap: 7px;
  border: 1px solid #dbe7f6;
  border-radius: 10px;
  background: #f8fbff;
  padding: 7px 9px 8px;
}
.ct-msg.is-selected { border-color: #1268c3; background: #eef6ff; box-shadow: 0 0 0 1px #1268c3 inset; }
.ct-msg.is-error { border-color: #e6a3a3; background: #fff7f7; }
.ct-check { flex: 0 0 auto; display: flex; align-items: flex-start; padding-top: 1px; cursor: pointer; }
.ct-check input { width: 14px; height: 14px; margin: 0; accent-color: #1268c3; cursor: pointer; }
.ct-msg-body { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.ct-row { display: flex; align-items: flex-start; gap: 6px; min-width: 0; }
.ct-tag {
  flex: 0 0 auto;
  margin-top: 1px;
  min-width: 18px;
  height: 15px;
  padding: 0 3px;
  border-radius: 4px;
  background: #e8f2fe;
  color: #0b5cad;
  font-size: 9px;
  font-weight: 700;
  line-height: 15px;
  text-align: center;
  letter-spacing: 0.02em;
}
.ct-src {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 11.5px;
  line-height: 1.5;
  color: #5b7391;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.ct-out {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 13px;
  line-height: 1.5;
  color: #10243b;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  user-select: text;
}
.ct-copy {
  flex: 0 0 auto;
  width: 22px;
  height: 20px;
  margin-top: -1px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #1268c3;
  cursor: pointer;
}
.ct-copy:hover { background: #e2eefc; }
.ct-copy.is-done { color: #1f9d55; }
.ct-working {
  flex: 1 1 auto;
  font-size: 12px;
  color: #1268c3;
  animation: ct-breathe 1.3s ease-in-out infinite;
}
.ct-error { flex: 1 1 auto; min-width: 0; font-size: 11.5px; line-height: 1.45; color: #c62828; overflow-wrap: anywhere; }
.ct-retry {
  flex: 0 0 auto;
  border: 1px solid #cfdff2;
  background: #ffffff;
  color: #1268c3;
  border-radius: 5px;
  padding: 1px 6px;
  font: inherit;
  font-size: 10.5px;
  cursor: pointer;
}
.ct-retry:hover { background: #e8f2fe; }
@keyframes ct-breathe { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }
.ct-compose {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-end;
  gap: 6px;
  padding: 8px 9px 9px;
  border-top: 1px solid #d8e6f7;
  background: #f5f9ff;
}
.ct-input {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 34px;
  max-height: 96px;
  padding: 7px 9px;
  resize: none;
  border: 1px solid #cfdff2;
  border-radius: 9px;
  background: #ffffff;
  color: #10243b;
  font: inherit;
  font-size: 12.5px;
  line-height: 1.45;
  outline: none;
}
.ct-input::placeholder { color: #7e94ad; }
.ct-input:focus { border-color: #1268c3; box-shadow: 0 0 0 2px rgba(18, 104, 195, 0.14); }
.ct-send {
  flex: 0 0 auto;
  height: 34px;
  min-width: 54px;
  padding: 0 10px;
  border: 0;
  border-radius: 9px;
  background: #1268c3;
  color: #ffffff;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.ct-send:hover:not(:disabled) { background: #0b5cad; }
.ct-send:disabled { opacity: 0.45; cursor: default; }
.ct-resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  color: #9db8d8;
  opacity: 0.75;
  cursor: nwse-resize;
  touch-action: none;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 0 2px 2px 0;
}
.ct-resize:hover { opacity: 1; color: #1268c3; }
.ct-fab {
  position: fixed;
  right: 12px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 2px solid #ffffff;
  border-radius: 50%;
  background: linear-gradient(140deg, #1268c3, #0b5cad);
  color: #ffffff;
  box-shadow: 0 10px 26px rgba(11, 79, 156, 0.34);
  cursor: pointer;
  z-index: 40;
  pointer-events: auto;
}
.ct-fab:hover { transform: translateY(-1px); }
.ct-fab-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #1268c3;
}
.ct-page {
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding: 20px 20px 16px;
  display: flex;
  background: var(--dsw-alias-bg-base);
  overflow: auto;
}
.ct-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 780px;
  margin: 0 auto;
  min-height: 440px;
  max-height: calc(100vh - 96px);
  background: #ffffff;
  color: #10243b;
  border: 1px solid #cfe0f5;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 18px 44px rgba(11, 79, 156, 0.14);
  font: inherit;
  font-size: 13px;
}
.ct-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 52px;
  flex: 0 0 auto;
  padding: 0 10px 0 16px;
  background: linear-gradient(135deg, #0b5cad 0%, #1268c3 55%, #2f86e0 100%);
  color: #ffffff;
}
.ct-card-title { font-size: 15px; font-weight: 600; }
.ct-card-sub { font-size: 11px; color: rgba(255, 255, 255, 0.78); }
.ct-page-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(255, 255, 255, 0.38);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
  white-space: nowrap;
}
.ct-page-btn:hover { background: rgba(255, 255, 255, 0.24); }
.ct-page .ct-tool { width: 27px; height: 27px; }
.ct-page .ct-langs { padding: 10px 14px; }
.ct-page .ct-select { height: 30px; font-size: 12.5px; }
.ct-page .ct-swap { width: 30px; height: 30px; }
.ct-page .ct-list { padding: 12px 14px 14px; gap: 9px; }
.ct-page .ct-msg { padding: 9px 11px 10px; }
.ct-page .ct-src { font-size: 12.5px; }
.ct-page .ct-out { font-size: 14px; }
.ct-page .ct-compose { padding: 10px 14px 12px; gap: 8px; }
.ct-page .ct-input { font-size: 13px; min-height: 38px; max-height: 140px; padding: 8px 11px; }
.ct-page .ct-send { height: 38px; min-width: 64px; font-size: 12.5px; }
.ct-page .ct-empty-title { font-size: 15px; }
.ct-page .ct-empty-sub { font-size: 12.5px; }
.ct-glyph { display: flex; align-items: center; justify-content: center; color: inherit; }
`

    const DICTS = {
      zh: {
        title: '外贸回复',
        subtitle: '多语种互译',
        pageSub: '外贸回复助手 · 多语种互译',
        floatWindow: '浮动小窗',
        minimize: '缩小成小圆标',
        close: '关闭窗口',
        clear: '清空全部记录',
        select: '勾选删除',
        selectAll: '全选',
        selectNone: '取消全选',
        delete: '删除',
        cancel: '取消',
        selected: '已选 {n} 条',
        removed: '已删除 {n} 条',
        undo: '撤销',
        autocopy: '自动复制译文',
        swap: '互换语言',
        source: '原文语言',
        target: '译文语言',
        placeholder: '输入内容，Enter 翻译…',
        send: '翻译',
        copy: '复制',
        copied: '已复制',
        retry: '重试',
        emptyTitle: '输入一句原文',
        emptySub: '自动变成简短的商务外语，复制即可发给客户。',
        working: '翻译中…',
        failed: '翻译失败',
        open: '打开外贸回复窗口',
      },
      en: {
        title: 'Trade reply',
        subtitle: 'Two-way translation',
        pageSub: 'Trade reply assistant · two-way translation',
        floatWindow: 'Floating window',
        minimize: 'Minimize to a floating dot',
        close: 'Close the window',
        clear: 'Clear all history',
        select: 'Select and delete',
        selectAll: 'Select all',
        selectNone: 'Deselect all',
        delete: 'Delete',
        cancel: 'Cancel',
        selected: '{n} selected',
        removed: '{n} deleted',
        undo: 'Undo',
        autocopy: 'Copy the translation automatically',
        swap: 'Swap languages',
        source: 'Source language',
        target: 'Target language',
        placeholder: 'Type here, Enter to translate…',
        send: 'Translate',
        copy: 'Copy',
        copied: 'Copied',
        retry: 'Retry',
        emptyTitle: 'Type one message',
        emptySub: 'Get a short business reply you can paste to your customer.',
        working: 'Translating…',
        failed: 'Translation failed',
        open: 'Open the trade reply window',
      },
    }

    function icon(name, size) {
      const common = {
        viewBox: '0 0 24 24',
        width: size || 16,
        height: size || 16,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
      }
      if (name === 'minimize') return h('svg', common, h('path', { d: 'M6 12h12' }))
      if (name === 'close') return h('svg', common, h('path', { d: 'M6.5 6.5l11 11M17.5 6.5l-11 11' }))
      if (name === 'trash') {
        return h('svg', common,
          h('path', { d: 'M4 7h16' }),
          h('path', { d: 'M9.5 7V4.8h5V7' }),
          h('path', { d: 'M6.4 7l.9 12.2h9.4L17.6 7' }))
      }
      if (name === 'select') {
        return h('svg', common,
          h('rect', { x: 4, y: 4, width: 16, height: 16, rx: 3.2 }),
          h('path', { d: 'M8 12.2l2.8 2.8L16.2 9.4' }))
      }
      if (name === 'clipboard') {
        return h('svg', common,
          h('rect', { x: 5, y: 4.5, width: 14, height: 16, rx: 2.4 }),
          h('path', { d: 'M9 4.5V3.4h6v1.1' }),
          h('path', { d: 'M9 11h6M9 15h4' }))
      }
      if (name === 'copy') {
        return h('svg', common,
          h('rect', { x: 9, y: 9, width: 11, height: 11, rx: 2 }),
          h('path', { d: 'M15 6.5A2.5 2.5 0 0 0 12.5 4H6.5A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15' }))
      }
      if (name === 'check') return h('svg', common, h('path', { d: 'M4.5 12.5l5 5 10-11' }))
      if (name === 'bubble') {
        return h('svg', common,
          h('path', { d: 'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z' }),
          h('path', { d: 'M8 9h6M8 12.5h4' }))
      }
      if (name === 'swap') {
        return h('svg', common,
          h('path', { d: 'M6 8h11M14 5l3 3-3 3' }),
          h('path', { d: 'M18 16H7M10 13l-3 3 3 3' }))
      }
      if (name === 'chevron') return h('svg', common, h('path', { d: 'M6 9.5l6 6 6-6' }))
      if (name === 'popout') {
        return h('svg', common,
          h('rect', { x: 3.5, y: 5, width: 12, height: 12, rx: 2.2 }),
          h('path', { d: 'M14 4h6v6M20 4l-7 7' }))
      }
      return null
    }

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max)
    }

    function fill(template, count) {
      return String(template).replace('{n}', String(count))
    }

    async function writeClipboard(text) {
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(text)
          return true
        }
      } catch {
        /* fall through to the legacy path */
      }
      try {
        const area = document.createElement('textarea')
        area.value = text
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.top = '-1000px'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        const done = document.execCommand('copy')
        document.body.removeChild(area)
        return done === true
      } catch {
        return false
      }
    }

    function installStyles() {
      const element = document.createElement('style')
      element.setAttribute('data-plugin', 'chat-translator')
      element.textContent = CSS
      document.head.appendChild(element)
      return () => {
        if (element.parentNode) element.parentNode.removeChild(element)
      }
    }

    function defaultState() {
      return {
        mode: 'open',
        x: null,
        y: null,
        w: DEFAULT_W,
        h: DEFAULT_H,
        fabX: null,
        fabY: null,
        sourceLang: 'zh',
        targetLang: 'en',
        autoCopy: true,
        messages: [],
      }
    }

    function normalizeMessage(raw) {
      if (!raw || typeof raw !== 'object') return null
      if (raw.status === 'pending') return null
      const sourceText = typeof raw.sourceText === 'string' ? raw.sourceText : (typeof raw.zh === 'string' ? raw.zh : '')
      const targetText = typeof raw.targetText === 'string' ? raw.targetText : (typeof raw.en === 'string' ? raw.en : '')
      if (sourceText.length === 0 && targetText.length === 0) return null
      return {
        id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : 'm' + Math.random().toString(36).slice(2, 10),
        sourceText,
        targetText,
        sourceLang: LANG_BY_CODE[raw.sourceLang] ? raw.sourceLang : 'zh',
        targetLang: LANG_BY_CODE[raw.targetLang] ? raw.targetLang : 'en',
        status: raw.status === 'error' ? 'error' : 'done',
        error: typeof raw.error === 'string' ? raw.error : '',
      }
    }

    function normalize(raw) {
      const state = defaultState()
      if (!raw || typeof raw !== 'object') return state
      if (raw.mode === 'open' || raw.mode === 'minimized' || raw.mode === 'closed') state.mode = raw.mode
      else if (raw.minimized === true) state.mode = 'minimized'
      for (const key of ['x', 'y', 'w', 'h', 'fabX', 'fabY']) {
        if (Number.isFinite(raw[key])) state[key] = raw[key]
      }
      if (LANG_BY_CODE[raw.sourceLang]) state.sourceLang = raw.sourceLang
      if (LANG_BY_CODE[raw.targetLang]) state.targetLang = raw.targetLang
      if (typeof raw.autoCopy === 'boolean') state.autoCopy = raw.autoCopy
      if (Array.isArray(raw.messages)) {
        state.messages = raw.messages.map(normalizeMessage).filter(Boolean).slice(-MAX_KEPT)
      }
      return state
    }

    function readSaved() {
      try {
        const raw = window.localStorage.getItem(STORE_KEY)
        if (raw) return normalize(JSON.parse(raw))
      } catch {
        /* storage unavailable */
      }
      try {
        const legacy = window.localStorage.getItem(LEGACY_KEY)
        if (legacy) return normalize(JSON.parse(legacy))
      } catch {
        /* storage unavailable */
      }
      return null
    }

    let state = readSaved() || defaultState()
    const listeners = new Set()
    let saveTimer = null

    function persist() {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        saveTimer = null
        try {
          window.localStorage.setItem(STORE_KEY, JSON.stringify({
            mode: state.mode,
            x: state.x,
            y: state.y,
            w: state.w,
            h: state.h,
            fabX: state.fabX,
            fabY: state.fabY,
            sourceLang: state.sourceLang,
            targetLang: state.targetLang,
            autoCopy: state.autoCopy,
            messages: state.messages.slice(-MAX_KEPT),
          }))
        } catch {
          /* storage may be full or disabled */
        }
      }, 200)
    }

    const store = {
      get() {
        return state
      },
      set(patch) {
        state = { ...state, ...patch }
        persist()
        for (const listener of listeners) listener()
      },
      subscribe(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    }

    function useStore() {
      const [snapshot, setSnapshot] = useState(state)
      useEffect(() => {
        setSnapshot(state)
        return store.subscribe(() => setSnapshot(state))
      }, [])
      return snapshot
    }

    function readActive(ctx) {
      try {
        return ctx.locale.getLocale().active
      } catch {
        return 'zh'
      }
    }

    function useI18n(ctx) {
      const [active, setActive] = useState(() => readActive(ctx))
      useEffect(() => ctx.locale.subscribe(() => setActive(readActive(ctx))), [ctx])
      const isZh = String(active || '').toLowerCase().startsWith('zh')
      const dict = isZh ? DICTS.zh : DICTS.en
      const t = useCallback((key) => {
        if (dict[key] !== undefined) return dict[key]
        return DICTS.zh[key] !== undefined ? DICTS.zh[key] : key
      }, [dict])
      return { t, isZh }
    }

    function useViewport() {
      const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
      useEffect(() => {
        const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
      }, [])
      return size
    }

    function geometryOf(snapshot, viewport) {
      const maxW = Math.max(MIN_W, viewport.w - 16)
      const maxH = Math.max(MIN_H, viewport.h - 16)
      const w = clamp(Number(snapshot.w) || DEFAULT_W, MIN_W, maxW)
      const h = clamp(Number(snapshot.h) || DEFAULT_H, MIN_H, maxH)
      const fallbackX = viewport.w - w - 24
      const fallbackY = viewport.h - h - 96
      const x = Number.isFinite(snapshot.x) ? snapshot.x : fallbackX
      const y = Number.isFinite(snapshot.y) ? snapshot.y : fallbackY
      return {
        w,
        h,
        x: clamp(x, 0, Math.max(0, viewport.w - w - 8)),
        y: clamp(y, 0, Math.max(0, viewport.h - h - 8)),
      }
    }

    function langLabel(code, isZh) {
      const language = LANG_BY_CODE[code]
      if (!language) return code
      return isZh ? language.zh : language.en
    }

    function langTag(code) {
      const language = LANG_BY_CODE[code]
      return language ? language.tag : '?'
    }

    /** Everything both surfaces share: history, selection, language pair, sending. */
    function useTranslator(t) {
      const state = useStore()
      const [draft, setDraft] = useState('')
      const [busy, setBusy] = useState(false)
      const [copiedId, setCopiedId] = useState(null)
      const [selecting, setSelecting] = useState(false)
      const [selected, setSelected] = useState([])
      const [undo, setUndo] = useState(null)
      const copyTimer = useRef(null)
      const undoTimer = useRef(null)

      useEffect(() => {
        return () => {
          if (copyTimer.current) clearTimeout(copyTimer.current)
          if (undoTimer.current) clearTimeout(undoTimer.current)
        }
      }, [])

      const markCopied = useCallback((id) => {
        setCopiedId(id)
        if (copyTimer.current) clearTimeout(copyTimer.current)
        copyTimer.current = setTimeout(() => setCopiedId(null), 1600)
      }, [])

      const pushUndo = useCallback((previous, count) => {
        setUndo({ previous, count })
        if (undoTimer.current) clearTimeout(undoTimer.current)
        undoTimer.current = setTimeout(() => setUndo(null), 6000)
      }, [])

      const send = useCallback(async (raw) => {
        const text = String(raw === undefined ? draft : raw).trim()
        if (!text || busy) return
        const current = store.get()
        const sourceInfo = LANG_BY_CODE[current.sourceLang]
        const targetInfo = LANG_BY_CODE[current.targetLang]
        const id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
        setDraft('')
        setBusy(true)
        if (selecting) setSelecting(false)
        setUndo(null)
        if (undoTimer.current) clearTimeout(undoTimer.current)
        store.set({
          messages: [...current.messages, {
            id,
            sourceText: text,
            targetText: '',
            sourceLang: current.sourceLang,
            targetLang: current.targetLang,
            status: 'pending',
            error: '',
          }].slice(-MAX_KEPT),
        })
        try {
          const response = await fetch(API + '/translate', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              text,
              sourceLanguage: sourceInfo ? sourceInfo.prompt : undefined,
              targetLanguage: targetInfo ? targetInfo.prompt : undefined,
            }),
          })
          const data = await response.json().catch(() => null)
          if (!response.ok || !data || data.ok !== true) {
            throw new Error((data && data.message) || 'HTTP ' + response.status)
          }
          const translation = String(data.translation || '').trim()
          if (!translation) throw new Error('Empty reply')
          store.set({
            messages: store.get().messages.map((message) => (
              message.id === id ? { ...message, targetText: translation, status: 'done' } : message
            )),
          })
          if (store.get().autoCopy) {
            const copied = await writeClipboard(translation)
            if (copied) markCopied(id)
          }
        } catch (error) {
          const message = error && error.message ? error.message : String(error)
          store.set({
            messages: store.get().messages.map((item) => (
              item.id === id ? { ...item, status: 'error', error: message } : item
            )),
          })
        } finally {
          setBusy(false)
        }
      }, [draft, busy, selecting, markCopied])

      const retry = useCallback((message) => {
        if (!message || busy) return
        store.set({ messages: store.get().messages.filter((item) => item.id !== message.id) })
        send(message.sourceText)
      }, [busy, send])

      const removeMessages = useCallback((ids) => {
        if (ids.length === 0) return
        const current = store.get()
        const kept = current.messages.filter((message) => !ids.includes(message.id))
        pushUndo(current.messages, current.messages.length - kept.length)
        store.set({ messages: kept })
        setSelected([])
        setSelecting(false)
      }, [pushUndo])

      const clearAll = useCallback(() => {
        const current = store.get()
        if (current.messages.length === 0) return
        pushUndo(current.messages, current.messages.length)
        store.set({ messages: [] })
        setSelected([])
        setSelecting(false)
      }, [pushUndo])

      const undoRemoval = useCallback(() => {
        if (!undo) return
        store.set({ messages: undo.previous })
        setUndo(null)
        if (undoTimer.current) clearTimeout(undoTimer.current)
      }, [undo])

      const toggleSelected = useCallback((id) => {
        setSelected((previous) => (previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]))
      }, [])

      const changeSource = useCallback((code) => {
        const current = store.get()
        if (code === current.targetLang) store.set({ sourceLang: code, targetLang: current.sourceLang })
        else store.set({ sourceLang: code })
      }, [])

      const changeTarget = useCallback((code) => {
        const current = store.get()
        if (code === current.sourceLang) store.set({ targetLang: code, sourceLang: current.targetLang })
        else store.set({ targetLang: code })
      }, [])

      const swapLanguages = useCallback(() => {
        const current = store.get()
        store.set({ sourceLang: current.targetLang, targetLang: current.sourceLang })
      }, [])

      const copyMessage = useCallback(async (message) => {
        if (!message || !message.targetText) return
        const copied = await writeClipboard(message.targetText)
        if (copied) markCopied(message.id)
      }, [markCopied])

      const toggleSelecting = useCallback(() => {
        setSelecting((value) => {
          if (value) setSelected([])
          return !value
        })
      }, [])

      const messages = state.messages

      return {
        state,
        messages,
        draft,
        setDraft,
        busy,
        copiedId,
        selecting,
        selected,
        setSelected,
        undo,
        send,
        retry,
        removeMessages,
        clearAll,
        undoRemoval,
        toggleSelected,
        changeSource,
        changeTarget,
        swapLanguages,
        copyMessage,
        toggleSelecting,
        pending: messages.some((message) => message.status === 'pending'),
        allSelected: messages.length > 0 && selected.length === messages.length,
      }
    }

    /** Language bar, selection banner, history and composer, shared by both surfaces. */
    function TranslatorCore(props) {
      const { t, isZh, tr } = props
      const listRef = useRef(null)
      const inputRef = useRef(null)
      const messages = tr.messages

      useEffect(() => {
        const el = listRef.current
        if (el) el.scrollTop = el.scrollHeight
      }, [messages])

      useEffect(() => {
        const el = inputRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = Math.min(el.scrollHeight || 34, 140) + 'px'
      }, [tr.draft])

      const onComposerKeyDown = useCallback((event) => {
        if (event.key !== 'Enter' || event.shiftKey) return
        if (event.nativeEvent && (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) return
        event.preventDefault()
        tr.send()
      }, [tr])

      const rows = messages.map((message) => {
        const copied = tr.copiedId === message.id
        const checked = tr.selected.includes(message.id)
        return h('div', {
          key: message.id,
          className: 'ct-msg'
            + (message.status === 'error' ? ' is-error' : '')
            + (checked ? ' is-selected' : ''),
        },
        tr.selecting ? h('label', { className: 'ct-check' },
          h('input', {
            type: 'checkbox',
            checked,
            onChange: () => tr.toggleSelected(message.id),
            'aria-label': t('select'),
          })) : null,
        h('div', { className: 'ct-msg-body' },
          h('div', { className: 'ct-row' },
            h('span', { className: 'ct-tag' }, langTag(message.sourceLang)),
            h('span', { className: 'ct-src' }, message.sourceText)),
          h('div', { className: 'ct-row' },
            h('span', { className: 'ct-tag' }, langTag(message.targetLang)),
            message.status === 'pending'
              ? h('span', { className: 'ct-working' }, t('working'))
              : message.status === 'error'
                ? h('span', { className: 'ct-error' }, t('failed') + '：' + (message.error || ''))
                : h('span', { className: 'ct-out' }, message.targetText),
            message.status === 'pending'
              ? null
              : message.status === 'error'
                ? h('button', {
                  type: 'button',
                  className: 'ct-retry',
                  onClick: () => tr.retry(message),
                  disabled: tr.busy,
                }, t('retry'))
                : h('button', {
                  type: 'button',
                  className: 'ct-copy' + (copied ? ' is-done' : ''),
                  title: copied ? t('copied') : t('copy'),
                  'aria-label': copied ? t('copied') : t('copy'),
                  onClick: () => tr.copyMessage(message),
                }, icon(copied ? 'check' : 'copy', 14)))))
      })

      const examples = EXAMPLES[tr.state.sourceLang] || []
      const empty = h('div', { className: 'ct-empty' },
        h('p', { className: 'ct-empty-title' }, t('emptyTitle')),
        h('p', { className: 'ct-empty-sub' }, t('emptySub')),
        examples.length > 0
          ? h('div', { className: 'ct-chips' }, examples.map((example) => h('button', {
            key: example,
            type: 'button',
            className: 'ct-chip',
            disabled: tr.busy,
            onClick: () => tr.send(example),
          }, example)))
          : null)

      const banner = tr.selecting
        ? h('div', { className: 'ct-banner' },
          h('span', { className: 'ct-banner-text' }, fill(t('selected'), tr.selected.length)),
          h('div', { className: 'ct-banner-actions' },
            h('button', {
              type: 'button',
              className: 'ct-link',
              onClick: () => tr.setSelected(tr.allSelected ? [] : messages.map((message) => message.id)),
            }, tr.allSelected ? t('selectNone') : t('selectAll')),
            h('button', {
              type: 'button',
              className: 'ct-danger',
              disabled: tr.selected.length === 0,
              onClick: () => tr.removeMessages(tr.selected),
            }, t('delete')),
            h('button', { type: 'button', className: 'ct-link', onClick: tr.toggleSelecting }, t('cancel'))))
        : tr.undo
          ? h('div', { className: 'ct-banner is-undo' },
            h('span', { className: 'ct-banner-text' }, fill(t('removed'), tr.undo.count)),
            h('div', { className: 'ct-banner-actions' },
              h('button', { type: 'button', className: 'ct-link', onClick: tr.undoRemoval }, t('undo'))))
          : null

      return h(React.Fragment, null,
        h('div', { className: 'ct-langs' },
          h('div', { className: 'ct-select-wrap' },
            h('select', {
              className: 'ct-select',
              value: tr.state.sourceLang,
              title: t('source'),
              'aria-label': t('source'),
              onChange: (event) => tr.changeSource(event.target.value),
            }, LANGS.map((language) => h('option', { key: language.code, value: language.code }, langLabel(language.code, isZh)))),
            h('span', { className: 'ct-chev' }, icon('chevron', 12))),
          h('button', {
            type: 'button',
            className: 'ct-swap',
            title: t('swap'),
            'aria-label': t('swap'),
            onClick: tr.swapLanguages,
          }, icon('swap', 14)),
          h('div', { className: 'ct-select-wrap' },
            h('select', {
              className: 'ct-select',
              value: tr.state.targetLang,
              title: t('target'),
              'aria-label': t('target'),
              onChange: (event) => tr.changeTarget(event.target.value),
            }, LANGS.map((language) => h('option', { key: language.code, value: language.code }, langLabel(language.code, isZh)))),
            h('span', { className: 'ct-chev' }, icon('chevron', 12)))),
        banner,
        h('div', { className: 'ct-list', ref: listRef }, messages.length === 0 ? empty : rows),
        h('div', { className: 'ct-compose' },
          h('textarea', {
            ref: inputRef,
            className: 'ct-input',
            value: tr.draft,
            rows: 1,
            placeholder: t('placeholder'),
            spellCheck: false,
            onChange: (event) => tr.setDraft(event.target.value),
            onKeyDown: onComposerKeyDown,
          }),
          h('button', {
            type: 'button',
            className: 'ct-send',
            disabled: tr.busy || tr.draft.trim().length === 0,
            onClick: () => tr.send(),
          }, tr.busy ? '…' : t('send'))))
    }

    function HistoryTools(props) {
      const { t, tr } = props
      return h(React.Fragment, null,
        h('button', {
          type: 'button',
          className: 'ct-tool' + (tr.state.autoCopy ? ' is-on' : ''),
          title: t('autocopy'),
          'aria-label': t('autocopy'),
          'aria-pressed': tr.state.autoCopy,
          onPointerDown: (event) => event.stopPropagation(),
          onClick: () => store.set({ autoCopy: !store.get().autoCopy }),
        }, icon('clipboard', 15)),
        tr.messages.length > 0
          ? h('button', {
            type: 'button',
            className: 'ct-tool' + (tr.selecting ? ' is-on' : ''),
            title: t('select'),
            'aria-label': t('select'),
            'aria-pressed': tr.selecting,
            onPointerDown: (event) => event.stopPropagation(),
            onClick: tr.toggleSelecting,
          }, icon('select', 15))
          : null,
        tr.messages.length > 0
          ? h('button', {
            type: 'button',
            className: 'ct-tool',
            title: t('clear'),
            'aria-label': t('clear'),
            onPointerDown: (event) => event.stopPropagation(),
            onClick: tr.clearAll,
          }, icon('trash', 15))
          : null)
    }

    function FloatSurface(props) {
      const { t, isZh } = props
      const tr = useTranslator(t)
      const viewport = useViewport()
      const geom = geometryOf(tr.state, viewport)
      const fabMoved = useRef(false)

      const beginFabDrag = useCallback((event, startX, startY) => {
        if (event.button !== 0) return
        const node = event.currentTarget
        const start = { px: event.clientX, py: event.clientY }
        let moved = false
        fabMoved.current = false
        const move = (moveEvent) => {
          const dx = moveEvent.clientX - start.px
          const dy = moveEvent.clientY - start.py
          if (!moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) moved = true
          if (!moved) return
          store.set({
            fabX: clamp(startX + dx, 0, Math.max(0, window.innerWidth - 48)),
            fabY: clamp(startY + dy, 0, Math.max(0, window.innerHeight - 48)),
          })
        }
        const stop = () => {
          node.removeEventListener('pointermove', move)
          node.removeEventListener('pointerup', stop)
          node.removeEventListener('pointercancel', stop)
          fabMoved.current = moved
        }
        try {
          node.setPointerCapture(event.pointerId)
        } catch {
          /* capture is best effort */
        }
        node.addEventListener('pointermove', move)
        node.addEventListener('pointerup', stop)
        node.addEventListener('pointercancel', stop)
      }, [])

      const onFabClick = useCallback(() => {
        if (fabMoved.current) {
          fabMoved.current = false
          return
        }
        store.set({ mode: 'open' })
      }, [])

      const beginDrag = useCallback((event) => {
        if (event.button !== 0) return
        event.preventDefault()
        const node = event.currentTarget
        const view = { w: window.innerWidth, h: window.innerHeight }
        const startGeom = geometryOf(store.get(), view)
        const start = { px: event.clientX, py: event.clientY, x: startGeom.x, y: startGeom.y, w: startGeom.w, h: startGeom.h }
        const move = (moveEvent) => {
          store.set({
            x: clamp(start.x + moveEvent.clientX - start.px, 0, Math.max(0, view.w - start.w - 8)),
            y: clamp(start.y + moveEvent.clientY - start.py, 0, Math.max(0, view.h - start.h - 8)),
          })
        }
        const stop = () => {
          node.removeEventListener('pointermove', move)
          node.removeEventListener('pointerup', stop)
          node.removeEventListener('pointercancel', stop)
          document.documentElement.style.userSelect = ''
        }
        try {
          node.setPointerCapture(event.pointerId)
        } catch {
          /* capture is best effort */
        }
        node.addEventListener('pointermove', move)
        node.addEventListener('pointerup', stop)
        node.addEventListener('pointercancel', stop)
        document.documentElement.style.userSelect = 'none'
      }, [])

      const beginResize = useCallback((event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        const node = event.currentTarget
        const view = { w: window.innerWidth, h: window.innerHeight }
        const startGeom = geometryOf(store.get(), view)
        const start = { px: event.clientX, py: event.clientY, w: startGeom.w, h: startGeom.h }
        const move = (moveEvent) => {
          const current = store.get()
          const w = clamp(start.w + moveEvent.clientX - start.px, MIN_W, Math.max(MIN_W, view.w - 8))
          const h = clamp(start.h + moveEvent.clientY - start.py, MIN_H, Math.max(MIN_H, view.h - 8))
          store.set({
            w,
            h,
            x: clamp(Number.isFinite(current.x) ? current.x : startGeom.x, 0, Math.max(0, view.w - w - 8)),
            y: clamp(Number.isFinite(current.y) ? current.y : startGeom.y, 0, Math.max(0, view.h - h - 8)),
          })
        }
        const stop = () => {
          node.removeEventListener('pointermove', move)
          node.removeEventListener('pointerup', stop)
          node.removeEventListener('pointercancel', stop)
          document.documentElement.style.userSelect = ''
        }
        try {
          node.setPointerCapture(event.pointerId)
        } catch {
          /* capture is best effort */
        }
        node.addEventListener('pointermove', move)
        node.addEventListener('pointerup', stop)
        node.addEventListener('pointercancel', stop)
        document.documentElement.style.userSelect = 'none'
      }, [])

      if (tr.state.mode === 'minimized') {
        const fabX = Number.isFinite(tr.state.fabX)
          ? clamp(tr.state.fabX, 0, Math.max(0, viewport.w - 48))
          : Math.max(8, viewport.w - 60)
        const fabY = Number.isFinite(tr.state.fabY)
          ? clamp(tr.state.fabY, 0, Math.max(0, viewport.h - 48))
          : clamp(geom.y + 24, 12, Math.max(12, viewport.h - 58))
        return h('button', {
          type: 'button',
          className: 'ct-fab',
          style: { left: fabX + 'px', top: fabY + 'px', right: 'auto' },
          title: t('open'),
          'aria-label': t('open'),
          onPointerDown: (event) => beginFabDrag(event, fabX, fabY),
          onClick: onFabClick,
        }, icon('bubble', 22), tr.pending ? h('span', { className: 'ct-fab-dot' }) : null)
      }

      if (tr.state.mode === 'closed') return null

      return h('div', {
        className: 'ct-panel',
        style: { left: geom.x + 'px', top: geom.y + 'px', width: geom.w + 'px', height: geom.h + 'px' },
        role: 'dialog',
        'aria-label': t('title'),
      },
      h('div', {
        className: 'ct-head',
        onPointerDown: beginDrag,
        onDoubleClick: () => store.set({ mode: 'minimized' }),
      },
      h('span', { className: 'ct-mark' }, icon('bubble', 15)),
      h('div', { className: 'ct-titles' },
        h('span', { className: 'ct-title' }, t('title')),
        h('span', { className: 'ct-sub' }, t('subtitle'))),
      h('div', { className: 'ct-tools' },
        h(HistoryTools, { t, tr }),
        h('button', {
          type: 'button',
          className: 'ct-tool',
          title: t('minimize'),
          'aria-label': t('minimize'),
          onPointerDown: (event) => event.stopPropagation(),
          onClick: () => store.set({ mode: 'minimized' }),
        }, icon('minimize', 16)),
        h('button', {
          type: 'button',
          className: 'ct-tool',
          title: t('close'),
          'aria-label': t('close'),
          onPointerDown: (event) => event.stopPropagation(),
          onClick: () => store.set({ mode: 'closed' }),
        }, icon('close', 15)))),
      h(TranslatorCore, { t, isZh, tr }),
      h('div', { className: 'ct-resize', onPointerDown: beginResize },
        h('svg', {
          viewBox: '0 0 12 12',
          width: 12,
          height: 12,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          'aria-hidden': 'true',
        }, h('path', { d: 'M11 5L5 11M11 9l-2 2' }))))
    }

    /**
     * The sidebar entry is a launcher, not a page: a plain click opens the
     * floating window and is stopped before the sidebar swaps its panel. This
     * view only catches the keyboard path, which cannot be intercepted.
     */
    function makeLauncher(ctx) {
      return function LauncherRoot() {
        useLayoutEffect(() => {
          store.set({ mode: 'open' })
          try {
            ctx.layout.selectPanel('conversation')
          } catch {
            /* the conversation panel may be unavailable in a bare shell */
          }
        }, [])
        return null
      }
    }

    function PanelGlyph(props) {
      const size = props && Number.isFinite(props.size) ? props.size : 18
      return h('span', {
        className: 'ct-glyph',
        onClick: (event) => {
          event.preventDefault()
          event.stopPropagation()
          store.set({ mode: 'open' })
        },
      }, icon('bubble', size))
    }

    function createSurface(ctx) {
      function OverlayRoot() {
        const { t, isZh } = useI18n(ctx)
        return h(FloatSurface, { t, isZh })
      }
      const LauncherRoot = makeLauncher(ctx)
      return { OverlayRoot, LauncherRoot }
    }

    return {
      inject: ['slots', 'locale', 'layout'],
      apply(ctx) {
        ctx.effect(() => installStyles())
        ctx.effect(() => ctx.locale.register('chat-translator', 'en', DICTS.en))
        ctx.effect(() => ctx.locale.register('chat-translator', 'zh', DICTS.zh))

        const { OverlayRoot, LauncherRoot } = createSurface(ctx)

        const surfaceLabel = () => {
          try {
            return String(ctx.locale.getLocale().active).toLowerCase().startsWith('zh')
              ? DICTS.zh.title
              : DICTS.en.title
          } catch {
            return DICTS.zh.title
          }
        }

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'chat-translator',
          order: 30,
          label: surfaceLabel,
        }, PanelGlyph))

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: 'chat-translator',
        }, LauncherRoot))

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'chat-translator',
          order: 40,
          label: surfaceLabel,
        }, OverlayRoot))
      },
    }
  },
})
