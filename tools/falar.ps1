# falar.ps1 - le um arquivo de TEXTO e gera a versao FALADA em WAV (pt-BR).
#
# Por que existe: cada checkpoint entrega uma peca visual; esta e a mesma entrega para o OUVIDO.
# A tecnica e a mesma de `tools/make-voice-fixtures.ps1`, trazida do CopilotSpeaker (MAIA):
# TTS local do Windows (SAPI), voz pt-BR, offline e deterministico - o mesmo texto gera o mesmo
# audio, sem chave, sem rede e sem mandar o conteudo do TCC para fora da maquina.
#
# ASCII only no script (regra do repo: PS 5.1 le -File como ANSI). O TEXTO lido e UTF-8.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File tools/falar.ps1 -In openspec/apresentacoes/x.falado.md
#   ... -Out artifacts/falado/x.wav -Rate 1 -Hz 22050
#
# -Rate: -10 (bem devagar) a 10 (bem rapido). 0 e o natural do SAPI; 1 soa menos arrastado.

param(
    [Parameter(Mandatory = $true)][string]$In,
    [string]$Out = '',
    [int]$Rate = 1,
    [int]$Hz = 22050,
    [string]$Voz = ''
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech

$repoRoot = Split-Path -Parent $PSScriptRoot
$inPath = if ([System.IO.Path]::IsPathRooted($In)) { $In } else { Join-Path $repoRoot $In }
if (-not (Test-Path $inPath)) { throw "Texto nao encontrado: $inPath" }

if (-not $Out) {
    $nome = [System.IO.Path]::GetFileNameWithoutExtension($inPath) -replace '\.falado$', ''
    $Out = "artifacts/falado/$nome.wav"
}
$outPath = if ([System.IO.Path]::IsPathRooted($Out)) { $Out } else { Join-Path $repoRoot $Out }
New-Item -ItemType Directory -Force (Split-Path -Parent $outPath) | Out-Null

# UTF-8 explicito: Get-Content assume ANSI no Windows e come acento (regra do repo).
$texto = [System.IO.File]::ReadAllText($inPath, [System.Text.Encoding]::UTF8)

# O leitor fala PROSA, nao marcacao. Tira o que e so para o olho.
$texto = $texto -replace '(?m)^\s{0,3}#{1,6}\s*', ''      # titulos
$texto = $texto -replace '(?m)^\s*[-*]\s+', ''            # marcadores de lista
$texto = $texto -replace '(?m)^\s*>\s?', ''               # citacao
$texto = $texto -replace '\*\*([^*]+)\*\*', '$1'          # negrito
$texto = $texto -replace '\*([^*]+)\*', '$1'              # italico
$texto = $texto -replace '`([^`]+)`', '$1'                # codigo
$texto = $texto -replace '\[([^\]]+)\]\([^)]+\)', '$1'    # link
$texto = $texto -replace [char]0x2014, ','                # travessao vira pausa
$texto = $texto -replace [char]0x2013, ','
$texto = $texto -replace [char]0x00A0, ' '                # espaco duro
$texto = $texto -replace '(?m)^\s+', ''
$texto = $texto.Trim()
if (-not $texto) { throw 'O texto ficou vazio depois de tirar a marcacao.' }

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$vozes = $synth.GetInstalledVoices() | Where-Object { $_.Enabled }
$escolhida = if ($Voz) {
    $vozes | Where-Object { $_.VoiceInfo.Name -like "*$Voz*" } | Select-Object -First 1
} else {
    $vozes | Where-Object { $_.VoiceInfo.Culture.Name -eq 'pt-BR' } | Select-Object -First 1
}
if (-not $escolhida) {
    $nomes = ($vozes | ForEach-Object { $_.VoiceInfo.Name }) -join ', '
    throw "Nenhuma voz pt-BR instalada (disponiveis: $nomes). Configuracoes > Hora e idioma > Voz."
}
$synth.SelectVoice($escolhida.VoiceInfo.Name)
$synth.Rate = $Rate

$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
    $Hz, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
    [System.Speech.AudioFormat.AudioChannel]::Mono)
$synth.SetOutputToWaveFile($outPath, $fmt)
$synth.Speak($texto)
$synth.SetOutputToNull()
$synth.Dispose()

$bytes = (Get-Item $outPath).Length
$segundos = [math]::Round(($bytes - 44) / ($Hz * 2.0), 0)
$palavras = ($texto -split '\s+').Count
Write-Output ("VOZ: {0}" -f $escolhida.VoiceInfo.Name)
Write-Output ("PALAVRAS: {0}" -f $palavras)
Write-Output ("DURACAO: {0}s  ({1} KB)" -f $segundos, [math]::Round($bytes / 1KB, 0))
Write-Output ("WAV: {0}" -f $outPath)
