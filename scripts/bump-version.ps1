# Usage: .\scripts\bump-version.ps1 [patch|minor|major]
# Bumps root package.json version, stages it. Call before committing.
param([string]$bump = "patch")

$pkgPath = Join-Path $PSScriptRoot "..\package.json"
$pkg = Get-Content $pkgPath | ConvertFrom-Json
$parts = $pkg.version -split "\."
$major = [int]$parts[0]; $minor = [int]$parts[1]; $patch = [int]$parts[2]

$newVersion = switch ($bump) {
  "major" { "$($major+1).0.0" }
  "minor" { "$major.$($minor+1).0" }
  default { "$major.$minor.$($patch+1)" }
}

$pkg.version = $newVersion
$pkg | ConvertTo-Json -Depth 10 | Set-Content $pkgPath -Encoding UTF8
Write-Host "Version bumped: $($parts -join '.') → $newVersion"
$newVersion
