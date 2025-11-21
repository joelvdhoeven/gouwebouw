import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, ArrowLeft, Package, FileText, Plus, Trash2, CheckCircle, Scan, X, Search, Edit2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Html5Qrcode } from 'html5-qrcode';

// Common unit types for products
const COMMON_UNITS = [
  'stuks',
  'meter',
  'meter²',
  'meter³',
  'liter',
  'kilogram',
  'gram',
  'ton',
  'zak',
  'doos',
  'set',
  'paar',
  'rol',
  'bus',
  'fles',
  'pak'
];

interface Product {
  id: string;
  name: string;
  gb_article_number: string;
  ean: string | null;
  category: string;
  material_group?: string;
  unit: string;
  minimum_stock: number;
  description: string | null;
  supplier: string | null;
  supplier_article_number?: string;
  price: number | null;
  price_per_unit?: number;
  photo_path?: string;
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

interface ProductLine {
  id: string; // Unique ID for the line
  product: Product | null;
  quantity: number;
  unit: string;
  location: string;
  searchValue: string;
  showDropdown: boolean;
}

type WizardStep = 'action' | 'customer' | 'products' | 'overview';

const VoorraadbeheerAfboekenNew: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('action');
  const [selectedAction, setSelectedAction] = useState<'booking' | 'overview' | null>(null);

