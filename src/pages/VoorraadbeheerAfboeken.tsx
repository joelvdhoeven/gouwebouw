import React, { useState, useEffect, useRef } from 'react';
import { Scan, X, Plus, Minus, CheckCircle, AlertCircle, Trash2, FileText, Download, Search, Upload, FileSpreadsheet } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import { exportToCSV } from '../utils/exportUtils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useSystemSettings } from '../contexts/SystemSettingsContext';
import { Html5Qrcode } from 'html5-qrcode';

interface Product {
  id: string;
  name: string;
  sku: string;
  ean: string | null;
  category: string;
  unit: string;
  minimum_stock: number;
  description: string | null;
  supplier: string | null;
  price: number | null;
}

interface Location {
  id: string;
  name: string;
  type: string;
  license_plate: string | null;
  description: string | null;
}

interface Project {
  id: string;
  naam: string;
  project_nummer: string | null;
}

interface BookingLine {
  searchValue: string;
  product: Product | null;
  quantity: number;
  showDropdown: boolean;
  location: string;
}

interface StockItem {
  product_id: string;
  product: Product;
  quantity: number;
  location_id: string;
}

interface Transaction {
  id: string;
  created_at: string;
  product_id: string;
  location_id: string;
  project_id: string;
  user_id: string;
  transaction_type: string;
  quantity: number;
  notes: string | null;
  product?: Product;
  location?: Location;
  project?: Project;
  user?: { id: string; email: string; naam: string | null };
}

type DateFilter = 'vandaag' | 'deze_week' | 'deze_maand' | 'dit_jaar' | 'custom';

