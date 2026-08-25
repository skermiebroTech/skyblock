---
title: "[December 16] Some more bug fixes"
date: 2021-12-16T17:57:15-0500
author: TheMGRF
source: https://hypixel.net/threads/december-16-some-more-bug-fixes.4714175/
---

# [December 16] Some more bug fixes

Hey all!  
  
Yesterday we rolled out a backlog of fun little bug fixes and improvements and we just wanted to make you aware of some of the changes.  
  


### Fixes​

  * Reworked how the Island Out of Bounds system works (teleporting you back when you go far away from island spawn).
  * Added a lag detector to player trading.
  * Fixed client crashes with the Griffin Burrows and Tuxedo armor on newer versions.
  * Pets, wardrobe, and sack contents are now coop salvaged properly.
  * Fixed some Fairy Soul counters not displaying properly.
  * Fixed errors with the Frosty menu outside of Jerry's Workshop.
  * Fixed a bunch of Ironman/Bingo transfers.
  * Removed the "NEW" tag from Crystal Hollows references. ![:hypixel_sketchy_smile:](data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7)
  * Made several changes to the following enchantments so they should work properly now:
    * Chance
    * Looting
    * Luck
  * Reworked how Thunderbolt and Thunderlord enchantments were handled to avoid double deaths and inconsistencies between the two.
  * Fixed a Crystal Hollows Nucleus re-roll exploit.
  * And finally, we've added a "Physics Limiter" to private islands to help with performance.

  


## Notes on the Physics Limiter​

This bit gets a bit wordy so buckle in.  


#### What does this mean?​

Basically, when some events happen in Minecraft they are treated as "physics events" such as sugar cane breaking above the block you broke or signs popping off of walls. Whilst this feature is fine in normal Minecraft we have found several issues were they have caused lag spikes on servers or been abused for nefarious acts. Due to this we will now be limiting how many of them can happen at any given time.  
  


#### What to expect.​

Certain blocks such as sand, sugar cane, and cactus etc. will now have their physics events cap out when a large number of them are broken in the same time period. This may result in some floating blocks but means that the server is more stable as a result of it.  
Overall our goal with this change is to improve server performance and prevent weird issues that can occur in some edge cases. We believe that for the most part general players will not notice this change since it is specifically designed to work well with farms. That said, we will constantly work to tweak the values we use to make sure it isn't affecting any real game play.  
  
_This change has been on the alpha network and now on live for around 24 hours and we've seen no complaints leading us to believe it is an effective change thus far._  
  
And that's it for today! Thanks again for all the bug reports.  
  
@TheMGRF, [@TheBirmanator](https://hypixel.net/members/4115771/), and [@skyerzz](https://hypixel.net/members/172494/) \- Bugs
