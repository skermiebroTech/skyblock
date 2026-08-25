---
title: "[February 7] Some Bug Fixes"
date: 2022-02-07T14:59:48-0500
author: TheMGRF
source: https://hypixel.net/threads/february-7-some-bug-fixes.4810816/
---

# [February 7] Some Bug Fixes

Hey all!  
  
Here is a small collection of bug fixes from over the last week.  
  


### Fixes​

  * Added an Entity Limiter to private islands.
  * Fixed a rare server crash with the Armadillo entity.
  * Fixed an issue where Skeletal Defense would fail to proc.
  * Fixed some issues with the Drill menu that could lead to the drill item being duplicated or removed.
  * Prevented throwables being used in The End island.
  * Fixed Showcase Blocks stacking and subsequently deleting themselves when you pick them up.
  * Fixed Enchanted Wet Sponge not working in the Super Compactor.
  * Fixed some missing item skill XP values when collecting from minions.
    * Spoiler: Categories

      * Mining
        * Enchanted Packed Ice (12,800 XP)
        * Enchanted Hard Stone (57.6 XP)
      * Combat
        * Enchanted Blaze Rod (7,680 XP)
      * Farming
        * Enchanted Cactus (12,800 XP)
        * Super Enchanted Egg (28.8 XP)
        * Hay Bale (1.8 XP)
        * Enchanted Hay Bale (288 XP)
        * Tightly-Tied Hay Bale (41,472 XP)
        * Polished Pumpkin (7,680 XP)
      * Fishing
        * Enchanted Wet Sponge: (800 XP)
      * Alchemy
        * Enchanted Sugar (16 XP)
        * Enchanted Sugar Cane (2,560 XP)
        * Mutant Nether Wart (7,680 XP)

  * Prevented spawning Villagers from spawn eggs _again_.
  * Added lots of additional checks to prevent manipulation of NPCs and other entities in Crystal Hollows and Dungeons.
  * Lots of internal fixes that make rolling updates a lot smoother.

  


## Notes on the Entity Limiter​

This is pretty simple in comparison to the previously mentioned physics limiter but here we go.  


#### What does this mean?​

Basically, when an entity spawns into the world (either mob or item) it is added to a global counter of how many entities of that type can exist at any given time. Once this limit has been reached new entities of that type will not spawn in the world.  
This has been active for about a week now with very few complaints but ultimately allows us to better control drops from farms and reduce load on private islands.  
  


#### What to expect.​

Certain entities like mob drops or Cactus will now have their total limited when a large number of them are in the world space. This shouldn't affect average players but is mainly aimed at extremely large farms or people abusing lots of entities to lag servers.  
It is also worth noting that breaking chests filled with items should still be fine with this change but we do not guarantee it will always work. Best to just take items out by hand.  
Overall this change will make a positive improvement to server performance and prevent extra load from unneeded entities whilst leaving players largely unaffected.  
  
And that's it for today, thanks again!
