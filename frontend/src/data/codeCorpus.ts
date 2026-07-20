import type { CodeSearchResponse } from '../api'

export interface CodeSection {
  section: string
  title: string
  text: string
  sourceUrl: string
}

// A curated subset of 29 CFR 1926 (OSHA's construction safety standards) —
// U.S. federal regulation text, public domain. Every `text` value below was
// copied verbatim from osha.gov's own standard pages (not paraphrased, not
// generated) and spot-checked against the raw page HTML before inclusion —
// the same discipline as sourcing the CC0 sample photos, applied to text.
// This is a small reference subset for demo purposes, not the full Part 1926.
export const CODE_CORPUS: CodeSection[] = [
  {
    section: '1926.405(b)(2)',
    title: 'Electrical — cabinets, boxes, and fittings: covers and canopies',
    text:
      'All pull boxes, junction boxes, and fittings shall be provided with covers. In energized ' +
      'installations each outlet box shall have a cover, faceplate, or fixture canopy. Covers of ' +
      'outlet boxes having holes through which flexible cord pendants pass shall be provided with ' +
      'bushings designed for the purpose or shall have smooth, well-rounded surfaces on which the ' +
      'cords may bear.',
    sourceUrl: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.405#1926.405(b)(2)',
  },
  {
    section: '1926.405(d)',
    title: 'Electrical — switchboards and panelboards',
    text:
      'Switchboards that have any exposed live parts shall be located in permanently dry locations ' +
      'and accessible only to qualified persons. Panelboards shall be mounted in cabinets, cutout ' +
      'boxes, or enclosures designed for the purpose and shall be dead front. However, panelboards ' +
      'other than the dead front externally-operable type are permitted where accessible only to ' +
      'qualified persons. Exposed blades of knife switches shall be dead when open.',
    sourceUrl: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.405#1926.405(d)',
  },
  {
    section: '1926.416(a)(1)',
    title: 'Electrical — protection of employees, general',
    text:
      'No employer shall permit an employee to work in such proximity to any part of an electric ' +
      'power circuit that the employee could contact the electric power circuit in the course of ' +
      'work, unless the employee is protected against electric shock by deenergizing the circuit ' +
      'and grounding it or by guarding it effectively by insulation or other means.',
    sourceUrl: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.416#1926.416(a)(1)',
  },
  {
    section: '1926.416(b)(1)',
    title: 'Electrical — passageways and open spaces, workspace guarding',
    text:
      'Barriers or other means of guarding shall be provided to ensure that workspace for electrical ' +
      'equipment will not be used as a passageway during periods when energized parts of electrical ' +
      'equipment are exposed.',
    sourceUrl: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.416#1926.416(b)(1)',
  },
  {
    section: '1926.501(b)(1)',
    title: 'Fall protection — unprotected sides and edges',
    text:
      'Each employee on a walking/working surface (horizontal and vertical surface) with an ' +
      'unprotected side or edge which is 6 feet (1.8 m) or more above a lower level shall be ' +
      'protected from falling by the use of guardrail systems, safety net systems, or personal fall ' +
      'arrest systems.',
    sourceUrl: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.501#1926.501(b)(1)',
  },
  {
    section: '1926.501(b)(4)(i)',
    title: 'Fall protection — holes',
    text:
      'Each employee on walking/working surfaces shall be protected from falling through holes ' +
      '(including skylights) more than 6 feet (1.8 m) above lower levels, by personal fall arrest ' +
      'systems, covers, or guardrail systems erected around such holes.',
    sourceUrl: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.501#1926.501(b)(4)(i)',
  },
  {
    section: '1926.25(a)',
    title: 'Housekeeping — debris and clearance of work areas',
    text:
      'During the course of construction, alteration, or repairs, form and scrap lumber with ' +
      'protruding nails, and all other debris, shall be kept cleared from work areas, passageways, ' +
      'and stairs, in and around buildings or other structures.',
    sourceUrl: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.25#1926.25(a)',
  },
  {
    section: '1926.25(c)',
    title: 'Housekeeping — waste containers',
    text:
      'Containers shall be provided for the collection and separation of waste, trash, oily and used ' +
      'rags, and other refuse. Containers used for garbage and other oily, flammable, or hazardous ' +
      'wastes, such as caustics, acids, harmful dusts, etc. shall be equipped with covers. Garbage ' +
      'and other waste shall be disposed of at frequent and regular intervals.',
    sourceUrl: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.25#1926.25(c)',
  },
  {
    section: '1926.95(a)',
    title: 'Personal protective equipment — application',
    text:
      'Protective equipment, including personal protective equipment for eyes, face, head, and ' +
      'extremities, protective clothing, respiratory devices, and protective shields and barriers, ' +
      'shall be provided, used, and maintained in a sanitary and reliable condition wherever it is ' +
      'necessary by reason of hazards of processes or environment, chemical hazards, radiological ' +
      'hazards, or mechanical irritants encountered in a manner capable of causing injury or ' +
      'impairment in the function of any part of the body through absorption, inhalation or physical ' +
      'contact.',
    sourceUrl: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.95#1926.95(a)',
  },
  {
    section: '1926.451(g)(1)',
    title: 'Scaffolding — fall protection above 10 feet',
    text:
      'Each employee on a scaffold more than 10 feet (3.1 m) above a lower level shall be protected ' +
      'from falling to that lower level. Paragraphs (g)(1) (i) through (vii) of this section ' +
      'establish the types of fall protection to be provided to the employees on each type of ' +
      'scaffold. Paragraph (g)(2) of this section addresses fall protection for scaffold erectors ' +
      'and dismantlers.',
    sourceUrl: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.451#1926.451(g)(1)',
  },
  {
    section: '1926.451(g)(4)(ii)',
    title: 'Scaffolding — guardrail systems',
    text:
      'Guardrail systems shall be installed along all open sides and ends of platforms. Guardrail ' +
      'systems shall be installed before the scaffold is released for use by employees other than ' +
      'erection/dismantling crews.',
    sourceUrl: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.451#1926.451(g)(4)(ii)',
  },
  {
    section: '1926.651(b)(1)',
    title: 'Excavations — underground installations',
    text:
      'The estimated location of utility installations, such as sewer, telephone, fuel, electric, ' +
      'water lines, or any other underground installations that reasonably may be expected to be ' +
      'encountered during excavation work, shall be determined prior to opening an excavation.',
    sourceUrl: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.651#1926.651(b)(1)',
  },
  {
    section: '1926.651(j)(1)',
    title: 'Excavations — protection from loose rock or soil',
    text:
      'Adequate protection shall be provided to protect employees from loose rock or soil that could ' +
      'pose a hazard by falling or rolling from an excavation face. Such protection shall consist of ' +
      'scaling to remove loose material; installation of protective barricades at intervals as ' +
      'necessary on the face to stop and contain falling material; or other means that provide ' +
      'equivalent protection.',
    sourceUrl: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.651#1926.651(j)(1)',
  },
  {
    section: '1926.1053(b)(15)',
    title: 'Ladders — inspection',
    text:
      'Ladders shall be inspected by a competent person for visible defects on a periodic basis and ' +
      'after any occurrence that could affect their safe use.',
    sourceUrl: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.1053#1926.1053(b)(15)',
  },
  {
    section: '1926.1053(b)(16)',
    title: 'Ladders — defective ladders withdrawn from service',
    text:
      'Portable ladders with structural defects, such as, but not limited to, broken or missing ' +
      'rungs, cleats, or steps, broken or split rails, corroded components, or other faulty or ' +
      'defective components, shall either be immediately marked in a manner that readily identifies ' +
      'them as defective, or be tagged with "Do Not Use" or similar language, and shall be withdrawn ' +
      'from service until repaired.',
    sourceUrl: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.1053#1926.1053(b)(16)',
  },
  {
    section: '1926.150(a)(1)',
    title: 'Fire protection — employer responsibility',
    text:
      'The employer shall be responsible for the development of a fire protection program to be ' +
      'followed throughout all phases of the construction and demolition work, and he shall provide ' +
      'for the firefighting equipment as specified in this subpart. As fire hazards occur, there ' +
      'shall be no delay in providing the necessary equipment.',
    sourceUrl: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.150#1926.150(a)(1)',
  },
  {
    section: '1926.150(a)(2)',
    title: 'Fire protection — access to firefighting equipment',
    text: 'Access to all available firefighting equipment shall be maintained at all times.',
    sourceUrl: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.150#1926.150(a)(2)',
  },
  {
    section: '1926.703(a)(1)',
    title: 'Concrete — formwork design',
    text:
      'Formwork shall be designed, fabricated, erected, supported, braced and maintained so that it ' +
      'will be capable of supporting without failure all vertical and lateral loads that may ' +
      'reasonably be anticipated to be applied to the formwork. Formwork which is designed, ' +
      'fabricated, erected, supported, braced and maintained in conformance with the appendix to ' +
      'this section will be deemed to meet the requirements of this paragraph.',
    sourceUrl: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.703#1926.703(a)(1)',
  },
  {
    section: '1926.20(b)(1)',
    title: 'General safety and health — accident prevention programs',
    text: 'It shall be the responsibility of the employer to initiate and maintain such programs as may be necessary to comply with this part.',
    sourceUrl: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.20#1926.20(b)(1)',
  },
  {
    section: '1926.20(b)(2)',
    title: 'General safety and health — jobsite inspections',
    text:
      'Such programs shall provide for frequent and regular inspections of the job sites, materials, ' +
      'and equipment to be made by competent persons designated by the employers.',
    sourceUrl: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.20#1926.20(b)(2)',
  },
]

