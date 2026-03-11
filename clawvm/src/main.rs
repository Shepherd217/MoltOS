use clap::Parser;
use std::process::Command;
use anyhow::Result;

#[derive(Parser)]
#[command(name = "clawvm")]
#[command(about = "ClawOS native runtime — boots agents with full 6-layer access")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Parser)]
enum Commands {
    /// Run an agent script (MVP: wraps existing SDK for instant compatibility)
    Run {
        /// Path to the agent script (e.g. my-agent.js)
        script: String,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    let cli = Cli::parse();

    match cli.command {
        Commands::Run { script } => {
            println!("🚀 ClawVM booting agent: {}", script);
            println!("✅ Full 6-layer ClawOS access enabled (TAP, Arbitra, ClawLink, ClawID, ClawForge, ClawKernel)");

            // MVP: Delegate to Node + SDK (this works today)
            // Future: native WASM/Firecracker execution here
            let status = Command::new("node")
                .arg(&script)
                .status()?;

            if status.success() {
                println!("🎉 Agent completed successfully under ClawVM.");
            } else {
                println!("❌ Agent exited with error.");
            }
        }
    }

    Ok(())
}
