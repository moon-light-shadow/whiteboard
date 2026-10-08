# Whiteboard

一款启动迅速、书写流畅的**桌面无限画布白板**（Microsoft Whiteboard 替代品），基于 Tauri v2 + React 19 + Canvas 自研渲染内核。

## 下载安装

前往 [Releases](https://github.com/moon-light-shadow/whiteboard/releases/latest) 下载：

| 文件 | 大小 | 适用场景 |
|---|---|---|
| `Whiteboard_x64-setup.exe` | ~1.4 MB | Windows 推荐，双击安装 |
| `Whiteboard_x64_en-US.msi` | ~1.9 MB | Windows 企业静默部署（`msiexec /i`） |
| `Whiteboard_0.2.0_android-universal.apk` | ~3.8 MB | Android 手机 / 平板，直接安装 |

系统要求：Windows 10 1809+ / Windows 11（x64）。首次安装若系统缺少 WebView2 Runtime 会自动联网获取。

Android 端要求 Android 7.0（API 24）及以上，安装包为通用 APK（`arm64-v8a` / `armeabi-v7a` / `x86` / `x86_64`）。移动端画布数据保存在应用私有目录，不提供自定义存放位置。

## 特性

- **无限画布**：自由缩放、平移，不受固定页面约束
- **流畅墨迹**：基于 [perfect-freehand](https://github.com/steveruizok/perfect-freehand) 的压感曲线渲染，带路径缓存
- **丰富工具**：画笔、形状、文字、便签、图片插入等
- **多白板管理**：新建、重命名、复制、删除、搜索、本地白板库
- **导出**：PNG / SVG / PDF（pdf-lib 按需懒加载）、复制到剪贴板
- **数据可靠**：写入先落临时文件再原子改名，损坏自动回退备份并自愈
- **目录可选**：画布存放位置可自定义，整目录复制即可迁移，完全离线可用

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

Windows：

```bash
npm run tauri:build
```

产物位于 `src-tauri/target/release/bundle/`（NSIS 安装包 + MSI）。

Android：

```bash
npm run tauri android init            # 首次生成 gen/android 工程（已随仓库提交）
npm run tauri android build -- --apk  # 生成通用 APK
```

产物位于 `src-tauri/gen/android/app/build/outputs/apk/universal/release/`。需要 JDK 17+、Android SDK（platform 36 / build-tools 36）与 NDK 27，并设置 `ANDROID_HOME`、`NDK_HOME`、`JAVA_HOME`；release 签名读取 `src-tauri/gen/android/keystore.properties`（该文件与密钥库不入库，需自行保管）。

> Windows 上构建时还需要「开发人员模式」或管理员权限：Tauri CLI 会把编译好的动态库以符号链接方式放入 `jniLibs`。

<details>
<summary>没有符号链接权限时的手动构建（Windows）</summary>

```powershell
$env:ANDROID_HOME = 'D:\Android\Sdk'; $env:NDK_HOME = "$env:ANDROID_HOME\ndk\27.0.12077973"
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-21'
$env:TAURI_ANDROID_PROJECT_PATH = "$PWD\src-tauri\gen\android"
$env:WRY_ANDROID_KOTLIN_FILES_OUT_DIR = "$env:TAURI_ANDROID_PROJECT_PATH\app\src\main\java\com\whiteboard\desktop\generated"
$env:WRY_ANDROID_PACKAGE = 'com.whiteboard.desktop'; $env:WRY_ANDROID_LIBRARY = 'whiteboard_lib'
$bin = "$env:NDK_HOME\toolchains\llvm\prebuilt\windows-x86_64\bin"

npm run build   # 先生成 dist，release 库会内嵌前端资源
cd src-tauri
# 逐个 ABI 交叉编译（release 必须带 custom-protocol，否则不会内嵌前端）
$env:CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER = "$bin\aarch64-linux-android24-clang.cmd"
$env:CC_aarch64-linux-android = $env:CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER
$env:AR_aarch64-linux-android = "$bin\llvm-ar.exe"
cargo build --release --features tauri/custom-protocol --target aarch64-linux-android
Copy-Item target\aarch64-linux-android\release\libwhiteboard_lib.so `
  gen\android\app\src\main\jniLibs\arm64-v8a\libwhiteboard_lib.so -Force
cd gen\android
.\gradlew.bat :app:assembleUniversalRelease -x rustBuildUniversalRelease `
  -x rustBuildArm64Release -x rustBuildArmRelease -x rustBuildX86Release -x rustBuildX86_64Release
```

`custom-protocol` 特性与 `#[cfg_attr(mobile, tauri::mobile_entry_point)]` 两者缺一不可：前者决定是否内嵌前端资源，后者生成 Kotlin 侧调用的 JNI 方法，缺失都会导致应用无法正常启动。

</details>

## 画布存放位置

画布数据默认保存在应用数据目录（Windows：`%APPDATA%\com.whiteboard.desktop\boards`），每块白板一个文件夹，内含 `board.json`、`board.json.bak`、`meta.json` 与 `assets/` 图片资源。

首次启动会提示选择存放位置，之后可在**白板库右上角 → 画布存放位置**中随时更改：

- 更换目录时可勾选「把现有白板复制到新目录」，同名白板会被跳过，不会覆盖新目录里已有的数据
- 换机迁移：把整个目录复制到新机器，再在软件里选择同一目录即可，无需导出导入
- 存放位置记录在 `%APPDATA%\com.whiteboard.desktop\storage.json`；目录被删除或不可写时会自动回退到默认位置，保证应用总能启动

移动端（Android）不提供该选项：系统没有桌面式目录选择器，画布固定存放在应用私有目录，卸载应用会一并删除，请注意导出备份。

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
