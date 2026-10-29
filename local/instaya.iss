; Instalador de InstaYa! para Windows (Inno Setup 6). Lo compila local\empaquetar.mjs.
#ifndef Version
  #define Version "1.0.0"
#endif

[Setup]
AppId={{8C1B5E2A-4F7D-4E1B-9A63-1D2B3C4E5F60}
AppName=InstaYa!
AppVersion={#Version}
AppPublisher=InstaYa!
DefaultDirName={localappdata}\Programs\InstaYa
DefaultGroupName=InstaYa!
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=salida
OutputBaseFilename=InstaYa-Setup-{#Version}
SetupIconFile=instaya.ico
UninstallDisplayIcon={app}\instaya.ico
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
CloseApplications=no

[Languages]
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "escritorio"; Description: "Crear un acceso directo en el escritorio"
Name: "inicio"; Description: "Abrir InstaYa! al encender la computadora"; Flags: unchecked

[Files]
Source: "salida\InstaYa\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\InstaYa!"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\InstaYa.vbs"""; IconFilename: "{app}\instaya.ico"
Name: "{group}\Detener InstaYa!"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\InstaYa.vbs"" --detener"; IconFilename: "{app}\instaya.ico"
Name: "{autodesktop}\InstaYa!"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\InstaYa.vbs"""; IconFilename: "{app}\instaya.ico"; Tasks: escritorio
Name: "{userstartup}\InstaYa!"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\InstaYa.vbs"""; IconFilename: "{app}\instaya.ico"; Tasks: inicio

[Run]
Filename: "{sys}\wscript.exe"; Parameters: """{app}\InstaYa.vbs"""; Description: "Abrir InstaYa! ahora"; Flags: postinstall nowait skipifsilent

[UninstallRun]
; Antes de borrar archivos se detienen la app y PostgreSQL. Los datos en %LOCALAPPDATA%\InstaYa se conservan.
Filename: "{app}\node\node.exe"; Parameters: """{app}\instaya.mjs"" --detener"; Flags: runhidden waituntilterminated; RunOnceId: "Detener"

[Code]
// Al actualizar sobre una instalación abierta, se detiene primero para poder reemplazar los archivos.
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Codigo: Integer;
begin
  if FileExists(ExpandConstant('{app}\node\node.exe')) then
    Exec(ExpandConstant('{app}\node\node.exe'), '"' + ExpandConstant('{app}\instaya.mjs') + '" --detener', '', SW_HIDE, ewWaitUntilTerminated, Codigo);
  Result := '';
end;
