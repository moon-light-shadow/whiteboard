export interface ShortcutItem {
  keys: string
  label: string
}

export interface ShortcutGroup {
  title: string
  items: ShortcutItem[]
}

export const IS_APPLE =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent)

/** 把 Ctrl / Shift / Alt 渲染为平台习惯的符号 */
export function formatKeys(keys: string): string {
  if (!IS_APPLE) return keys
  return keys
    .replace(/Ctrl/g, '⌘')
    .replace(/Shift/g, '⇧')
    .replace(/Alt/g, '⌥')
    .replace(/Delete/g, '⌫')
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: '工具',
    items: [
      { keys: 'V', label: '选择' },
      { keys: 'L', label: '套索' },
      { keys: 'P', label: '钢笔' },
      { keys: 'H', label: '荧光笔' },
      { keys: 'E', label: '橡皮' },
      { keys: 'N', label: '便签' },
      { keys: 'T', label: '文字' },
      { keys: 'R', label: '矩形' },
      { keys: 'O', label: '椭圆' },
      { keys: 'D', label: '菱形' },
      { keys: 'A', label: '箭头' },
      { keys: 'I', label: '插入图片' },
      { keys: '空格 + 拖动', label: '平移画布' },
    ],
  },
  {
    title: '编辑',
    items: [
      { keys: 'Ctrl+Z', label: '撤销' },
      { keys: 'Ctrl+Shift+Z', label: '重做' },
      { keys: 'Ctrl+C', label: '复制' },
      { keys: 'Ctrl+X', label: '剪切' },
      { keys: 'Ctrl+V', label: '粘贴' },
      { keys: 'Ctrl+D', label: '再制' },
      { keys: 'Ctrl+A', label: '全选' },
      { keys: 'Delete', label: '删除所选' },
      { keys: '方向键', label: '微调 1 像素' },
      { keys: 'Shift+方向键', label: '微调 10 像素' },
      { keys: 'Ctrl+]', label: '置于顶层' },
      { keys: 'Ctrl+[', label: '置于底层' },
      { keys: '双击', label: '编辑便签 / 文字' },
    ],
  },
  {
    title: '视图与文件',
    items: [
      { keys: 'Ctrl+=', label: '放大' },
      { keys: 'Ctrl+-', label: '缩小' },
      { keys: 'Ctrl+0', label: '缩放回 100%' },
      { keys: 'Shift+1', label: '适配内容' },
      { keys: '] / [', label: '笔刷加粗 / 变细' },
      { keys: 'Ctrl+E', label: '导出白板' },
      { keys: 'Ctrl+S', label: '立即保存' },
      { keys: 'Ctrl+Shift+D', label: '切换深浅主题' },
      { keys: 'Esc', label: '回到选择工具' },
      { keys: '?', label: '打开本帮助' },
    ],
  },
]
