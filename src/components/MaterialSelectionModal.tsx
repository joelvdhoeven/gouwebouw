import React, { useState, useEffect, useRef } from 'react';
import { X, Scan, Search, Plus, Minus, Trash2, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Html5Qrcode } from 'html5-qrcode';

interface Product {
  id: string;
  name: string;
  sku: string;
  ean: string | null;
  category: string;
  unit: string;
  description: string | null;
  photo?: string;
}

interface Location {
  id: string;
  name: string;
  type: string;
}

interface ProductLine {
  id: string;
  product: Product | null;
  location: string;
  unit: string;
  quantity: number;
  searchValue: string;
  showDropdown: boolean;
}

interface MaterialSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (materials: Array<{product_id: string, location_id: string, quantity: number, product_name: string, unit: string}>) => void;
  projectId?: string;
}

const MaterialSelectionModal: React.FC<MaterialSelectionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  projectId
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [productLines, setProductLines] = useState<ProductLine[]>([{
    id: crypto.randomUUID(),
    product: null,
    location: '',
    unit: 'stuks',
    quantity: 1,
    searchValue: '',
    showDropdown: false
  }]);

  // Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanningForLineIndex, setScanningForLineIndex] = useState<number | null>(null);
  const [scannedValue, setScannedValue] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Search modal state
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchingForLineIndex, setSearchingForLineIndex] = useState<number | null>(null);
  const [searchLocation, setSearchLocation] = useState('');
  const [searchCategory, setSearchCategory] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear();
      }
    };
  }, []);

  const loadData = async () => {
    const [productsRes, locationsRes] = await Promise.all([
      supabase.from('inventory_products').select('*').order('name'),
      supabase.from('inventory_locations').select('*').order('name')
    ]);

    if (productsRes.data) setProducts(productsRes.data);
    if (locationsRes.data) setLocations(locationsRes.data);
  };

  const addLine = () => {
    setProductLines([...productLines, {
      id: crypto.randomUUID(),
      product: null,
      location: '',
      unit: 'stuks',
      quantity: 1,
      searchValue: '',
      showDropdown: false
    }]);
  };

  const removeLine = (index: number) => {
    if (productLines.length > 1) {
      setProductLines(productLines.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...productLines];
    newLines[index] = { ...newLines[index], [field]: value };
    setProductLines(newLines);
  };

  const updateLineSearch = (index: number, value: string) => {
    const newLines = [...productLines];
    newLines[index].searchValue = value;
    newLines[index].showDropdown = value.length >= 2;

    if (value.length >= 2) {
      // Try to find matching product
      const matching = products.filter(p =>
        p.name.toLowerCase().includes(value.toLowerCase()) ||
        p.sku.toLowerCase().includes(value.toLowerCase()) ||
        (p.ean && p.ean.toLowerCase().includes(value.toLowerCase()))
      );

      // Auto-select if exact match
      if (matching.length === 1 || matching.some(p => p.ean === value || p.sku === value)) {
        const exactMatch = matching.find(p => p.ean === value || p.sku === value) || matching[0];
        newLines[index].product = exactMatch;
        newLines[index].unit = exactMatch.unit;
        newLines[index].showDropdown = false;
      }
    } else {
      newLines[index].product = null;
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
    if (!searchValue || searchValue.length < 2) return [];
    return products.filter(p =>
      p.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchValue.toLowerCase()) ||
      (p.ean && p.ean.toLowerCase().includes(searchValue.toLowerCase()))
    ).slice(0, 10);
  };

  // Scanner functions
  const startScanning = async (lineIndex: number) => {
    setScanningForLineIndex(lineIndex);
    setShowScanner(true);
    setScanning(true);
    setScannedValue('');

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("qr-reader-material");
      }

      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {}
      );
    } catch (error) {
      console.error('Error starting scanner:', error);
      setScanning(false);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current && scanning) {
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
    console.log('Scan success:', decodedText);

    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        scannerRef.current?.clear();
        scannerRef.current = null;
      }).catch(err => console.error('Error stopping scanner:', err));
    }

    setScanning(false);
    setScannedValue(decodedText);
  };

  const handleConfirmScan = () => {
    if (scanningForLineIndex !== null && scannedValue) {
      const lineIndex = scanningForLineIndex;
      updateLineSearch(lineIndex, scannedValue);
      setShowScanner(false);
      setScanningForLineIndex(null);
      setScannedValue('');
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

    const { data: stockData } = await supabase
      .from('inventory_stock')
      .select('product_id, inventory_products(*)')
      .eq('location_id', locationId);

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

    const { data: stockData } = await supabase
      .from('inventory_stock')
      .select('product_id, inventory_products(*)')
      .eq('location_id', searchLocation);

    if (stockData) {
      let productsInLocation = stockData
        .map(s => s.inventory_products)
        .filter(Boolean) as Product[];

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
      const newLines = [...productLines];
      newLines[lineIndex].product = product;
      newLines[lineIndex].searchValue = product.name;
      newLines[lineIndex].unit = product.unit;
      newLines[lineIndex].location = searchLocation;
      newLines[lineIndex].showDropdown = false;
      setProductLines(newLines);
      closeSearchModal();
    }
  };

  const handleSave = () => {
    const validLines = productLines.filter(line =>
      line.product && line.location && line.quantity > 0
    );

    if (validLines.length === 0) {
      alert('Voeg minimaal 1 product toe met locatie en aantal');
      return;
    }

    const materials = validLines.map(line => ({
      product_id: line.product!.id,
      location_id: line.location,
      quantity: line.quantity,
      product_name: line.product!.name,
      unit: line.unit
    }));

    onSave(materials);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Materiaal Selecteren</h2>
            <p className="text-sm text-gray-600 mt-1">Zoek, scan of selecteer producten uit voorraad</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {productLines.map((line, index) => (
            <div key={line.id} className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50 hover:border-red-300 transition-colors">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Product Search */}
                <div className="lg:col-span-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Product *
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={line.searchValue}
                        onChange={(e) => updateLineSearch(index, e.target.value)}
                        placeholder="Zoek op naam, SKU of scan barcode"
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      />

                      {line.showDropdown && line.searchValue && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {getFilteredProducts(line.searchValue).map((product) => (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => selectProduct(index, product)}
                              className="w-full text-left px-4 py-3 hover:bg-red-50 border-b border-gray-200 last:border-b-0 transition-colors"
                            >
                              <div className="font-medium text-gray-900">{product.name}</div>
                              <div className="text-sm text-gray-600">
                                SKU: {product.sku} | {product.category} | {product.unit}
                              </div>
                            </button>
                          ))}
                          {getFilteredProducts(line.searchValue).length === 0 && (
                            <div className="px-4 py-3 text-gray-500 text-center">
                              Geen producten gevonden
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => startScanning(index)}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                      title="Scan barcode"
                    >
                      <Scan size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openSearchModal(index)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                      title="Zoek in voorraad"
                    >
                      <Search size={20} />
                    </button>
                  </div>
                  {line.product && (
                    <div className="mt-2 text-sm text-green-600 flex items-center gap-1">
                      <CheckCircle size={16} />
                      Geselecteerd: {line.product.name}
                    </div>
                  )}
                </div>

                {/* Location */}
                <div className="lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Locatie *
                  </label>
                  <select
                    value={line.location}
                    onChange={(e) => updateLine(index, 'location', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="">Selecteer locatie</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantity */}
                <div className="lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Aantal *
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateLine(index, 'quantity', Math.max(1, line.quantity - 1))}
                      className="p-2 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                      className="flex-1 text-center px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                    <button
                      type="button"
                      onClick={() => updateLine(index, 'quantity', line.quantity + 1)}
                      className="p-2 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  {line.product && (
                    <div className="mt-1 text-xs text-gray-500 text-center">
                      {line.unit}
                    </div>
                  )}
                </div>

                {/* Remove button */}
                <div className="lg:col-span-1 flex items-end justify-center">
                  {productLines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Verwijder regel"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addLine}
            className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-red-500 hover:text-red-600 hover:bg-red-50 flex items-center justify-center gap-2 transition-colors font-medium"
          >
            <Plus size={20} />
            Regel toevoegen
          </button>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50 flex gap-3 sticky bottom-0">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 transition-colors font-medium"
          >
            Annuleren
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
          >
            Materialen Toevoegen ({productLines.filter(l => l.product && l.location && l.quantity > 0).length})
          </button>
        </div>
      </div>

      {/* Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Scan Barcode</h3>
              <button
                onClick={stopScanning}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div id="qr-reader-material" className="w-full mb-4"></div>

            {scannedValue && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="text-sm text-green-800 font-medium">Gescand:</div>
                <div className="text-green-900 font-mono">{scannedValue}</div>
              </div>
            )}

            <p className="text-sm text-gray-600 text-center mb-4">
              Richt de camera op de barcode of QR code
            </p>

            {scannedValue && (
              <button
                onClick={handleConfirmScan}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Bevestigen
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-gray-900">Zoek in Voorraad</h3>
              <button
                onClick={closeSearchModal}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecteer Locatie
                </label>
                <select
                  value={searchLocation}
                  onChange={(e) => handleSearchLocation(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">Kies een locatie...</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name} ({location.type})
                    </option>
                  ))}
                </select>
              </div>

              {searchLocation && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Filter op Categorie (optioneel)
                  </label>
                  <select
                    value={searchCategory}
                    onChange={(e) => handleSearchCategory(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
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

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    {searchResults.length} product(en) gevonden
                  </div>
                  {searchResults.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => selectProductFromSearch(product)}
                      className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-red-500 hover:bg-red-50 text-left transition-colors"
                    >
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        SKU: {product.sku} | Categorie: {product.category} | Eenheid: {product.unit}
                      </div>
                      {product.ean && (
                        <div className="text-sm text-gray-500 mt-1">EAN: {product.ean}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {searchLocation && searchResults.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Geen producten gevonden op deze locatie
                </div>
              )}

              {!searchLocation && (
                <div className="text-center py-8 text-gray-500">
                  Selecteer eerst een locatie om producten te zoeken
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialSelectionModal;
