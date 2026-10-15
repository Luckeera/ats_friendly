param (
    [Parameter(Mandatory=$true)]
    [string]$InputPath,

    [Parameter(Mandatory=$false)]
    [string]$OutputPath,

    [Parameter(Mandatory=$false)]
    [int]$MaxPages = 0
)

# 1. Tenta usar o motor Puppeteer (Node.js) - Muito mais preciso, sem margens indesejadas e com validação de páginas
$NodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($NodeCmd) {
    $ScriptJs = Join-Path $PSScriptRoot "generate_pdf.js"
    $ArgsList = @($ScriptJs, "--input", $InputPath)
    if ($OutputPath) {
        $ArgsList += @("--output", $OutputPath)
    }
    if ($MaxPages -gt 0) {
        $ArgsList += @("--max-pages", $MaxPages)
    }
    
    & node $ArgsList
    exit $LASTEXITCODE
}

# 2. Fallback: Procura Microsoft Edge em múltiplos caminhos do Windows
$PossiblePaths = @(
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
)

$EdgePath = $null
foreach ($p in $PossiblePaths) {
    if (Test-Path $p) {
        $EdgePath = $p
        break
    }
}

if (-not $EdgePath) {
    Write-Error "❌ Nem Node.js nem Microsoft Edge foram encontrados no sistema para gerar o PDF."
    exit 1
}

$AbsInputPath = Resolve-Path $InputPath
if (-not $OutputPath) {
    $OutputPath = [System.IO.Path]::ChangeExtension($AbsInputPath.Path, ".pdf")
}
$AbsOutputPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
$FileUrl = "file:///$($AbsInputPath.Path.Replace('\', '/'))"

Write-Host "Gerando PDF via Edge (Fallback) para: $InputPath"
Write-Host "Destino: $AbsOutputPath"

# Inicia processo do Edge com --headless=new e aguarda término real (-Wait em vez de sleep estático)
$Process = Start-Process -FilePath $EdgePath -ArgumentList @(
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    "--print-to-pdf=$AbsOutputPath",
    $FileUrl
) -PassThru -Wait

if (Test-Path $AbsOutputPath) {
    Write-Host "✅ PDF gerado via Edge fallback!" -ForegroundColor Green
} else {
    Write-Error "❌ Falha ao gerar PDF via Edge."
    exit 1
}
