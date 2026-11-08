// Mirror of src/lib/assets.ts entries for Node scripts (kept in sync by assets-check's self-test).
const roles = ['villager', 'werewolf', 'seer', 'witch', 'guardian', 'hunter', 'cupid', 'elder', 'white-wolf'];
const bgs = ['landing', 'lobby', 'role-reveal', 'night', 'day', 'discussion', 'voting', 'elimination', 'victory-village', 'victory-werewolf', 'moderator'];
const effectsSquare = ['moon-full', 'moon-blood', 'potion-heal', 'potion-poison', 'vote-token', 'shield', 'victory-emblem', 'defeat-emblem'];
const effectsWide = ['transition-dusk', 'transition-dawn', 'border-ornament', 'fog-overlay'];

/** @type {{key:string, width:number, height:number, alpha:boolean, widths:number[], priority:string}[]} */
export const MANIFEST = [
  ...roles.map((r) => ({ key: `cards/${r}`, width: 1024, height: 1536, alpha: false, widths: [384, 768], priority: ['cupid', 'elder', 'white-wolf'].includes(r) ? 'P2' : 'P0' })),
  { key: 'card-backs/card-back', width: 1024, height: 1536, alpha: false, widths: [384, 768], priority: 'P0' },
  ...bgs.flatMap((b) => [
    { key: `backgrounds/${b}`, width: 1536, height: 1024, alpha: false, widths: [960, 1536], priority: 'P0' },
    { key: `backgrounds/${b}-mobile`, width: 1024, height: 1536, alpha: false, widths: [640, 1024], priority: 'P1' },
  ]),
  ...roles.map((r) => ({ key: `icons/role-${r}`, width: 1024, height: 1024, alpha: true, widths: [128, 256], priority: ['cupid', 'elder', 'white-wolf'].includes(r) ? 'P2' : 'P0' })),
  ...['village', 'werewolf', 'special'].map((t) => ({ key: `icons/team-${t}`, width: 1024, height: 1024, alpha: true, widths: [128, 256], priority: t === 'special' ? 'P2' : 'P0' })),
  ...effectsSquare.map((e) => ({ key: `effects/${e}`, width: 1024, height: 1024, alpha: true, widths: [256, 512], priority: e === 'moon-full' ? 'P0' : 'P1' })),
  ...effectsWide.map((e) => ({ key: `effects/${e}`, width: 1536, height: 1024, alpha: !e.startsWith('transition'), widths: [960, 1536], priority: 'P1' })),
  { key: 'logos/logo-emblem', width: 1024, height: 1024, alpha: true, widths: [128, 256, 512], priority: 'P0' },
];
