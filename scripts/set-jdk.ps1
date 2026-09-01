<#
Auto-set JAVA_HOME for this project.
- Tries to locate Microsoft OpenJDK 17 under `C:\Program Files\Microsoft\jdk-17*`.
- Falls back to Android Studio JBR if found.
- Attempts to set Machine environment variables (requires admin); on failure, sets User and the current session.
- Usage: run from repo root: `powershell -ExecutionPolicy Bypass -File .\scripts\set-jdk.ps1` or pass Gradle tasks as args to forward to gradlew.
#>

param(
    [Parameter(ValueFromRemainingArguments=$true)]
    [String[]]
    $ForwardArgs
)

function Set-EnvMachineOrUser {
    param($name, $value)
    try {
        [Environment]::SetEnvironmentVariable($name, $value, 'Machine')
        Write-Host "Set system (Machine) environment variable $name=$value" -ForegroundColor Green
        return 'Machine'
    } catch {
        try {
            [Environment]::SetEnvironmentVariable($name, $value, 'User')
            Write-Host "Unable to set Machine env (no admin). Set user environment variable $name=$value" -ForegroundColor Yellow
            return 'User'
        } catch {
            Write-Host "Failed to set $name in Machine or User scope: $_" -ForegroundColor Red
            return $null
        }
    }
}

# 1) Try Microsoft JDK 17
$msJdk = Get-ChildItem 'C:\Program Files\Microsoft' -Filter 'jdk-17*' -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
if ($msJdk) { $jdkPath = $msJdk.FullName } else {
    # 2) Try Android Studio bundled JBR
    $jbrPath = 'C:\Program Files\Android\Android Studio\jbr'
    if (Test-Path $jbrPath) { $jdkPath = $jbrPath }
}

if (-not $jdkPath) {
    Write-Host "Could not find a suitable JDK automatically. Please set JAVA_HOME manually." -ForegroundColor Red
    exit 1
}

Write-Host "Using JDK: $jdkPath" -ForegroundColor Cyan

# Attempt to set system/user env; falls back to setting in-process only
$scope = Set-EnvMachineOrUser -name 'JAVA_HOME' -value $jdkPath
if ($scope) {
    # Ensure PATH contains the bin entry at chosen scope if possible (only do Machine/User changes above)
    if ($scope -in 'Machine','User') {
        try {
            $oldPath = [Environment]::GetEnvironmentVariable('Path', $scope)
            $bin = Join-Path $jdkPath 'bin'
            if ($oldPath -notlike "*${bin}*") {
                $newPath = "$oldPath;$bin"
                [Environment]::SetEnvironmentVariable('Path', $newPath, $scope)
                Write-Host "Added $bin to $scope Path" -ForegroundColor Green
            } else {
                Write-Host "$bin already present in $scope Path" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "Failed to update $scope Path: $_" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "Falling back to setting environment for this session only." -ForegroundColor Yellow
}

# Set current session vars so the script immediately affects this terminal
$env:JAVA_HOME = $jdkPath
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

Write-Host "JAVA_HOME is currently: $env:JAVA_HOME" -ForegroundColor Cyan
java -version

# If forward args provided, run gradlew with them
if ($ForwardArgs -and $ForwardArgs.Length -gt 0) {
    Write-Host "Forwarding args to gradlew: $ForwardArgs" -ForegroundColor Cyan
    Push-Location (Join-Path $PSScriptRoot '..')
    try {
        & .\android\gradlew.bat @ForwardArgs
    } finally {
        Pop-Location
    }
}
