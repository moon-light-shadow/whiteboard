use std::fs;
use std::path::Path;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine as _;
use serde::Serialize;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

use crate::error::{AppError, AppResult};
use crate::storage::{BoardMeta, MigrationReport, RawAsset, Storage, StorageInfo};

/// 切换目录后的返回：新位置快照 + 迁移统计（未迁移时为 null）
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetStorageDirResult {
    pub info: StorageInfo,
    pub migration: Option<MigrationReport>,
}

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

// ---------------------------------------------------------------- 存储位置

#[tauri::command]
pub fn storage_info(storage: State<'_, Storage>) -> AppResult<StorageInfo> {
    storage.info()
}

/// 切换画布目录；`migrate` 为真时把现有白板一并复制到新目录
#[tauri::command]
pub fn set_storage_dir(
    storage: State<'_, Storage>,
    path: String,
    migrate: bool,
) -> AppResult<SetStorageDirResult> {
    let (info, migration) = storage.set_data_dir(&path, migrate)?;
    Ok(SetStorageDirResult { info, migration })
}

#[tauri::command]
pub fn reset_storage_dir(storage: State<'_, Storage>) -> AppResult<StorageInfo> {
    storage.reset_data_dir()
}

/// 用系统文件管理器打开画布目录，便于用户手动备份或迁移
#[tauri::command]
pub fn open_storage_dir(storage: State<'_, Storage>) -> AppResult<()> {
    crate::storage::reveal_dir(&storage.data_dir())
}

// ------------------------------------------------------------------ 系统对话框
//
// 前端不再直接调用 dialog 插件的 `open()` / `save()`：那两条路径内部用的是
// 插件的**阻塞**实现，在异步命令线程里与事件循环互相等待，表现为
// 「取消选择后 Promise 永不 resolve，按钮一直转圈、界面被锁死」。
// 这里改用插件官方推荐的非阻塞回调 API + 通道，取消同样会正常返回。

/// 桌面端把对话框挂到主窗口上（模态、置顶）；移动端忽略
#[cfg(desktop)]
fn with_parent<R: tauri::Runtime>(
  builder: tauri_plugin_dialog::FileDialogBuilder<R>,
  window: &tauri::Window<R>,
) -> tauri_plugin_dialog::FileDialogBuilder<R> {
  builder.set_parent(window)
}

#[cfg(not(desktop))]
fn with_parent<R: tauri::Runtime>(
  builder: tauri_plugin_dialog::FileDialogBuilder<R>,
  _window: &tauri::Window<R>,
) -> tauri_plugin_dialog::FileDialogBuilder<R> {
  builder
}

/// 弹出选择文件对话框（单个）；用户取消返回 `None`
#[tauri::command]
pub async fn pick_scene_file(
  app: AppHandle,
  window: tauri::Window,
) -> AppResult<Option<String>> {
    let (tx, mut rx) = tauri::async_runtime::channel(1);
    let dialog = with_parent(app.dialog().file().set_title("导入场景文件"), &window)
      .add_filter("白板场景", &["json"]);
    dialog.pick_file(move |path| {
      let _ = tx.blocking_send(path);
    });
    let picked = rx.recv().await.unwrap_or(None);
    Ok(picked.map(|path| path.to_string()))
}

/// 弹出图片选择对话框（可多选）；用户取消返回 `None`
#[tauri::command]
pub async fn pick_image_files(
  app: AppHandle,
  window: tauri::Window,
) -> AppResult<Option<Vec<String>>> {
    let (tx, mut rx) = tauri::async_runtime::channel(1);
    let dialog = with_parent(
      app
        .dialog()
        .file()
        .set_title("选择图片")
        .add_filter("图片", &["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"]),
      &window,
    );
    dialog.pick_files(move |paths| {
      let _ = tx.blocking_send(paths);
    });
    let picked = rx.recv().await.unwrap_or(None);
    Ok(picked.map(|list| list.into_iter().map(|path| path.to_string()).collect()))
}

/// 弹出目录选择对话框；用户取消返回 `None`
///
/// 移动端没有「选择文件夹」这一交互（系统只提供文件选择器），直接返回未选择。
#[tauri::command]
pub async fn pick_folder(
  app: AppHandle,
  window: tauri::Window,
) -> AppResult<Option<String>> {
    #[cfg(not(desktop))]
    {
      let _ = (app, window);
      Ok(None)
    }
    #[cfg(desktop)]
    {
      let (tx, mut rx) = tauri::async_runtime::channel(1);
      let dialog = with_parent(app.dialog().file().set_title("选择画布存放目录"), &window);
      dialog.pick_folder(move |path| {
        let _ = tx.blocking_send(path);
      });
      let picked = rx.recv().await.unwrap_or(None);
      Ok(picked.map(|path| path.to_string()))
    }
}

/// 弹出保存对话框；用户取消返回 `None`
#[tauri::command]
pub async fn pick_save_path(
  app: AppHandle,
  window: tauri::Window,
  suggested_name: String,
  extension: String,
  description: String,
) -> AppResult<Option<String>> {
    let (tx, mut rx) = tauri::async_runtime::channel(1);
    let filters = [extension.as_str()];
    let dialog = with_parent(app.dialog().file().set_title("导出"), &window)
      .set_file_name(suggested_name)
      .add_filter(&description, &filters);
    dialog.save_file(move |path| {
      let _ = tx.blocking_send(path);
    });
    let picked = rx.recv().await.unwrap_or(None);
    Ok(picked.map(|path| path.to_string()))
}

// -------------------------------------------------- 系统文件读写（配合对话框）

/// 导出文件落盘（移动端专用）
///
/// Android 的「保存到」返回的是 `content://` URI，无法用普通文件写入；
/// 这里统一写到应用外部文件目录的 `exports/`，在文件管理器里可见，返回落盘路径。
#[tauri::command]
pub fn write_export_file(
  app: AppHandle,
  name: String,
  data: String,
) -> AppResult<String> {
  let bytes = BASE64.decode(data.as_bytes())?;
  let dir = app.path().app_data_dir()?.join("exports");
  fs::create_dir_all(&dir)?;
  let target = dir.join(safe_export_name(&name));
  fs::write(&target, bytes).map_err(|error| AppError::new(format!("写入导出文件失败：{error}")))?;
  Ok(target.to_string_lossy().to_string())
}

/// 去掉路径分隔符等危险字符，避免导出文件名逃出目标目录
fn safe_export_name(name: &str) -> String {
  let cleaned: String = name
    .chars()
    .filter(|c| !matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') && !c.is_control())
    .collect();
  let cleaned = cleaned.trim().to_string();
  if cleaned.is_empty() {
    "whiteboard-export".to_string()
  } else {
    cleaned
  }
}

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
