# Whiteboard

一款启动迅速、书写流畅的**桌面无限画布白板**（Microsoft Whiteboard 替代品），基于 Tauri v2 + React 19 + Canvas 自研渲染内核。

## 下载安装

前往 [Releases](https://github.com/moon-light-shadow/whiteboard/releases/latest) 下载：

| 文件 | 大小 | 适用场景 |
|---|---|---|
| `Whiteboard_x64-setup.exe` | ~1.4 MB | 推荐，双击安装 |
| `Whiteboard_x64_en-US.msi` | ~1.9 MB | 企业静默部署（`msiexec /i`） |

系统要求：Windows 10 1809+ / Windows 11（x64）。首次安装若系统缺少 WebView2 Runtime 会自动联网获取。

## 特性

- **无限画布**：自由缩放、平移，不受固定页面约束
- **流畅墨迹**：基于 [perfect-freehand](https://github.com/steveruizok/perfect-freehand) 的压感曲线渲染，带路径缓存
- **丰富工具**：画笔、形状、文字、便签、图片插入等
- **多白板管理**：新建、重命名、复制、删除、搜索、本地白板库
- **导出**：PNG / SVG / PDF（pdf-lib 按需懒加载）、复制到剪贴板
- **数据可靠**：写入先落临时文件再原子改名，损坏自动回退备份并自愈
- **离线可用**：数据全部保存在本机应用数据目录

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面壳 | Tauri v2（Rust） |
| 前端 | React 19 + TypeScript + Vite 5 |
| 状态 | Zustand |
| 样式 | Tailwind CSS 3 |
| 渲染 | Canvas 2D 自研内核（`src/kernel/`：相机、几何、历史、命中测试、渲染器） |
| 持久化 | JSON 文档 + 原子写入（`src-tauri/src/storage.rs`） |

## 本地开发

```bash
npm install        # 安装依赖
npm run tauri:dev  # 启动开发模式（热更新）
```

## 构建

```bash
npm run tauri:build
```

产物位于 `src-tauri/target/release/bundle/`（NSIS 安装包 + MSI）。

## 目录结构

```
src/
├── kernel/        # 渲染内核：相机、几何、历史、命中测试、各元素渲染器
├── persist/       # 持久化抽象（Tauri / Web 双实现）
├── export/        # PNG / SVG / PDF 导出
├── ui/            # 工具栏、白板库、对话框等组件
└── store/         # Zustand 状态
src-tauri/
└── src/           # Rust 侧：命令、存储、错误处理
```

## License

MIT
