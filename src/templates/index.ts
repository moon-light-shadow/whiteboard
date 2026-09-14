import { createArrow, createNote, createShape, createText, NOTE_COLORS } from '../kernel/factories'
import type {
  ArrowRecord,
  NoteRecord,
  Point,
  Rect,
  SceneRecord,
  ShapeKind,
  ShapeProps,
  TextRecord,
} from '../kernel/types'

export type TemplateCategory = '思考' | '规划' | '协作' | '分析'

export interface TemplateDef {
  id: string
  name: string
  category: TemplateCategory
  description: string
  /** 缩略图渐变色（模板面板使用） */
  accent: string
  build: () => SceneRecord[]
}

const INK = '#1f2937'
const MUTED = '#64748b'

function note(x: number, y: number, w: number, h: number, body: string, color: string = NOTE_COLORS[0], fontSize = 16): NoteRecord {
  const record = createNote({ x, y, w, h }, { color, fontSize, textColor: '#3f2d0b' })
  record.props.text = body
  return record
}

function heading(x: number, y: number, w: number, body: string, fontSize = 26): TextRecord {
  const record = createText({ x, y, w, h: Math.round(fontSize * 1.5) }, { fontSize, bold: true, color: '#0f172a' })
  record.props.text = body
  return record
}

function label(x: number, y: number, w: number, body: string, fontSize = 17, color = MUTED): TextRecord {
  const record = createText({ x, y, w, h: Math.round(fontSize * 1.4) }, { fontSize, color })
  record.props.text = body
  return record
}

function box(kind: ShapeKind, rect: Rect, options?: Partial<ShapeProps>): SceneRecord {
  return createShape(kind, rect, { stroke: INK, fill: 'transparent', size: 2, ...options })
}

function link(from: Point, to: Point, dashed = false): ArrowRecord {
  return createArrow('arrow', from, to, { stroke: INK, size: 2, dash: dashed ? [4, 4] : null })
}

function brainstorm(): SceneRecord[] {
  return [
    heading(0, -140, 520, '头脑风暴'),
    label(0, -92, 620, '围绕中心主题发散，先求数量再求质量'),
    note(300, 40, 300, 170, '中心主题\n\n把要解决的问题写在这里', NOTE_COLORS[5], 20),
    note(-320, -60, 260, 130, '灵感 1\n\n为什么用户会放弃使用？', NOTE_COLORS[1]),
    note(-320, 120, 260, 130, '灵感 2\n\n哪些环节可以被自动化？', NOTE_COLORS[2]),
    note(660, -60, 260, 130, '灵感 3\n\n如果只做一个功能会是什么？', NOTE_COLORS[3]),
    note(660, 120, 260, 130, '灵感 4\n\n怎样在一分钟内让人上手？', NOTE_COLORS[4]),
    link({ x: 300, y: 110 }, { x: -60, y: 0 }),
    link({ x: 300, y: 150 }, { x: -60, y: 185 }),
    link({ x: 600, y: 110 }, { x: 660, y: 0 }),
    link({ x: 600, y: 150 }, { x: 660, y: 185 }),
    note(-320, 320, 1240, 150, '结论：\n1. 明确目标用户与最小可用场景\n2. 收敛出三个可验证的假设\n3. 为每个假设安排一次一周内的验证动作', NOTE_COLORS[6]),
  ]
}

function flowchart(): SceneRecord[] {
  return [
    heading(0, -160, 520, '流程设计'),
    box('roundedRect', { x: 180, y: -70, w: 200, h: 72 }, { fill: '#E0E7FF', stroke: '#4F46E5' }),
    label(230, -46, 120, '开始', 18, '#3730A3'),
    box('rect', { x: 180, y: 60, w: 200, h: 72 }),
    label(226, 84, 140, '收集需求', 18),
    box('diamond', { x: 170, y: 200, w: 220, h: 150 }),
    label(214, 262, 150, '是否明确？', 17),
    box('rect', { x: 180, y: 420, w: 200, h: 72 }),
    label(226, 444, 140, '拆解为任务', 18),
    box('roundedRect', { x: 180, y: 560, w: 200, h: 72 }, { fill: '#DCFCE7', stroke: '#16A34A' }),
    label(226, 584, 140, '结束', 18, '#166534'),
    box('rect', { x: 560, y: 218, w: 220, h: 72 }, { stroke: '#EF4444', dash: [5, 4] }),
    label(596, 242, 160, '补充调研', 18, '#B91C1C'),
    link({ x: 280, y: 2 }, { x: 280, y: 60 }),
    link({ x: 280, y: 132 }, { x: 280, y: 200 }),
    link({ x: 280, y: 350 }, { x: 280, y: 420 }),
    link({ x: 280, y: 492 }, { x: 280, y: 560 }),
    link({ x: 390, y: 275 }, { x: 560, y: 254 }, true),
    link({ x: 560, y: 290 }, { x: 380, y: 460 }, true),
  ]
}

