use std::fs;
use std::path::Path;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine as _;
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::storage::{BoardMeta, RawAsset, Storage};

// ---------------------------------------------------------------- 白板文档

#[tauri::command]
pub fn list_boards(storage: State<'_, Storage>) -> AppResult<Vec<BoardMeta>> {
    storage.list_boards()
}

#[tauri::command]
pub fn read_board(storage: State<'_, Storage>, id: String) -> AppResult<Option<String>> {
    storage.read_board(&id)
}

#[tauri::command]
pub fn write_board(storage: State<'_, Storage>, id: String, data: String, meta: String) -> AppResult<()> {
    storage.write_board(&id, &data, &meta)
}

#[tauri::command]
pub fn delete_board(storage: State<'_, Storage>, id: String) -> AppResult<()> {
    storage.delete_board(&id)
}

#[tauri::command]
pub fn read_thumbnail(storage: State<'_, Storage>, id: String) -> AppResult<Option<String>> {
    storage.read_thumbnail(&id)
}

// ---------------------------------------------------------------- 图片资源

#[tauri::command]
pub fn write_asset(
    storage: State<'_, Storage>,
    id: String,
    asset_id: String,
    mime: String,
    data: String,
) -> AppResult<()> {
    let bytes = BASE64.decode(data.as_bytes())?;
    storage.write_asset(&id, &asset_id, &mime, &bytes)
}

#[tauri::command]
pub fn read_asset(storage: State<'_, Storage>, id: String, asset_id: String) -> AppResult<Option<RawAsset>> {
    storage.read_asset(&id, &asset_id)
}

// -------------------------------------------------- 系统文件读写（配合对话框）

#[tauri::command]
pub fn read_file_base64(path: String) -> AppResult<String> {
    let bytes = fs::read(absolute(&path)?).map_err(|error| AppError::new(format!("读取文件失败（{path}）：{error}")))?;
    Ok(BASE64.encode(bytes))
}

#[tauri::command]
pub fn read_file_text(path: String) -> AppResult<String> {
    fs::read_to_string(absolute(&path)?)
        .map_err(|error| AppError::new(format!("读取文件失败（{path}）：{error}")))
}

#[tauri::command]
pub fn write_file_base64(path: String, data: String) -> AppResult<()> {
    let target = absolute(&path)?.to_path_buf();
    let bytes = BASE64.decode(data.as_bytes())?;
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&target, bytes).map_err(|error| AppError::new(format!("写入文件失败（{path}）：{error}")))
}

/// 路径均来自系统对话框或前端自己拼出的导出名，这里只做基本约束
fn absolute(path: &str) -> AppResult<&Path> {
    let candidate = Path::new(path);
    if !candidate.is_absolute() {
        return Err(AppError::new(format!("只接受绝对路径：{path}")));
    }
    Ok(candidate)
}
