import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';

interface InvoiceData {
  projectNaam: string;
  projectNummer: string;
  klantNaam?: string;
  klantAdres?: string;
  factuurNummer: string;
  factuurDatum: string;
  vervaldatum: string;
  urenRegistraties: Array<{
    datum: string;
    naam: string;
    uren: number;
    tarief: number;
    subtotaal: number;
  }>;
  totaalUren: number;
  totaalBedrag: number;
  btwBedrag: number;
  totaalInclBTW: number;
}

export const generateInvoicePDF = async (projectId: string, projectNaam: string, projectNummer: string) => {
  try {
    // Haal invoice settings op
    const { data: settings } = await supabase
      .from('invoice_settings')
      .select('*')
      .maybeSingle();

    if (!settings) {
      throw new Error('Geen factuur instellingen gevonden');
    }

    // Haal urenregistraties op voor dit project
    const { data: timeRegs, error: timeRegsError } = await supabase
      .from('time_registrations')
      .select('*')
      .eq('project_id', projectId)
      .order('datum', { ascending: true });

    if (timeRegsError) {
      console.error('Error fetching time registrations:', timeRegsError);
      throw new Error('Fout bij het ophalen van urenregistraties: ' + timeRegsError.message);
    }

    if (!timeRegs || timeRegs.length === 0) {
      throw new Error('Geen urenregistraties gevonden voor dit project');
    }

    // Haal unieke user IDs op
    const userIds = [...new Set(timeRegs.map((reg: any) => reg.user_id))];

    // Haal profiles op
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, naam, hourly_rate_sale')
      .in('id', userIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw new Error('Fout bij het ophalen van gebruikersgegevens');
    }

    // Maak een map van user_id naar profile
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Bereken totalen
    const urenData = timeRegs.map((reg: any) => {
      const profile = profileMap.get(reg.user_id);
      const tarief = profile?.hourly_rate_sale || 50; // Default tarief
      const subtotaal = reg.aantal_uren * tarief;
      return {
        datum: new Date(reg.datum).toLocaleDateString('nl-NL'),
        naam: profile?.naam || 'Onbekend',
        uren: reg.aantal_uren,
        tarief: tarief,
        subtotaal: subtotaal
      };
    });

    const totaalUren = urenData.reduce((sum, item) => sum + item.uren, 0);
    const totaalBedrag = urenData.reduce((sum, item) => sum + item.subtotaal, 0);
    const btwBedrag = totaalBedrag * 0.21;
    const totaalInclBTW = totaalBedrag + btwBedrag;

    // Genereer factuurnummer
    const factuurNummer = `${settings.invoice_prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
    const factuurDatum = new Date().toLocaleDateString('nl-NL');
    const vervaldatum = new Date(Date.now() + settings.payment_terms_days * 24 * 60 * 60 * 1000).toLocaleDateString('nl-NL');

    // Maak PDF
    const doc = new jsPDF();

    // Logo (indien beschikbaar)
    if (settings.logo_url) {
      try {
        doc.addImage(settings.logo_url, 'SVG', 15, 15, 40, 20);
      } catch (e) {
        console.warn('Logo kon niet worden geladen');
      }
    }

    // Bedrijfsgegevens (links boven)
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.company_name, 15, 45);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    let yPos = 52;
    if (settings.address_street) {
      doc.text(settings.address_street, 15, yPos);
      yPos += 5;
    }
    if (settings.address_zip || settings.address_city) {
      doc.text(`${settings.address_zip} ${settings.address_city}`, 15, yPos);
      yPos += 5;
    }
    if (settings.phone) {
      doc.text(`Tel: ${settings.phone}`, 15, yPos);
      yPos += 5;
    }
    if (settings.email) {
      doc.text(`Email: ${settings.email}`, 15, yPos);
      yPos += 5;
    }

    // Factuur titel en nummers (rechts boven)
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('FACTUUR', 200, 45, { align: 'right' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Factuurnummer: ${factuurNummer}`, 200, 55, { align: 'right' });
    doc.text(`Factuurdatum: ${factuurDatum}`, 200, 62, { align: 'right' });
    doc.text(`Vervaldatum: ${vervaldatum}`, 200, 69, { align: 'right' });

    // Project informatie
    yPos = 90;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Project:', 15, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(`${projectNaam} (${projectNummer})`, 15, yPos + 6);

    // Tabel met urenregistraties
    autoTable(doc, {
      startY: yPos + 15,
      head: [['Datum', 'Medewerker', 'Uren', 'Tarief (€/uur)', 'Subtotaal (€)']],
      body: urenData.map(item => [
        item.datum,
        item.naam,
        item.uren.toFixed(2),
        item.tarief.toFixed(2),
        item.subtotaal.toFixed(2)
      ]),
      foot: [[
        '',
        'Totaal:',
        totaalUren.toFixed(2) + ' uur',
        '',
        totaalBedrag.toFixed(2)
      ]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [220, 38, 38], textColor: 255 },
      footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold' }
    });

    // BTW en totalen
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);

    doc.text('Subtotaal:', 140, finalY);
    doc.text(`€ ${totaalBedrag.toFixed(2)}`, 200, finalY, { align: 'right' });

    doc.text('BTW (21%):', 140, finalY + 7);
    doc.text(`€ ${btwBedrag.toFixed(2)}`, 200, finalY + 7, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Totaal incl. BTW:', 140, finalY + 15);
    doc.text(`€ ${totaalInclBTW.toFixed(2)}`, 200, finalY + 15, { align: 'right' });

    // Bedrijfsgegevens onder aan
    let footerY = finalY + 30;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    if (settings.kvk_number) {
      doc.text(`KVK: ${settings.kvk_number}`, 15, footerY);
      footerY += 4;
    }
    if (settings.btw_number) {
      doc.text(`BTW: ${settings.btw_number}`, 15, footerY);
      footerY += 4;
    }
    if (settings.iban) {
      doc.text(`IBAN: ${settings.iban}`, 15, footerY);
      footerY += 4;
    }

    // Footer tekst
    if (settings.invoice_footer) {
      doc.setFontSize(9);
      doc.text(settings.invoice_footer, 105, 280, { align: 'center', maxWidth: 180 });
    }

    // Opslaan
    doc.save(`Factuur-${factuurNummer}-${projectNaam}.pdf`);

    return {
      success: true,
      factuurNummer,
      message: 'Factuur succesvol gegenereerd!'
    };
  } catch (error: any) {
    console.error('Error generating invoice:', error);
    throw new Error(error.message || 'Fout bij het genereren van de factuur');
  }
};