const VoorraadbeheerAfboeken: React.FC = () => {
  const { user } = useAuth();
  const { getCsvSeparator } = useSystemSettings();
  const [projects, setProjects] = useState<Project[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockModalLineIndex, setStockModalLineIndex] = useState<number | null>(null);
  const [locationStock, setLocationStock] = useState<StockItem[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [bookingLines, setBookingLines] = useState<BookingLine[]>([{ searchValue: '', product: null, quantity: 1, showDropdown: false, location: '' }]);
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanningForLineIndex, setScanningForLineIndex] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showOverview, setShowOverview] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('deze_maand');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userRole, setUserRole] = useState<string>('medewerker');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (showOverview) {
      loadTransactions();
    }
  }, [showOverview]);

  useEffect(() => {
    // Reset selection when filters change
    setSelectedTransactions(new Set());
  }, [searchTerm, dateFilter, customStartDate, customEndDate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.product-search-container')) {
        setBookingLines(lines => lines.map(line => ({ ...line, showDropdown: false })));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    try {
      const [productsRes, locationsRes, projectsRes] = await Promise.all([
        supabase.from('inventory_products').select('*').order('name'),
        supabase.from('inventory_locations').select('*').order('name'),
        supabase.from('projects').select('id, naam, project_nummer').eq('status', 'actief').order('naam')
      ]);

      if (productsRes.data) setProducts(productsRes.data);
      if (locationsRes.data) setLocations(locationsRes.data);
      if (projectsRes.data) setProjects(projectsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const startScanning = async (lineIndex: number) => {
    try {
      setShowScanner(true);
      setScanning(true);
      setScanningForLineIndex(lineIndex);
      setErrorMessage('');

      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        throw new Error('Geen camera gevonden');
      }

      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      await scanner.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        (errorMessage) => {
        }
      );
    } catch (error: any) {
      console.error('Error starting scanner:', error);
      const errorMsg = error.message || 'Kon camera niet starten. Controleer de camera permissies.';
      setErrorMessage(errorMsg);
      setShowScanner(false);
      setScanning(false);
      setScanningForLineIndex(null);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        scannerRef.current = null;
      } catch (error) {
        console.error('Error stopping scanner:', error);
      }
    }
    setShowScanner(false);
    setScanning(false);
    setScanningForLineIndex(null);
  };

  const handleScanSuccess = (decodedText: string) => {
    if (scanningForLineIndex !== null) {
      updateLineSearch(scanningForLineIndex, decodedText);
      stopScanning();
    }
  };

  const updateLineSearch = (index: number, value: string) => {
    const newLines = [...bookingLines];
    newLines[index].searchValue = value;
    newLines[index].showDropdown = value.length > 0;

    const foundProduct = products.find(p =>
      p.ean === value ||
      p.sku.toLowerCase() === value.toLowerCase()
    );

    newLines[index].product = foundProduct || null;
    setBookingLines(newLines);
  };

  const selectProduct = (index: number, product: Product) => {
    const newLines = [...bookingLines];
    newLines[index].product = product;
    newLines[index].searchValue = product.name;
    newLines[index].showDropdown = false;
    setBookingLines(newLines);
  };

  const getFilteredProducts = (searchValue: string) => {
    if (!searchValue) return [];
    const search = searchValue.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(search) ||
      p.sku.toLowerCase().includes(search) ||
      (p.ean && p.ean.toLowerCase().includes(search))
    ).slice(0, 5);
  };

  const updateLineQuantity = (index: number, delta: number) => {
    const newLines = [...bookingLines];
    newLines[index].quantity = Math.max(1, newLines[index].quantity + delta);
    setBookingLines(newLines);
  };

  const addLine = () => {
    setBookingLines([...bookingLines, { searchValue: '', product: null, quantity: 1, showDropdown: false, location: '' }]);
  };

  const updateLineLocation = (index: number, locationId: string) => {
    const newLines = [...bookingLines];
    newLines[index].location = locationId;
    setBookingLines(newLines);
  };

  const loadLocationStock = async (lineIndex: number) => {
    const line = bookingLines[lineIndex];
    if (!line.location) {
      setErrorMessage('Selecteer eerst een locatie');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    setStockModalLineIndex(lineIndex);
    setShowStockModal(true);
    setLoadingStock(true);

    try {
      const { data, error } = await supabase
        .from('inventory_stock')
        .select(`
          product_id,
          quantity,
          location_id,
          product:inventory_products!inventory_stock_product_id_fkey(*)
        `)
        .eq('location_id', line.location)
        .gt('quantity', 0)
        .order('product(name)');

      if (error) throw error;
      setLocationStock(data || []);
    } catch (error: any) {
      console.error('Error loading stock:', error);
      setErrorMessage('Fout bij het laden van voorraad');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setLoadingStock(false);
    }
  };

  const selectProductFromStock = (stockItem: StockItem) => {
    if (stockModalLineIndex !== null) {
      const newLines = [...bookingLines];
      newLines[stockModalLineIndex].product = stockItem.product;
      newLines[stockModalLineIndex].searchValue = stockItem.product.name;
      newLines[stockModalLineIndex].showDropdown = false;
      setBookingLines(newLines);
      setShowStockModal(false);
      setStockModalLineIndex(null);
    }
  };

  const removeLine = (index: number) => {
    if (bookingLines.length > 1) {
      setBookingLines(bookingLines.filter((_, i) => i !== index));
    }
  };

  const handleBookProducts = async () => {
    const validLines = bookingLines.filter(line => line.product !== null && line.location);

    if (!selectedProject) {
      setErrorMessage('Selecteer een project');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    const missingLocations = bookingLines.some(line => line.product && !line.location);
    if (missingLocations) {
      setErrorMessage('Selecteer een locatie voor alle producten');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    if (validLines.length === 0) {
      setErrorMessage('Voeg minimaal 1 geldig product toe');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    try {
      // Check stock availability for each product
      for (const line of validLines) {
        const { data: stockData, error: stockError } = await supabase
          .from('inventory_stock')
          .select('quantity')
          .eq('product_id', line.product!.id)
          .eq('location_id', line.location)
          .maybeSingle();

        if (stockError) {
          throw new Error(`Fout bij het controleren van voorraad: ${stockError.message}`);
        }

        const currentStock = stockData?.quantity || 0;

        if (currentStock < line.quantity) {
          const productName = line.product!.name;
          const locationName = locations.find(l => l.id === line.location)?.name || 'deze locatie';
          throw new Error(
            `Er is geen voorraad van "${productName}" op ${locationName}. ` +
            `Beschikbaar: ${currentStock} ${line.product!.unit}, Gevraagd: ${line.quantity} ${line.product!.unit}`
          );
        }
      }

      // All stock checks passed, proceed with transactions
      const projectName = projects.find(p => p.id === selectedProject)?.naam || '';
      const transactions = validLines.map(line => ({
        product_id: line.product!.id,
        location_id: line.location,
        project_id: selectedProject,
        user_id: user!.id,
        transaction_type: 'out' as const,
        quantity: -Math.abs(line.quantity),
        notes: `Afgeboekt naar project ${projectName}`
      }));

      const { error } = await supabase
        .from('inventory_transactions')
        .insert(transactions)
        .select();

      if (error) {
        if (error.code === '23503') {
          throw new Error('Een van de geselecteerde producten of locaties bestaat niet meer');
        }
        if (error.code === '23505') {
          throw new Error('Deze afboeking bestaat al in het systeem');
        }
        throw new Error(`Database fout: ${error.message}`);
      }

      setSuccessMessage('Producten succesvol afgeboekt!');
      setBookingLines([{ searchValue: '', product: null, quantity: 1, showDropdown: false, location: '' }]);
      setSelectedProject('');

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      console.error('Error booking products:', error);
      setErrorMessage(error.message || 'Fout bij het afboeken van producten');
      setTimeout(() => setErrorMessage(''), 5000);
    }
  };

  const getTotalItems = () => {
    return bookingLines
      .filter(line => line.product !== null)
      .reduce((sum, line) => sum + line.quantity, 0);
  };

  const loadTransactions = async () => {
    setLoadingTransactions(true);
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single();

      const role = profileData?.role || 'medewerker';
      setUserRole(role);
      const canViewAll = role === 'admin' || role === 'kantoor_medewerker';

      let query = supabase
        .from('inventory_transactions')
        .select(`
          *,
          product:inventory_products!inventory_transactions_product_id_fkey(*),
          location:inventory_locations!inventory_transactions_location_id_fkey(*),
          project:projects!inventory_transactions_project_id_fkey(id, naam, project_nummer),
          user:profiles!inventory_transactions_user_id_fkey(id, email, naam)
        `)
        .eq('transaction_type', 'out');

      if (!canViewAll) {
        query = query.eq('user_id', user?.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
      setErrorMessage('Fout bij het laden van afboekingen');
    } finally {
      setLoadingTransactions(false);
    }
  };

  const getDateRange = () => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    switch (dateFilter) {
      case 'vandaag':
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'deze_week':
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        startDate = new Date(now.setDate(diff));
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'deze_maand':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case 'dit_jaar':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      case 'custom':
        if (customStartDate) startDate = new Date(customStartDate);
        if (customEndDate) {
          endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);
        }
        break;
    }

    return { startDate, endDate };
  };

  const filteredTransactions = transactions.filter(transaction => {
    const { startDate, endDate } = getDateRange();
    const transactionDate = new Date(transaction.created_at);

    if (transactionDate < startDate || transactionDate > endDate) {
      return false;
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesProject = transaction.project?.naam.toLowerCase().includes(search) ||
                            transaction.project?.project_nummer?.toLowerCase().includes(search);
      const matchesUser = transaction.user?.naam?.toLowerCase().includes(search) ||
                         transaction.user?.email.toLowerCase().includes(search);
      const matchesProduct = transaction.product?.name.toLowerCase().includes(search) ||
                            transaction.product?.sku.toLowerCase().includes(search) ||
                            transaction.product?.category.toLowerCase().includes(search);
      const matchesLocation = transaction.location?.name.toLowerCase().includes(search);

      if (!matchesProject && !matchesUser && !matchesProduct && !matchesLocation) {
        return false;
      }
    }

    return true;
  });

  const handleExportTransactions = () => {
    if (filteredTransactions.length === 0) {
      setErrorMessage('Geen afboekingen om te exporteren');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    const separator = getCsvSeparator();
    const headers = ['Datum', 'Project', 'Product', 'Categorie', 'Aantal', 'Eenheid', 'Locatie', 'Medewerker', 'Opmerkingen'];
    const data = filteredTransactions.map(t => ({
      datum: formatDate(t.created_at),
      project: `${t.project?.naam || ''} ${t.project?.project_nummer ? `(#${t.project.project_nummer})` : ''}`,
      product: `${t.product?.name || ''} (${t.product?.sku || ''})`,
      categorie: t.product?.category || '',
      aantal: Math.abs(t.quantity),
      eenheid: t.product?.unit || '',
      locatie: t.location?.name || '',
      medewerker: t.user?.naam || t.user?.email || '',
      opmerkingen: t.notes || ''
    }));

    const csvContent = [
      headers.join(separator),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header.toLowerCase().replace(/\s+/g, '')];
          const stringValue = value !== null && value !== undefined ? String(value) : '';
          return stringValue.includes(separator) || stringValue.includes('"') || stringValue.includes('\n')
            ? `"${stringValue.replace(/"/g, '""')}"`
            : stringValue;
        }).join(separator)
      )
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `afboekingen_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadTemplate = () => {
    const separator = getCsvSeparator();
    const headers = ['Datum', 'Project', 'Product SKU', 'Aantal', 'Locatie', 'Opmerkingen'];
    const example = [
      `14-10-2025${separator}J. Raaijmakers${separator}CEM-25KG${separator}3${separator}Magazijn Moordrecht${separator}Afgeboekt naar project`,
      `14-10-2025${separator}A.S. Schuch${separator}AFD-FOL-45${separator}5${separator}Bus 2${separator}Materiaal gebruikt`
    ];

    const csvContent = [headers.join(separator), ...example].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'afboekingen_sjabloon.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async () => {
    if (!importFile) return;

    setImporting(true);
    try {
      const text = await importFile.text();
      const separator = getCsvSeparator();
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        throw new Error('Bestand is leeg of heeft geen data');
      }

      // Skip header
      const dataLines = lines.slice(1);
      const importedTransactions = [];

      for (const line of dataLines) {
        const values = line.split(separator).map(v => v.trim().replace(/^"|"$/g, ''));

        if (values.length < 6) continue;

        const [dateStr, projectName, productSku, quantityStr, locationName, notes] = values;

        // Find project
        const { data: projectData } = await supabase
          .from('projects')
          .select('id')
          .ilike('naam', `%${projectName}%`)
          .maybeSingle();

        if (!projectData) {
          console.warn(`Project niet gevonden: ${projectName}`);
          continue;
        }

        // Find product
        const { data: productData } = await supabase
          .from('inventory_products')
          .select('id')
          .eq('sku', productSku)
          .maybeSingle();

        if (!productData) {
          console.warn(`Product niet gevonden: ${productSku}`);
          continue;
        }

        // Find location
        const { data: locationData } = await supabase
          .from('inventory_locations')
          .select('id')
          .ilike('name', `%${locationName}%`)
          .maybeSingle();

        if (!locationData) {
          console.warn(`Locatie niet gevonden: ${locationName}`);
          continue;
        }

        importedTransactions.push({
          product_id: productData.id,
          location_id: locationData.id,
          project_id: projectData.id,
          user_id: user?.id,
          transaction_type: 'out',
          quantity: -Math.abs(parseFloat(quantityStr)),
          notes: notes || 'Geïmporteerd via CSV'
        });
      }

      if (importedTransactions.length === 0) {
        throw new Error('Geen geldige regels gevonden om te importeren');
      }

      const { error } = await supabase
        .from('inventory_transactions')
        .insert(importedTransactions);

      if (error) throw error;

      setSuccessMessage(`${importedTransactions.length} afboekingen succesvol geïmporteerd!`);
      setShowImportModal(false);
      setImportFile(null);
      await loadTransactions();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      console.error('Import error:', error);
      setErrorMessage(error.message || 'Fout bij importeren');
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setImporting(false);
    }
  };

  const toggleSelectTransaction = (id: string) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTransactions(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedTransactions.size === filteredTransactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(filteredTransactions.map(t => t.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedTransactions.size === 0) return;

    try {
      const { error } = await supabase
        .from('inventory_transactions')
        .delete()
        .in('id', Array.from(selectedTransactions));

      if (error) throw error;

      setSuccessMessage(`${selectedTransactions.size} afboeking(en) succesvol verwijderd`);
      setSelectedTransactions(new Set());
      setShowDeleteConfirm(false);
      await loadTransactions();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      console.error('Delete error:', error);
      setErrorMessage(error.message || 'Fout bij verwijderen');
      setTimeout(() => setErrorMessage(''), 5000);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Voorraad Afboeken</h1>
          <p className="text-gray-600">Scan of zoek producten en boek ze af op een project</p>
        </div>
        <button
          onClick={() => setShowOverview(true)}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
        >
          <FileText size={20} />
          Overzicht
        </button>
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="text-green-600" size={20} />
          <span className="text-green-800">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="text-red-600" size={20} />
          <span className="text-red-800">{errorMessage}</span>
        </div>
      )}

      {showScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Scan Barcode</h3>
              <button
                onClick={stopScanning}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            <div className="relative border-2 border-red-500 rounded-lg overflow-hidden">
              <div id="qr-reader" className="w-full"></div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Project *</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="">Selecteer project</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.naam} {project.project_nummer ? `(#${project.project_nummer})` : ''}
                </option>
              ))}
            </select>
          </div>

        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Producten</h2>
          <span className="text-sm text-gray-600">
            {getTotalItems()} {getTotalItems() === 1 ? 'artikel' : 'artikelen'}
          </span>
        </div>

        <div className="space-y-3">
          {bookingLines.map((line, index) => (
            <div key={index} className="space-y-2">
              <div className="flex gap-2">
                <div className="w-48">
                  <select
                    value={line.location}
                    onChange={(e) => updateLineLocation(index, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="">Selecteer locatie</option>
                    {locations.map(location => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 relative product-search-container">
                  <input
                    type="text"
                    placeholder="Artikel, EAN of SKU"
                    value={line.searchValue}
                    onChange={(e) => updateLineSearch(index, e.target.value)}
                    onFocus={() => {
                      if (line.searchValue) {
                        const newLines = [...bookingLines];
                        newLines[index].showDropdown = true;
                        setBookingLines(newLines);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                  {line.showDropdown && getFilteredProducts(line.searchValue).length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {getFilteredProducts(line.searchValue).map((product) => (
                        <button
                          key={product.id}
                          onClick={() => selectProduct(index, product)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">{product.name}</div>
                          <div className="text-sm text-gray-600">{product.sku} - {product.category}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => loadLocationStock(index)}
                  disabled={!line.location}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
                  title="Bekijk voorraad"
                >
                  <Search size={20} />
                </button>
                <button
                  onClick={() => startScanning(index)}
                  disabled={scanning}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Scan size={20} />
                </button>
                {bookingLines.length > 1 && (
                  <button
                    onClick={() => removeLine(index)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>

              {line.product && (
                <div className="ml-2 p-3 bg-gray-50 rounded-md">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{line.product.name}</div>
                      <div className="text-sm text-gray-600">{line.product.sku} - {line.product.category}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateLineQuantity(index, -1)}
                        className="p-1 bg-white border border-gray-300 rounded hover:bg-gray-100"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="font-medium w-16 text-center">
                        {line.quantity} {line.product.unit}
                      </span>
                      <button
                        onClick={() => updateLineQuantity(index, 1)}
                        className="p-1 bg-white border border-gray-300 rounded hover:bg-gray-100"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {line.searchValue && !line.product && (
                <div className="ml-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                  Product niet gevonden
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={addLine}
          className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          Voeg regel toe
        </button>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={() => {
              setBookingLines([{ searchValue: '', product: null, quantity: 1, showDropdown: false, location: '' }]);
              setSelectedProject('');
            }}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            Annuleren
          </button>
          <button
            onClick={handleBookProducts}
            disabled={!selectedProject || bookingLines.filter(l => l.product && l.location).length === 0}
            className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Afboeken
          </button>
        </div>
      </div>

      {showOverview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-900">Overzicht Afboekingen</h2>
              <button
                onClick={() => setShowOverview(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Zoek op project, medewerker, product, locatie..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={loadTransactions}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 flex items-center gap-2"
                    title="Ververs overzicht"
                  >
                    <Search size={20} />
                    Ververs
                  </button>
                  {(userRole === 'admin' || userRole === 'kantoor_medewerker') && (
                    <>
                      <button
                        onClick={() => setShowImportModal(true)}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
                      >
                        <Upload size={20} />
                        Import
                      </button>
                      <button
                        onClick={handleExportTransactions}
                        disabled={filteredTransactions.length === 0}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        <Download size={20} />
                        Export
                      </button>
                    </>
                  )}
                  {!(userRole === 'admin' || userRole === 'kantoor_medewerker') && (
                    <button
                      onClick={handleExportTransactions}
                      disabled={filteredTransactions.length === 0}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      <Download size={20} />
                      Export
                    </button>
                  )}
                </div>
              </div>

              {(userRole === 'admin' || userRole === 'kantoor_medewerker') && selectedTransactions.size > 0 && (
                <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg p-3">
                  <span className="text-sm text-red-800 font-medium">
                    {selectedTransactions.size} {selectedTransactions.size === 1 ? 'afboeking' : 'afboekingen'} geselecteerd
                  </span>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
                  >
                    <Trash2 size={18} />
                    Verwijderen
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Periode</label>
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="vandaag">Vandaag</option>
                    <option value="deze_week">Deze Week</option>
                    <option value="deze_maand">Deze Maand</option>
                    <option value="dit_jaar">Dit Jaar</option>
                    <option value="custom">Aangepaste Periode</option>
                  </select>
                </div>

                {dateFilter === 'custom' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Van Datum</label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tot Datum</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <div className="text-sm text-gray-600">Totaal Afboekingen</div>
                  <div className="text-2xl font-bold text-gray-900">{filteredTransactions.length}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Totaal Producten</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {filteredTransactions.reduce((sum, t) => sum + Math.abs(t.quantity), 0).toFixed(0)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Unieke Producten</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {new Set(filteredTransactions.map(t => t.product_id)).size}
                  </div>
                </div>
              </div>

              {loadingTransactions ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  Geen afboekingen gevonden
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          {(userRole === 'admin' || userRole === 'kantoor_medewerker') && (
                            <th className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={selectedTransactions.size === filteredTransactions.length && filteredTransactions.length > 0}
                                onChange={toggleSelectAll}
                                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                              />
                            </th>
                          )}
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Datum & Tijd</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categorie</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Aantal</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Locatie</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medewerker</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opmerkingen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {filteredTransactions.map((transaction) => (
                          <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                            {(userRole === 'admin' || userRole === 'kantoor_medewerker') && (
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedTransactions.has(transaction.id)}
                                  onChange={() => toggleSelectTransaction(transaction.id)}
                                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                                />
                              </td>
                            )}
                            <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                              <div>{new Date(transaction.created_at).toLocaleDateString('nl-NL')}</div>
                              <div className="text-xs text-gray-500">{new Date(transaction.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</div>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="font-medium text-gray-900">{transaction.project?.naam}</div>
                              {transaction.project?.project_nummer && (
                                <div className="text-xs text-gray-500">#{transaction.project.project_nummer}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="font-medium text-gray-900">{transaction.product?.name}</div>
                              <div className="text-xs text-gray-500">{transaction.product?.sku}</div>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                {transaction.product?.category}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-center">
                              <div className="font-semibold text-gray-900">{Math.abs(transaction.quantity)}</div>
                              <div className="text-xs text-gray-500">{transaction.product?.unit}</div>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="font-medium text-gray-900">{transaction.location?.name}</div>
                              {transaction.location?.type && (
                                <div className="text-xs text-gray-500 capitalize">{transaction.location.type}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {transaction.user?.naam || transaction.user?.email}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={transaction.notes || '-'}>
                              {transaction.notes || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Afboekingen Importeren</h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-3">
                  Upload een CSV bestand met afboekingen. Het bestand moet de volgende kolommen bevatten:
                </p>
                <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 mb-3">
                  <li>Datum (bijv. 14-10-2025)</li>
                  <li>Project (naam)</li>
                  <li>Product SKU</li>
                  <li>Aantal</li>
                  <li>Locatie (naam)</li>
                  <li>Opmerkingen (optioneel)</li>
                </ul>
                <button
                  onClick={downloadTemplate}
                  className="text-sm text-red-600 hover:text-red-700 flex items-center gap-2"
                >
                  <FileSpreadsheet size={16} />
                  Download CSV sjabloon
                </button>
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-red-400 text-gray-600 hover:text-red-600 flex items-center justify-center gap-2"
                >
                  <Upload size={20} />
                  {importFile ? importFile.name : 'Selecteer CSV bestand'}
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleImport}
                  disabled={!importFile || importing}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? 'Importeren...' : 'Importeren'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showStockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-900">
                Voorraad - {stockModalLineIndex !== null && bookingLines[stockModalLineIndex]?.location
                  ? locations.find(l => l.id === bookingLines[stockModalLineIndex!].location)?.name
                  : 'Locatie'}
              </h2>
              <button
                onClick={() => {
                  setShowStockModal(false);
                  setStockModalLineIndex(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              {loadingStock ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
                </div>
              ) : locationStock.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  Geen voorraad beschikbaar op deze locatie
                </div>
              ) : (
                <div className="space-y-2">
                  {locationStock.map((stockItem) => (
                    <button
                      key={stockItem.product_id}
                      onClick={() => selectProductFromStock(stockItem)}
                      className="w-full p-4 border border-gray-200 rounded-lg hover:border-red-500 hover:bg-red-50 text-left transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{stockItem.product.name}</div>
                          <div className="text-sm text-gray-600">
                            SKU: {stockItem.product.sku} | Categorie: {stockItem.product.category}
                          </div>
                          {stockItem.product.ean && (
                            <div className="text-sm text-gray-500">EAN: {stockItem.product.ean}</div>
                          )}
                        </div>
                        <div className="ml-4 text-right">
                          <div className="text-lg font-bold text-gray-900">{stockItem.quantity}</div>
                          <div className="text-sm text-gray-600">{stockItem.product.unit}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="text-red-600" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Afboekingen Verwijderen</h3>
                <p className="text-sm text-gray-600">
                  Weet je zeker dat je {selectedTransactions.size} {selectedTransactions.size === 1 ? 'afboeking' : 'afboekingen'} wilt verwijderen?
                </p>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                Let op: Deze actie kan niet ongedaan worden gemaakt. De voorraad wordt automatisch bijgewerkt.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Annuleren
              </button>
              <button
                onClick={handleDeleteSelected}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoorraadbeheerAfboeken;
