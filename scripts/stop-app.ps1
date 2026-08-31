# Stops any leftover "electron.exe" process that belongs to this project,
# so a crashed previous run does not lock files (dist\main\index.js, the
# sqlite db, ...) during a fresh install/build.
#
# Scoped by matching the process command line against this project's own
# folder, so it never touches unrelated Electron apps (VS Code, Slack,
# Discord, ...) that happen to also be named electron.exe.
#
# Best effort only: any failure here is swallowed by the caller (install.bat)
# so it never blocks the actual install.

param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectDir
)

$pattern = [Regex]::Escape($ProjectDir.TrimEnd('\'))

Get-CimInstance Win32_Process -Filter "Name = 'electron.exe'" |
    Where-Object { $_.CommandLine -and ($_.CommandLine -match $pattern) } |
    ForEach-Object {
        try {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop
            Write-Host "Stopped a leftover instance of this app (PID $($_.ProcessId))."
        } catch {
            # Ignore - this is a best-effort cleanup step only.
        }
    }
