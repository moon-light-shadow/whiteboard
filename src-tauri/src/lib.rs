mod commands;
mod error;
mod storage;

use tauri::Manager;

/// 应用运行入口：注册存储状态、系统对话框插件与全部 IPC 命令
///
/// `mobile_entry_point` 是移动端必需的：它在 Android 上生成 Kotlin 侧 `Rust.kt`
/// 所声明的 JNI 方法（`create` / `start` / `ipc` 等）。缺失会导致启动即 UnsatisfiedLinkError。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // 画布目录可由用户指定，配置缺失时回落到默认的应用数据目录
            let storage = storage::Storage::init(app.handle())?;
            app.manage(storage);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_boards,
            commands::read_board,
            commands::write_board,
            commands::delete_board,
            commands::read_thumbnail,
            commands::write_asset,
            commands::read_asset,
            commands::storage_info,
            commands::set_storage_dir,
            commands::reset_storage_dir,
            commands::open_storage_dir,
            commands::read_file_base64,
            commands::read_file_text,
            commands::write_file_base64,
        ])
        .run(tauri::generate_context!())
        .expect("启动 Whiteboard 失败");
}
