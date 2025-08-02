#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod database;
mod voice;
mod terminal;
mod ollama;
mod git;
mod whisper;
mod piper;
mod plugin_system;
mod agents;
mod tools;
mod knowledge;
mod config;
mod state;
mod security;
mod realtime_voice;
mod tool_executor;

use commands::*;
use tauri::Manager;
use std::sync::Arc;

fn main() {
    // Load .env file if it exists
    if let Ok(env_path) = std::env::current_dir() {
        let env_file = env_path.join(".env");
        if env_file.exists() {
            dotenv::from_path(&env_file).ok();
        }
    }
    
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(AppStateManager::default())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_app_state,
            update_settings,
            get_settings,
            send_chat_message,
            chat_completion,
            transcribe_audio,
            read_directory,
            read_file,
            write_file,
            delete_file,
            create_terminal,
            close_terminal,
            start_voice_session,
            stop_voice_session,
            speak_text,
            voice_add_audio_chunk,
            terminal_send_input,
            terminal_resize,
            save_context,
            load_context,
            list_contexts,
            delete_context,
            get_audit_logs,
            get_git_file_status,
            get_git_directory_status,
            get_git_repository_info,
            load_plugin,
            unload_plugin,
            execute_plugin,
            list_plugins,
            create_agent_workflow,
            get_agent_workflow,
            update_agent_workflow,
            list_agent_workflows,
            execute_agent_workflow,
            get_available_agents,
            list_tools,
            get_tool,
            install_tool,
            uninstall_tool,
            execute_tool,
            get_tool_categories,
            search_tools,
            get_knowledge_items,
            get_knowledge_item,
            read_knowledge_content,
            create_knowledge_folder,
            upload_knowledge_file,
            delete_knowledge_item,
            update_knowledge_tags,
            toggle_knowledge_star,
            toggle_knowledge_private,
            vectorize_knowledge_item,
            search_similar_knowledge,
            get_knowledge_storage_info,
            create_realtime_session,
            send_realtime_audio,
            wake_up_realtime_session,
            close_realtime_session,
            get_available_tools
        ])
        .setup(|app| {
            let app_handle = app.handle();
            
            // Get app data directory
            let app_data_dir = match app_handle.path().app_data_dir() {
                Ok(dir) => dir,
                Err(e) => {
                    eprintln!("Failed to get app data directory: {}", e);
                    return Err(format!("Failed to get app data directory: {}", e).into());
                }
            };
            
            // Initialize SQLite database
            let app_data_dir_clone = app_data_dir.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = database::initialize_database(app_data_dir_clone).await {
                    eprintln!("Failed to initialize database: {}", e);
                }
            });
            
            // Initialize voice manager
            let voice_handle = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = voice::initialize_voice_manager(voice_handle).await {
                    eprintln!("Failed to initialize voice manager: {}", e);
                }
            });
            
            // Initialize terminal manager
            let terminal_handle = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = terminal::initialize_terminal_manager(terminal_handle).await {
                    eprintln!("Failed to initialize terminal manager: {}", e);
                }
            });
            
            // Initialize plugin system
            let plugins_dir = app_data_dir.join("plugins");
            tauri::async_runtime::spawn(async move {
                if let Err(e) = plugin_system::initialize_plugin_system(plugins_dir).await {
                    eprintln!("Failed to initialize plugin system: {}", e);
                }
            });
            
            // Initialize agent system
            tauri::async_runtime::spawn(async move {
                if let Err(e) = agents::initialize_agent_system().await {
                    eprintln!("Failed to initialize agent system: {}", e);
                }
            });
            
            // Initialize tools manager
            let tools_dir = app_data_dir.join("tools");
            tauri::async_runtime::spawn(async move {
                if let Err(e) = tools::initialize_tools_manager(tools_dir).await {
                    eprintln!("Failed to initialize tools manager: {}", e);
                }
            });
            
            // Initialize knowledge manager
            let knowledge_dir = app_data_dir.join("knowledge");
            tauri::async_runtime::spawn(async move {
                if let Err(e) = knowledge::initialize_knowledge_manager(knowledge_dir).await {
                    eprintln!("Failed to initialize knowledge manager: {}", e);
                }
            });
            
            // Initialize realtime voice manager
            realtime_voice::init_realtime_manager(app_handle.clone());
            
            // Initialize tool registry with built-in tools
            let allowed_roots = {
                let state_manager = app_handle.state::<AppStateManager>();
                let state = state_manager.state.lock().unwrap();
                state.settings.allowed_roots.clone()
            };
            let security_manager = Arc::new(security::SecurityManager::new());
            tauri::async_runtime::spawn(async move {
                use std::sync::Arc;
                use crate::tool_executor::{FileSystemTool, TerminalTool, MCPBridgeTool};
                
                let registry_result = realtime_voice::with_realtime_manager(|manager| {
                    let registry = manager.tool_registry.clone();
                    Box::pin(async move { Ok(registry) })
                }).await;
                
                if let Ok(registry) = registry_result {
                    // Register built-in tools
                    let fs_tool = Arc::new(FileSystemTool::new(allowed_roots));
                    let term_tool = Arc::new(TerminalTool::new(security_manager));
                    let mcp_tool = Arc::new(MCPBridgeTool::new());
                    
                    registry.register(fs_tool).await;
                    registry.register(term_tool).await;
                    registry.register(mcp_tool).await;
                    
                    println!("Tool registry initialized with {} tools", registry.list().await.len());
                }
            });
            
            // Load settings from database on app startup
            let app_handle_for_settings = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                // Wait a moment for database to initialize
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                
                // Load settings from database
                match crate::database::with_database(|db| {
                    Box::pin(async move {
                        db.get_all_settings().await
                    })
                }).await {
                    Ok(settings_vec) => {
                        let mut api_key_to_set = None;
                        
                        // Update settings from database
                        {
                            let state_manager = app_handle_for_settings.state::<AppStateManager>();
                            if let Ok(mut app_state) = state_manager.state.lock() {
                                for setting in settings_vec {
                                    match setting.key.as_str() {
                                        "voice_enabled" => {
                                            if let Ok(val) = serde_json::from_value::<bool>(setting.value) {
                                                app_state.settings.voice_enabled = val;
                                            }
                                        }
                                        "offline_mode" => {
                                            if let Ok(val) = serde_json::from_value::<bool>(setting.value) {
                                                app_state.settings.offline_mode = val;
                                            }
                                        }
                                        "openai_api_key" => {
                                            if let Ok(val) = serde_json::from_value::<Option<String>>(setting.value) {
                                                app_state.settings.openai_api_key = val.clone();
                                                api_key_to_set = val;
                                            }
                                        }
                                        "openai_model" => {
                                            if let Ok(val) = serde_json::from_value::<String>(setting.value) {
                                                app_state.settings.openai_model = val;
                                            }
                                        }
                                        _ => {}
                                    }
                                }
                                // If no API key from database, check environment
                                if app_state.settings.openai_api_key.is_none() {
                                    if let Some(env_key) = crate::config::get_openai_api_key() {
                                        app_state.settings.openai_api_key = Some(env_key.clone());
                                        api_key_to_set = Some(env_key);
                                    }
                                }
                            };
                        }; // Mutex guard is dropped here
                        
                        // Set API key in voice manager if available
                        if let Some(api_key) = api_key_to_set {
                            let _ = voice::with_voice_manager(|manager| {
                                manager.set_api_key(Some(api_key));
                                Box::pin(async { Ok(()) })
                            }).await;
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to load settings from database: {}", e);
                    }
                }
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}