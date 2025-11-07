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

export const exportUrenRegistraties = (registraties: any[], separator: string = ';') => {
  const headers = ['Datum', 'Gebruiker', 'Project', 'Werktype', 'Uren', 'Omschrijving', 'Kilometers', 'Materiaal (tekst)', 'Materiaal (afgeboekt)'];
  const data = registraties.map(reg => {
    // Format afgeboekte materialen
    let afgeboektMateriaal = '';
    if (reg.materials && Array.isArray(reg.materials) && reg.materials.length > 0) {
      afgeboektMateriaal = reg.materials.map((mat: any) => {
        const name = mat.type === 'product' ? mat.product_name : mat.description;
        return `${name}: ${mat.quantity} ${mat.unit}`;
      }).join('; ');
    }

    return {
      datum: formatDate(reg.datum),
      gebruiker: reg.user_naam || '',
      project: reg.project_naam || '',
      werktype: reg.werktype,
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