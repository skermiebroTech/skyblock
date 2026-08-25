---
title: "SkyBlock Patch Notes 0.19.4 - Dungeons, QoL, Bug Fixes"
date: 2023-09-12T09:46:58-0400
author: Hypixel Team
source: https://hypixel.net/threads/skyblock-patch-notes-0-19-4-dungeons-qol-bug-fixes.5490381/
---

# SkyBlock Patch Notes 0.19.4 - Dungeons, QoL, Bug Fixes

### 

![sb-19-4.png](https://hypixel.net/attachments/sb-19-4-png.3246122/)

  
Hello!  
  
Welcome to **SkyBlock Patch 0.19.4**. Today's patch includes many Dungeons changes and additions, QoL features, bug fixes, and more!  
  
  


### **►** Dungeons​

Today’s the day that the Berserk class will rise to glory. That’s right, this is an update to The Catacombs! We’re introducing a bunch of new items and class abilities to make melee Berserk a viable option when plundering The Catacombs. Read more to learn about the changes!  
  


#### **►** Berserk Changes​

  * **Berserk** gains a new ability Weapons Master, effectively making each swing “AOE”.
    * Mobs within this cone will take knockback as if they were damaged by a melee hit.
    * Add a swing range of +0.06 blocks per class level, maximizing at +3 blocks swing range at Berserk 50. This stacks on top of any weapon with swing range.
    * Ferocity has been disabled from proccing when Weapon Master is in effect.
  * **Berserk** ’s Lust for Blood ability is rescaled to buff its effect at lower class level and buffs the Dungeon Class Bonus if solo.
    * Let p be amount of damage increase per hit and let m be the damage increase cap.
    * p% = 15% + Berserk Level * 0.6%
    * max% = 250% + floor(Berserk Level / 5) * 70%
  * **Berserk’s** Blood Lust ability will no longer heal for 1.5% of any damage dealt. Instead, heal for 3% of your missing health per **melee** hit.
    * Procs on Flower of Truth right clicks.
    * Hitting more than one mob at once will not result in additional healing.
  * **Berserk** gains a new passive ability Indomitable, increasing its tankiness to go close range.
    * Gain 5% + (0.1% * Class Level) of Strength as Defense.
  * **Berserk** ’s Ragnarok ability now has the following additional effects on top of the current minions:
    * If player’s attack speed is less than 100, set it to 100.
    * If player’s speed is less than 200 + Berserk Level * 4, set their speed to 200 + Berserk Level * 4.
    * Increase their **melee** damage to all mobs by 1.5x.
  * **Berserk** ’s Throwing Axe ability has been buffed as follows:
    * Allow sneak to activate Throwing Axe.
    * Increased the hitbox of Throwing Axe by 0.5 blocks radius.
    * Throwing Axe now pierces through enemies.

  


#### Other Class Changes​

  * **Archer** ’s Arrow Damage Bonus has been rescaled to not punish dupe Archer as heavily.
    * Arrow Damage Boost% = 150% + Archer Level * 1.6%
    * +50% Arrow Damage if Dungeon Class Bonus is applied.
  * **Healer** gains a new passive ability: Overheal, allowing it to convert excess healing on a player into an absorption shield.
    * Healing done by a Healer when the player is max health is converted into an absorption shield.
    * The maximum absorption shield is based on the player’s Healer level - 20 + 0.4 per Healer Level.
    * If the healer is the sole healer in the party, calculate max absorption shield as 40 + 0.4 per healer level instead. (maximum 40 + 0.4*50 = 60% overheal absorption shield).
    * Wish now works with Overheal - it fully heals you and gives you the maximum absorption hearts you can get from Overheal + an additional 20%.
  * **Mage** ’s Mage Staff’s (beam) dropoff range now starts at 10 instead of 5.
    * It’s indicated that the beam drops off in damage starting from 15 blocks but that’s not the case on live.
  * **Mage** ’s Mage Staff’s (beam) hit reg has been increased by 0.5 blocks radius.
  * **Mage** ’s Mage Staff’s (beam) cooldown is now affected by attack speed.
  * **Mage** ’s Mage Staff’s (beam) range is doubled in M7 P5, allowing players to hit Dragons with Mage Beam easier.

  


#### **►** New Stat: Swing Range​

Swing Range is now indicated as a stat on your profile. The base Swing Range stat is 3 blocks and can be increased by various longswords. The Swing Range stat on swords are now additive to the base Swing Range. Please note that swing range is a global stat, not just to be used in dungeons.  
  
Swing Range is shown and works accurately to 1.decimal place. Swing Range obtained from Dominus stats is also dynamically reflected by the Swing Range stat.  
  


![Swing Range.png](https://hypixel.net/attachments/swing-range-png.3246116/)

  
  


#### **►** New Items​

 _All the new items from this update can be donated to the Museum. If you can’t find certain items (i.e Adaptive Belt and Shadow Assassin Cloak), they need to be donated with their full set._  


  * **Bouquet of Lies** _(Upgrade to Flower of Truth)_
    * Damage: +220
    * Strength: +300
    * Crit Damage: +50
    * Bouquet of Lies’ ability fires a barrage of three roses and ricochets two additional times (compared to the Flower of Truth).
    * Requires F6 Completion
  * **Bone Reaver** _(New longsword crafted with materials obtained from F4)_
    * Damage: +235
    * Strength: +90
    * Swing Range: +0.5
    * Right click ability deals damage to enemies in a wide cone.
    * Requires F4 Completion
  * **Felthorn Reaper** _(Upgrade to Bone Reaver)_
    * Damage: +295
    * Strength: +135
    * Swing Range: +1
    * Right click ability deals more damage to more enemies in a wider cone.
    * Requires F6 Completion
  * **Balloon Snake** _(New dungeon necklace obtained from F1)_
    * Health: +10
    * Intelligence: +10
    * Grants Jump Boost 2 to the player.
    * Requires F1 Completion
  * **Adaptive Belt** _(New dungeon belt obtained from F2)_
    * Strength: +5
    * Health: +10
    * Defense: +5
    * Grants additional bonuses based on your selected dungeon class!
      * Berserk: +10 Strength
      * Healer: +10 Health, + 5 Mending
      * Mage: +25 Intelligence
      * Tank: +5 Health, +10 Defense
      * Archer: +2 Crit Chance, +5 Crit Damage
    * Requires F2 Completion
  * **Bone Necklace** _(New Dungeon Necklace obtained from F4)_
    * Defense: +35
    * Crit Chance: +3
    * This necklace gains +3 Defense as base stats for every enemy within 10 blocks (up to 30 mobs, 60 as Tank). Range increases to 30 blocks when you play as Tank in dungeons and increase Diversion passive range by 15 blocks.
    * Requires F4 Completion
  * **Shadow Assassin Cloak** _(New dungeon cloak obtained from F5)_
    * Strength: +20
    * Speed: +3
    * After you teleport, your next hit will deal 1.1x damage.
    * Requires F5 Completion
  * **Soulweaver Gloves** _(New dungeon gloves obtained from F6)_
    * Strength: +10
    * Crit Damage: +10
    * While in The Catacombs, summon a haunted skull that slowly revolves around you every 15 seconds or when you kill a mob with melee damage. When an enemy is hit by a haunted skull, they are stunned for 2 seconds and deal 5% less damage
    * Requires F6 Completion
  * **Fel Skull** _(New dungeon drop from F6 Bedrock Chest)_
    * Used to craft Felthorn Reaper.
  * Some of the new items can be upgraded by their respective floor fragments.
  * Spirit Bear is now a miniboss that appears in blood room starting from F5/M5 onwards. He drops Thorn Fragments that can be used to upgrade items obtained in F4/M4.
  * Players now start with a base 10% base item dungeon stat boost, giving newer players a taste of dungeon stat boosts and encourage them to use dungeon items.

  


#### **►** Terminator and Shortbow Changes​

You can now hold right-click to fire your Terminator and other shortbows at maximum efficiency! The rate of firing is affected by your attack speed. Your shot cooldown now dynamically updates on your item tooltip based on your attack speed stat. Pretty nifty, eh?  
  
In addition, Terminator’s Salvation ability now has a 0.25s cooldown and is activated on left-clicking only.  
  


![javaw_g3NprAUDeD.png](https://hypixel.net/attachments/javaw_g3nprauded-png.3246117/)

  
  


#### Modifications to Existing Items​

  * Dreadlord Sword now has a Catacombs requirement of 3 (from 5).
  * Dragon Shortbow can now be dungeonized. (Requires Catacombs 8)
  * Increased the health of Skeleton Grunt pieces by 10 per piece.
  * Reduced the mana cost of Bonzo’s Staff from 100 to 90.
  * Slightly increased the damage of the higher tier Cleavers obtained from Ophelia
    * Increase damage of Hyper Cleaver to 175 dmg / 100 str / 100 cd - (will make it equal to the FoT)
    * Increase damage of Giant Cleaver to 235 dmg / 120 str / 120 cd
  * Giant’s Sword is now a longsword and has a swing range of +1.
  * Ophelia shop item requirements have been significantly nerfed.
    * Mender Fedora, Shadow Goggles, Metal Chestplate, Hyper Cleaver, and Super Undead Bow now requires a F3 clear instead of Catacombs Level 16.
    * Mender Crown, Wither Goggles, Steel Chestplate, Giant Cleaver, and Death Bow now require a F6 clear instead of Catacombs Level 28.
  * Young, Unstable, Holy, and Old Dragon Armor now have a Catacombs requirement of 10.
  * Wise, Protector, and Strong Dragon Armor now have a Catacombs requirement of 12.
  * Superior Dragon Armor now has a Catacombs requirement of 14.
  * Aspect of the Dragons now has a Catacombs requirement of 12.
  * Revenant Falchion now has a Catacombs requirement of 12.
  * Reaper Falchion now has a Catacombs requirement of 18.

  


#### Dungeon Changes​

  * Dungeon Talismans now give double the MP while in Dungeons.
  * Master Mode clears now count for 2 completions in collections.
  * There are now warning signs when a Shadow Assassin is about to jump you.
  * You can now activate class abilities without having a Dungeon Orb in your inventory.
    * You can still use a Dungeon Orb to activate your abilities if you want.
  * Withered Dragons in M7 P5 now have 1,000,000,000 HP and 2500 Defense.
  * Decoys no longer bounce arrows (Bouncy Arrows and Archer’s Bouncy Arrows ability).
  * You now have a short period of invulnerability when teleporting to someone using Spirit Leaps
  * Super Archer now wears armor on F5-F7.
  * Heavily reduced the mob HP of Entrance, F1 and F2 to make dungeons easier for new players.
  * Vitality and Mending no longer scale with dungeons stat boost.
  * Durability is no longer a mechanic in SkyBlock.

  


#### Catacombs Loot Table Changes​

  * Adaptive Armor is now a lot cheaper from chests, making it a way more palatable option for newer players.
    * Helmet: 500k
    * Chestplate: 2m
    * Leggings: 1m
    * Boots: 250k
  * Increased the weight of Precursor Eye in F6 from 2 -> 3
  * Increased the weight of Giant’s Sword in F6 from 3 -> 5
  * Increased the weight of Precursor Eye in M6 from 2 -> 3
  * Increased the weight of Giant’s Sword in M6 from 3 -> 6
  * Added Fel Skull to the Bedrock Chest of the F6/M6 chests.
  * Added Dark Orb to the emerald chests and above’s loot table of F5/M5.
    * This should fix the issue of Dark Orb not appearing in the RNG Meter of F5/M5.
  * The Gilded reforge now gives an additional 350/400 Intelligence and can be applied on the Midas Staff.
  * Removed Ancient Rose from the drop table of Emerald, Obsidian and Bedrock Chests.

  


#### QOL Improvements​

  * **You can now salvage multiple items at once!**
    * Want to quickly insert your items into the salvage menu? Click the buttons in the bottom right of the salvage menu to add all Rare/Epic mob drops into the GUI!



![image.png](https://hypixel.net/attachments/image-png.3246119/)

  * F3 now ends when The Professor explodes, you are able to claim your chests while Necron rambles on.
  * F6’s final giant’s chains were sped up. **Immensely**.
  * F7 P1’s floor cracks open faster when Maxor dies.
  * F7 P2’s Storm’s idle time when you enter the boss is reduced by 0.1s per Wither Miner/Guard kill.
  * Ice Fill now updates the block you’re walking on much faster, making the puzzle a lot more lenient.
  * Players can no longer dungeonize their gear if they don’t meet the gear’s Catacombs requirements.
    * For dungeon items with a catacombs requirement to be used in dungeons, the tooltip should say “Catacombs Requirement: Level XI” instead of “Requires Catacombs XI”.
    * “Catacombs Requirement” tells players that the requirement is only applicable in the Catacombs; you can still use your armor as normal outside of dungeons.
  * If you don't meet the requirements for a dungeonized item, it will now show the catacombs requirement if you hover over it.
  * Soul Eater now no longer procs on non-critical hits, stopping it from being procc’d by enchants like Thorns.
  * Added a cooldown of 1s on deploying Power Orbs (so you don’t accidentally double-click).
  * Reduced the cooldown of SOS Flare from 20s to 10s.

  


#### Dungeon Bug Fixes​

  * Fixed King Midas room completing when you blow up King Midas’s crypt without killing him
  * Fixed Potion effects and class bonus not being retained when rejoining a dungeon.
  * Fixed rewards not being automatically picked up when claiming a chest from a failed run.
  * Fixed players being unable to activate certain abilities in doorways.
  * Fixed keys being elevated upwards when spawning in iron bars, fences etc.
  * Fixed Respawning Skeletons dropping keys and blessings only after they complete their respawning animation.
  * Fixed Ender Dragon’s End Strike giving an additional 100% additive damage.
  * Fixed /getfromsacks (/gfs) being disabled in Dungeons.
  * Fixed Soul Whip dealing damage to invulnerable enemies.
  * Fixed the blood room portal taking too long to teleport on later versions.

  


### **►** Pets Menu​

#### Searching & Sorting​

  * The Pets Menu and AutoPets menu now have a search option.
  * The Pets Menu and AutoPets menu now have a sorting filter of Rarity, Alphabetical, and Skill.



![Sort.png](https://hypixel.net/attachments/sort-png.3246120/)

  


#### Visibility​

Pet Visibility has now been completely updated with 4 features:  


  * Show all pets
  * Hide all pets
  * Show only your pet
  * Pet nametags: Enabled/Disabled



![Pet Visibility.png](https://hypixel.net/attachments/pet-visibility-png.3246121/)

  


#### AutoPets​

  * Specific pets can now be selected in the Autopets menu. Rather than the highest pet rarity and level always being chosen, now any leveled pet can be selected and used for autopet rules!

  


#### Item Converting​

  * Pets can now be converted to items via Right-Clicking on the pet in the menu.

  


### **►** **Other Changes** ​

With this patch we’ve decided to bring in a few much needed Broodmother changes, as well as a new NPC in the Deep Caverns.  
  


### Broodmother Changes​

  * Renamed 'Brood Mother' to 'Broodmother'.
  * Brought styling inline with Broodfather.
  * Added particles when Broodmother spawns.
  * Added better indication of when the Broodmother will spawn on the scoreboard and tab list.
  * /warp mound will now take you to the top of the Spider Mound.
  * Changed Haymitch’s dialogue to guide the player to the Broodmother.

  


### Redstone Miner​

  * Added a new dude to the Pigmen’s Den in the Deep Caverns.
    * He’ll ask for some Redstone and in return teach you about the Accessory Bag!
    * In case you don’t care about the Accessory Bag, or you already know how it works, he’ll also give you some Accessory Bag slots and SkyBlock XP.
  * Changed the skin of the Lapis Miner to match his brother, the Redstone Miner.

  


### **Items and Equipment Changes** ​

These changes usually affect all useable items and wearable equipment, as well as pets and the Bazaar/Auction House.  
  


#### **Combat and Slayer Items** ​

  * Significantly reduced the damage conversion rates of Tactical Insertion and Souls Rebound.
    * Tactical Insertion’s burn deals 10% of all damage instead of 40% within 3s.
    * Souls Rebound’s damage increase is now 10% instead of 20%.



> These items had too much damage potential and were pretty much only used to perform exploits such as 1-tapping slayer bosses. We have nerfed the damage potency of these items to prevent similar issues from happening in the future. 
> 
> Click to expand...

  


### **World and Progression Changes** ​

These changes usually affect progression related systems like quests, collections, levels and skills, NPC interactions and worlds.  


#### **Combat Progression** ​

  * Nest Endermites now give Combat XP and do less damage than before.

  


#### **Mining Items** ​

  * Added a chest sound and a cute jingle to completing the lockpick minigame in Crystal Hollows.
  * Removed the cooldown when resetting Heart of the Mountain.

  


### **►** Other **Bug Fixes** ​

#### **Combat Fixes** ​

  * Fixed Griffin Pet buffs remaining after unequipping the pet.
  * Fixed being able to spawn in multiple Rollim and Kaus NPCs.
  * Changed Dungeoneering skill menu arrow style to match other similar menus.
  * Fixed the Ability Cooldown Chat setting not being respected by the Zombie Sword ability.
  * Fixed being able to turn a Moody Grappleshot into a Tripwire Hook by clicking a furnace.
  * Fixed Magma Cube kills not counting toward Bestiary.
  * Croesus will no longer display their menu if you haven’t completed a Dungeon yet.
  * Fixed the always-active Kuudra pet perks being inactive/the wrong level if multiple Kuudra pets were in the menu.
  * Fixed the Kuudra pet's Trophy Bait perk not working if the pet wasn't active.
  * Fixed the Rend enchantment’s cooldown sometimes not applying correctly.
  * Fixed abilities working on Sven Packmaster.
  * Fixed the Ashfang Gravity Well taking too long to explode.

  


#### **Mining Fixes** ​

  * Using Smelting Touch on Netherrack now provides Netherrack collection.
  * Fixed the Chest Looter commission in the Crystal Hollows resetting when leaving the lobby.
  * Fixed Slow Moving Snail Pet perk activating only half the time when breaking blocks.

  


#### **Farming Fixes** ​

  * Fixed a Garden Milestone exploit.
  * Chicken Head fall damage is now displayed without the unnecessary decimal.
  * Fixed typo in Elizabeth’s Barn Skin preview dialogue.
  * Fixed not being able to open chests while having Enchanted Seeds in hand.

  


#### **Misc. Fixes** ​

  * **Fixed getting 3 clicks as a reward from non-highest difficulties in Experimentation Table.**
  * **Fixed Bingo profiles always getting the Abiphone achievement.**
  * Fixed Builder's Wand not working with Quartz Pillar Blocks.
  * Beach Ball decoration can now be placed.
  * Fixed Day Savers turning into vanilla blocks when breaking them.
  * Fixed being able to turn a Moody Grappleshot into a Tripwire Hook by clicking a furnace.
  * Fixed Personal Deletor not deleting Luxurious Spools dropped by Arachne and items obtained from Crystal Hollows chests.
  * Egg Hunt blocks will no longer be removed from an explosion.
  * Picking up a minion will now give you XP and collection for the items inside.
  * Fixed being unable to mount pets.
  * Fixed the Bingo NPC saying you aren't SkyBlock Level 10 when on a Bingo profile.
  * Fixed being able to collect extra SkyBlock XP from the Claim All button in the Museum menu.
  * Fixed the wiki link not properly sending for the Blazetekk™ Ham Radio
  * Fixed Rhys still only awarding 1 copper in the Garden.
  * Fixed many coloring and spelling inconsistencies.