  // Customer/Project data
  const [selectedProject, setSelectedProject] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);

  // Product selection
  const [productLines, setProductLines] = useState<ProductLine[]>([
    { id: crypto.randomUUID(), product: null, quantity: 1, unit: 'stuks', location: '', searchValue: '', showDropdown: false }
  ]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Scanner
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanningForLineIndex, setScanningForLineIndex] = useState<number | null>(null);
  const [scannedValue, setScannedValue] = useState<string>('');
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Search modal
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchingForLineIndex, setSearchingForLineIndex] = useState<number | null>(null);
  const [searchLocation, setSearchLocation] = useState('');
  const [searchCategory, setSearchCategory] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);

  // Messages
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loadingStock, setLoadingStock] = useState(false);

  // Booking tracking
  const [lastBookingIds, setLastBookingIds] = useState<string[]>([]);
  const [negativeStockWarnings, setNegativeStockWarnings] = useState<Array<{
    product: string;
    location: string;
    available: number;
    requested: number;
  }>>([]);
  const [showBookingResultModal, setShowBookingResultModal] = useState(false);

  // Overview state
  const [transactions, setTransactions] = useState<any[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [overviewSearch, setOverviewSearch] = useState('');
  const [userFilter, setUserFilter] = useState('');

  // Edit/Delete state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({
    product_id: '',
    location_id: '',
    project_id: '',
    quantity: 0,
    notes: ''
  });
  const [showDeleteSingleConfirm, setShowDeleteSingleConfirm] = useState(false);
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.product-search-container')) {
        setProductLines(lines => lines.map(line => ({ ...line, showDropdown: false })));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
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

  const getProductPhotoUrl = (photoPath: string | undefined): string | null => {
    if (!photoPath) return null;
    const { data } = supabase.storage.from('product-images').getPublicUrl(photoPath);
    return data?.publicUrl || null;
  };

  // Helper function to check if user has admin privileges
  const hasAdminPrivileges = () => {
    return ['admin', 'superuser', 'kantoorpersoneel'].includes(user?.role || '');
  };

  const handleEditTransaction = (transaction: any) => {
    setEditingTransaction(transaction);
    setEditFormData({
      product_id: transaction.product_id,
      location_id: transaction.location_id,
      project_id: transaction.project_id,
      quantity: Math.abs(transaction.quantity),
      notes: transaction.notes || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateTransaction = async () => {
    if (!editingTransaction) return;

    try {
      const { error } = await supabase
        .from('inventory_transactions')
        .update({
          product_id: editFormData.product_id,
          location_id: editFormData.location_id,
          project_id: editFormData.project_id,
          quantity: -Math.abs(editFormData.quantity),
          notes: editFormData.notes
        })
        .eq('id', editingTransaction.id);

      if (error) throw error;

      setSuccessMessage('Afboeking succesvol bijgewerkt!');
      setShowEditModal(false);
      setEditingTransaction(null);
      await loadTransactions();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      console.error('Error updating transaction:', error);
      setErrorMessage(error.message || 'Fout bij het bijwerken van de afboeking');
      setTimeout(() => setErrorMessage(''), 5000);
    }
  };

  const handleDeleteSingleTransaction = async () => {
    if (!deletingTransactionId) return;

    try {
      const { error } = await supabase
        .from('inventory_transactions')
        .delete()
        .eq('id', deletingTransactionId);

      if (error) throw error;

      setSuccessMessage('Afboeking succesvol verwijderd');
      setShowDeleteSingleConfirm(false);
      setDeletingTransactionId(null);
      await loadTransactions();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      console.error('Delete error:', error);
      setErrorMessage(error.message || 'Fout bij verwijderen');
      setTimeout(() => setErrorMessage(''), 5000);
    }
  };

  const loadTransactions = async () => {
    try {
      // Check if user is admin/superuser to see all transactions
      const isAdmin = user?.role === 'admin' || user?.role === 'superuser' || user?.role === 'kantoorpersoneel';

      let query = supabase
        .from('inventory_transactions')
        .select(`
          *,
          inventory_products!inner(name, gb_article_number),
          location:inventory_locations!location_id(name),
          profiles(naam),
          projects(naam, project_nummer)
        `)
        .eq('transaction_type', 'out')
        .order('created_at', { ascending: false });

      // If not admin, only show own transactions
      if (!isAdmin && user?.id) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Supabase error details:', error);
        throw new Error(`Database fout: ${error.message}`);
      }

      setTransactions(data || []);
      setFilteredTransactions(data || []);

      // Load users for filter dropdown (only if admin)
      if (isAdmin) {
        const { data: usersData, error: usersError } = await supabase
          .from('profiles')
          .select('id, naam')
          .order('naam');

        if (usersError) {
          console.error('Error loading users:', usersError);
        } else {
          setUsers(usersData || []);
        }
      }
    } catch (error: any) {
      console.error('Error loading transactions:', error);
      setErrorMessage(error?.message || 'Fout bij het laden van transacties');
    }
  };

  // Filter transactions based on search and user filter
  useEffect(() => {
    let filtered = [...transactions];

    // Filter by search term
    if (overviewSearch) {
      filtered = filtered.filter(t =>
        t.inventory_products?.name?.toLowerCase().includes(overviewSearch.toLowerCase()) ||
        t.inventory_products?.gb_article_number?.toLowerCase().includes(overviewSearch.toLowerCase()) ||
        t.profiles?.naam?.toLowerCase().includes(overviewSearch.toLowerCase()) ||
        t.notes?.toLowerCase().includes(overviewSearch.toLowerCase()) ||
        t.projects?.naam?.toLowerCase().includes(overviewSearch.toLowerCase())
      );
    }

    // Filter by user
    if (userFilter) {
      filtered = filtered.filter(t => t.user_id === userFilter);
    }

    setFilteredTransactions(filtered);
  }, [overviewSearch, userFilter, transactions]);

  const exportOverviewToCSV = () => {
    try {
      // Get Excel export settings from localStorage
      const settings = JSON.parse(localStorage.getItem('excelExportSettings') || '{}');
      const delimiter = settings.delimiter || ';';

      const headers = [
        'Datum',
        'Product',
        'GB-art.nr.',
        'Aantal',
        'Locatie',
        'Gebruiker',
        'Klant/Project',
        'Notities'
      ];

      const rows = filteredTransactions.map(t => [
        new Date(t.created_at).toLocaleString('nl-NL'),
        t.inventory_products?.name || '',
        t.inventory_products?.gb_article_number || '',
        Math.abs(t.quantity),
        t.location?.name || '',
        t.profiles?.naam || '',
        t.customer_name || t.projects?.naam || '',
        t.notes || ''
      ]);

      const csv = [
        headers.join(delimiter),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(delimiter))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `voorraad-afboekingen-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } catch (error) {
      console.error('Error exporting:', error);
      alert('Fout bij exporteren');
    }
  };

  // Step 1: Action Selection
  const handleActionSelect = async (action: 'booking' | 'overview') => {
    setSelectedAction(action);
    if (action === 'overview') {
      // Load transactions and show overview
      await loadTransactions();
      setCurrentStep('overview');
    } else {
      setCurrentStep('customer');
    }
  };

  // Step 2: Customer/Project Input
  const handleCustomerNext = () => {
    if (!selectedProject && !customerName.trim()) {
      setErrorMessage('Selecteer een project of voer een klantnaam in');
      return;
    }
    setErrorMessage('');
    setCurrentStep('products');
  };

  // Step 3: Product Lines Management
  const addProductLine = () => {
    setProductLines([
      ...productLines,
      {
        id: crypto.randomUUID(),
        product: null,
        quantity: 1,
        unit: 'stuks',
        location: '',
        searchValue: '',
        showDropdown: false
      }
    ]);
  };

  const removeProductLine = (id: string) => {
    if (productLines.length > 1) {
      setProductLines(productLines.filter(line => line.id !== id));
    }
  };

  const updateProductLine = (id: string, updates: Partial<ProductLine>) => {
    setProductLines(productLines.map(line =>
      line.id === id ? { ...line, ...updates } : line
    ));
  };

  const updateLineSearch = (index: number, value: string) => {
    const newLines = [...productLines];
    newLines[index].searchValue = value;
    newLines[index].showDropdown = value.length > 0;

    // Search by EAN, GB article number, or name
    const searchLower = value.toLowerCase().trim();
    const foundProduct = products.find(p =>
      p.ean === value ||
      p.gb_article_number.toLowerCase() === searchLower ||
      p.name.toLowerCase().includes(searchLower)
    );

    newLines[index].product = foundProduct || null;

    // If product found, set its default unit and close dropdown
    if (foundProduct) {
      newLines[index].unit = foundProduct.unit;
      newLines[index].showDropdown = false;
    }

    setProductLines(newLines);
  };

  const selectProduct = (index: number, product: Product) => {
    const newLines = [...productLines];
    newLines[index].product = product;
    newLines[index].searchValue = product.name;
    newLines[index].unit = product.unit;
    newLines[index].showDropdown = false;
    setProductLines(newLines);
  };

  const getFilteredProducts = (searchValue: string) => {
    if (!searchValue) return [];
    const search = searchValue.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(search) ||
      p.gb_article_number.toLowerCase().includes(search) ||
      (p.ean && p.ean.toLowerCase().includes(search)) ||
      (p.supplier_article_number && p.supplier_article_number.toLowerCase().includes(search))
    ).slice(0, 8);
  };

  // Scanner functions
  const startScanning = async (lineIndex: number) => {
    try {
      // Clean up any existing scanner first
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
          scannerRef.current.clear();
          scannerRef.current = null;
        } catch (e) {
          console.log('Cleaned up old scanner');
        }
      }

      setShowScanner(true);
      setScanning(true);
      setScanningForLineIndex(lineIndex);
      setScannedValue('');
      setErrorMessage('');

      console.log('Starting scanner for line index:', lineIndex);

      // Delay to ensure modal and qr-reader div are rendered
      await new Promise(resolve => setTimeout(resolve, 150));

      // Check if element exists
      const element = document.getElementById('qr-reader');
      if (!element) {
        throw new Error('Scanner element niet gevonden');
      }

      const cameras = await Html5Qrcode.getCameras();
      console.log('Cameras found:', cameras.length);
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

      console.log('Starting camera...');

      // Start scanner with simple callback (no async)
      await scanner.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          // Direct state update when scan succeeds
          console.log('✅ Barcode gescand:', decodedText);
          handleScanSuccess(decodedText);
        },
        (errorMessage) => {
          // Ignore continuous scan errors (they happen when no barcode is visible)
        }
      );

      console.log('Camera started successfully');
    } catch (error: any) {
      console.error('❌ Error starting scanner:', error);
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
    setScannedValue('');
  };

  const handleScanSuccess = (decodedText: string) => {
    console.log('handleScanSuccess called with:', decodedText);

    // Stop the scanner
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        console.log('Scanner stopped');
        scannerRef.current?.clear();
        scannerRef.current = null;
      }).catch(err => console.error('Error stopping scanner:', err));
    }

    // Update state
    setScanning(false);
    setScannedValue(decodedText);
  };

  const handleConfirmScan = () => {
    console.log('Confirm scan clicked, value:', scannedValue, 'lineIndex:', scanningForLineIndex);

    if (scanningForLineIndex !== null && scannedValue) {
      const lineIndex = scanningForLineIndex;

      // Update the search value and try to find product
      updateLineSearch(lineIndex, scannedValue);

      // Close scanner modal
      setShowScanner(false);
      setScanningForLineIndex(null);
      setScannedValue('');

      console.log('Scan confirmed, input should be filled now');
    }
  };

  // Search modal functions
  const openSearchModal = (lineIndex: number) => {
    setSearchingForLineIndex(lineIndex);
    setShowSearchModal(true);
    setSearchLocation('');
    setSearchCategory('');
    setSearchResults([]);
  };

  const closeSearchModal = () => {
    setShowSearchModal(false);
    setSearchingForLineIndex(null);
    setSearchLocation('');
    setSearchCategory('');
    setSearchResults([]);
  };

  const handleSearchLocation = async (locationId: string) => {
    setSearchLocation(locationId);
    setSearchCategory('');

    if (!locationId) {
      setSearchResults([]);
      return;
    }

    // Get products available in this location from stock
    const { data: stockData } = await supabase
      .from('inventory_stock')
      .select('product_id, inventory_products(*)')
      .eq('location_id', locationId)
      .gt('quantity', 0);

    if (stockData) {
      const productsInLocation = stockData
        .map(s => s.inventory_products)
        .filter(Boolean) as Product[];
      setSearchResults(productsInLocation);
    }
  };

  const handleSearchCategory = async (category: string) => {
    setSearchCategory(category);

    if (!searchLocation) {
      return;
    }

    // Get products from stock filtered by location
    const { data: stockData } = await supabase
      .from('inventory_stock')
      .select('product_id, inventory_products(*)')
      .eq('location_id', searchLocation)
      .gt('quantity', 0);

    if (stockData) {
      let productsInLocation = stockData
        .map(s => s.inventory_products)
        .filter(Boolean) as Product[];

      // Filter by category if selected
      if (category) {
        productsInLocation = productsInLocation.filter(p => p.category === category);
      }

      setSearchResults(productsInLocation);
    }
  };

  const getAvailableCategories = () => {
    const categories = new Set(searchResults.map(p => p.category).filter(Boolean));
    return Array.from(categories).sort();
  };

  const selectProductFromSearch = (product: Product) => {
    if (searchingForLineIndex !== null) {
      const lineIndex = searchingForLineIndex;

      // Update the product line
      const newLines = [...productLines];
      newLines[lineIndex].product = product;
      newLines[lineIndex].searchValue = product.name;
      newLines[lineIndex].unit = product.unit;
      newLines[lineIndex].location = searchLocation;
      newLines[lineIndex].showDropdown = false;
      setProductLines(newLines);

      // Close modal
      closeSearchModal();
    }
  };

  // Final submission
  const handleSubmitBooking = async () => {
    // Validation
    const validLines = productLines.filter(line => line.product && line.location && line.quantity > 0);

    if (validLines.length === 0) {
      setErrorMessage('Voeg minimaal 1 product toe met locatie en aantal');
      return;
    }

    setLoadingStock(true);
    setErrorMessage('');
    setNegativeStockWarnings([]);

    try {
      const warnings: Array<{product: string, location: string, available: number, requested: number}> = [];

      // Check stock availability for warnings only (don't block)
      for (const line of validLines) {
        const { data: stockData } = await supabase
          .from('inventory_stock')
          .select('quantity')
          .eq('product_id', line.product!.id)
          .eq('location_id', line.location)
          .maybeSingle();

        const currentStock = stockData?.quantity || 0;

        if (currentStock < line.quantity) {
          const productName = line.product!.name;
          const locationName = locations.find(l => l.id === line.location)?.name || 'deze locatie';
          warnings.push({
            product: productName,
            location: locationName,
            available: currentStock,
            requested: line.quantity
          });
        }
      }

      // Create transactions
      const transactions = validLines.map(line => ({
        product_id: line.product!.id,
        location_id: line.location,
        project_id: selectedProject || null,
        quantity: -Math.abs(line.quantity), // Negative for outbound
        transaction_type: 'out' as const,
        user_id: user!.id,
        notes: customerName.trim() || null
      }));

      const { data: transactionData, error: transactionError } = await supabase
        .from('inventory_transactions')
        .insert(transactions)
        .select('id');

      if (transactionError) throw transactionError;

      // Save transaction IDs for later reference
      const bookingIds = transactionData?.map(t => t.id) || [];
      setLastBookingIds(bookingIds);

      // Update stock levels (allow negative)
      for (const line of validLines) {
        const { data: currentStock } = await supabase
          .from('inventory_stock')
          .select('quantity')
          .eq('product_id', line.product!.id)
          .eq('location_id', line.location)
          .maybeSingle();

        const newQuantity = (currentStock?.quantity || 0) - line.quantity;

        if (currentStock) {
          // Update existing stock (allow negative)
          await supabase
            .from('inventory_stock')
            .update({ quantity: newQuantity })
            .eq('product_id', line.product!.id)
            .eq('location_id', line.location);
        } else {
          // Create new stock entry with negative quantity
          await supabase
            .from('inventory_stock')
            .insert({
              product_id: line.product!.id,
              location_id: line.location,
              quantity: newQuantity
            });
        }
      }

      // If there were warnings, create notifications for office staff
      if (warnings.length > 0) {
        // Get admin and office staff users
        const { data: officeUsers } = await supabase
          .from('profiles')
          .select('id')
          .in('role', ['admin', 'kantoorpersoneel', 'superuser']);

        if (officeUsers && officeUsers.length > 0) {
          const notifications = officeUsers.map(officeUser => ({
            recipient_id: officeUser.id,
            sender_id: user!.id,
            type: 'system_alert' as const,
            title: '⚠️ Negatieve voorraad na afboeking',
            message: `${user?.naam || 'Een gebruiker'} heeft producten afgeboekt die niet op voorraad zijn:\n${warnings.map(w => `- ${w.product} op ${w.location}: ${w.available} beschikbaar, ${w.requested} afgeboekt`).join('\n')}\n\nControleer de voorraad en pas indien nodig aan.`,
            status: 'unread' as const
          }));

          await supabase.from('notifications').insert(notifications);
        }
      }

      setNegativeStockWarnings(warnings);
      setShowBookingResultModal(true);

    } catch (error: any) {
      console.error('Error booking stock:', error);
      setErrorMessage(error.message || 'Fout bij afboeken van voorraad');
    } finally {
      setLoadingStock(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('voorraadbeheer')}</h1>
          <p className="text-gray-600 mt-1">{t('voorraadAfboekenStapVoorStap')}</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-8">
          <div className={`flex items-center ${currentStep === 'action' ? 'text-red-600' : currentStep !== 'action' ? 'text-red-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'action' ? 'border-red-600 bg-red-50' : currentStep !== 'action' ? 'border-red-600 bg-red-50' : 'border-gray-300'}`}>
              1
            </div>
            <span className="ml-2 font-medium">{t('actie')}</span>
          </div>
          <div className="flex-1 h-0.5 bg-gray-300 mx-4"></div>
          <div className={`flex items-center ${currentStep === 'customer' ? 'text-red-600' : ['products', 'overview'].includes(currentStep) ? 'text-red-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'customer' ? 'border-red-600 bg-red-50' : ['products', 'overview'].includes(currentStep) ? 'border-red-600 bg-red-50' : 'border-gray-300'}`}>
              2
            </div>
            <span className="ml-2 font-medium">{t('klant')}</span>
          </div>
          <div className="flex-1 h-0.5 bg-gray-300 mx-4"></div>
          <div className={`flex items-center ${currentStep === 'products' ? 'text-red-600' : currentStep === 'overview' ? 'text-red-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'products' ? 'border-red-600 bg-red-50' : currentStep === 'overview' ? 'border-red-600 bg-red-50' : 'border-gray-300'}`}>
              3
            </div>
            <span className="ml-2 font-medium">{t('producten')}</span>
          </div>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <CheckCircle className="text-red-600" size={20} />
            <span className="text-red-800">{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{errorMessage}</p>
          </div>
        )}

        {/* Step 1: Action Selection */}
        {currentStep === 'action' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('kiesEenActie')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => handleActionSelect('booking')}
                className="p-6 border-2 border-gray-300 rounded-lg hover:border-red-600 hover:bg-red-50 transition-colors text-left group"
              >
                <Package className="text-red-600 mb-3" size={32} />
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-red-600">{t('voorraadAfboeken')}</h3>
                <p className="text-sm text-gray-600 mt-1">{t('boekVoorraadAfVoor')}</p>
              </button>

              <button
                onClick={() => handleActionSelect('overview')}
                className="p-6 border-2 border-gray-300 rounded-lg hover:border-red-600 hover:bg-red-50 transition-colors text-left group"
              >
                <FileText className="text-red-600 mb-3" size={32} />
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-red-600">{t('voorraadAfboekenOverzicht')}</h3>
                <p className="text-sm text-gray-600 mt-1">{t('bekijkAlleAfboekingen')}</p>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Customer/Project Input */}
        {currentStep === 'customer' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{t('klantOfProject')}</h2>
              <button
                onClick={() => setCurrentStep('action')}
                className="text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                <ArrowLeft size={16} />
                {t('terug')}
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('projectOptioneel')}</label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">{t('geenProject')}</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.project_nummer ? `${project.project_nummer} - ` : ''}{project.naam}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('klantnaamOfNotitie')}</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Bijv. Jan Jansen of bouwproject locatie X"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={handleCustomerNext}
                className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
              >
                {t('volgende')}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Product Selection */}
        {currentStep === 'products' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{t('selecteerProducten')}</h2>
              <button
                onClick={() => setCurrentStep('customer')}
                className="text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                <ArrowLeft size={16} />
                {t('terug')}
              </button>
            </div>

            {/* Product Lines */}
            <div className="space-y-4">
              {productLines.map((line, index) => (
                <div key={line.id} className="border border-gray-300 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">Product {index + 1}</span>
                    {productLines.length > 1 && (
                      <button
                        onClick={() => removeProductLine(line.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>

                  {/* Product Search with Scanner */}
                  <div className="flex gap-2">
                    <div className="flex-1 relative product-search-container">
                      <input
                        type="text"
                        value={line.searchValue}
                        onChange={(e) => updateLineSearch(index, e.target.value)}
                        onFocus={() => {
                          if (line.searchValue) {
                            const newLines = [...productLines];
                            newLines[index].showDropdown = true;
                            setProductLines(newLines);
                          }
                        }}
                        placeholder="Zoek op naam, EAN of GB-art.nr."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      />

                      {/* Dropdown */}
                      {line.showDropdown && getFilteredProducts(line.searchValue).length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {getFilteredProducts(line.searchValue).map((product) => (
                            <button
                              key={product.id}
                              onClick={() => selectProduct(index, product)}
                              className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium text-gray-900">{product.name}</div>
                              <div className="text-sm text-gray-600 space-y-0.5">
                                <div>GB-art.nr.: {product.gb_article_number}</div>
                                {product.ean && <div>EAN: {product.ean}</div>}
                                <div>{product.category}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => openSearchModal(index)}
                        className="p-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                        title="Zoeken"
                      >
                        <Search size={20} />
                      </button>
                      <button
                        onClick={() => startScanning(index)}
                        className="p-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                        title="Scannen"
                      >
                        <Scan size={20} />
                      </button>
                    </div>
                  </div>

                  {/* Selected Product Display */}
                  {line.product && (
                    <div className="bg-gray-50 rounded-md p-3">
                      <div className="flex items-start gap-3">
                        {line.product.photo_path && getProductPhotoUrl(line.product.photo_path) && (
                          <img
                            src={getProductPhotoUrl(line.product.photo_path)!}
                            alt={line.product.name}
                            className="w-16 h-16 object-cover rounded border border-gray-200"
                          />
                        )}
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{line.product.name}</div>
                          <div className="text-sm text-gray-600">GB-art.nr.: {line.product.gb_article_number}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Location, Quantity, Unit */}
                  {line.product && (
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Locatie *</label>
                        <select
                          value={line.location}
                          onChange={(e) => updateProductLine(line.id, { location: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        >
                          <option value="">Selecteer</option>
                          {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Aantal *</label>
                        <input
                          type="number"
                          min="1"
                          value={line.quantity}
                          onChange={(e) => updateProductLine(line.id, { quantity: parseInt(e.target.value) || 1 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Eenheid *</label>
                        <select
                          value={line.unit}
                          onChange={(e) => updateProductLine(line.id, { unit: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        >
                          {COMMON_UNITS.map(unit => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add Product Button */}
              <button
                onClick={addProductLine}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-red-600 hover:text-red-600 hover:bg-red-50 flex items-center justify-center gap-2 transition-colors"
              >
                <Plus size={20} />
                {t('productToevoegen')}
              </button>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={handleSubmitBooking}
                disabled={loadingStock}
                className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle size={18} />
                {loadingStock ? t('bezigMetAfboeken') : t('afboekenBevestigen')}
              </button>
            </div>
          </div>
        )}

        {/* Step: Overview */}
        {currentStep === 'overview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{t('voorraadAfboekenOverzicht')}</h2>
              <button
                onClick={() => {
                  setCurrentStep('action');
                  setSelectedAction(null);
                }}
                className="text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                <ArrowLeft size={16} />
                {t('terug')}
              </button>
            </div>

            {/* Search and Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder={t('zoekOpProductGebruikerKlant')}
                  value={overviewSearch}
                  onChange={(e) => setOverviewSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              {users.length > 0 && (
                <select
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">{t('alleGebruikers')}</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.naam}</option>
                  ))}
                </select>
              )}

              <button
                onClick={exportOverviewToCSV}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2 whitespace-nowrap"
              >
                <FileText size={18} />
                {t('exportCsv')}
              </button>
            </div>

            {/* Transactions Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {filteredTransactions.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  {t('geenAfboekingenGevonden')}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('datum')}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('aantal')}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('locatie')}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('gebruiker')}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('klant')}/Project</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('notities')}</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acties</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {filteredTransactions.map((transaction) => (
                        <tr key={transaction.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {new Date(transaction.created_at).toLocaleString('nl-NL', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="font-medium text-gray-900">{transaction.inventory_products?.name || '-'}</div>
                            <div className="text-gray-500 text-xs">{transaction.inventory_products?.gb_article_number || ''}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-gray-900 font-medium">
                            {Math.abs(transaction.quantity)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {transaction.location?.name || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {transaction.profiles?.naam || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {transaction.customer_name || transaction.projects?.naam || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {transaction.notes || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEditTransaction(transaction)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Bewerken"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => {
                                  setDeletingTransactionId(transaction.id);
                                  setShowDeleteSingleConfirm(true);
                                }}
                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Verwijderen"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Transaction Count */}
            <div className="text-sm text-gray-600 text-right">
              {filteredTransactions.length} {filteredTransactions.length === 1 ? t('afboeking') : t('afboekingen')} {t('gevonden')}
            </div>
          </div>
        )}
      </div>

      {/* Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{t('scanBarcode')}</h3>
              <button
                onClick={stopScanning}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            {/* Camera Scanner */}
            {scanning && <div id="qr-reader" className="w-full mb-4"></div>}

            {/* Scanned Value Display */}
            {scannedValue && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('gescandeWaarde')}
                  </label>
                  <div className="px-4 py-3 bg-red-50 border-2 border-red-500 rounded-md">
                    <p className="text-lg font-mono text-red-900 break-all">{scannedValue}</p>
                  </div>
                </div>

                <button
                  onClick={handleConfirmScan}
                  className="w-full px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center justify-center gap-2 transition-colors font-medium"
                >
                  <CheckCircle size={20} />
                  {t('doorgaan')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
              <h3 className="text-lg font-semibold">{t('productZoeken')}</h3>
              <button
                onClick={closeSearchModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Step 1: Select Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  1. {t('selecteerLocatie')} *
                </label>
                <select
                  value={searchLocation}
                  onChange={(e) => handleSearchLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">{t('kiesEenLocatie')}</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name} ({location.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Select Category (only if location selected) */}
              {searchLocation && searchResults.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    2. Filter op Categorie (optioneel)
                  </label>
                  <select
                    value={searchCategory}
                    onChange={(e) => handleSearchCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="">Alle categorieën</option>
                    {getAvailableCategories().map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Step 3: Product Results */}
              {searchLocation && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    3. {t('selecteerProducten')}
                  </label>
                  {searchResults.length > 0 ? (
                    <div className="border border-gray-300 rounded-md max-h-96 overflow-y-auto">
                      {searchResults.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => selectProductFromSearch(product)}
                          className="w-full px-4 py-3 text-left hover:bg-red-50 border-b border-gray-100 last:border-b-0 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{product.name}</div>
                              <div className="text-sm text-gray-600 mt-1 space-y-0.5">
                                <div>GB-art.nr.: {product.gb_article_number}</div>
                                {product.ean && <div>EAN: {product.ean}</div>}
                                <div className="text-red-600 font-medium">{product.category}</div>
                                <div>Eenheid: {product.unit}</div>
                              </div>
                            </div>
                            {product.photo_path && (
                              <img
                                src={getProductPhotoUrl(product.photo_path) || ''}
                                alt={product.name}
                                className="w-16 h-16 object-cover rounded"
                              />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Package size={48} className="mx-auto mb-2 text-gray-400" />
                      <p>Geen producten beschikbaar op deze locatie</p>
                    </div>
                  )}
                </div>
              )}

              {!searchLocation && (
                <div className="text-center py-8 text-gray-500">
                  <Search size={48} className="mx-auto mb-2 text-gray-400" />
                  <p>Selecteer eerst een locatie om producten te zoeken</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Booking Result Modal */}
      {showBookingResultModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {negativeStockWarnings.length > 0 ? (
                <>
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">⚠️</span>
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-gray-900 mb-2">
                        Afboeking voltooid met waarschuwingen
                      </h2>
                      <p className="text-gray-700">
                        De producten zijn afgeboekt, maar er was onvoldoende voorraad voor de volgende items:
                      </p>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Producten met onvoldoende voorraad:</h3>
                    <div className="space-y-2">
                      {negativeStockWarnings.map((warning, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-yellow-600">•</span>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{warning.product}</div>
                            <div className="text-gray-600">
                              Locatie: {warning.location} |
                              Beschikbaar: {warning.available} |
                              Afgeboekt: {warning.requested}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 text-xl">ℹ️</span>
                      <div className="flex-1 text-sm">
                        <p className="font-medium text-blue-900 mb-1">
                          Er is een melding gemaakt naar het kantoor
                        </p>
                        <p className="text-blue-800">
                          Het kantoorpersoneel is automatisch geïnformeerd om de voorraad te controleren en indien nodig aan te passen.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="text-green-600" size={28} />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-gray-900 mb-2">
                        Afboeking succesvol voltooid!
                      </h2>
                      <p className="text-gray-700">
                        Alle producten zijn succesvol afgeboekt.
                      </p>
                    </div>
                  </div>
                </>
              )}

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  onClick={() => {
                    setSelectedAction('overview');
                    setCurrentStep('action');
                    setShowBookingResultModal(false);
                  }}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 font-medium transition-colors"
                >
                  Bekijk afboekingen overzicht
                </button>
                <button
                  onClick={() => {
                    // Reset form
                    setCurrentStep('action');
                    setSelectedAction(null);
                    setSelectedProject('');
                    setCustomerName('');
                    setProductLines([{
                      id: crypto.randomUUID(),
                      product: null,
                      quantity: 1,
                      unit: 'stuks',
                      location: '',
                      searchValue: '',
                      showDropdown: false
                    }]);
                    setShowBookingResultModal(false);
                    setNegativeStockWarnings([]);
                    setLastBookingIds([]);
                  }}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium transition-colors"
                >
                  Nieuwe afboeking maken
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {showEditModal && editingTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Afboeking Bewerken</h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingTransaction(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product</label>
                <select
                  value={editFormData.product_id}
                  onChange={(e) => setEditFormData({ ...editFormData, product_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">Selecteer product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.gb_article_number})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Locatie</label>
                <select
                  value={editFormData.location_id}
                  onChange={(e) => setEditFormData({ ...editFormData, location_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">Selecteer locatie</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
                <select
                  value={editFormData.project_id}
                  onChange={(e) => setEditFormData({ ...editFormData, project_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">Selecteer project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.naam} {project.project_nummer ? `(#${project.project_nummer})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Aantal</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editFormData.quantity}
                  onChange={(e) => setEditFormData({ ...editFormData, quantity: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Opmerkingen</label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Optionele opmerkingen..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingTransaction(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Annuleren
              </button>
              <button
                onClick={handleUpdateTransaction}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteSingleConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="text-red-600" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Afboeking Verwijderen</h3>
                <p className="text-sm text-gray-600">
                  Weet je zeker dat je deze afboeking wilt verwijderen?
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
                onClick={() => {
                  setShowDeleteSingleConfirm(false);
                  setDeletingTransactionId(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Annuleren
              </button>
              <button
                onClick={handleDeleteSingleTransaction}
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

export default VoorraadbeheerAfboekenNew;
