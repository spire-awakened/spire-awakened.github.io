$path = 'c:\Users\thoma\Documents\DevOps\spireHelper\wwwroot\images\cards\ironclad_card_descriptions.json'
$json = Get-Content -Raw -Path $path | ConvertFrom-Json

function Normalize-Title([string]$s) {
    if (-not $s) { return '' }
    $x = $s -replace ' \(Ironclad\)', ''
    $x = $x -replace '[“”]', '"'
    $x = $x -replace '[’]', "'"
    return $x.Trim()
}

$score = @{ 'S' = 6; 'A' = 5; 'B' = 4; 'C' = 3; 'D' = 2; 'F' = 1 }

$nat = @{
    'Offering'='S'; 'Feed'='S'; 'Hellraiser'='S'; 'Corruption'='S'; 'Bloodletting'='S'; 'Forgotten Ritual'='S';
    'Thrash'='A'; 'Fiend Fire'='A'; 'Second Wind'='A'; 'Expect a Fight'='A'; 'Conflagration'='A'; 'Battle Trance'='A'; 'Pommel Strike'='A'; 'Stomp'='A'; 'Shrug It Off'='A'; 'Armaments'='A'; 'Demonic Shield'='A'; 'Cascade'='A'; 'Tear Asunder'='A'; 'Demon Form'='A'; 'Crimson Mantle'='A';
    'Brand'='B'; 'Feel No Pain'='B'; 'Break'='B'; 'Whirlwind'='B'; 'Fight Me!'='B'; 'Rupture'='B'; 'Stampede'='B'; 'Evil Eye'='B'; 'Flame Barrier'='B'; 'Uppercut'='B'; 'True Grit'='B'; 'Body Slam'='B'; 'Dismantle'='B'; 'Burning Pact'='B'; "Pact's End"='B'; 'Howl from Beyond'='B'; 'Impervious'='B'; 'Mangle'='B'; 'Bludgeon'='B'; 'Unmovable'='B'; 'Inferno'='B';
    'Primal Force'='C'; 'Barricade'='C'; 'Headbutt'='C'; 'Juggernaut'='C'; 'Cruelty'='C'; 'Rampage'='C'; 'Inflame'='C'; 'Spite'='C'; 'Pyre'='C'; 'Aggression'='C'; 'Colossus'='C'; 'Taunt'='C'; 'Breakthrough'='C'; 'Ashen Strike'='C'; 'Stoke'='C'; 'One-Two Punch'='C'; 'Molten Fist'='C'; 'Infernal Blade'='C'; 'Rage'='C'; 'Unrelenting'='C'; 'Grapple'='C'; 'Anger'='C'; 'Hemokinesis'='C'; 'Setup Strike'='C'; 'Twin Strike'='C'; 'Perfected Strike'='C'; 'Dark Embrace'='C'; 'Dominate'='C'; 'Pillage'='C'; 'Sword Boomerang'='C'; 'Blood Wall'='C';
    'Tank'='D'; 'Cinder'='D'; 'Thunderclap'='D'; 'Stone Armor'='D'; 'Iron Wave'='D'; 'Bully'='D'; 'Vicious'='D'; 'Bash'='D'; 'Juggling'='D'; 'Tremble'='D';
    'Havoc'='F'; 'Drum of Battle'='F'
}

