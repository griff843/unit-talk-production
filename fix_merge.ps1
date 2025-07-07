$content = Get-Content "unit-talk-custom-bot\src\commands\adminCommands.ts"
$filteredContent = $content | Where-Object { $_ -ne "=======" }
$filteredContent | Set-Content "unit-talk-custom-bot\src\commands\adminCommands_fixed.ts"