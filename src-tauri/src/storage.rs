use std::fs;
use std::path::{Path, PathBuf};
use std::sync::RwLock;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine as _;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};

use crate::error::{AppError, AppResult};

const BOARDS_DIR: &str = "boards";
const ASSETS_DIR: &str = "assets";
const BOARD_FILE: &str = "board.json";
const META_FILE: &str = "meta.json";
const BOARD_BACKUP: &str = "board.json.bak";
const TEMP_EXT: &str = "tmp";
const CONFIG_FILE: &str = "storage.json";

/// 白板列表项（与前端 `BoardMeta` 对齐，`storage` 由前端补齐）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardMeta {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub record_count: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thumbnail: Option<String>,
}

/// 图片资源读取结果：base64 文本 + MIME
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RawAsset {
    pub data: String,
    pub mime: String,
}

/// 画布存储位置快照，供前端展示
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageInfo {
    /// 当前画布数据目录（各白板位于其 `boards` 子目录）
    pub data_dir: String,
    /// 出厂默认目录，用于「恢复默认位置」
    pub default_dir: String,
    /// 用户是否显式选择过目录（false = 首次启动尚未选择）
    pub configured: bool,
    /// 当前目录下的白板数量
    pub board_count: usize,
}

/// 目录迁移结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationReport {
    pub copied: usize,
    pub skipped: usize,
    pub failed: usize,
}

/// 落盘的存储配置：只记录用户选定的目录，文件位置固定不变
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StorageConfig {
    data_dir: Option<String>,
}

/// 存储位置的权威配置文件名固定，目录为应用数据根目录
#[derive(Debug)]
pub struct Storage {
    /// 用户选定的画布数据根目录（`boards/` 存放在其中）
    data_dir: RwLock<PathBuf>,
    /// 出厂默认位置，永远可回退
    default_dir: PathBuf,
    /// 配置文件路径（位于应用配置目录，与画布数据分离）
    config_path: PathBuf,
    /// 是否已显式配置过目录
    configured: RwLock<bool>,
}

impl Storage {
    /// 读取配置并初始化；配置缺失/损坏/目录不可用时回退到默认位置，保证应用总能启动
    pub fn init<R: Runtime>(app: &AppHandle<R>) -> AppResult<Self> {
        let default_dir = app.path().app_data_dir()?;
        let config_path = app
            .path()
            .app_config_dir()
            .unwrap_or_else(|_| default_dir.clone())
            .join(CONFIG_FILE);

        let mut configured = false;
        let mut data_dir = default_dir.clone();

        if let Ok(text) = fs::read_to_string(&config_path) {
            if let Ok(config) = serde_json::from_str::<StorageConfig>(&text) {
                let raw = config.data_dir.unwrap_or_default();
                let raw = raw.trim();
                if !raw.is_empty() && Path::new(raw).is_absolute() {
                    data_dir = PathBuf::from(raw);
                    configured = true;
                }
            }
        }

        if let Err(error) = fs::create_dir_all(data_dir.join(BOARDS_DIR)) {
            eprintln!(
                "画布目录不可用（{}）：{error}，已回退到默认位置",
                data_dir.display()
            );
            data_dir = default_dir.clone();
            configured = false;
            fs::create_dir_all(data_dir.join(BOARDS_DIR))?;
        }

        Ok(Self {
            data_dir: RwLock::new(data_dir),
            default_dir,
            config_path,
            configured: RwLock::new(configured),
        })
    }

    // ------------------------------------------------------------ 存储位置

    /// 当前画布数据目录
    pub fn data_dir(&self) -> PathBuf {
        self.current_dir()
    }

    pub fn info(&self) -> AppResult<StorageInfo> {
        Ok(StorageInfo {
            data_dir: display_path(&self.current_dir()),
            default_dir: display_path(&self.default_dir),
            configured: self.is_configured(),
            board_count: self.list_boards()?.len(),
        })
    }

    /// 切换到新目录；`migrate` 为真时把现有白板复制过去（同名目录跳过，不覆盖已有数据）
    pub fn set_data_dir(&self, raw: &str, migrate: bool) -> AppResult<(StorageInfo, Option<MigrationReport>)> {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return Err(AppError::new("请选择一个存放画布的目录"));
        }
        let target = PathBuf::from(trimmed);
        if !target.is_absolute() {
            return Err(AppError::new(format!("需要绝对路径：{trimmed}")));
        }

