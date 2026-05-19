param([string]$Command = "help")

$compose = "docker compose -f docker-compose.dev.yml"

switch ($Command) {
    "dev"   { Invoke-Expression "$compose up --build" }
    "up"    { Invoke-Expression "$compose up" }
    "down"  { Invoke-Expression "$compose down" }
    "logs"  { Invoke-Expression "$compose logs -f" }
    "reset" { Invoke-Expression "$compose down -v" }
    default {
        Write-Host "Usage: .\noodle.ps1 <command>"
        Write-Host ""
        Write-Host "  dev    Start all services with rebuild (hot reload)"
        Write-Host "  up     Start without rebuild"
        Write-Host "  down   Stop all services"
        Write-Host "  logs   Tail logs from all services"
        Write-Host "  reset  Stop and delete all volumes (clean DB)"
    }
}
