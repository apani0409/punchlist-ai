import type { Sample } from '../types'

// Pre-analyzed examples so the demo can be explored with zero API cost.
// Each result was produced by the same Claude vision prompt/schema used by
// the live backend (generated during development with Claude Code, then
// reviewed by hand). Photos are CC0 / public domain from Wikimedia Commons.
export const SAMPLES: Sample[] = [
  {
    id: 'cracked-wall',
    label: 'Cracked retaining wall',
    photo: '/samples/cracked-wall.jpg',
    credit: 'Wikimedia Commons (CC0)',
    creditUrl:
      'https://commons.wikimedia.org/wiki/File:Cracked_concrete_retaining_wall_at_Medway_Park_Sports_Centre,_Gillingham,_Kent,_England.jpg',
    result: {
      scene_summary:
        'Exterior low block retaining wall between a paved walkway and a raised gravel bed. A continuous vertical crack runs through the full height of the wall, and the surrounding paving shows displaced units and debris.',
      items: [
        {
          id: 1,
          title: 'Vertical crack through retaining wall',
          description:
            'A continuous vertical crack runs from the coping course to the base, passing through blocks rather than only joints. This suggests differential settlement or lateral pressure and may worsen over time.',
          location_in_photo: 'Center of the wall, running top to bottom',
          trade: 'concrete',
          severity: 'high',
          recommended_action:
            'Have a structural assessment of the crack; monitor width, then rake out and repair with appropriate repair mortar or rebuild the affected section once movement is addressed.',
        },
        {
          id: 2,
          title: 'Displaced coping / paver at wall top',
          description:
            'A paving unit above the wall sits proud of the surrounding surface and is misaligned, indicating loss of bedding. It can rock underfoot at the walkway edge.',
          location_in_photo: 'Top of the wall, upper-left area',
          trade: 'concrete',
          severity: 'medium',
          recommended_action: 'Lift, re-bed and re-level the displaced unit; check adjacent units for hollowness.',
        },
        {
          id: 3,
          title: 'Loose gravel spilling onto walkway',
          description:
            'Aggregate from the raised bed has migrated over the wall and onto the paved path, creating a slip risk for pedestrians.',
          location_in_photo: 'Base of the wall, bottom of the photo',
          trade: 'general',
          severity: 'medium',
          recommended_action: 'Sweep the walkway and add edge restraint or top up bedding to contain the gravel.',
        },
        {
          id: 4,
          title: 'Organic growth on wall face',
          description:
            'Moss and organic staining on the block faces retain moisture against the wall, accelerating surface weathering and freeze–thaw damage.',
          location_in_photo: 'Left half of the wall face',
          trade: 'general',
          severity: 'low',
          recommended_action: 'Clean the wall face with a biocide wash after the structural repair is complete.',
        },
      ],
    },
  },
  {
    id: 'basement-wiring',
    label: 'Basement utility room',
    photo: '/samples/basement-wiring.jpg',
    credit: 'Wikimedia Commons (public domain)',
    creditUrl:
      'https://commons.wikimedia.org/wiki/File:EFTA00000341_-_Empty_basement_room_with_exposed_electrical_wiring_panels_and_pipes_on_the_wall_leading_to_a_doorway_into_another_space.jpg',
    result: {
      scene_summary:
        'Basement utility room with surface-mounted electrical panels, conduit and overhead insulated piping, next to an open double door into a corridor. Wiring is partly unsecured and finishes are incomplete.',
      items: [
        {
          id: 1,
          title: 'Unsecured cable hanging to floor',
          description:
            'A cable drops loosely from the control equipment down to the floor instead of being routed in conduit or secured to the wall, leaving it exposed to snagging and mechanical damage.',
          location_in_photo: 'Center wall, below the gray control boxes',
          trade: 'electrical',
          severity: 'high',
          recommended_action:
            'Re-route the cable in conduit or secure it with appropriate fasteners; verify termination at both ends complies with code.',
        },
        {
          id: 2,
          title: 'Stained / degraded pipe insulation',
          description:
            'Overhead pipe insulation shows staining and surface damage at several joints, which can indicate past leaks or condensation and reduces insulation performance.',
          location_in_photo: 'Ceiling, upper-right pipes',
          trade: 'plumbing',
          severity: 'medium',
          recommended_action:
            'Inspect the pipework at stained sections for active leaks; replace damaged insulation sleeves.',
        },
        {
          id: 3,
          title: 'Unfinished wall patches',
          description:
            'Several areas of the wall show filled but unpainted patches and scuffing around the equipment, leaving the room without a finished, cleanable surface.',
          location_in_photo: 'Left and center walls around panels',
          trade: 'paint',
          severity: 'low',
          recommended_action: 'Sand, prime and repaint patched areas once electrical work is signed off.',
        },
        {
          id: 4,
          title: 'Loose item leaning on services',
          description:
            'A framed panel/picture rests against wall-mounted conduit, which can stress fittings and blocks access to the equipment.',
          location_in_photo: 'Center-left, leaning against conduit',
          trade: 'general',
          severity: 'low',
          recommended_action: 'Remove stored items from service walls and keep clearance in front of panels.',
        },
      ],
    },
  },
  {
    id: 'water-damage-ceiling',
    label: 'Water-damaged ceiling',
    photo: '/samples/water-damage-ceiling.jpg',
    credit: 'Wikimedia Commons (CC0)',
    creditUrl:
      'https://commons.wikimedia.org/wiki/File:Ceiling_sheetrock_damaged_by_water_so_paint_was_peeling.jpg',
    result: {
      scene_summary:
        'Interior ceiling with a large area of peeling, delaminating paint and brown water staining on the sheetrock, consistent with water ingress from above.',
      items: [
        {
          id: 1,
          title: 'Water staining indicates leak above',
          description:
            'Brown staining across the exposed sheetrock shows water has penetrated the ceiling. Until the source is found, damage will recur and there is a risk of hidden mold growth.',
          location_in_photo: 'Center of the ceiling, within the peeled area',
          trade: 'plumbing',
          severity: 'high',
          recommended_action:
            'Locate and repair the water source (roof or plumbing above) before any cosmetic work; check the cavity for moisture and mold.',
        },
        {
          id: 2,
          title: 'Extensive paint delamination',
          description:
            'Paint has blistered and peeled over a large area, with loose flakes still attached at the edges that will continue to detach and fall.',
          location_in_photo: 'Across the center of the ceiling',
          trade: 'paint',
          severity: 'medium',
          recommended_action:
            'After the leak is fixed and the substrate is dry, scrape back to a sound edge, seal with stain-blocking primer and repaint.',
        },
        {
          id: 3,
          title: 'Possible sheetrock damage',
          description:
            'The stained board may have softened or lost paper bond where it was saturated; paint alone will not restore a sound surface if the board is compromised.',
          location_in_photo: 'Stained area, center of the ceiling',
          trade: 'drywall',
          severity: 'medium',
          recommended_action:
            'Probe the stained board for softness; cut out and replace any compromised sheetrock, then tape, skim and refinish.',
        },
      ],
    },
  },
]
