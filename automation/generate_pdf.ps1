param (
    [Parameter(Mandatory=$true)]
    [string]$InputPath,

    [Parameter(Mandatory=$true)]
    [string]$OutputPath
)

$EdgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

if (-not (Test-Path $EdgePath)) {
    Write-Error "Microsoft Edge não encontrado em $EdgePath"
    exit 1
}

$AbsInputPath = Resolve-Path $InputPath
$AbsOutputPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
$FileUrl = "file:///$($AbsInputPath.Path.Replace('\', '/'))"

Write-Host "Gerando PDF para: $InputPath"
Write-Host "Destino: $AbsOutputPath"

$Process = Start-Process -FilePath $EdgePath -ArgumentList @(
    "--headless",
    "--disable-gpu",
    "--no-pdf-header-footer",
    "--print-to-pdf=$AbsOutputPath",
    $FileUrl
) -PassThru

# Aguarda a conclusão (Edge headless geralmente fecha rápido após imprimir)
Start-Sleep -Seconds 3

if (Test-Path $AbsOutputPath) {
    Write-Host "✅ PDF gerado com sucesso!" -ForegroundColor Green
} else {
    Write-Error "❌ Falha ao gerar PDF."
}
