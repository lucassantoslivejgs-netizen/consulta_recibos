<#
.SYNOPSIS
    Registra a sincronização diária de recibos no Agendador de Tarefas do Windows.

.DESCRIPTION
    Cria (ou substitui) uma tarefa agendada que roda "python run_sync.py" todo dia
    às 07:00, com a opção de executar assim que possível caso o horário agendado
    tenha sido perdido (máquina desligada, etc.).

    Rode este script manualmente, com PowerShell como Administrador, depois de
    validar que "python run_sync.py" funciona corretamente na máquina de produção.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\agendar_tarefa.ps1
#>

$ErrorActionPreference = 'Stop'

$NomeTarefa = 'ConsultaRecibos-Sincronizacao'
$RaizProjeto = Split-Path -Parent $PSScriptRoot
$ScriptSync = Join-Path $RaizProjeto 'run_sync.py'
$Python = (Get-Command python).Source

if (-not (Test-Path $ScriptSync)) {
    throw "run_sync.py não encontrado em $ScriptSync"
}

$Acao = New-ScheduledTaskAction -Execute $Python -Argument "`"$ScriptSync`"" -WorkingDirectory $RaizProjeto
$Gatilho = New-ScheduledTaskTrigger -Daily -At 07:00
$Config = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopOnIdleEnd `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask `
    -TaskName $NomeTarefa `
    -Action $Acao `
    -Trigger $Gatilho `
    -Settings $Config `
    -Description 'Sincroniza os recibos de clientes das planilhas FLUXO DE CAIXA com o SQLite usado pela tela de consulta.' `
    -Force

Write-Host "Tarefa '$NomeTarefa' registrada. Rodará diariamente às 07:00 (com 'executar assim que possível' habilitado)."
Write-Host "Para testar agora: Start-ScheduledTask -TaskName '$NomeTarefa'"
