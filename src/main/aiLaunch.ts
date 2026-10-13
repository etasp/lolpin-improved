import { shell } from 'electron';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { AI_TARGETS, type AiTarget } from '../shared/aiTargets';

// Windows can accept a deep link while keeping the requesting app in front.
// Restore and activate only the Codex desktop window; never send keystrokes.
const CODEX_FOCUS = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class PingAiFocus {
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, IntPtr process);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool attach);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool ShowWindowAsync(IntPtr hwnd, int command);
    [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hwnd);
    public static bool Raise(IntPtr hwnd) {
        uint current=GetCurrentThreadId(), foreground=GetWindowThreadProcessId(GetForegroundWindow(),IntPtr.Zero);
        bool attached=current!=foreground && AttachThreadInput(current,foreground,true);
        try {
            if(IsIconic(hwnd)) ShowWindowAsync(hwnd,9);
            BringWindowToTop(hwnd); SetForegroundWindow(hwnd);
            return GetForegroundWindow()==hwnd;
        } finally { if(attached) AttachThreadInput(current,foreground,false); }
    }
}
'@
for ($attempt=0; $attempt -lt 10; $attempt++) {
    $target = Get-Process -Name codex,ChatGPT -ErrorAction SilentlyContinue | Where-Object {
        $_.MainWindowHandle -ne 0 -and ($_.ProcessName -eq 'codex' -or $_.Path -like '*\OpenAI.Codex_*\*' -or $_.Path -like '*\Codex\*')
    } | Select-Object -First 1
    if ($target -and [PingAiFocus]::Raise($target.MainWindowHandle)) { 'True'; exit 0 }
    Start-Sleep -Milliseconds 200
}
'False'
`;

export async function openAi(target: AiTarget): Promise<void> {
  await shell.openExternal(AI_TARGETS[target].url);
  if (target !== 'codex' || process.platform !== 'win32') return;
  const powershell = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const focused = await new Promise<string>((resolve, reject) => {
    execFile(powershell, ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', CODEX_FOCUS],
      { windowsHide: true, timeout: 8000 }, (error, stdout) => error ? reject(error) : resolve(stdout));
  });
  if (focused.trim() !== 'True') throw new Error('Codex window could not be activated');
}
