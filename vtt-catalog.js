/* ========================================================
   VTT CATALOG
   Ready-made maps and tokens the DM can pick from the VTT's
   "Catalog" window. Only the chosen file's address (and its id)
   is shared through Firebase; this list itself never is.

   Adding an entry:
   - put the picture in assets/maps/ or assets/tokens/
     (WebP or SVG; keep maps under ~2 MB, tokens ~256 px);
   - optionally a small preview in assets/maps/thumbs/;
   - only use pictures you made yourself or whose licence
     allows it — never maps scanned from official books.

   Map:   { id, name, category, tags, file, thumb?, grid: { size, offsetX?, offsetY? } }
          grid = the grid drawn into the picture, in its own px.
   Token: { id, name, category, tags, file, size }   size = squares per side
   ======================================================== */
window.VTT_CATALOG = {
  maps: [
    {
      id: 'map-forest-clearing',
      name: 'Forest Clearing',
      category: 'outdoor',
      tags: ['forest', 'camp', 'road'],
      file: 'assets/maps/forest-clearing.svg',
      grid: { size: 70, offsetX: 0, offsetY: 0 }
    },
    {
      id: 'map-stone-crypt',
      name: 'Stone Crypt',
      category: 'dungeon',
      tags: ['crypt', 'tomb', 'undead'],
      file: 'assets/maps/stone-crypt.svg',
      grid: { size: 70, offsetX: 0, offsetY: 0 }
    },
    {
      id: 'map-tavern-hall',
      name: 'Tavern Hall',
      category: 'indoor',
      tags: ['tavern', 'inn', 'town'],
      file: 'assets/maps/tavern-hall.svg',
      grid: { size: 70, offsetX: 0, offsetY: 0 }
    }
  ],
  tokens: [
    { id: 'tok-skeleton', name: 'Skeleton', category: 'undead', tags: ['skeleton', 'bones'], file: 'assets/tokens/skeleton.svg', size: 1 },
    { id: 'tok-wolf', name: 'Wolf', category: 'beast', tags: ['wolf', 'animal'], file: 'assets/tokens/wolf.svg', size: 1 },
    { id: 'tok-bandit', name: 'Bandit', category: 'humanoid', tags: ['bandit', 'thief'], file: 'assets/tokens/bandit.svg', size: 1 },
    { id: 'tok-guard', name: 'Guard', category: 'humanoid', tags: ['guard', 'soldier'], file: 'assets/tokens/guard.svg', size: 1 },
    { id: 'tok-cultist', name: 'Cultist', category: 'humanoid', tags: ['cultist', 'priest'], file: 'assets/tokens/cultist.svg', size: 1 },
    { id: 'tok-fire-elemental', name: 'Fire Elemental', category: 'elemental', tags: ['fire', 'elemental'], file: 'assets/tokens/fire-elemental.svg', size: 2 }
  ]
};