        let boards = target.join(BOARDS_DIR);
        fs::create_dir_all(&boards)
            .map_err(|error| AppError::new(format!("无法创建目录（{}）：{error}", target.display())))?;
        probe_writable(&boards)?;

        let current = self.current_dir();
        let report = if migrate && !same_path(&current, &target) {
            Some(migrate_boards(&current.join(BOARDS_DIR), &boards)?)
        } else {
            None
        };

        self.switch_to(&target)?;
        Ok((self.info()?, report))
    }

    /// 恢复出厂默认位置（同样写回配置，避免下次启动再弹引导）
    pub fn reset_data_dir(&self) -> AppResult<StorageInfo> {
        let default_dir = self.default_dir.clone();
        fs::create_dir_all(default_dir.join(BOARDS_DIR))?;
        self.switch_to(&default_dir)?;
        Ok(self.info()?)
    }

    /// 先落配置再改内存：配置写失败时不切换，避免下次启动位置不一致
    fn switch_to(&self, target: &Path) -> AppResult<()> {
        fs::create_dir_all(target.join(BOARDS_DIR))?;
        self.persist_config(target)?;
        match self.data_dir.write() {
            Ok(mut guard) => *guard = target.to_path_buf(),
            Err(poisoned) => *poisoned.into_inner() = target.to_path_buf(),
        }
        match self.configured.write() {
            Ok(mut guard) => *guard = true,
            Err(poisoned) => *poisoned.into_inner() = true,
        }
        Ok(())
    }

    fn persist_config(&self, dir: &Path) -> AppResult<()> {
        if let Some(parent) = self.config_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let config = StorageConfig {
            data_dir: Some(display_path(dir)),
        };
        let text = serde_json::to_string_pretty(&config)?;
        write_atomic(&self.config_path, text.as_bytes())
    }

    fn current_dir(&self) -> PathBuf {
        match self.data_dir.read() {
            Ok(guard) => guard.clone(),
            Err(poisoned) => poisoned.into_inner().clone(),
        }
    }

    fn is_configured(&self) -> bool {
        match self.configured.read() {
            Ok(guard) => *guard,
            Err(poisoned) => *poisoned.into_inner(),
        }
    }

    fn boards_root(&self) -> PathBuf {
        self.current_dir().join(BOARDS_DIR)
    }

    fn board_dir(&self, id: &str) -> AppResult<PathBuf> {
        Ok(self.boards_root().join(safe_segment(id, "白板 ID")?))
    }

    // ------------------------------------------------------------ 白板文档

    pub fn list_boards(&self) -> AppResult<Vec<BoardMeta>> {
        let root = self.boards_root();
        fs::create_dir_all(&root)?;
        let mut metas: Vec<BoardMeta> = Vec::new();
        for entry in fs::read_dir(&root)? {
            let entry = entry?;
            if !entry.file_type()?.is_dir() {
                continue;
            }
            let id = match entry.file_name().into_string() {
                Ok(name) => name,
                Err(_) => continue,
            };
            if let Some(meta) = self.read_meta(&id)? {
                metas.push(meta);
            }
        }
        metas.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        Ok(metas)
    }

    pub fn read_board(&self, id: &str) -> AppResult<Option<String>> {
        let dir = self.board_dir(id)?;
        let primary = dir.join(BOARD_FILE);
        if let Some(text) = read_valid_json(&primary) {
            return Ok(Some(text));
        }
        // 主文件缺失或损坏：回退到备份，并顺手修复主文件
        let backup = dir.join(BOARD_BACKUP);
        if let Some(text) = read_valid_json(&backup) {
            let _ = write_atomic(&primary, text.as_bytes());
            return Ok(Some(text));
        }
        Ok(None)
    }

    pub fn write_board(&self, id: &str, data: &str, meta: &str) -> AppResult<()> {
        let board = serde_json::from_str::<serde_json::Value>(data)?;
        if !board.get("records").map(|value| value.is_array()).unwrap_or(false) {
            return Err(AppError::new("白板数据缺少 records 字段，已取消写入"));
        }
        let meta = serde_json::from_str::<serde_json::Value>(meta)?;

        let dir = self.board_dir(id)?;
        fs::create_dir_all(dir.join(ASSETS_DIR))?;

        let board_path = dir.join(BOARD_FILE);
        if let Ok(previous) = fs::read(&board_path) {
            if serde_json::from_slice::<serde_json::Value>(&previous).is_ok() {
                write_atomic(&dir.join(BOARD_BACKUP), &previous)?;
            }
        }
        write_atomic(&board_path, data.as_bytes())?;
        write_atomic(&dir.join(META_FILE), meta.to_string().as_bytes())?;
        Ok(())
    }

    pub fn delete_board(&self, id: &str) -> AppResult<()> {
        let dir = self.board_dir(id)?;
        if dir.exists() {
            fs::remove_dir_all(&dir)?;
        }
        Ok(())
    }

    pub fn read_thumbnail(&self, id: &str) -> AppResult<Option<String>> {
        Ok(self.read_meta(id)?.and_then(|meta| meta.thumbnail))
    }

    /// 读取列表元数据；`meta.json` 缺失或损坏时由 `board.json` 兜底重建
    fn read_meta(&self, id: &str) -> AppResult<Option<BoardMeta>> {
        let dir = self.boards_root().join(id);
        if let Ok(text) = fs::read_to_string(dir.join(META_FILE)) {
            if let Ok(mut meta) = serde_json::from_str::<BoardMeta>(&text) {
                // 目录名是权威 ID，避免 meta.json 被手动改乱后串台
                meta.id = id.to_string();
                return Ok(Some(meta));
            }
        }

        let Some(text) = read_valid_json(&dir.join(BOARD_FILE)) else {
            return Ok(None);
        };
        let Ok(board) = serde_json::from_str::<serde_json::Value>(&text) else {
            return Ok(None);
        };
        let created_at = board.get("createdAt").and_then(|value| value.as_i64()).unwrap_or(0);
        Ok(Some(BoardMeta {
            id: id.to_string(),
            name: board
                .get("name")
                .and_then(|value| value.as_str())
                .unwrap_or("未命名白板")
                .to_string(),
            created_at,
            updated_at: board
                .get("updatedAt")
                .and_then(|value| value.as_i64())
                .unwrap_or(created_at),
            record_count: board
                .get("records")
                .and_then(|value| value.as_array())
                .map(|records| records.len())
                .unwrap_or(0),
            thumbnail: None,
        }))
    }

    // ------------------------------------------------------------ 图片资源

    pub fn write_asset(&self, id: &str, asset_id: &str, mime: &str, bytes: &[u8]) -> AppResult<()> {
        let asset_id = safe_segment(asset_id, "资源 ID")?;
        let assets = self.board_dir(id)?.join(ASSETS_DIR);
        fs::create_dir_all(&assets)?;

        let target = assets.join(format!("{asset_id}.{}", ext_for_mime(mime)));
        // 同一资源换了扩展名时清掉旧文件，避免读取时命中过期数据
        for path in asset_paths(&assets, &asset_id)? {
            if path != target {
                let _ = fs::remove_file(path);
            }
        }
        write_atomic(&target, bytes)
    }

    pub fn read_asset(&self, id: &str, asset_id: &str) -> AppResult<Option<RawAsset>> {
        let asset_id = safe_segment(asset_id, "资源 ID")?;
        let assets = self.board_dir(id)?.join(ASSETS_DIR);
        let Some(path) = asset_paths(&assets, &asset_id)?.into_iter().next() else {
            return Ok(None);
        };
        let mime = path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(mime_for_ext)
            .unwrap_or_else(|| "application/octet-stream".to_string());
        let bytes = fs::read(&path)?;
        Ok(Some(RawAsset {
            data: BASE64.encode(bytes),
            mime,
        }))
    }
}

