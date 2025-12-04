import { UrenRegistratie, MagazijnItem } from '../types';
import { formatDate } from './dateUtils';

export const exportToCSV = (data: any[], filename: string, headers: string[], separator: string = ';') => {
  const csvContent = [
    headers.join(separator),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header.toLowerCase().replace(/\s+/g, '')];
        // Keep value as-is if it's already a string, otherwise convert
        const stringValue = typeof value === 'string' ? value : (value !== null && value !== undefined ? String(value) : '');
        return stringValue.includes(separator) || stringValue.includes('"') || stringValue.includes('\n')
          ? `"${stringValue.replace(/"/g, '""')}"`
          : stringValue;
      }).join(separator)
    )
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export const exportUrenRegistraties = (registraties: any[], separator: string = ';', workCodes: any[] = [], projectWorkCodes: any[] = []) => {
  const headers = ['Datum', 'Gebruiker', 'Project', 'Bewakingscode', 'Bewakingscode Naam', 'Uren', 'Omschrijving', 'Kilometers', 'Materiaal (tekst)', 'Materiaal (afgeboekt)'];
  const data = registraties.map(reg => {
    // Format afgeboekte materialen
    let afgeboektMateriaal = '';
    if (reg.materials && Array.isArray(reg.materials) && reg.materials.length > 0) {
      afgeboektMateriaal = reg.materials.map((mat: any) => {
        const name = mat.type === 'product' ? mat.product_name : mat.description;
        return `${name}: ${mat.quantity} ${mat.unit}`;
      }).join('; ');
    }

    // Get bewakingscode and name
    // werktype can contain: code, name, or "code - name" format
    const werktypeValue = reg.werktype || '';
    let bewakingscode = '';
    let bewakingscodeNaam = '';

    if (werktypeValue) {
      // First check if it's in "CODE - Name" format (e.g., "MW01 - Meerwerk")
      const codeNameMatch = werktypeValue.match(/^([A-Z0-9]+)\s*-\s*(.+)$/i);
      if (codeNameMatch) {
        bewakingscode = codeNameMatch[1];
        bewakingscodeNaam = codeNameMatch[2].trim();
      } else if (workCodes && workCodes.length > 0) {
        // Try to find by code first
        let workCode = workCodes.find((wc: any) => wc.code === werktypeValue);

        // If not found by code, try to find by name
        if (!workCode) {
          workCode = workCodes.find((wc: any) => wc.name === werktypeValue);
        }

        // If still not found, check project-specific codes
        if (!workCode && projectWorkCodes && projectWorkCodes.length > 0) {
          const projectCode = projectWorkCodes.find((pwc: any) =>
            pwc.custom_name === werktypeValue ||
            pwc.custom_code === werktypeValue ||
            (pwc.work_codes && pwc.work_codes.name === werktypeValue)
          );
          if (projectCode) {
            if (projectCode.custom_code) {
              bewakingscode = projectCode.custom_code;
              bewakingscodeNaam = projectCode.custom_name || '';
            } else if (projectCode.work_codes) {
              bewakingscode = projectCode.work_codes.code;
              bewakingscodeNaam = projectCode.work_codes.name;
            }
          }
        }

        if (workCode) {
          bewakingscode = workCode.code;
          bewakingscodeNaam = workCode.name;
        } else if (!bewakingscode) {
          // If no match found, use the original value as the name
          bewakingscodeNaam = werktypeValue;
        }
      } else {
        // No work codes available, just use what we have
        bewakingscodeNaam = werktypeValue;
      }
    }

    return {
      datum: formatDate(reg.datum),
      gebruiker: reg.user_naam || '',
      project: reg.project_naam || '',
      bewakingscode: bewakingscode,
      bewakingscodenaam: bewakingscodeNaam,
      uren: String(reg.aantal_uren).replace('.', ','),
      omschrijving: reg.werkomschrijving || '',
      kilometers: reg.driven_kilometers ? String(reg.driven_kilometers).replace('.', ',') : '0',
      'materiaal(tekst)': reg.verbruikt_materiaal || '',
      'materiaal(afgeboekt)': afgeboektMateriaal
    };
  });

  exportToCSV(data, 'urenregistraties', headers, separator);
};

export const exportMagazijnItems = (items: MagazijnItem[], separator: string = ';') => {
  const headers = ['Naam', 'Barcode', 'Categorie', 'Locatie', 'Voorraad', 'Minimum Voorraad', 'Eenheid', 'Prijs', 'Leverancier'];
  const data = items.map(item => ({
    naam: item.naam,
    barcode: item.barcode || '',
    categorie: item.categorie,
    locatie: item.locatie,
    voorraad: item.voorraad,
    minimumvoorraad: item.minimumVoorraad,
    eenheid: item.eenheid,
    prijs: item.prijs || '',
    leverancier: item.leverancier || ''
  }));

  exportToCSV(data, 'magazijn_voorraad', headers, separator);
};