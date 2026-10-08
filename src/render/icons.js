// icons.js — a small painted icon for each of the 30 discoveries, for the
// Discovery Book and the eureka card. viewBox -16 -16 32 32. Pure strings.

const I = {
  fire_warmth: '<path d="M0 -13 Q8 -4 6 4 Q4 11 0 11 Q-4 11 -6 4 Q-8 -4 0 -13 Z" fill="#f08a2a"/><path d="M0 -4 Q4 1 3 5 Q2 9 0 9 Q-2 9 -3 5 Q-4 1 0 -4 Z" fill="#ffd24a"/><path d="M-9 12 H9" stroke="#7a5a3a" stroke-width="2.4" stroke-linecap="round"/>',
  stone_stacking: '<ellipse cx="0" cy="9" rx="10" ry="4.5" fill="#9a948a"/><ellipse cx="0" cy="1" rx="7.5" ry="3.8" fill="#b4ada2"/><ellipse cx="0" cy="-6" rx="5" ry="3" fill="#a59e93"/><ellipse cx="0" cy="-11" rx="3" ry="2" fill="#bdb6ab"/>',
  foraging: '<path d="M-2 -10 Q4 -14 8 -10" stroke="#5e8f3a" stroke-width="2" fill="none"/><circle cx="-5" cy="2" r="5" fill="#c4365a"/><circle cx="5" cy="3" r="5" fill="#d84a6a"/><circle cx="0" cy="-5" r="4.5" fill="#b02a4a"/><circle cx="-6" cy="0" r="1.2" fill="#fff" opacity=".7"/>',
  wading: '<path d="M-14 4 Q-7 0 0 4 T14 4 V14 H-14 Z" fill="#6aa7cf"/><ellipse cx="-4" cy="-3" rx="4" ry="6" fill="#e3c39a"/><ellipse cx="5" cy="-5" rx="3.5" ry="5.5" fill="#e3c39a"/><path d="M-14 6 Q-7 2 0 6 T14 6" stroke="#bfe0f5" stroke-width="1.5" fill="none"/>',
  rhythm: '<rect x="-9" y="-4" width="18" height="14" rx="3" fill="#b5703a"/><ellipse cx="0" cy="-4" rx="9" ry="3.5" fill="#f2e2c4"/><path d="M-12 -14 L-3 -6 M12 -14 L3 -6" stroke="#7a5a3a" stroke-width="2.4" stroke-linecap="round"/>',
  digging: '<path d="M-14 6 Q0 2 14 6 V14 H-14 Z" fill="#8a6a44"/><path d="M4 -14 L-2 2" stroke="#7a5a3a" stroke-width="2.6" stroke-linecap="round"/><path d="M-6 0 Q-2 6 2 4 L0 -2 Z" fill="#9aa3ad"/>',
  leaf_bed: '<ellipse cx="0" cy="6" rx="13" ry="5" fill="#6fa95a"/><path d="M-10 4 Q-6 -6 0 -2 Q-4 4 -10 4 Z M2 3 Q6 -7 12 -2 Q8 5 2 3 Z" fill="#8cc46c"/><path d="M-6 -8 l2 -4 M6 -10 l1 -4" stroke="#8a7bb8" stroke-width="1.6" stroke-linecap="round"/>',
  shiny_keeping: '<path d="M0 -12 L9 -2 L0 12 L-9 -2 Z" fill="#8fd0f0"/><path d="M0 -12 L3 -2 L0 12 L-3 -2 Z" fill="#cdeefc"/><path d="M-9 -2 H9" stroke="#5aa3d6" stroke-width="1"/><circle cx="9" cy="-10" r="1.6" fill="#fff"/>',
  fire_carrying: '<path d="M-2 14 L2 -2" stroke="#7a5a3a" stroke-width="3" stroke-linecap="round"/><path d="M3 -14 Q9 -6 6 0 Q4 4 1 3 Q-3 2 -2 -4 Q-1 -9 3 -14 Z" fill="#f08a2a"/><path d="M3 -7 Q5 -3 3 0 Q1 1 0 -2 Q0 -5 3 -7 Z" fill="#ffd24a"/>',
  sharp_stone: '<path d="M-10 10 L-4 -12 L8 -4 L6 8 Z" fill="#8a847a"/><path d="M-4 -12 L8 -4 L0 -2 Z" fill="#b4ada2"/><path d="M-10 10 L0 -2" stroke="#fff" stroke-width="1" opacity=".6"/>',
  wall: '<rect x="-13" y="-6" width="26" height="18" rx="2" fill="#a59e93"/><path d="M-13 0 H13 M-13 6 H13 M-5 -6 V0 M5 0 V6 M-8 6 V12 M8 6 V12" stroke="#7d776d" stroke-width="1.2"/>',
  planting: '<path d="M-12 10 Q0 6 12 10 V14 H-12 Z" fill="#8a6a44"/><path d="M0 9 V-4" stroke="#5e8f3a" stroke-width="2.2"/><path d="M0 -2 Q-8 -6 -9 -12 Q-2 -11 0 -2 Z M0 -4 Q8 -8 9 -13 Q2 -12 0 -4 Z" fill="#7cc35a"/>',
  fishing: '<path d="M-12 0 Q-2 -9 8 0 Q-2 9 -12 0 Z" fill="#6aa7cf"/><path d="M8 0 L14 -6 V6 Z" fill="#5a93bb"/><circle cx="-6" cy="-1" r="1.4" fill="#1f2a33"/><path d="M-12 -14 Q-6 -6 -4 -2" stroke="#7a5a3a" stroke-width="1.2" fill="none"/>',
  clay_shaping: '<path d="M-9 10 Q-11 -2 -5 -8 Q0 -12 5 -8 Q11 -2 9 10 Z" fill="#c97d55"/><path d="M-5 -2 Q0 2 5 -2" stroke="#9a5a3a" stroke-width="1.4" fill="none"/><circle cx="-4" cy="-7" r="1.6" fill="#e3a07a"/>',
  song: '<path d="M-6 8 V-8 L8 -12 V4" stroke="#6b4fb0" stroke-width="2.4" fill="none"/><ellipse cx="-9" cy="8" rx="4" ry="3" fill="#6b4fb0"/><ellipse cx="5" cy="4" rx="4" ry="3" fill="#6b4fb0"/>',
  weaving: '<path d="M-11 -2 Q0 -8 11 -2 L9 12 H-9 Z" fill="#c9a25a"/><path d="M-10 2 H10 M-9 6 H9 M-6 -2 V12 M0 -4 V12 M6 -2 V12" stroke="#9a7434" stroke-width="1.2"/><path d="M-8 -3 Q0 -14 8 -3" stroke="#9a7434" stroke-width="2" fill="none"/>',
  hearth: '<path d="M-13 12 V0 H13 V12" fill="#a59e93"/><path d="M-13 0 H13" stroke="#7d776d" stroke-width="2"/><path d="M0 -12 Q6 -5 4 0 Q2 3 0 3 Q-2 3 -4 0 Q-6 -5 0 -12 Z" fill="#f08a2a"/>',
  hut: '<path d="M-12 12 V2 H12 V12 Z" fill="#a8763e"/><path d="M-15 3 Q-12 -13 0 -14 Q12 -13 15 3 Z" fill="#e0b25a"/><path d="M-3 12 V5 Q0 2 3 5 V12 Z" fill="#ffd27a"/>',
  cooking: '<path d="M-11 -2 H11 Q11 10 0 10 Q-11 10 -11 -2 Z" fill="#5a5048"/><path d="M-13 -2 H13" stroke="#3a322c" stroke-width="2.4" stroke-linecap="round"/><path d="M-4 -6 q-3 -4 0 -8 M3 -6 q-3 -4 0 -8" stroke="#d8d4cc" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
  pottery: '<path d="M-5 -12 H5 V-8 Q12 -4 11 4 Q9 12 0 12 Q-9 12 -11 4 Q-12 -4 -5 -8 Z" fill="#c97d55"/><path d="M-10 0 H10" stroke="#f2e2c4" stroke-width="1.6"/><path d="M-9 4 H9" stroke="#9a5a3a" stroke-width="1.2"/>',
  garden: '<rect x="-13" y="2" width="26" height="10" rx="2" fill="#8a6a44"/><path d="M-8 2 V-6 M0 2 V-9 M8 2 V-6" stroke="#5e8f3a" stroke-width="2"/><circle cx="-8" cy="-7" r="3" fill="#ff9fb2"/><circle cx="0" cy="-10" r="3" fill="#ffd24a"/><circle cx="8" cy="-7" r="3" fill="#c9a6ff"/>',
  raft: '<path d="M-14 6 H14 L11 11 H-11 Z" fill="#a8763e"/><path d="M-9 6 V11 M-3 6 V11 M3 6 V11 M9 6 V11" stroke="#7a5a3a" stroke-width="1.2"/><path d="M0 6 V-12" stroke="#7a5a3a" stroke-width="1.8"/><path d="M1 -11 L11 2 H1 Z" fill="#f4f0e8"/>',
  ritual: '<circle r="11" fill="none" stroke="#e0b94a" stroke-width="2" stroke-dasharray="3 3"/><circle r="4" fill="#ffe28a"/><path d="M0 -15 V-11 M0 11 V15 M-15 0 H-11 M11 0 H15" stroke="#e0b94a" stroke-width="2" stroke-linecap="round"/>',
  paint: '<path d="M-12 12 L4 -4" stroke="#a8763e" stroke-width="3" stroke-linecap="round"/><path d="M4 -4 L10 -12 Q14 -8 8 -2 Z" fill="#c9563c"/><circle cx="-6" cy="-6" r="3" fill="#4a8ac9"/><circle cx="-10" cy="1" r="2.4" fill="#5aa86b"/><circle cx="2" cy="6" r="2.4" fill="#ffd24a"/>',
  lore: '<rect x="-10" y="-12" width="20" height="24" rx="2" fill="#efe3c8"/><path d="M-6 -6 H6 M-6 -1 H6 M-6 4 H3" stroke="#9a7a4c" stroke-width="1.6" stroke-linecap="round"/><circle cx="-10" cy="-12" r="3" fill="#d9c49a"/><circle cx="10" cy="12" r="3" fill="#d9c49a"/>',
  festival: '<path d="M-14 -10 Q0 -2 14 -10" stroke="#7a5a3a" stroke-width="1.2" fill="none"/><path d="M-11 -8 L-8 0 L-5 -6 Z" fill="#c9563c"/><path d="M-3 -5 L0 3 L3 -5 Z" fill="#ffd24a"/><path d="M5 -6 L8 0 L11 -8 Z" fill="#4a8ac9"/><circle cx="-8" cy="9" r="2" fill="#ff9fb2"/><circle cx="2" cy="11" r="1.6" fill="#8ee08a"/><circle cx="9" cy="8" r="1.8" fill="#c9a6ff"/>',
  totem: '<rect x="-6" y="-13" width="12" height="26" rx="2" fill="#a8763e"/><circle cx="-2.5" cy="-7" r="1.6" fill="#2a2420"/><circle cx="2.5" cy="-7" r="1.6" fill="#2a2420"/><path d="M-3 -3 H3 M-6 2 H6" stroke="#5a3a20" stroke-width="1.4"/><path d="M-6 -10 L-13 -6 L-6 -5 Z M6 -10 L13 -6 L6 -5 Z" fill="#c9563c"/>',
  temple: '<path d="M-14 -4 L0 -13 L14 -4 Z" fill="#efe9dc"/><rect x="-12" y="-4" width="24" height="3" fill="#ddd5c4"/><path d="M-9 -1 V10 M-3 -1 V10 M3 -1 V10 M9 -1 V10" stroke="#efe9dc" stroke-width="3"/><rect x="-13" y="10" width="26" height="3" fill="#ddd5c4"/><circle cy="-7" r="1.8" fill="#ffd24a"/>',
  star_watching: '<path d="M0 -12 L3 -4 L11 -4 L5 1 L7 9 L0 4 L-7 9 L-5 1 L-11 -4 L-3 -4 Z" fill="#ffe36b"/><circle cx="-11" cy="-11" r="1.4" fill="#fff"/><circle cx="11" cy="10" r="1.2" fill="#fff"/><circle cx="12" cy="-12" r="1" fill="#fff"/>',
  herb_healing: '<path d="M0 12 V-6" stroke="#5e8f3a" stroke-width="2"/><path d="M0 -2 Q-9 -4 -10 -11 Q-2 -10 0 -2 Z M0 2 Q9 0 10 -7 Q2 -6 0 2 Z" fill="#7cc35a"/><path d="M7 7 H13 M10 4 V10" stroke="#e05a5a" stroke-width="2.4" stroke-linecap="round"/>'
};

export function discoveryIcon(id, size = 32) {
  return `<svg viewBox="-16 -16 32 32" width="${size}" height="${size}" aria-hidden="true">${I[id] || '<circle r="10" fill="#e6dcc6"/>'}</svg>`;
}
export const HAS_ICON = id => !!I[id];
