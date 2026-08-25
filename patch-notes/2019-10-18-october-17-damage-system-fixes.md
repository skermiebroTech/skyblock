---
title: "[October 17] Damage system fixes"
date: 2019-10-18T00:02:11-0400
author: Minikloon
source: https://hypixel.net/threads/october-17-damage-system-fixes.2390042/
---

# [October 17] Damage system fixes

Hello.  
  
Last Tuesday we rolled a patch to fix a bug with Revenant & Tarantula armor's Bulwark effect not applying their defense bonus against boss abilities. The patch had the side effect of crashing servers and everything catching on fire.  
  
We now have a resolution for the initial bug and we picked up a few goodies along the way.  
  
**Bugfixes**  


  * Damage/stat modifiers now correctly apply against enemy abilities. This includes Revenant/Tarantula Bulwark, but also _many_ other things._For example, did you know Resistance potion's defense bonus didn't work against Pestilence?_
  * Spiked Hook was dealing +250% damage instead of +25%
  * Cleave Enchant was only dealing 3% damage regardless of level, now properly does 15%. Also, it was sort of dealing random damage, now it should hit properly for 15% damage at rank V.
  * Fixed Leaping Sword multiplying the player's crit damage stat by 1.25 instead of adding +25%.

**Changes**  


  * **Abilities/enchants now don't apply invulnerability ticks on mobs. This includes Pigman's sword Burning Souls, but also Thorns, Venomous...![:eek:](https://cdn.jsdelivr.net/joypixels/assets/8.0/png/unicode/64/1f631.png)**
  * Fixed Extreme Focus on End Stone Sword so the resistance bonus doesn't go away on the first hit. Also added some sfx to it.

**Slayer**  


  * Normalized the Slayer XP required for Broodfather & Packmaster LVLs so they're the same as Zombie.
  * Reduced the insane damage of dark-red mini-bosses. They still hit hard, but half as much.
  * Added a minute to Sven's time limit.

We updated our tools to better investigate effects of items/enchants/perks on damage.  
Here's a glimpse:  


![GHWDBqk.png](https://i.imgur.com/GHWDBqk.png)

  
_This screenshot lets us see a problem with the Spider Sword crit damage bonus_ ​

  
We may eventually release a nicer-looking version of this debugging information to players as a feature.  
  
![:\)](https://cdn.jsdelivr.net/joypixels/assets/8.0/png/unicode/64/1f642.png)
