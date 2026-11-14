# NEXTERM one-line installer for Windows.
#
#   PowerShell:      iex ((New-Object Net.WebClient).DownloadString('https://raw.githubusercontent.com/renzoae/nexterm/main/install.ps1'))
#   Command Prompt:  powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; iex ((New-Object Net.WebClient).DownloadString('https://raw.githubusercontent.com/renzoae/nexterm/main/install.ps1'))"
#
# Downloads the latest installer from GitHub Releases, verifies its SHA-256
# checksum, and installs NEXTERM for the current user (no admin rights needed).

& {
    $ErrorActionPreference = 'Stop'
    $ProgressPreference = 'SilentlyContinue'
    $Repo = 'renzoae/nexterm'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    Write-Host "Installing NEXTERM from github.com/$Repo" -ForegroundColor Cyan

    $headers = @{ 'User-Agent' = 'nexterm-installer' }
    $release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest" -Headers $headers
    $asset = $release.assets | Where-Object { $_.name -like 'NEXTERM-Setup-*.exe' } | Select-Object -First 1
    if (-not $asset) { throw "No installer found in release $($release.tag_name)." }

    $dest = Join-Path $env:TEMP $asset.name
    Write-Host "Downloading $($asset.name) ($([math]::Round($asset.size / 1MB, 1)) MB)..."
    Invoke-WebRequest $asset.browser_download_url -OutFile $dest -UseBasicParsing -Headers $headers

    $sums = $release.assets | Where-Object { $_.name -eq 'SHA256SUMS.txt' } | Select-Object -First 1
    if ($sums) {
        $text = (Invoke-WebRequest $sums.browser_download_url -UseBasicParsing -Headers $headers).Content
        if ($text -is [byte[]]) { $text = [Text.Encoding]::ASCII.GetString($text) }
        $line = ($text -split "`r?`n") | Where-Object { $_ -match [regex]::Escape($asset.name) } | Select-Object -First 1
        $expected = ($line -split '\s+')[0]
        $actual = (Get-FileHash $dest -Algorithm SHA256).Hash
        if (-not $expected -or $expected -ne $actual) {
            Remove-Item $dest -Force
            throw 'Checksum mismatch: the download was deleted and nothing was installed.'
        }
        Write-Host 'Checksum verified.' -ForegroundColor Green
    } else {
        Write-Warning 'No SHA256SUMS.txt in this release; skipping checksum verification.'
    }

    Write-Host 'Running installer...'
    $p = Start-Process $dest -ArgumentList '/S' -Wait -PassThru
    Remove-Item $dest -Force -ErrorAction SilentlyContinue
    if ($p.ExitCode -ne 0) { throw "Installer exited with code $($p.ExitCode)." }

    Write-Host "NEXTERM $($release.tag_name) installed. Find it in the Start menu." -ForegroundColor Green
}
