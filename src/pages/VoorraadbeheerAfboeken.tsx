import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, ArrowLeft, Package, FileText, Plus, Trash2, CheckCircle, Scan, X, Search } from 'lucide-react';
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
  sku: string;
  gb_article_number?: string;
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

  // Messages
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loadingStock, setLoadingStock] = useState(false);

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

  // Step 1: Action Selection
  const handleActionSelect = (action: 'booking' | 'overview') => {
    setSelectedAction(action);
    if (action === 'overview') {
      // Go directly to overview page (we'll handle this separately)
      window.location.href = '/voorraad-overzicht'; // Or handle with routing
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

    // Search by EAN, SKU, GB article number, or name
    const searchLower = value.toLowerCase().trim();
    const foundProduct = products.find(p =>
      p.ean === value ||
      p.sku.toLowerCase() === searchLower ||
      p.gb_article_number?.toLowerCase() === searchLower ||
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
      p.sku.toLowerCase().includes(search) ||
      (p.ean && p.ean.toLowerCase().includes(search)) ||
      (p.gb_article_number && p.gb_article_number.toLowerCase().includes(search)) ||
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

    try {
      // Check stock availability for each line
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
          throw new Error(
            `Er is geen voorraad van "${productName}" op ${locationName}. ` +
            `Beschikbaar: ${currentStock} ${line.unit}, gevraagd: ${line.quantity} ${line.unit}`
          );
        }
      }

      // Create transactions
      const transactions = validLines.map(line => ({
        product_id: line.product!.id,
        location_id: line.location,
        project_id: selectedProject || null,
        quantity: -line.quantity, // Negative for outbound
        transaction_type: 'outbound',
        user_id: user?.id,
        notes: customerName.trim() || null
      }));

      const { error: transactionError } = await supabase
        .from('inventory_transactions')
        .insert(transactions);

      if (transactionError) throw transactionError;

      // Update stock levels
      for (const line of validLines) {
        const { data: currentStock } = await supabase
          .from('inventory_stock')
          .select('quantity')
          .eq('product_id', line.product!.id)
          .eq('location_id', line.location)
          .maybeSingle();

        if (currentStock) {
          const newQuantity = currentStock.quantity - line.quantity;

          if (newQuantity < 0) {
            throw new Error(`Voorraad kan niet negatief worden voor ${line.product!.name}`);
          }

          if (newQuantity === 0) {
            await supabase
              .from('inventory_stock')
              .delete()
              .eq('product_id', line.product!.id)
              .eq('location_id', line.location);
          } else {
            await supabase
              .from('inventory_stock')
              .update({ quantity: newQuantity })
              .eq('product_id', line.product!.id)
              .eq('location_id', line.location);
          }
        }
      }

      setSuccessMessage('Voorraad succesvol afgeboekt!');

      // Reset form
      setTimeout(() => {
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
        setSuccessMessage('');
      }, 2000);

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
          <p className="text-gray-600 mt-1">Voorraad afboeken - stap voor stap</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-8">
          <div className={`flex items-center ${currentStep === 'action' ? 'text-red-600' : currentStep !== 'action' ? 'text-red-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'action' ? 'border-red-600 bg-red-50' : currentStep !== 'action' ? 'border-red-600 bg-red-50' : 'border-gray-300'}`}>
              1
            </div>
            <span className="ml-2 font-medium">Actie</span>
          </div>
          <div className="flex-1 h-0.5 bg-gray-300 mx-4"></div>
          <div className={`flex items-center ${currentStep === 'customer' ? 'text-red-600' : ['products', 'overview'].includes(currentStep) ? 'text-red-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'customer' ? 'border-red-600 bg-red-50' : ['products', 'overview'].includes(currentStep) ? 'border-red-600 bg-red-50' : 'border-gray-300'}`}>
              2
            </div>
            <span className="ml-2 font-medium">Klant</span>
          </div>
          <div className="flex-1 h-0.5 bg-gray-300 mx-4"></div>
          <div className={`flex items-center ${currentStep === 'products' ? 'text-red-600' : currentStep === 'overview' ? 'text-red-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'products' ? 'border-red-600 bg-red-50' : currentStep === 'overview' ? 'border-red-600 bg-red-50' : 'border-gray-300'}`}>
              3
            </div>
            <span className="ml-2 font-medium">Producten</span>
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
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Kies een actie</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => handleActionSelect('booking')}
                className="p-6 border-2 border-gray-300 rounded-lg hover:border-red-600 hover:bg-red-50 transition-colors text-left group"
              >
                <Package className="text-red-600 mb-3" size={32} />
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-red-600">Voorraad Afboeken</h3>
                <p className="text-sm text-gray-600 mt-1">Boek voorraad af voor een klant of project</p>
              </button>

              <button
                onClick={() => handleActionSelect('overview')}
                className="p-6 border-2 border-gray-300 rounded-lg hover:border-red-600 hover:bg-red-50 transition-colors text-left group"
              >
                <FileText className="text-red-600 mb-3" size={32} />
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-red-600">Voorraad Afboeken Overzicht</h3>
                <p className="text-sm text-gray-600 mt-1">Bekijk alle afboekingen en transacties</p>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Customer/Project Input */}
        {currentStep === 'customer' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Klant of Project</h2>
              <button
                onClick={() => setCurrentStep('action')}
                className="text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                <ArrowLeft size={16} />
                Terug
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project (optioneel)</label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">Geen project</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.project_nummer ? `${project.project_nummer} - ` : ''}{project.naam}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Klantnaam of notitie</label>
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
                Volgende
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Product Selection */}
        {currentStep === 'products' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Selecteer Producten</h2>
              <button
                onClick={() => setCurrentStep('customer')}
                className="text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                <ArrowLeft size={16} />
                Terug
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
                        placeholder="Zoek op naam, EAN, SKU of GB-art.nr."
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
                                <div>SKU: {product.sku} {product.gb_article_number && `| GB: ${product.gb_article_number}`}</div>
                                {product.ean && <div>EAN: {product.ean}</div>}
                                <div>{product.category}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => startScanning(index)}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
                    >
                      <Scan size={18} />
                      Scan
                    </button>
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
                          <div className="text-sm text-gray-600">SKU: {line.product.sku}</div>
                          {line.product.gb_article_number && (
                            <div className="text-sm text-gray-600">GB-art.nr.: {line.product.gb_article_number}</div>
                          )}
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
                Product Toevoegen
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
                {loadingStock ? 'Bezig met afboeken...' : 'Afboeken Bevestigen'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Scan Barcode</h3>
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
                    Gescande waarde:
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
                  Doorgaan
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VoorraadbeheerAfboekenNew;
