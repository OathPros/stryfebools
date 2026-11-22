# Run from PowerShell: powershell -ExecutionPolicy Bypass -File .\install-fonts.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dest = Join-Path $root 'assets\fonts'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$files = @(
  @{ Name='PirataOne-Regular.ttf'; Url='https://raw.githubusercontent.com/google/fonts/main/ofl/pirataone/PirataOne-Regular.ttf' },
  @{ Name='Archivo-Variable.ttf'; Url='https://raw.githubusercontent.com/google/fonts/main/ofl/archivo/Archivo%5Bwdth%2Cwght%5D.ttf' }
)
foreach ($f in $files) {
  $out = Join-Path $dest $f.Name
  Write-Host "Downloading $($f.Name)..."
  Invoke-WebRequest -Uri $f.Url -OutFile $out -MaximumRedirection 5
  if ((Get-Item $out).Length -lt 10000) { throw "Downloaded file too small: $out" }
}
$licenses = @(
  @{ Name='OFL-Pirata-One.txt'; Url='https://raw.githubusercontent.com/google/fonts/main/ofl/pirataone/OFL.txt' },
  @{ Name='OFL-Archivo.txt'; Url='https://raw.githubusercontent.com/google/fonts/main/ofl/archivo/OFL.txt' }
)
foreach ($f in $licenses) { Invoke-WebRequest -Uri $f.Url -OutFile (Join-Path $root ('licenses\'+$f.Name)) }
Write-Host 'Done: font files and licenses are installed.' -ForegroundColor Green
