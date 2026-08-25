---
title: "[July 30] Floor 4 and other changes"
date: 2020-07-30T19:07:23-0400
author: Jayavarmen
source: https://hypixel.net/threads/july-30-floor-4-and-other-changes.3186966/
---

# [July 30] Floor 4 and other changes

Hello,  
  
This is the first large Dungeon patch after release!  
Quite a few changes, here are the headlines:  


  * Floor 4 release
  * Large changes to magic items and mana regeneration
  * Changes to aggro system
  * Few general changes

**Floor 4**  
It's out! And includes:  


  * New Boss: Thorn
  * New Boss Rewards
  * New mobs and items from those mobs
  * 2 New secret chest rewards
  * Ice Essence is now added
  * New regular rooms with new special mechanics (we also added some new rooms to previous floors)
  * 1 New Puzzle room and 1 new Danger room (and 2 new mini-boss rooms)
  * Floor 4 Watcher improvements
  * Ophelia now has Floor 4 Items and Potions
  * Floor 4 Journals
  * Thorn Boss Milestones
  * And more!

**Magic Damage**  
With the release of 0.8, we introduced a lot of new ability items with intelligence scaling.  
While we do believe those were a fun addition to the game, they are clearly outshining every other item in the Dungeons and making mage by far the best class.  
Many changes were made to magic items and their scaling:  


  * Bonzo Staff damage buffed from 500 to 1000 but scaling is now 0.2
  * Frozen Scythe damage buffed from 500 to 1000 but scaling is now 0.3
  * Pigman Sword now has a 5 second cooldown and costs 400 mana (instead of 150) but has 300 intel, grants 200 defense instead of 50 and has 30000 base damage instead of 7500
  * Dreadlord Sword now has a very short cooldown
  * Skulls from Dreadlord Swords and Soulstealer Bows are now easier to hit and deal AOE.

On top of that we changed how Mana Regeneration works inside dungeons.  
**Mana Regen will now be nerfed by 90% inside Dungeons** , however players gain back mana when hitting enemy monsters.  
**Every hit on an enemy mob gives back 5 mana + 1% of your total mana.** (This is a first draft and we will most likely tweak those values over the next few days based on testing and feedback.)  
This works on all melee attacks, arrow hits and mage beams (ranged attacks).  
Using abilities should now require a bit more strategy, let us know what you think about those changes!  
  
**General Changes**  
Many tweaks, new features and bug fixes are rolling in this patch:  


  * Aggro system should now work a lot better, but it is currently disabled during boss fights because of issues we could not fix on time.
  * No Pain No Gain enchantment buffed from 2 to 10 orbs.
  * Fixed a damage bug that would apply the Berserk melee damage buff to all kind of damage, and the Archer melee debuff to all kind of damage. (so Archer would deal less arrow and ability damage due to that).
  * Item Ability messages will now appear in the action bar instead of the chat.
  * We are experimenting with magic damage reduction on some Dungeon monsters, for starter the Chaos Guardian and Withermancers will now take reduced damage from abilities.
  * Fixed a bug with Lost Adventurers killing themselves with Gapples after the 4th one (negative healing).
  * Fixed an issue that would complete many Dungeon rooms after beating the watcher.
  * Fixed Adaptive boots having the wrong price.
  * Decoys are now immune to player damage.
  * The Silent Death' lore now shows that it refreshes on kills.
  * The Guardians now respawn faster during the Professor fight.
  * Unstable version of the lost Adventurer now deals lightning damage and the Holy version heals.
  * Any monster above 100k health will now have "k" and "M" representing their health.
  * Removed a silverfish puzzle variant and added a box puzzle variant.
  * Fixed boss chest rewards giving the wrong Undead Essence numbers (always stuck at 1).
  * Spirit Mask got a few stat buffs and is now a Dungeon item.

Thanks for reading!  
Please test the mana changes and give us your feedback, keep in mind this is the first draft and we will very likely improve the system based on your feedback.  
  
**EDIT** : Quick patch  


  * The mana regen ticks are now rounded up.
  * Non mage classes mana debuff is now 75% instead of 90%.
  * Mob cap during Thorn fight is now 100, from 150.

