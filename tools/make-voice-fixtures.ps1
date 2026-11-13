# make-voice-fixtures.ps1 - gera WAVs pt-BR para usar como MICROFONE em teste automatizado.
#
# Tecnica trazida do CopilotSpeaker (tools/live-first-m0/make-fixtures.ps1 e
# tools/knowledge-lab/f8-certification/prepare-audio.ps1): TTS local do Windows (SAPI), voz
# pt-BR, 16 kHz / 16 bits / mono - exatamente o formato que o Gemini Live espera na entrada.
# Deterministico e offline: o mesmo texto gera o mesmo WAV, entao a prova e repetivel.
#
# No navegador o WAV entra pela flag --use-file-for-fake-audio-capture do Chromium: o
# getUserMedia passa a devolver ESTE audio. O caminho do microfone roda inteiro (worklet,
# reamostragem, PCM16, base64, socket) - so a fonte e sintetica.
#
# ASCII only (regra do repo: PS 5.1 le -File como ANSI).
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File tools/make-voice-fixtures.ps1
#   powershell -ExecutionPolicy Bypass -File tools/make-voice-fixtures.ps1 -Only gateway

param(
    [string]$OutDir = 'artifacts/voz',
    [string[]]$Only = @()
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech

$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not [System.IO.Path]::IsPathRooted($OutDir)) { $OutDir = Join-Path $repoRoot $OutDir }
New-Item -ItemType Directory -Force $OutDir | Out-Null

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice = $synth.GetInstalledVoices() |
    Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -eq 'pt-BR' } |
    Select-Object -First 1
if (-not $voice) {
    throw 'Nenhuma voz SAPI pt-BR instalada. No Windows: Configuracoes > Hora e idioma > Voz.'
}
$synth.SelectVoice($voice.VoiceInfo.Name)
$synth.Rate = 0

# Perguntas de BPMN de verdade: o que um aluno perguntaria, e o que da para conferir na resposta.
$fixtures = [ordered]@{
    'gateway'     = 'Qual a diferenca entre um gateway exclusivo e um gateway paralelo?'
    'evento'      = 'Para que serve um evento intermediario de temporizador num diagrama BPMN?'
    'raia'        = 'Qual a diferenca entre pool e lane no BPMN?'
    'mensagem'    = 'Quando eu uso fluxo de mensagem em vez de fluxo de sequencia?'
    'curta'       = 'O que e um gateway?'
    # Para provar barge-in: uma pergunta que puxa resposta longa, e o corte por cima.
    'longa'       = 'Me explique com bastante detalhe, sem pressa, todos os tipos de evento do BPMN dois ponto zero e quando usar cada um.'
    'interrompe'  = 'Espera, chega, responde so em uma frase.'
    # Fora do dominio: a instrucao de sistema manda recusar em uma frase.
    'fora'        = 'Qual a receita de bolo de cenoura?'
    # F4: continuidade ao trocar de modo. A pergunta nao diz o assunto - quem tem de
    # saber e o modelo, pelo historico que a sessao nova levou junto.
    'continuidade' = 'Sobre o que a gente estava falando?'
    # Gate 4.3: ferramenta de leitura numa sessao de VOZ. Pedir a ferramenta pelo nome e
    # do ALUNO; quem decide chamar continua sendo o modelo.
    'ferramenta'   = 'Chame a ferramenta descrever diagrama e me diga quantas raias o diagrama tem.'
}

$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
    16000,
    [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
    [System.Speech.AudioFormat.AudioChannel]::Mono)

$manifest = @{}
$gerados = 0
try {
    foreach ($id in $fixtures.Keys) {
        if ($Only.Count -gt 0 -and $Only -notcontains $id) { continue }
        $wav = Join-Path $OutDir "$id.wav"
        $synth.SetOutputToWaveFile($wav, $format)
        $synth.Speak($fixtures[$id])
        $synth.SetOutputToNull()
        $info = Get-Item $wav
        $manifest[$id] = @{
            texto  = $fixtures[$id]
            wav    = "$id.wav"
            bytes  = $info.Length
            sha256 = (Get-FileHash $wav -Algorithm SHA256).Hash
        }
        $gerados++
        Write-Output ("  {0,-12} {1,8} bytes  {2}" -f $id, $info.Length, $fixtures[$id])
    }
} finally {
    $synth.Dispose()
}

$manifestPath = Join-Path $OutDir 'manifest.json'
if (Test-Path $manifestPath -PathType Leaf) {
    $antigo = Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($p in $antigo.PSObject.Properties) {
        if (-not $manifest.ContainsKey($p.Name)) { $manifest[$p.Name] = $p.Value }
    }
}
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 4), $utf8)

Write-Output ''
Write-Output ("RESULT: OK {0} WAV pt-BR em {1} (voz: {2})" -f $gerados, $OutDir, $voice.VoiceInfo.Name)
Write-Output 'Use: node tools/drive-assistant.mjs --mic artifacts/voz/gateway.wav'
