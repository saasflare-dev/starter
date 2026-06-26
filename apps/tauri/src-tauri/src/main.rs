// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    include_image,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;

const TRAY_ID: &str = "main-tray";
const APP_NAME: &str = "Saasflare Desktop";

fn show_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Tray badge: on macOS the count renders as text next to the icon. Call from
/// the frontend with `invoke('set_badge', { count })`. Generic example of
/// driving the tray from app state (unread items, pending jobs, …).
#[tauri::command]
fn set_badge(app: tauri::AppHandle, count: i64) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        // macOS keeps the previous menu-bar title when passed `None`, leaving a
        // stale count next to the icon. Clear it with an empty string instead.
        let title = if count > 0 {
            count.to_string()
        } else {
            String::new()
        };
        let _ = tray.set_title(Some(title));
        let tooltip = if count > 0 {
            format!("{APP_NAME} — {count}")
        } else {
            APP_NAME.to_string()
        };
        let _ = tray.set_tooltip(Some(tooltip));
    }
}

fn main() {
    // Register single-instance first: a second launch is forwarded to this
    // instance (which focuses the existing window) instead of starting a new one.
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main(app);
        }))
        .plugin(tauri_plugin_notification::init())
        // Auto-start at login. The frontend toggles it via the JS plugin; here
        // we only register it (LaunchAgent on macOS, registry/desktop entry
        // elsewhere). No extra launch args.
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ));

    // Auto-updater: only in release builds — the plugin requires a
    // `plugins.updater` config (endpoints + pubkey) at init, which dev builds
    // don't ship. In dev the frontend's "Check for updates" reports
    // "not configured". Before a release build, add the config block (see
    // docs/desktop-tauri.md) so this initializes.
    #[cfg(not(debug_assertions))]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .invoke_handler(tauri::generate_handler![set_badge])
        .setup(|app| {
            // Tray: the app is resident; closing the main window only hides it.
            let open = MenuItem::with_id(app, "open", "Open", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;
            // Dedicated tray mark, separate from the app/Dock icon: on macOS a
            // black "template" glyph the system recolors for the light/dark
            // menu bar (and aligns with the badge count); a colored mark
            // elsewhere. Replace both with your brand glyph.
            let is_macos = cfg!(target_os = "macos");
            let tray_icon = if is_macos {
                include_image!("icons/tray-template.png")
            } else {
                include_image!("icons/tray.png")
            };
            TrayIconBuilder::with_id(TRAY_ID)
                .icon(tray_icon)
                .icon_as_template(is_macos)
                .tooltip(APP_NAME)
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Close = hide to tray; the webview keeps running in the background.
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