// ------------------------------------------------------------------ 工具函数

/// 只接受由前端生成的 ID，杜绝 `..` 之类的路径穿越
fn safe_segment(raw: &str, label: &str) -> AppResult<String> {
    let trimmed = raw.trim();
    let valid = !trimmed.is_empty()
        && trimmed.len() <= 128
        && trimmed
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
    if !valid {
        return Err(AppError::new(format!("{label} 不合法：{raw}")));
    }
    Ok(trimmed.to_string())
}

fn temp_path(path: &Path) -> PathBuf {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("board");
    path.with_file_name(format!("{name}.{TEMP_EXT}"))
}

/// 先写临时文件再改名，保证读取方永远看不到半截内容
fn write_atomic(path: &Path, bytes: &[u8]) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let temp = temp_path(path);
    fs::write(&temp, bytes)?;
    if let Err(error) = fs::rename(&temp, path) {
        // Windows 下目标已存在时改名会失败：先删旧文件再改名
        if path.exists() {
            fs::remove_file(path)?;
            fs::rename(&temp, path)?;
        } else {
            let _ = fs::remove_file(&temp);
            return Err(error.into());
        }
    }
    Ok(())
}

fn read_valid_json(path: &Path) -> Option<String> {
    let text = fs::read_to_string(path).ok()?;
    serde_json::from_str::<serde_json::Value>(&text).ok()?;
    Some(text)
}

