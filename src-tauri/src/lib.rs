mod commands;
mod error;
mod storage;

use tauri::Manager;

/// 桌面端运行入口：注册存储状态、系统对话框插件与全部 IPC 命令
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // 白板数据统一落在应用数据目录（Windows: %APPDATA%\<identifier>）
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
            commands::read_file_base64,
            commands::read_file_text,
            commands::write_file_base64,
        ])
        .run(tauri::generate_context!())
        .expect("启动 Whiteboard 失败");
}