function kanban(): SceneRecord[] {
  const columns = [
    { title: '待办', color: '#E2E8F0', items: ['梳理需求文档', '设计数据库结构', '确定发布节奏'] },
    { title: '进行中', color: '#BFDBFE', items: ['画布内核渲染', '笔迹平滑调优'] },
    { title: '待评审', color: '#FED7AA', items: ['导出功能自测', '快捷键清单'] },
    { title: '已完成', color: '#B7E4C7', items: ['工程脚手架', '主题变量'] },
  ]
  const records: SceneRecord[] = [heading(0, -140, 520, '本周计划'), label(0, -92, 620, '每周五更新一次，保持任务粒度不超过两天')]
  columns.forEach((column, columnIndex) => {
    const x = columnIndex * 320
    records.push(
      box('roundedRect', { x, y: 0, w: 296, h: 620 }, { fill: '#F8FAFC', stroke: '#E2E8F0' }),
      label(x + 20, 18, 140, column.title, 18, INK),
      note(x + 20, 62, 256, 44, `共 ${column.items.length} 项`, NOTE_COLORS[6], 14),
    )
    column.items.forEach((item, itemIndex) => {
      records.push(note(x + 20, 118 + itemIndex * 118, 256, 100, item, column.color as string, 15))
    })
  })
  return records
}

function meeting(): SceneRecord[] {
  return [
    heading(0, -140, 620, '产品评审会 · 纪要'),
    label(0, -92, 620, '2026 年 9 月 13 日 10:00 - 11:00 · 参与者：产品、设计、研发', 15),
    box('roundedRect', { x: 0, y: 0, w: 380, h: 420 }, { fill: '#F1F5F9', stroke: '#CBD5E1' }),
    label(24, 20, 200, '议题', 18, INK),
    note(24, 62, 332, 130, '1. 画布性能与笔迹手感\n2. 便签与图形的排版规则\n3. 导出格式与文件命名', NOTE_COLORS[2]),
    note(24, 208, 332, 90, '结论：优先保证 500 笔迹场景下的流畅度', NOTE_COLORS[1]),
    box('roundedRect', { x: 420, y: 0, w: 380, h: 420 }, { fill: '#FFF7ED', stroke: '#FDBA74' }),
    label(444, 20, 200, '待办事项', 18, INK),
    note(444, 62, 332, 96, '张明：完成压力测试场景脚本（本周三）', NOTE_COLORS[5], 15),
    note(444, 172, 332, 96, '李然：补全导出面板的预览与进度反馈', NOTE_COLORS[0], 15),
    note(444, 282, 332, 96, '王珂：整理快捷键说明并放进帮助弹窗', NOTE_COLORS[3], 15),
    box('roundedRect', { x: 840, y: 0, w: 340, h: 420 }, { fill: '#F8FAFC', stroke: '#E2E8F0' }),
    label(864, 20, 200, '风险', 18, INK),
    note(864, 62, 292, 120, '大图导入可能带来内存压力，需要限制尺寸并做缓存', NOTE_COLORS[6], 15),
    note(864, 200, 292, 120, 'Tauri 首次打包需确认 WebView2 运行时依赖', NOTE_COLORS[4], 15),
  ]
}

function swot(): SceneRecord[] {
  const quadrants = [
    { title: '优势 Strengths', x: 0, y: 0, color: '#B7E4C7', body: '启动快、体积小\n自研内核，手感可控\n数据完全本地存储' },
    { title: '劣势 Weaknesses', x: 640, y: 0, color: '#FED7AA', body: '生态与云服务缺失\n暂无多人协作\n插件能力有限' },
    { title: '机会 Opportunities', x: 0, y: 460, color: '#BFDBFE', body: '同类工具停服带来空窗\n本地优先需求增长\n手写笔设备普及' },
    { title: '威胁 Threats', x: 640, y: 460, color: '#FBCFE8', body: '在线白板持续免费化\n系统自带墨迹能力增强\n跨平台诉求强烈' },
  ]
  const records: SceneRecord[] = [heading(455, -150, 360, 'SWOT 分析'), label(430, -100, 420, '用于判断产品方向与投入优先级', 15)]
  quadrants.forEach((quadrant) => {
    records.push(
      box('roundedRect', { x: quadrant.x, y: quadrant.y, w: 620, h: 420 }, { fill: '#FFFFFF', stroke: '#E2E8F0' }),
      label(quadrant.x + 28, quadrant.y + 24, 300, quadrant.title, 20, INK),
      note(quadrant.x + 28, quadrant.y + 80, 564, 300, quadrant.body, quadrant.color, 16),
    )
  })
  return records
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'brainstorm',
    name: '头脑风暴',
    category: '思考',
    description: '中心主题 + 四向发散灵感，并预留结论区，适合快速收敛想法。',
    accent: 'from-amber-200 to-orange-300',
    build: brainstorm,
  },
  {
    id: 'flowchart',
    name: '流程图',
    category: '思考',
    description: '起止、处理、判断与补救分支的完整节点，可直接改写用于流程梳理。',
    accent: 'from-indigo-200 to-violet-300',
    build: flowchart,
  },
  {
    id: 'kanban',
    name: '看板周计划',
    category: '规划',
    description: '待办 / 进行中 / 待评审 / 已完成 四列看板，每列预置任务卡片。',
    accent: 'from-sky-200 to-blue-300',
    build: kanban,
  },
  {
    id: 'meeting',
    name: '会议纪要',
    category: '协作',
    description: '议题、结论、待办与风险四区结构，待办区带责任人与时间。',
    accent: 'from-emerald-200 to-teal-300',
    build: meeting,
  },
  {
    id: 'swot',
    name: 'SWOT 分析',
    category: '分析',
    description: '优势、劣势、机会、威胁四象限，用于方向评审与竞品对比。',
    accent: 'from-rose-200 to-pink-300',
    build: swot,
  },
]

export const TEMPLATE_CATEGORIES: TemplateCategory[] = ['思考', '规划', '协作', '分析']

export function findTemplate(id: string): TemplateDef | undefined {
  return TEMPLATES.find((template) => template.id === id)
}