/// 列出某资源 ID 对应的全部文件（同一 ID 理论上只应存在一个）
fn asset_paths(assets: &Path, asset_id: &str) -> AppResult<Vec<PathBuf>> {
    if !assets.is_dir() {
        return Ok(Vec::new());
    }
    let prefix = format!("{asset_id}.");
    let mut paths: Vec<PathBuf> = Vec::new();
    for entry in fs::read_dir(assets)? {
        let entry = entry?;
        if !entry.file_type()?.is_file() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.starts_with(&prefix) {
            continue;
        }
        let ext = name.rsplit('.').next().unwrap_or_default();
        if ext == TEMP_EXT {
            continue;
        }
        paths.push(entry.path());
    }
    paths.sort();
    Ok(paths)
}

/// 真写一个探针文件，确认目标目录确实可写（而非仅有权限位）
fn probe_writable(boards: &Path) -> AppResult<()> {
    let probe = boards.join(format!(".whiteboard-write-test.{TEMP_EXT}"));
    fs::write(&probe, b"ok")
        .map_err(|error| AppError::new(format!("目录不可写（{}）：{error}", boards.display())))?;
    let _ = fs::remove_file(&probe);
    Ok(())
}

/// 把源 `boards` 下的白板复制到目标目录，同名目录跳过，绝不覆盖既有数据
fn migrate_boards(source: &Path, target: &Path) -> AppResult<MigrationReport> {
    let mut report = MigrationReport {
        copied: 0,
        skipped: 0,
        failed: 0,
    };
    if !source.is_dir() {
        return Ok(report);
    }
    fs::create_dir_all(target)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }
        let dest = target.join(entry.file_name());
        if dest.exists() {
            report.skipped += 1;
            continue;
        }
        match copy_dir(&entry.path(), &dest) {
            Ok(()) => report.copied += 1,
            Err(error) => {
                eprintln!("复制白板失败（{}）：{error}", entry.path().display());
                let _ = fs::remove_dir_all(&dest);
                report.failed += 1;
            }
        }
    }
    Ok(report)
}

fn copy_dir(source: &Path, target: &Path) -> std::io::Result<()> {
    fs::create_dir_all(target)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let dest = target.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir(&entry.path(), &dest)?;
        } else {
            fs::copy(entry.path(), dest)?;
        }
    }
    Ok(())
}

/// Windows 路径大小写与分隔符不敏感，比较前先归一化
fn same_path(a: &Path, b: &Path) -> bool {
    let norm = |path: &Path| {
        path.to_string_lossy()
            .replace('/', "\\")
            .trim_end_matches('\\')
            .to_lowercase()
    };
    norm(a) == norm(b)
}

/// 展示用路径：去掉 Windows 扩展长度前缀，便于直接粘贴到资源管理器
fn display_path(path: &Path) -> String {
    let text = path.to_string_lossy().to_string();
    text.strip_prefix(r"\\?\").unwrap_or(&text).to_string()
}

/// 用系统文件管理器打开目录，方便用户查看/备份画布
pub fn reveal_dir(path: &Path) -> AppResult<()> {
    if !path.exists() {
        return Err(AppError::new(format!("目录不存在：{}", path.display())));
    }
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut cmd = std::process::Command::new("explorer");
        cmd.arg(path);
        cmd
    };
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut cmd = std::process::Command::new("open");
        cmd.arg(path);
        cmd
    };
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut cmd = std::process::Command::new("xdg-open");
        cmd.arg(path);
        cmd
    };

    command
        .spawn()
        .map_err(|error| AppError::new(format!("打开目录失败：{error}")))?;
    Ok(())
}

fn ext_for_mime(mime: &str) -> &'static str {
    match mime.to_ascii_lowercase().as_str() {
        "image/png" => "png",
        "image/jpeg" | "image/jpg" => "jpg",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/svg+xml" => "svg",
        "image/bmp" => "bmp",
        _ => "bin",
    }
}

fn mime_for_ext(ext: &str) -> String {
    match ext.to_ascii_lowercase().as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        _ => "application/octet-stream",
    }
    .to_string()
}
