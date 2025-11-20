import React, { useState, useEffect, useRef } from 'react';
import { X, Scan, Search, Plus, Minus, Trash2 } from 'lucide-react';
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
}

interface Location {
  id: string;
  name: string;
  type: string;
}

interface MaterialLine {
  id: string;
  product: Product | null;
  location: string;
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
  const [materialLines, setMaterialLines] = useState<MaterialLine[]>([{
    id: crypto.randomUUID(),
    product: null,
    location: '',
    quantity: 1,
    searchValue: '',
    showDropdown: false
  }]);
  const [showScanner, setShowScanner] = useState(false);
  const [scanningForLineIndex, setScanningForLineIndex] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

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
    setMaterialLines([...materialLines, {
      id: crypto.randomUUID(),
      product: null,
      location: '',
      quantity: 1,
      searchValue: '',
      showDropdown: false
    }]);
  };

  const removeLine = (index: number) => {
    if (materialLines.length > 1) {
      setMaterialLines(materialLines.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...materialLines];
    newLines[index] = { ...newLines[index], [field]: value };
    setMaterialLines(newLines);
  };

  const searchProducts = (index: number, searchValue: string) => {
    updateLine(index, 'searchValue', searchValue);

    if (searchValue.length < 2) {
      updateLine(index, 'showDropdown', false);
      return;
    }

    const filtered = products.filter(p =>
      p.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchValue.toLowerCase()) ||
      (p.ean && p.ean.toLowerCase().includes(searchValue.toLowerCase()))
    );

    if (filtered.length > 0) {
      updateLine(index, 'showDropdown', true);
    }
  };

  const selectProduct = (index: number, product: Product) => {
    const newLines = [...materialLines];
    newLines[index].product = product;
    newLines[index].searchValue = product.name;
    newLines[index].showDropdown = false;
    setMaterialLines(newLines);
  };

  const getFilteredProducts = (searchValue: string) => {
    if (!searchValue) return [];
    return products.filter(p =>
      p.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchValue.toLowerCase()) ||
      (p.ean && p.ean.toLowerCase().includes(searchValue.toLowerCase()))
    );
  };

  const startScanning = async (lineIndex: number) => {
    setScanningForLineIndex(lineIndex);
    setShowScanner(true);
    setScanning(true);

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("qr-reader");
      }

      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleScan(lineIndex, decodedText);
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
        setScanning(false);
        setShowScanner(false);
        setScanningForLineIndex(null);
      } catch (error) {
        console.error('Error stopping scanner:', error);
      }
    }
  };

  const handleScan = (lineIndex: number, scannedValue: string) => {
    const product = products.find(p =>
      p.ean === scannedValue ||
      p.sku === scannedValue
    );

    if (product) {
      selectProduct(lineIndex, product);
      stopScanning();
    }
  };

  const handleSave = () => {
    const validLines = materialLines.filter(line =>
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
      unit: line.product!.unit
    }));

    onSave(materials);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-gray-900">Materiaal Selecteren</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {materialLines.map((line, index) => (
            <div key={line.id} className="border border-gray-300 rounded-lg p-4 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Product zoeken */}
                <div className="md:col-span-5 relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={line.searchValue}
                        onChange={(e) => searchProducts(index, e.target.value)}
                        placeholder="Zoek product op naam, SKU of EAN"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      />

                      {line.showDropdown && line.searchValue && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {getFilteredProducts(line.searchValue).map((product) => (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => selectProduct(index, product)}
                              className="w-full text-left px-4 py-2 hover:bg-gray-100 border-b border-gray-200 last:border-b-0"
                            >
                              <div className="font-medium">{product.name}</div>
                              <div className="text-sm text-gray-600">
                                SKU: {product.sku} | {product.unit}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => startScanning(index)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      title="Scan barcode"
                    >
                      <Scan size={20} />
                    </button>
                  </div>
                </div>

                {/* Locatie */}
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Locatie
                  </label>
                  <select
                    value={line.location}
                    onChange={(e) => updateLine(index, 'location', e.target.value)}
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

                {/* Aantal */}
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Aantal
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateLine(index, 'quantity', Math.max(1, line.quantity - 1))}
                      className="p-2 border border-gray-300 rounded hover:bg-gray-100"
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 text-center px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                    <button
                      type="button"
                      onClick={() => updateLine(index, 'quantity', line.quantity + 1)}
                      className="p-2 border border-gray-300 rounded hover:bg-gray-100"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {/* Verwijder knop */}
                <div className="md:col-span-1 flex items-end">
                  {materialLines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
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
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-red-500 hover:text-red-600 flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            Regel toevoegen
          </button>
        </div>

        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            Annuleren
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Opslaan
          </button>
        </div>
      </div>

      {/* Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
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
            <div id="qr-reader" className="w-full"></div>
            <p className="text-sm text-gray-600 mt-4 text-center">
              Richt de camera op de barcode of QR code
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialSelectionModal;