More changes coming later.  
Also a note on mage, I understand some players believe the class is now terrible, but it apparently is still the best performing class in the Dungeons right now. Give it a few days.  
  
**EDIT 2** : Other quick patch  


  * Less Spirit mobs are now spawning in the later waves (around 20% less).
  * Fixed an issue with the spirit bow being able to be moved around in your hotbar.
  * Fixed Spirit bunnies sometimes staying after the fight ends.
  * Fixed Dungeon Chest Key being an accessory.
  * Fixed the Epic Spirit Pet having the legendary perk.

The Spirit Pet works even when not selected, so when you become a ghost it'll pop up as long as you own it.  
  
**EDIT 3** : One more quick patch  


  * Fixed an issue with Spirit Bats preventing waves to spawn sometimes.
  * Buffed based Floor 4 EXP from 800 to 1000
  * Fixed Wizard Crystal not working with the Wizard

Probably the last patch of the night. We noted a few more bugs that we will try to fix soon. Tomorrow we will look at class stats and talk balancing changes.  
  
**EDIT 4** : Nvm one more  


  * Added Frozen Adventurers to regular rooms, fixed an issue that was making them too tanky and gave them 1 extra Ice essence drop.
  * Buffed passive mana regen of classes
    * Mage from 10% to 20% (doubled)
    * Tank and Berserk from 25% to 35%
    * Healer and Archer from 25% to 50%
  * Fixed recipe of Spirit Sceptre

That's it for tonight, more planned for tomorrow!  
  
**EDIT 5** : New patch  


  * Fixed mobs spawning after the end of the Thorn fight sometimes
  * Thorn now requires 4 hits to kill instead of 5
  * Mort won't give Dungeon Orbs anymore in floor 3 and up if you don't have one already.
  * Spirit Chicken damage nerfed by approximately 20%
  * Fixed Spirit Chickens damaging tanks through their ultimate
  * Fixed Frozen Adventurer dropping the wrong items and Essence numbers
  * Fixed Super Tank Zombie dropping the wrong items
  * Fixed button puzzle (new room mechanic) now correctly opening the door next to it
  * Fixed the Spirit Sceptre recipe (for real this time)

We also just fixed a pretty large damage bug on magic damage items, in short magic items will now deal more damage.  
If you want the details look at the spoiler below:  


Spoiler: Magic Damage formula

The magic damage formula would read something like:  
final damage = ability damage * ((1 + intelligence / 100) * ability scaling))  
  
When it should have been  
final damage = ability damage * (1+ ( intelligence / 100) * ability scaling))  
  
Which essentially means that the damage multiplier was always reduced by 1.  
  
So in the case of the Pigman Sword for example, in the scenario where a player had 1000 intelligence, the formula would be:  
  
Pigman Sword damage = 30000 *((1 + 1000 / 100) * 0.1))  
So 30000 * 1.001  
Which equals **30030 total damage**  
  
With the correct formula the pigman sword would deal:  
Pigman Sword damage = 30000 *(1+ ( 2590 / 100) * 0.1))  
So 30000 * 2  
Which equals **60000 total damage**  
  
This affected everyone, but it was a lot more severe on players with low intelligence values.  
  
Let's take the example of a player using the Bonzo staff with **500 intelligence** total:  
Formula with typo: 1000 *((1 + 500 / 100) * 0.2)) = **1001 Damage**  
Formula without typo: 1000 *(1+ ( 500 / 100) * 0.2)) = **2000 Damage**  
The fix doubles the damage of Bonzo staff on players with only 500 intelligence.  
  
Now let's take the example of a player using the Bonzo staff with **5000 intelligence** total:  
Formula with typo: 1000 *((1 + 5000 / 100) * 0.2)) = **10001 Damage**  
Formula without typo: 1000 *(1+ ( 5000 / 100) * 0.2)) = **11000 Damage**  
For this player the fix only increases his damage by 10%  
  
All those damage values are of course calculated only looking at magic damage scaling, other things apply to magic damage, like the Combat skill passive, items increasing ability damage (like shadow goggles) etc.  
  
TLDR; this fix should mostly affect players with lower Intel values, but could result in a very large damage increase.
