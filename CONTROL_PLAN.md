# Neptune Control Plan

## Core Direct Controls
- **Movement**: Arrow keys steer ship or aim; `Z` jumps while on foot as astraunat.
- **Primary action**: `space` fires ship weapons or throws bombs; hold to charge throws.
- **Mode toggle**: `X` boards or exits the ship/walker when in range.
- **Parachute**: `A` toggles the parachute while airborne.
- **Bomb / aim down**: `↓` drops bombs in ship mode or adjusts aim downward while walking.
- **Utility menus**: `U` opens upgrades; `F5` / `F6` save and load; debug bindings stay unchanged.

## Contextual Action Menu (Hold `Q`)
- Holding `Q` opens a radial action overlay; release while highlighting an option to trigger it.
- Quick-tapping `Q` repeats the last action (tracked separately per movement mode) if still valid.
- Use arrow keys to cycle options; releasing `Q` or pressing `space` confirms the highlighted action.

### Ship Mode
- **Always listed**: Missile, Wingman, Drone, Base.
- **Upgrade-gated**: Walker (after unlock)
- Items disable and grey out when on cooldown, out of resources, or when terrain rules block deployment.

### Astronaut Mode
- **Common utilities**: Turret, Missile, Drone, Wingman, Shield, Base
- **Conditional**: Drill Rig appears only when `Upgrades.canPlaceRig` and the surface supports placement; Walker requires the walker upgrade.
- Entries respect inventory limits and disappear entirely if never acquired.

## Availability Rules
- The menu rebuilds each time `Q` is pressed using capability checks.
- Disabled entries are not visible
- Options stay hidden until the player actually obtains the underlying upgrade.

## HUD & UX Notes
- The favourite action indicator shows which option a quick `Q` tap will trigger next.

## Two-Player Alien Mode
- Numeric hotkeys (`1–5`) remain untouched for the alien role and bypass the radial system entirely.

## Implementation Checklist
1. Add an `ActionMenu` module that provides action descriptors (`id`, `label`, `icon`, `isEnabled`, `onSelect`).
2. Inject context providers (ship, astronaut, walker) to assemble filtered action lists per frame.
3. Extend input handling so `Q` hold logic opens the menu, caches last actions, and respects other UI states.
4. Render the radial UI with cooldown/resource feedback and integrate the HUD hint system.
5. Playtest keyboard and controller builds to tune hold thresholds, selection snapping, and favourite defaults.
