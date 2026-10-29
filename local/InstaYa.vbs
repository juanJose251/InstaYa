' Abre InstaYa! sin ventana de consola. Uso: wscript InstaYa.vbs [--detener]
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
args = ""
If WScript.Arguments.Count > 0 Then args = " " & WScript.Arguments(0)
CreateObject("WScript.Shell").Run """" & dir & "\node\node.exe"" """ & dir & "\instaya.mjs""" & args, 0, False
