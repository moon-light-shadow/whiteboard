use std::fs;
use std::path::{Path, PathBuf};

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

/// 本地存储：`<appData>/boards/<id>/{board.json, meta.json, assets/}`
///
/// 约定：
/// - 写入先落临时文件再改名，避免半截文件；
/// - 覆盖前备份上一份 `board.json.bak`，读取时自动回退并自愈；
/// - 目录名即权威 ID，`meta.json` 损坏时可由 `board.json` 重建。
#[derive(Debug, Clone)]
pub struct Storage {
    root: PathBuf,
}

impl Storage {
    pub fn init<R: Runtime>(app: &AppHandle<R>) -> AppResult<Self> {
        let root = app.path().app_data_dir()?;
        fs::create_dir_all(root.join(BOARDS_DIR))?;
        Ok(Self { root })
    }

    fn boards_root(&self) -> PathBuf {
        self.root.join(BOARDS_DIR)
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