// Pre-computed answers so Codes is explorable with zero API key. Three are
// grounded in this corpus subset; the fourth deliberately demonstrates the
// honest refusal — asking about a topic (crane operations) this curated
// subset doesn't include, rather than guessing at what the fuller code says.
export const CODE_SUGGESTED_QUESTIONS: { question: string; answer: CodeSearchResponse }[] = [
  {
    question: 'What does OSHA require for electrical panel covers?',
    answer: {
      answer:
        'Electrical enclosures need covers: pull boxes, junction boxes, and outlet boxes must have ' +
        'covers, faceplates, or fixture canopies, and panelboards specifically must be mounted in ' +
        'cabinets or enclosures designed for the purpose and be dead front — an open panel with live ' +
        'components exposed meets neither requirement.',
      grounded: true,
      citations: [
        {
          section: '1926.405(b)(2)',
          title: 'Electrical — cabinets, boxes, and fittings: covers and canopies',
          quote: 'All pull boxes, junction boxes, and fittings shall be provided with covers.',
        },
        {
          section: '1926.405(d)',
          title: 'Electrical — switchboards and panelboards',
          quote:
            'Panelboards shall be mounted in cabinets, cutout boxes, or enclosures designed for the ' +
            'purpose and shall be dead front.',
        },
      ],
    },
  },
  {
    question: 'When do workers need fall protection?',
    answer: {
      answer:
        'Any employee on a walking/working surface with an unprotected side or edge 6 feet (1.8 m) or ' +
        'more above a lower level must be protected — by guardrail systems, safety net systems, or a ' +
        'personal fall arrest system.',
      grounded: true,
      citations: [
        {
          section: '1926.501(b)(1)',
          title: 'Fall protection — unprotected sides and edges',
          quote:
            'Each employee on a walking/working surface (horizontal and vertical surface) with an ' +
            'unprotected side or edge which is 6 feet (1.8 m) or more above a lower level shall be ' +
            'protected from falling by the use of guardrail systems, safety net systems, or personal ' +
            'fall arrest systems.',
        },
      ],
    },
  },
  {
    question: 'What are the housekeeping requirements for debris on a job site?',
    answer: {
      answer:
        'During construction, alteration, or repairs, form and scrap lumber (including anything with ' +
        'protruding nails) and all other debris must be kept cleared from work areas, passageways, ' +
        'and stairs, in and around buildings or other structures.',
      grounded: true,
      citations: [
        {
          section: '1926.25(a)',
          title: 'Housekeeping — debris and clearance of work areas',
          quote:
            'During the course of construction, alteration, or repairs, form and scrap lumber with ' +
            'protruding nails, and all other debris, shall be kept cleared from work areas, ' +
            'passageways, and stairs, in and around buildings or other structures.',
        },
      ],
    },
  },
  {
    question: 'What certification do crane operators need?',
    answer: {
      answer:
        "This corpus doesn't cover crane operations — that's Subpart CC of 29 CFR 1926, which isn't " +
        'part of this curated subset. Answering would require adding those sections rather than ' +
        'guessing from what construction codes typically require.',
      grounded: false,
      citations: [],
    },
  },
]
