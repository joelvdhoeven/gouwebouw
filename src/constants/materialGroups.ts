/**
 * Material Groups Constants
 * Defines the 10 material groups for inventory classification
 */

export interface MaterialGroup {
  code: string;
  name: string;
  description: string;
}

export const MATERIAL_GROUPS: MaterialGroup[] = [
  {
    code: '01',
    name: 'Diversen',
    description: 'Isolatiematerialen, funderingsmaterialen, elektromaterialen, rioleringsmaterialen, rubbers (kozijnen), folies, voegklemmen, spouwankers, etc.'
  },
  {
    code: '02',
    name: 'Pur & Kit',
    description: 'Pur, kitten, aanverwanten als cleaner, primer, etc.'
  },
  {
    code: '03',
    name: 'Montage',
    description: 'Schroeven, kozijnschroeven, vulplaatjes, Hannoband, etc.'
  },
  {
    code: '04',
    name: 'Afwerking',
    description: 'Vensterbanken (kunststof/hardsteen), afwerklijsten (kunststof/MDF), binnendeurdorpels, douchedorpels, etc.'
  },
  {
    code: '05',
    name: 'Gevelbekledingen',
    description: 'Rabat, gevelsteen, volkern kunststof, etc.'
  },
  {
    code: '06',
    name: 'Hout',
    description: 'Houten balken, houten beplating, etc.'
  },
  {
    code: '07',
    name: 'Zakgoed',
    description: 'Mortels (metselen/stuc), etc.'
  },
  {
    code: '08',
    name: 'Tapes en bescherming',
    description: 'Ducttape, paneltap, primacover, etc.'
  },
  {
    code: '09',
    name: '—',
    description: 'Gereserveerd voor toekomstig gebruik'
  },
  {
    code: '10',
    name: '—',
    description: 'Gereserveerd voor toekomstig gebruik'
  }
];

/**
 * Get material group by code
 */
export const getMaterialGroupByCode = (code: string): MaterialGroup | undefined => {
  return MATERIAL_GROUPS.find(group => group.code === code);
};

/**
 * Get material group display name (code + name)
 */
export const getMaterialGroupDisplayName = (code: string): string => {
  const group = getMaterialGroupByCode(code);
  return group ? `${group.code} ${group.name}` : code;
};