$lvl = @{
    'Offering'='S'; 'Spite'='S'; 'Stoke'='S'; 'Pillage'='S'; 'Pommel Strike'='S'; 'Bloodletting'='S'; 'Expect a Fight'='S';
    'Burning Pact'='A'; 'Fiend Fire'='A'; 'Dark Embrace'='A'; 'Vicious'='A'; 'Brand'='A'; 'Shrug It Off'='A'; 'Forgotten Ritual'='A'; 'Impervious'='A'; 'Pyre'='A'; 'Taunt'='A'; 'Colossus'='A'; 'Rage'='A'; 'Feed'='A'; 'Hellraiser'='A'; 'Stomp'='A'; 'Thunderclap'='A';
    'Battle Trance'='B'; 'Break'='B'; 'Breakthrough'='B'; 'True Grit'='B'; 'Feel No Pain'='B'; 'Second Wind'='B'; 'Stampede'='B'; 'Thrash'='B'; 'Unmovable'='B'; 'Unrelenting'='B'; 'Corruption'='B'; 'Headbutt'='B'; 'Primal Force'='B'; 'Uppercut'='B'; 'Anger'='B'; 'Crimson Mantle'='B'; 'Demon Form'='B'; 'Dismantle'='B'; 'Flame Barrier'='B'; "Pact's End"='B'; 'Rampage'='B'; 'Tank'='B'; 'Bludgeon'='B'; 'Hemokinesis'='B'; 'Rupture'='B'; 'Bash'='B'; 'Bully'='B'; 'Cruelty'='B'; 'Mangle'='B'; 'Molten Fist'='B'; 'Whirlwind'='B'; 'Twin Strike'='B'; 'Barricade'='B'; 'Inflame'='B'; 'Armaments'='B'; 'Grapple'='B'; 'Inferno'='B'; 'Iron Wave'='B'; 'Setup Strike'='B';
    'Aggression'='C'; 'Ashen Strike'='C'; 'Juggernaut'='C'; 'Stone Armor'='C'; 'Tear Asunder'='C'; 'Blood Wall'='C'; 'Cascade'='C'; 'Evil Eye'='C'; 'Perfected Strike'='C'; 'Dominate'='C'; 'Sword Boomerang'='C'; 'Conflagration'='C'; 'Defend'='C'; 'Demonic Shield'='C'; 'Drum of Battle'='C'; 'One-Two Punch'='C'; 'Tremble'='C'; 'Fight Me!'='C'; 'Body Slam'='C'; 'Cinder'='C'; 'Havoc'='C'; 'Infernal Blade'='C'; 'Juggling'='C'; 'Howl from Beyond'='C';
    'Strike'='D'
}

$sts = @{
    'Demon Form'='S'; 'Barricade'='S'; 'Corruption'='S'; 'Dark Embrace'='S'; 'Feel No Pain'='S'; 'Whirlwind'='S'; 'Body Slam'='S';
    'Inflame'='A'; 'Offering'='A'; 'Impervious'='A'; 'Juggernaut'='A'; 'Rupture'='A'; 'Inferno'='A'; 'Twin Strike'='A'; 'Aggression'='A'; 'Ashen Strike'='A'; 'Cruelty'='A'; 'Perfected Strike'='A';
    'Shrug It Off'='B'; 'True Grit'='B'; 'Flame Barrier'='B'; 'Hellraiser'='B'; 'Bash'='B'; 'Brand'='B'; 'Entrench'='B'; 'Blood Wall'='B'; 'Pommel Strike'='B';
    'Bloodletting'='C'; 'Hemokinesis'='C'; 'Thunderclap'='C';
    'Strike'='D'; 'Defend'='D'; 'Rampage'='D'
}

function TierFromAverage([double]$value) {
    if ($value -ge 5.5) { return 'S' }
    if ($value -ge 4.5) { return 'A' }
    if ($value -ge 3.5) { return 'B' }
    if ($value -ge 2.5) { return 'C' }
    if ($value -ge 1.5) { return 'D' }
    return 'F'
}

foreach ($prop in $json.PSObject.Properties) {
    $card = $prop.Value
    $title = Normalize-Title $card.title
    $vals = @()

    if ($nat.ContainsKey($title)) { $vals += $score[$nat[$title]] }
    if ($lvl.ContainsKey($title)) { $vals += $score[$lvl[$title]] }
    if ($sts.ContainsKey($title)) { $vals += $score[$sts[$title]] }

    if ($vals.Count -eq 0) {
        $card.tier = 'U'
        continue
    }

    $avg = ($vals | Measure-Object -Average).Average
    $card.tier = TierFromAverage $avg
}

($json | ConvertTo-Json -Depth 8) | Set-Content -Path $path

$cards = @($json.PSObject.Properties.Value)
$distribution = $cards | Group-Object tier | Sort-Object Name | ForEach-Object { "{0}={1}" -f $_.Name, $_.Count }
Write-Output ("Tier distribution: " + ($distribution -join '; '))
