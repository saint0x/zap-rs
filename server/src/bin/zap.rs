//! Zap HTTP Server - High-Performance Rust-Based Server
//!
//! Ultra-fast HTTP server with SIMD optimizations and Unix socket IPC
//! for TypeScript handler invocation.

use clap::Parser;
use std::path::PathBuf;
use tokio::signal;
use tracing::{error, info};
use tracing_subscriber::EnvFilter;

use zap_server::config::ZapConfig;
use zap_server::error::ZapResult;
use zap_server::Zap;

#[derive(Parser, Debug)]
#[command(name = "Zap")]
#[command(version = "1.0.0")]
#[command(about = "Ultra-fast HTTP server for Node.js/Bun", long_about = None)]
struct Args {
    /// Path to JSON configuration file
    #[arg(short, long)]
    config: PathBuf,

    /// Override HTTP server port
    #[arg(short, long)]
    port: Option<u16>,

    /// Override HTTP server hostname
    #[arg(long)]
    hostname: Option<String>,

    /// Unix socket path for IPC with TypeScript wrapper
    #[arg(short, long)]
    socket: Option<String>,

    /// Log level (trace, debug, info, warn, error)
    #[arg(long, default_value = "info")]
    log_level: String,
}

#[tokio::main]
async fn main() -> ZapResult<()> {
    let args = Args::parse();

    // Initialize logging
    init_logging(&args.log_level)?;

    info!("🚀 Starting Zap HTTP server v1.0.0");

    // Load configuration from JSON file
    let mut config = ZapConfig::from_file(args.config.to_str().unwrap())?;

    info!(
        "📋 Configuration loaded from {}",
        args.config.display()
    );

    // Apply CLI argument overrides
    if let Some(port) = args.port {
        info!("⚙️  Overriding port: {}", port);
        config.port = port;
    }
    if let Some(hostname) = args.hostname {
        info!("⚙️  Overriding hostname: {}", hostname);
        config.hostname = hostname;
    }
    if let Some(socket) = args.socket {
        info!("⚙️  Overriding IPC socket: {}", socket);
        config.ipc_socket_path = socket;
    }

    // Validate configuration
    config.validate().await?;

    info!(
        "📡 Server will listen on http://{}:{}",
        config.hostname, config.port
    );
    info!("🔌 IPC socket: {}", config.ipc_socket_path);
    info!("📊 Routes: {}", config.routes.len());
    info!("📁 Static files: {}", config.static_files.len());

    // Create and start the server
    let app = Zap::from_config(config).await?;

    info!("✅ Zap server initialized successfully");

    // Run the server (blocks until signal)
    // Note: listen() takes ownership and runs indefinitely
    tokio::select! {
        result = app.listen() => {
            if let Err(e) = result {
                error!("Server error: {}", e);
                return Err(e.into());
            }
        }
        _ = setup_signal_handlers() => {
            info!("📛 Received shutdown signal");
        }
    }

    info!("👋 Zap server shut down successfully");
    Ok(())
}

/// Initialize structured logging with configurable level
fn init_logging(level: &str) -> ZapResult<()> {
    let env_filter = level.parse::<EnvFilter>().map_err(|e| {
        zap_server::error::ZapError::Config(format!(
            "Invalid log level '{}': {}",
            level, e
        ))
    })?;

    tracing_subscriber::fmt()
        .with_env_filter(env_filter)
        .with_target(true)
        .with_file(true)
        .with_line_number(true)
        .with_ansi(true)
        .init();

    Ok(())
}

/// Setup Unix signal handlers for graceful shutdown
async fn setup_signal_handlers() {
    #[cfg(unix)]
    {
        let mut sigterm = signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("Failed to setup SIGTERM handler");
        let mut sigint = signal::unix::signal(signal::unix::SignalKind::interrupt())
            .expect("Failed to setup SIGINT handler");

        tokio::select! {
            _ = sigterm.recv() => {
                info!("Received SIGTERM signal");
            }
            _ = sigint.recv() => {
                info!("Received SIGINT signal");
            }
            _ = signal::ctrl_c() => {
                info!("Received Ctrl+C");
            }
        }
    }

    #[cfg(not(unix))]
    {
        let _ = signal::ctrl_c().await;
        info!("Received Ctrl+C");
    }
}
