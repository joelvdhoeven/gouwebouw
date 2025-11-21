import React, { useState, useEffect, useRef } from 'react';
import { Package, Search, Plus, AlertCircle, Truck, Warehouse, Download, Upload, ScanLine, Filter, X, Edit, Trash2, Eye, ArrowRightLeft, Image as ImageIcon, Camera } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useSystemSettings } from '../contexts/SystemSettingsContext';
import type { ProductCategory, MaterialGroup } from '../types';

interface Product {
  id: string;
  name: string; // Materiaalomschrijving
  sku: string;
  gb_article_number?: string; // GB-art.nr.
  ean: string | null; // EAN-code
  category: string;
  material_group?: string; // Materiaalgroep (01-10)
  unit: string; // Eenheid
  minimum_stock: number; // Min. voorraad
  description: string | null;
  supplier: string | null; // Leverancier
  supplier_article_number?: string; // Lev.art.nr.
  price: number | null;
  purchase_price: number | null;
  sale_price: number | null;
  price_per_unit?: number; // €/eenh
  photo_path?: string; // Product photo path in Supabase Storage
}

interface Location {
  id: string;
  name: string;
  type: string;
  license_plate: string | null;
  description: string | null;
}

interface Stock {
  product_id: string;
  location_id: string;
  quantity: number;
  product?: Product;
  location?: Location;
}

interface LowStockAlert {
  product_id: string;
  product_name: string;
  sku: string;
  category: string;
  location_id: string;
  location_name: string;
  current_stock: number;
  minimum_stock: number;
}

interface Project {
  id: string;
  naam: string;
  project_nummer: string | null;
}

const VoorraadbeheerAdmin: React.FC = () => {
  const { user, profile } = useAuth();
  const { getCsvSeparator } = useSystemSettings();
  const [activeTab, setActiveTab] = useState<'overzicht' | 'boeken' | 'producten' | 'locaties'>('overzicht');
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [stock, setStock] = useState<Stock[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');


  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editFormData, setEditFormData] = useState({
    minimum_stock: 0,
    ean: '',
    price: 0,
    purchase_price: 0,
    sale_price: 0,
    supplier: ''
  });
  const [productStockByLocation, setProductStockByLocation] = useState<Stock[]>([]);

  const [showStockEditModal, setShowStockEditModal] = useState(false);
  const [editingStock, setEditingStock] = useState<Stock | null>(null);
  const [stockEditFormData, setStockEditFormData] = useState({
    product_name: '',
    quantity: 0,
    minimum_stock: 0,
    ean: '',
    purchase_price: 0,
    sale_price: 0,
    location_id: ''
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [showEditLocationModal, setShowEditLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [showLocationDetailsModal, setShowLocationDetailsModal] = useState(false);
  const [selectedLocationForDetails, setSelectedLocationForDetails] = useState<Location | null>(null);
  const [newLocationData, setNewLocationData] = useState({
    name: '',
    type: 'magazijn' as 'magazijn' | 'bus',
    license_plate: '',
    description: ''
  });
  const [editLocationData, setEditLocationData] = useState({
    name: '',
    type: 'magazijn' as 'magazijn' | 'bus',
    license_plate: '',
    description: ''
  });

  const [showImportLocationModal, setShowImportLocationModal] = useState(false);
  const [importLocationId, setImportLocationId] = useState<string>('');

  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProductData, setNewProductData] = useState({
    name: '',
    sku: '',
    gb_article_number: '',
    ean: '',
    category: '',
    unit: '',
    minimum_stock: 0,
    description: '',
    supplier: '',
    supplier_article_number: '',
    price: 0,
    purchase_price: 0,
    sale_price: 0,
    price_per_unit: 0
  });
  const [newProductPhoto, setNewProductPhoto] = useState<File | null>(null);
  const [newProductPhotoPreview, setNewProductPhotoPreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Initial stock for new product
  const [initialStockLocation, setInitialStockLocation] = useState('');
  const [initialStockQuantity, setInitialStockQuantity] = useState(0);

  const [showMoveStockModal, setShowMoveStockModal] = useState(false);
  const [moveStockData, setMoveStockData] = useState<{
    productId: string;
    productName: string;
    fromLocationId: string;
    toLocationId: string;
    quantity: number;
    maxQuantity: number;
  } | null>(null);

  const [selectedStockIds, setSelectedStockIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showBulkLocationChange, setShowBulkLocationChange] = useState(false);
  const [bulkNewLocationId, setBulkNewLocationId] = useState('');
  const [showBulkLocationConfirm, setShowBulkLocationConfirm] = useState(false);

  const isAdmin = profile?.role === 'admin';
  const isKantoor = profile?.role === 'kantoorpersoneel';
  const canManage = isAdmin || isKantoor;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [productsRes, locationsRes, stockRes, projectsRes, categoriesRes] = await Promise.all([
        supabase.from('inventory_products').select('*').order('name'),
        supabase.from('inventory_locations').select('*').order('name'),
        supabase.from('inventory_stock').select('*, product:inventory_products(*), location:inventory_locations(*)'),
        supabase.from('projects').select('id, naam, project_nummer').eq('status', 'actief').order('naam'),
        supabase.from('product_categories').select('*').eq('is_active', true).order('name')
      ]);

      if (productsRes.data) setProducts(productsRes.data);
      if (locationsRes.data) setLocations(locationsRes.data);
      if (stockRes.data) setStock(stockRes.data);
      if (projectsRes.data) setProjects(projectsRes.data);
      if (categoriesRes.data) setCategories(categoriesRes.data);

      if (canManage) {
        const { data: alerts } = await supabase.rpc('get_low_stock_products');
        if (alerts) setLowStockAlerts(alerts);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleEditProduct = async (product: Product) => {
    setEditingProduct(product);
    setEditFormData({
      minimum_stock: product.minimum_stock,
      ean: product.ean || '',
      price: product.price || 0,
      supplier: product.supplier || ''
    });

    const productStock = stock.filter(s => s.product_id === product.id);
    setProductStockByLocation(productStock);
    setShowEditModal(true);
  };

  const handleSaveProductEdit = async () => {
    if (!editingProduct) return;

    try {
      const { error: productError } = await supabase
        .from('inventory_products')
        .update({
          minimum_stock: editFormData.minimum_stock,
          ean: editFormData.ean || null,
          price: editFormData.price || null,
          purchase_price: editFormData.purchase_price || null,
          sale_price: editFormData.sale_price || null,
          supplier: editFormData.supplier || null
        })
        .eq('id', editingProduct.id);

      if (productError) throw productError;

      for (const stockItem of productStockByLocation) {
        const { error: stockError } = await supabase
          .from('inventory_stock')
          .update({ quantity: stockItem.quantity })
          .eq('product_id', editingProduct.id)
          .eq('location_id', stockItem.location_id);

        if (stockError) throw stockError;
      }

      alert('Product succesvol bijgewerkt!');
      setShowEditModal(false);
      setEditingProduct(null);
      loadData();
    } catch (error) {
      console.error('Error updating product:', error);
      alert('Fout bij het bijwerken van product');
    }
  };

  const updateStockQuantity = (locationId: string, newQuantity: number) => {
    setProductStockByLocation(productStockByLocation.map(s =>
      s.location_id === locationId ? { ...s, quantity: Math.max(0, newQuantity) } : s
    ));
  };

  const handleEditStock = (stockItem: Stock) => {
    setEditingStock(stockItem);
    setStockEditFormData({
      product_name: stockItem.product?.name || '',
      quantity: stockItem.quantity,
      minimum_stock: stockItem.product?.minimum_stock || 0,
      ean: stockItem.product?.ean || '',
      purchase_price: stockItem.product?.purchase_price || 0,
      sale_price: stockItem.product?.sale_price || 0,
      location_id: stockItem.location_id
    });
    setShowStockEditModal(true);
  };

  const handleSaveStockEdit = async () => {
    if (!editingStock) return;

    try {
      const { error: stockError } = await supabase
        .from('inventory_stock')
        .update({
          quantity: stockEditFormData.quantity,
          location_id: stockEditFormData.location_id
        })
        .eq('product_id', editingStock.product_id)
        .eq('location_id', editingStock.location_id);

      if (stockError) throw stockError;

      const { error: productError } = await supabase
        .from('inventory_products')
        .update({
          name: stockEditFormData.product_name,
          minimum_stock: stockEditFormData.minimum_stock,
          ean: stockEditFormData.ean || null,
          purchase_price: stockEditFormData.purchase_price || null,
          sale_price: stockEditFormData.sale_price || null
        })
        .eq('id', editingStock.product_id);

      if (productError) throw productError;

      alert('Voorraad succesvol bijgewerkt!');
      setShowStockEditModal(false);
      setEditingStock(null);
      loadData();
    } catch (error) {
      console.error('Error updating stock:', error);
      alert('Fout bij het bijwerken van voorraad');
    }
  };

  const handleDeleteProductConfirm = (productId: string) => {
    setProductToDelete(productId);
    setShowDeleteConfirm(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      const { error: productError } = await supabase
        .from('inventory_products')
        .delete()
        .eq('id', productId);

      if (productError) throw productError;

      alert('Product succesvol verwijderd! Alle gerelateerde voorraad en transacties zijn ook verwijderd.');
      setShowDeleteConfirm(false);
      setProductToDelete(null);
      setShowStockEditModal(false);
      setEditingStock(null);
      loadData();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      const errorMessage = error?.message || 'Onbekende fout bij het verwijderen';
      alert(`Fout bij het verwijderen van product: ${errorMessage}`);
      setShowDeleteConfirm(false);
      setProductToDelete(null);
    }
  };

  const handleMoveStock = async () => {
    if (!moveStockData || !moveStockData.toLocationId) {
      alert('Selecteer een locatie om naartoe te verplaatsen');
      return;
    }

    if (moveStockData.quantity <= 0 || moveStockData.quantity > moveStockData.maxQuantity) {
      alert(`Voer een geldige hoeveelheid in (1-${moveStockData.maxQuantity})`);
      return;
    }

    try {
      const newQuantityFrom = moveStockData.maxQuantity - moveStockData.quantity;

      if (newQuantityFrom > 0) {
        const { error: updateError } = await supabase
          .from('inventory_stock')
          .update({ quantity: newQuantityFrom })
          .eq('product_id', moveStockData.productId)
          .eq('location_id', moveStockData.fromLocationId);

        if (updateError) throw updateError;
      } else {
        const { error: deleteError } = await supabase
          .from('inventory_stock')
          .delete()
          .eq('product_id', moveStockData.productId)
          .eq('location_id', moveStockData.fromLocationId);

        if (deleteError) throw deleteError;
      }

      const { data: existingStock } = await supabase
        .from('inventory_stock')
        .select('quantity')
        .eq('product_id', moveStockData.productId)
        .eq('location_id', moveStockData.toLocationId)
        .maybeSingle();

      if (existingStock) {
        const { error: updateError } = await supabase
          .from('inventory_stock')
          .update({ quantity: existingStock.quantity + moveStockData.quantity })
          .eq('product_id', moveStockData.productId)
          .eq('location_id', moveStockData.toLocationId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('inventory_stock')
          .insert({
            product_id: moveStockData.productId,
            location_id: moveStockData.toLocationId,
            quantity: moveStockData.quantity
          });

        if (insertError) throw insertError;
      }

      alert('Voorraad succesvol verplaatst!');
      setShowMoveStockModal(false);
      setMoveStockData(null);
      loadData();
    } catch (error) {
      console.error('Error moving stock:', error);
      alert('Fout bij het verplaatsen van voorraad');
    }
  };

  const toggleSelectStock = (stockId: string) => {
    const newSelected = new Set(selectedStockIds);
    if (newSelected.has(stockId)) {
      newSelected.delete(stockId);
    } else {
      newSelected.add(stockId);
    }
    setSelectedStockIds(newSelected);
  };

  const selectAllStock = () => {
    const allIds = new Set(filteredStock.map(s => `${s.product_id}|||${s.location_id}`));
    setSelectedStockIds(allIds);
  };

  const deselectAllStock = () => {
    setSelectedStockIds(new Set());
  };

  const handleBulkDelete = async () => {
    setShowBulkDeleteConfirm(false);
    try {
      for (const stockId of selectedStockIds) {
        const [productId, locationId] = stockId.split('|||');
        const { error } = await supabase
          .from('inventory_stock')
          .delete()
          .eq('product_id', productId)
          .eq('location_id', locationId);

        if (error) throw error;
      }

      alert(`${selectedStockIds.size} item(s) succesvol verwijderd!`);
      setSelectedStockIds(new Set());
      loadData();
    } catch (error) {
      console.error('Error deleting stock:', error);
      alert('Fout bij het verwijderen van voorraad');
    }
  };

  const handleBulkLocationChangeSubmit = () => {
    if (!bulkNewLocationId) {
      alert('Selecteer een nieuwe locatie');
      return;
    }
    setShowBulkLocationChange(false);
    setShowBulkLocationConfirm(true);
  };

  const handleBulkLocationChangeConfirm = async () => {
    setShowBulkLocationConfirm(false);
    try {
      for (const stockId of selectedStockIds) {
        const [productId, oldLocationId] = stockId.split('|||');

        const { data: currentStock } = await supabase
          .from('inventory_stock')
          .select('quantity')
          .eq('product_id', productId)
          .eq('location_id', oldLocationId)
          .maybeSingle();

        if (!currentStock) continue;

        const { data: existingStock } = await supabase
          .from('inventory_stock')
          .select('quantity')
          .eq('product_id', productId)
          .eq('location_id', bulkNewLocationId)
          .maybeSingle();

        if (existingStock) {
          await supabase
            .from('inventory_stock')
            .update({ quantity: existingStock.quantity + currentStock.quantity })
            .eq('product_id', productId)
            .eq('location_id', bulkNewLocationId);
        } else {
          await supabase
            .from('inventory_stock')
            .insert({
              product_id: productId,
              location_id: bulkNewLocationId,
              quantity: currentStock.quantity
            });
        }

        await supabase
          .from('inventory_stock')
          .delete()
          .eq('product_id', productId)
          .eq('location_id', oldLocationId);
      }

      alert(`${selectedStockIds.size} item(s) succesvol verplaatst!`);
      setSelectedStockIds(new Set());
      setBulkNewLocationId('');
      loadData();
    } catch (error) {
      console.error('Error changing location:', error);
      alert('Fout bij het wijzigen van locatie');
    }
  };

  const handleAddLocation = async () => {
    if (!newLocationData.name || !newLocationData.type) {
      alert('Vul minimaal een naam en type in');
      return;
    }

    try {
      const { error } = await supabase
        .from('inventory_locations')
        .insert({
          name: newLocationData.name,
          type: newLocationData.type,
          license_plate: newLocationData.license_plate || null,
          description: newLocationData.description || null
        });

      if (error) throw error;

      alert('Locatie succesvol toegevoegd!');
      setShowAddLocationModal(false);
      setNewLocationData({ name: '', type: 'magazijn', license_plate: '', description: '' });
      loadData();
    } catch (error) {
      console.error('Error adding location:', error);
      alert('Fout bij het toevoegen van locatie');
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (!window.confirm('Weet je zeker dat je deze locatie wilt verwijderen? Dit verwijdert ook alle voorraad op deze locatie.')) {
      return;
    }

    try {
      const { error: stockError } = await supabase
        .from('inventory_stock')
        .delete()
        .eq('location_id', locationId);

      if (stockError) throw stockError;

      const { error: locationError } = await supabase
        .from('inventory_locations')
        .delete()
        .eq('id', locationId);

      if (locationError) throw locationError;

      alert('Locatie succesvol verwijderd!');
      loadData();
    } catch (error) {
      console.error('Error deleting location:', error);
      alert('Fout bij het verwijderen van locatie');
    }
  };

  const handleViewLocationDetails = (location: Location) => {
    setSelectedLocationForDetails(location);
    setShowLocationDetailsModal(true);
  };

  const handleEditLocation = (location: Location) => {
    setEditingLocation(location);
    setEditLocationData({
      name: location.name,
      type: location.type as 'magazijn' | 'bus',
      license_plate: location.license_plate || '',
      description: location.description || ''
    });
    setShowEditLocationModal(true);
  };

  const handleSaveLocationEdit = async () => {
    if (!editingLocation) return;

    if (!editLocationData.name) {
      alert('Vul minimaal een naam in');
      return;
    }

    try {
      const { error } = await supabase
        .from('inventory_locations')
        .update({
          name: editLocationData.name,
          type: editLocationData.type,
          license_plate: editLocationData.license_plate || null,
          description: editLocationData.description || null
        })
        .eq('id', editingLocation.id);

      if (error) throw error;

      alert('Locatie succesvol bijgewerkt!');
      setShowEditLocationModal(false);
      setEditingLocation(null);
      loadData();
    } catch (error) {
      console.error('Error updating location:', error);
      alert('Fout bij het bijwerken van locatie');
    }
  };

  const exportLocationToCSV = (location: Location) => {
    const locationStock = stock.filter(s => s.location_id === location.id);

    if (locationStock.length === 0) {
      alert('Geen voorraad op deze locatie om te exporteren');
      return;
    }

    const separator = ';';
    const csv = [
      ['SKU', 'Naam', 'Materiaal groep', 'Voorraad', 'Eenheid', 'Min. Voorraad', 'EAN'].join(separator),
      ...locationStock.map(s => [
        s.product?.sku || '',
        s.product?.name || '',
        s.product?.category || '',
        s.quantity,
        s.product?.unit || '',
        s.product?.minimum_stock || 0,
        s.product?.ean || ''
      ].join(separator))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voorraad_${location.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleImportLocation = (locationId: string) => {
    setImportLocationId(locationId);
    setShowImportLocationModal(true);
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const separator = getCsvSeparator();
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const rows = text.split('\n').slice(1);

        let successCount = 0;
        let errorCount = 0;

        for (const row of rows) {
          if (!row.trim()) continue;

          const [sku, , , quantity] = row.split(separator);

          if (!sku || !quantity) continue;

          const { data: productData } = await supabase
            .from('inventory_products')
            .select('id')
            .eq('sku', sku.trim())
            .maybeSingle();

          if (!productData) {
            errorCount++;
            continue;
          }

          const { data: existingStock } = await supabase
            .from('inventory_stock')
            .select('quantity')
            .eq('product_id', productData.id)
            .eq('location_id', importLocationId)
            .maybeSingle();

          if (existingStock) {
            const { error } = await supabase
              .from('inventory_stock')
              .update({ quantity: existingStock.quantity + parseInt(quantity) })
              .eq('product_id', productData.id)
              .eq('location_id', importLocationId);

            if (error) {
              errorCount++;
            } else {
              successCount++;
            }
          } else {
            const { error } = await supabase
              .from('inventory_stock')
              .insert({
                product_id: productData.id,
                location_id: importLocationId,
                quantity: parseInt(quantity)
              });

            if (error) {
              errorCount++;
            } else {
              successCount++;
            }
          }
        }

        alert(`Import voltooid!\nSuccesvol: ${successCount}\nFouten: ${errorCount}`);
        setShowImportLocationModal(false);
        loadData();
      } catch (error) {
        console.error('Error importing CSV:', error);
        alert('Fout bij het importeren van CSV');
      }
    };
    reader.readAsText(file);
  };

  const handleAddProduct = async () => {
    // Only name and SKU are required
    if (!newProductData.name || !newProductData.sku) {
      alert('Vul minimaal naam en SKU in');
      return;
    }

    try {
      let photoPath: string | null = null;

      // Upload photo if provided (skip if bucket doesn't exist)
      if (newProductPhoto) {
        try {
          const fileExt = newProductPhoto.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `product-photos/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, newProductPhoto);

          if (uploadError) {
            console.error('Error uploading photo:', uploadError);
            // Continue without photo - don't block product creation
          } else {
            photoPath = filePath;
          }
        } catch (photoError) {
          console.error('Photo upload failed:', photoError);
          // Continue without photo - don't block product creation
        }
      }

      const { data: newProduct, error } = await supabase
        .from('inventory_products')
        .insert({
          name: newProductData.name,
          sku: newProductData.sku,
          gb_article_number: newProductData.gb_article_number || null,
          ean: newProductData.ean || null,
          category: newProductData.category || null,
          unit: newProductData.unit || 'stuks',
          minimum_stock: newProductData.minimum_stock || 0,
          description: newProductData.description || null,
          supplier: newProductData.supplier || null,
          supplier_article_number: newProductData.supplier_article_number || null,
          price: newProductData.price || null,
          purchase_price: newProductData.purchase_price || null,
          sale_price: newProductData.sale_price || null,
          price_per_unit: newProductData.price_per_unit || null,
          photo_path: photoPath
        })
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);

        // User-friendly error messages
        if (error.message && error.message.includes('gb_article_number')) {
          alert('⚠️ Database migratie vereist!\n\nVoer eerst de SQL migratie uit in Supabase:\n1. Kopieer de SQL code\n2. Ga naar Supabase > SQL Editor\n3. Plak en voer uit');
        } else {
          alert('Fout bij het toevoegen van product. Zie console voor details.');
        }

        throw error;
      }

      // Add initial stock if location and quantity are provided
      if (newProduct && initialStockLocation && initialStockQuantity > 0) {
        const { error: stockError } = await supabase
          .from('inventory_stock')
          .insert({
            product_id: newProduct.id,
            location_id: initialStockLocation,
            quantity: initialStockQuantity
          });

        if (stockError) {
          console.error('Error adding initial stock:', stockError);
          alert('Product toegevoegd, maar er ging iets mis bij het toevoegen van voorraad. Voeg handmatig voorraad toe in het overzicht.');
        }
      }

      alert('Product succesvol toegevoegd!');
      closeAddProductModal();
      setNewProductData({
        name: '',
        sku: '',
        gb_article_number: '',
        ean: '',
        category: '',
        unit: '',
        minimum_stock: 0,
        description: '',
        supplier: '',
        supplier_article_number: '',
        price: 0,
        purchase_price: 0,
        sale_price: 0,
        price_per_unit: 0
      });
      setNewProductPhoto(null);
      setNewProductPhotoPreview(null);
      loadData();
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Fout bij het toevoegen van product');
    }
  };

  // Camera functions for product photo
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 1280, height: 720 }
      });
      setCameraStream(stream);
      setShowCamera(true);

      // Wait for video element to be ready
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Kon camera niet starten. Controleer de camera permissies.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `product-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
            setNewProductPhoto(file);

            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
              setNewProductPhotoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);

            // Stop camera
            stopCamera();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  const closeAddProductModal = () => {
    // Stop camera if running
    stopCamera();
    // Reset form
    setNewProductPhoto(null);
    setNewProductPhotoPreview(null);
    setInitialStockLocation('');
    setInitialStockQuantity(0);
    setShowAddProductModal(false);
  };

  const handleEditFullProduct = (product: Product) => {
    setEditingProduct(product);
    const productStock = stock.filter(s => s.product_id === product.id);
    setProductStockByLocation(productStock);

    setEditFormData({
      minimum_stock: product.minimum_stock,
      ean: product.ean || '',
      price: product.price || 0,
      purchase_price: product.purchase_price || 0,
      sale_price: product.sale_price || 0,
      supplier: product.supplier || ''
    });
    setShowEditModal(true);
  };


  const exportToCSV = () => {
    if (filteredStock.length === 0) {
      alert('Geen voorraad om te exporteren');
      return;
    }

    const separator = getCsvSeparator();
    const csv = [
      ['SKU', 'Naam', 'Materiaal groep', 'Locatie', 'Voorraad', 'Eenheid', 'Min. Voorraad'].join(separator),
      ...filteredStock.map(s => [
        s.product?.sku || '',
        s.product?.name || '',
        s.product?.category || '',
        s.location?.name || '',
        s.quantity,
        s.product?.unit || '',
        s.product?.minimum_stock || 0
      ].join(separator))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voorraad_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const exportProductsToCSV = () => {
    if (products.length === 0) {
      alert('Geen producten om te exporteren');
      return;
    }

    const separator = getCsvSeparator();
    const csv = [
      [
        'SKU',
        'GB-art.nr.',
        'Materiaalomschrijving',
        'Materiaal groep',
        'Eenheid',
        'Min. Voorraad',
        'EAN-code',
        'Leverancier',
        'Lev.art.nr.',
        '€/eenh',
        'Inkoopprijs',
        'Verkoopprijs',
        'Beschrijving'
      ].join(separator),
      ...products.map(p => [
        p.sku || '',
        p.gb_article_number || '',
        p.name || '',
        p.category || '',
        p.unit || '',
        p.minimum_stock || 0,
        p.ean || '',
        p.supplier || '',
        p.supplier_article_number || '',
        p.price_per_unit || 0,
        p.purchase_price || 0,
        p.sale_price || 0,
        p.description || ''
      ].join(separator))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `producten_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const downloadImportTemplate = () => {
    const separator = getCsvSeparator();
    const headers = [
      'sku',
      'gb_article_number',
      'name',
      'category',
      'unit',
      'minimum_stock',
      'ean',
      'supplier',
      'supplier_article_number',
      'price_per_unit',
      'purchase_price',
      'sale_price',
      'description'
    ];
    const exampleRows = [
      ['PROD001', '45x70-300', 'Vuren C geschaafd 44x70 FSC, lengte 300 cm', '06', 'Hout', 'stuk', '10', '37215133001', 'Stiho', '160740', '5.13', '4.50', '6.00', 'Houten balk voor constructie'],
      ['PROD002', 'SVD04040-500', 'Schroef 4.0x40 Voldraad, 500 per doosje', '03', 'Montage', 'doosje', '10', '', 'Berner', '410148-500', '8.85', '7.50', '10.00', 'Doos met 500 schroeven'],
      ['PROD003', 'KIT-PUR-001', 'PUR Schuim 750ml', '02', 'Pur & Kit', 'bus', '5', '8712345678901', 'Soudal', 'PUR750', '4.25', '3.50', '5.50', 'Expansie PUR schuim 750ml']
    ];

    const csvContent = [
      headers.join(separator),
      ...exampleRows.map(row => row.join(separator))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'import_sjabloon_producten.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportProducts = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const separator = getCsvSeparator();
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const rows = text.split('\n').slice(1);

        let successCount = 0;
        let errorCount = 0;

        for (const row of rows) {
          if (!row.trim()) continue;

          const [
            sku,
            gb_article_number,
            name,
            category,
            unit,
            minimum_stock,
            ean,
            supplier,
            supplier_article_number,
            price_per_unit,
            purchase_price,
            sale_price,
            description
          ] = row.split(separator);

          if (!sku || !name || !category || !unit) {
            errorCount++;
            continue;
          }

          const { error } = await supabase
            .from('inventory_products')
            .upsert({
              sku: sku.trim(),
              gb_article_number: gb_article_number?.trim() || null,
              name: name.trim(),
              category: category.trim(),
              unit: unit.trim(),
              minimum_stock: parseInt(minimum_stock) || 0,
              ean: ean?.trim() || null,
              supplier: supplier?.trim() || null,
              supplier_article_number: supplier_article_number?.trim() || null,
              price_per_unit: parseFloat(price_per_unit) || null,
              purchase_price: parseFloat(purchase_price) || null,
              sale_price: parseFloat(sale_price) || null,
              description: description?.trim() || null
            }, { onConflict: 'sku' });

          if (error) {
            errorCount++;
            console.error('Error importing product:', error);
          } else {
            successCount++;
          }
        }

        alert(`Import voltooid!\nSuccesvol: ${successCount}\nFouten: ${errorCount}`);
        loadData();
      } catch (error) {
        console.error('Error reading CSV:', error);
        alert('Fout bij het lezen van het CSV bestand');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const filteredStock = stock.filter(s => {
    const matchesSearch = !searchTerm ||
      s.product?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.product?.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || s.product?.category === categoryFilter;
    const matchesLocation = !locationFilter || s.location_id === locationFilter;
    return matchesSearch && matchesCategory && matchesLocation;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Voorraadbeheer</h1>
          <p className="text-gray-600">Beheer voorraad en boek materiaal af op projecten</p>
        </div>
        <div className="flex gap-2">
        </div>
      </div>

      {canManage && lowStockAlerts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-yellow-600 mt-0.5" size={20} />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900 mb-2">Voorraad Waarschuwingen ({lowStockAlerts.length})</h3>
              <div className="space-y-1">
                {lowStockAlerts.slice(0, 5).map((alert, idx) => (
                  <div key={idx} className="text-sm text-yellow-800">
                    {alert.product_name} bij {alert.location_name}: {alert.current_stock} {products.find(p => p.id === alert.product_id)?.unit} (min: {alert.minimum_stock})
                  </div>
                ))}
                {lowStockAlerts.length > 5 && (
                  <div className="text-sm text-yellow-700 font-medium">+ {lowStockAlerts.length - 5} meer...</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <div className="flex space-x-1 p-1">
            {['overzicht', 'producten', 'locaties'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab
                    ? 'bg-red-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'overzicht' && (
            <div className="space-y-4">
              {selectedStockIds.size > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <span className="text-blue-900 font-medium">
                      {selectedStockIds.size} item(s) geselecteerd
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={selectAllStock}
                        className="px-3 py-1.5 text-sm bg-white border border-blue-300 text-blue-700 rounded hover:bg-blue-50"
                      >
                        Alles Selecteren
                      </button>
                      <button
                        onClick={deselectAllStock}
                        className="px-3 py-1.5 text-sm bg-white border border-blue-300 text-blue-700 rounded hover:bg-blue-50"
                      >
                        Alles Deselecteren
                      </button>
                      {canManage && (
                        <>
                          <button
                            onClick={() => setShowBulkLocationChange(true)}
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                          >
                            <ArrowRightLeft size={16} />
                            Wijzig Locatie
                          </button>
                          <button
                            onClick={() => setShowBulkDeleteConfirm(true)}
                            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1"
                          >
                            <Trash2 size={16} />
                            Verwijderen
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3 pb-4 border-b border-gray-200">
                <div className="flex flex-wrap gap-2">
                  {canManage && (
                    <>
                      <button
                        onClick={() => setShowAddProductModal(true)}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
                      >
                        <Plus size={18} />
                        Product Toevoegen
                      </button>
                      <button
                        onClick={() => setShowAddLocationModal(true)}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
                      >
                        <Plus size={18} />
                        Locatie Toevoegen
                      </button>
                    </>
                  )}
                  <button
                    onClick={exportToCSV}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
                  >
                    <Download size={18} />
                    Export Voorraad
                  </button>
                  {canManage && (
                    <div className="flex flex-col items-end gap-1">
                      <label className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2 cursor-pointer">
                        <Upload size={18} />
                        Import Voorraad
                        <input
                          type="file"
                          accept=".csv"
                          onChange={handleImportProducts}
                          className="hidden"
                        />
                      </label>
                      <button
                        onClick={downloadImportTemplate}
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        Download import sjabloon
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Zoek op naam of SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">Alle Materiaal groepen</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">Alle Locaties</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 w-12">
                        <input
                          type="checkbox"
                          checked={filteredStock.length > 0 && selectedStockIds.size === filteredStock.length}
                          onChange={(e) => e.target.checked ? selectAllStock() : deselectAllStock()}
                          className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Materiaal groep</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Locatie</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Voorraad</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Min.</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acties</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredStock.map((item) => {
                      const isLow = item.quantity < (item.product?.minimum_stock || 0);
                      const stockId = `${item.product_id}|||${item.location_id}`;
                      const isSelected = selectedStockIds.has(stockId);
                      return (
                        <tr key={stockId} className={isLow ? 'bg-yellow-50' : ''}>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectStock(stockId)}
                              className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.product?.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.product?.sku}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.product?.category}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              {item.location?.type === 'bus' ? <Truck size={16} /> : <Warehouse size={16} />}
                              {item.location?.name}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium">
                            {item.quantity} {item.product?.unit}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">
                            {item.product?.minimum_stock}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {isLow ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                Laag
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                OK
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEditStock(item)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                title="Bewerk voorraad"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => {
                                  setMoveStockData({
                                    productId: item.product_id,
                                    productName: item.product?.name || '',
                                    fromLocationId: item.location_id,
                                    toLocationId: '',
                                    quantity: 1,
                                    maxQuantity: item.quantity
                                  });
                                  setShowMoveStockModal(true);
                                }}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="Verplaats naar andere locatie"
                              >
                                <ArrowRightLeft size={16} />
                              </button>
                              {canManage && (
                                <button
                                  onClick={() => handleDeleteProduct(item.product_id)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  title="Verwijder product"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'producten' && (
            <div className="space-y-4">
              {/* Search and Actions - Mobile Responsive */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Zoek op naam, SKU of materiaal groep..."
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    <label className="flex-1 sm:flex-none px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap">
                      <Upload size={18} />
                      <span className="hidden sm:inline">Import CSV</span>
                      <span className="sm:hidden">Import</span>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleImportProducts}
                        className="hidden"
                      />
                    </label>
                    <button
                      onClick={exportProductsToCSV}
                      className="flex-1 sm:flex-none px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <Download size={18} />
                      <span className="hidden sm:inline">Export CSV</span>
                      <span className="sm:hidden">Export</span>
                    </button>
                    <button
                      onClick={() => setShowAddProductModal(true)}
                      className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <Plus size={18} />
                      <span className="hidden sm:inline">Product Toevoegen</span>
                      <span className="sm:hidden">Toevoegen</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.filter(p =>
                  !productSearchTerm ||
                  p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                  p.sku.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                  p.category.toLowerCase().includes(productSearchTerm.toLowerCase())
                ).map((product) => (
                  <div key={product.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900 flex-1 break-words">{product.name}</h3>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded whitespace-nowrap">{product.sku}</span>
                        {canManage && (
                          <>
                            <button
                              onClick={() => handleEditFullProduct(product)}
                              className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                              title="Bewerk product"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Verwijder product"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{product.category}</p>
                    {product.description && (
                      <p className="text-sm text-gray-500 mb-2 line-clamp-2">{product.description}</p>
                    )}
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 text-sm">
                      <span className="text-gray-600">Min. voorraad: {product.minimum_stock}</span>
                      <span className="text-gray-600">Eenheid: {product.unit}</span>
                    </div>
                    {product.ean && (
                      <div className="mt-2 text-xs text-gray-500 truncate" title={product.ean}>EAN: {product.ean}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'locaties' && (
            <div className="space-y-4">
              {canManage && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowAddLocationModal(true)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
                  >
                    <Plus size={18} />
                    Locatie Toevoegen
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {locations.map((location) => (
                  <div
                    key={location.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => handleViewLocationDetails(location)}
                  >
                    <div className="flex items-start gap-3 mb-2">
                      {location.type === 'bus' ? (
                        <Truck className="text-blue-600" size={24} />
                      ) : (
                        <Warehouse className="text-green-600" size={24} />
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{location.name}</h3>
                        {location.license_plate && (
                          <p className="text-sm text-gray-600">{location.license_plate}</p>
                        )}
                      </div>
                    </div>
                    {location.description && (
                      <p className="text-sm text-gray-500 mt-2">{location.description}</p>
                    )}
                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                          {stock.filter(s => s.location_id === location.id).length} producten
                        </div>
                        {canManage && (
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleEditLocation(location)}
                              className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                              title="Bewerk locatie"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteLocation(location.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Verwijder locatie"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                      {canManage && (
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => exportLocationToCSV(location)}
                            className="flex-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 flex items-center justify-center gap-1"
                          >
                            <Download size={14} />
                            Export
                          </button>
                          <button
                            onClick={() => handleImportLocation(location.id)}
                            className="flex-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 flex items-center justify-center gap-1"
                          >
                            <Upload size={14} />
                            Import
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showEditModal && editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Bewerk Product: {editingProduct.name}</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Minimale Voorraad</label>
                  <input
                    type="number"
                    min="0"
                    value={editFormData.minimum_stock}
                    onChange={(e) => setEditFormData({ ...editFormData, minimum_stock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">EAN Code</label>
                  <input
                    type="text"
                    value={editFormData.ean}
                    onChange={(e) => setEditFormData({ ...editFormData, ean: e.target.value })}
                    placeholder="EAN barcode"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inkoopprijs (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editFormData.purchase_price}
                    onChange={(e) => setEditFormData({ ...editFormData, purchase_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Verkoopprijs (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editFormData.sale_price}
                    onChange={(e) => setEditFormData({ ...editFormData, sale_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Leverancier</label>
                  <input
                    type="text"
                    value={editFormData.supplier}
                    onChange={(e) => setEditFormData({ ...editFormData, supplier: e.target.value })}
                    placeholder="Leverancier naam"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Voorraad per Locatie</h3>
                <div className="space-y-2">
                  {productStockByLocation.map((stockItem) => (
                    <div key={stockItem.location_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        {stockItem.location?.type === 'bus' ? <Truck size={18} /> : <Warehouse size={18} />}
                        <span className="font-medium">{stockItem.location?.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateStockQuantity(stockItem.location_id, stockItem.quantity - 1)}
                          className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={stockItem.quantity}
                          onChange={(e) => updateStockQuantity(stockItem.location_id, parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-center border border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-600">{editingProduct.unit}</span>
                        <button
                          onClick={() => updateStockQuantity(stockItem.location_id, stockItem.quantity + 1)}
                          className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleSaveProductEdit}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Opslaan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showStockEditModal && editingStock && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Bewerk Voorraad</h2>
              <button onClick={() => setShowStockEditModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Productnaam</label>
                <input
                  type="text"
                  value={stockEditFormData.product_name}
                  onChange={(e) => setStockEditFormData({ ...stockEditFormData, product_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aantal in Voorraad</label>
                <input
                  type="number"
                  min="0"
                  value={stockEditFormData.quantity}
                  onChange={(e) => setStockEditFormData({ ...stockEditFormData, quantity: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Minimale Voorraad</label>
                <input
                  type="number"
                  min="0"
                  value={stockEditFormData.minimum_stock}
                  onChange={(e) => setStockEditFormData({ ...stockEditFormData, minimum_stock: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">EAN Code</label>
                <input
                  type="text"
                  value={stockEditFormData.ean}
                  onChange={(e) => setStockEditFormData({ ...stockEditFormData, ean: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inkoopprijs (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={stockEditFormData.purchase_price}
                    onChange={(e) => setStockEditFormData({ ...stockEditFormData, purchase_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Verkoopprijs (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={stockEditFormData.sale_price}
                    onChange={(e) => setStockEditFormData({ ...stockEditFormData, sale_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Locatie</label>
                <select
                  value={stockEditFormData.location_id}
                  onChange={(e) => setStockEditFormData({ ...stockEditFormData, location_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleDeleteProductConfirm(editingStock.product_id)}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 flex items-center gap-2"
                >
                  <Trash2 size={18} />
                  Verwijder Product
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowStockEditModal(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  >
                    Annuleren
                  </button>
                  <button
                    onClick={handleSaveStockEdit}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Opslaan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddLocationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Nieuwe Locatie Toevoegen</h2>
              <button onClick={() => setShowAddLocationModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Naam *</label>
                <input
                  type="text"
                  value={newLocationData.name}
                  onChange={(e) => setNewLocationData({ ...newLocationData, name: e.target.value })}
                  placeholder="Bijv. Magazijn A, Bus 1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select
                  value={newLocationData.type}
                  onChange={(e) => setNewLocationData({ ...newLocationData, type: e.target.value as 'magazijn' | 'bus' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="magazijn">Magazijn</option>
                  <option value="bus">Bus</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kenteken (optioneel)</label>
                <input
                  type="text"
                  value={newLocationData.license_plate}
                  onChange={(e) => setNewLocationData({ ...newLocationData, license_plate: e.target.value })}
                  placeholder="Bijv. XX-123-YY"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beschrijving (optioneel)</label>
                <textarea
                  value={newLocationData.description}
                  onChange={(e) => setNewLocationData({ ...newLocationData, description: e.target.value })}
                  rows={3}
                  placeholder="Extra informatie over deze locatie"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowAddLocationModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleAddLocation}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Toevoegen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLocationDetailsModal && selectedLocationForDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-3">
                {selectedLocationForDetails.type === 'bus' ? <Truck size={24} className="text-blue-600" /> : <Warehouse size={24} className="text-green-600" />}
                <h2 className="text-xl font-bold text-gray-900">{selectedLocationForDetails.name}</h2>
              </div>
              <button onClick={() => setShowLocationDetailsModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-gray-200">
                <div>
                  <label className="text-sm font-medium text-gray-500">Type</label>
                  <p className="text-gray-900">{selectedLocationForDetails.type === 'bus' ? 'Bus' : 'Magazijn'}</p>
                </div>
                {selectedLocationForDetails.license_plate && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Kenteken</label>
                    <p className="text-gray-900">{selectedLocationForDetails.license_plate}</p>
                  </div>
                )}
              </div>

              {selectedLocationForDetails.description && (
                <div className="pb-4 border-b border-gray-200">
                  <label className="text-sm font-medium text-gray-500">Beschrijving</label>
                  <p className="text-gray-900">{selectedLocationForDetails.description}</p>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Voorraad op deze locatie</h3>
                {stock.filter(s => s.location_id === selectedLocationForDetails.id).length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Geen voorraad op deze locatie</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Voorraad</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Min.</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acties</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {stock.filter(s => s.location_id === selectedLocationForDetails.id).map((item) => {
                          const isLow = item.quantity < (item.product?.minimum_stock || 0);
                          return (
                            <tr key={item.product_id} className={isLow ? 'bg-yellow-50' : ''}>
                              <td className="px-4 py-3 text-sm text-gray-900">{item.product?.name}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{item.product?.sku}</td>
                              <td className="px-4 py-3 text-sm text-right font-medium">
                                {item.quantity} {item.product?.unit}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-600">
                                {item.product?.minimum_stock}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {isLow ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                    Laag
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    OK
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleEditStock(item)}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                    title="Bewerk voorraad"
                                  >
                                    <Edit size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowLocationDetailsModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Sluiten
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditLocationModal && editingLocation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Bewerk Locatie</h2>
              <button onClick={() => setShowEditLocationModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Naam *</label>
                <input
                  type="text"
                  value={editLocationData.name}
                  onChange={(e) => setEditLocationData({ ...editLocationData, name: e.target.value })}
                  placeholder="Bijv. Magazijn A, Bus 1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select
                  value={editLocationData.type}
                  onChange={(e) => setEditLocationData({ ...editLocationData, type: e.target.value as 'magazijn' | 'bus' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="magazijn">Magazijn</option>
                  <option value="bus">Bus</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kenteken (optioneel)</label>
                <input
                  type="text"
                  value={editLocationData.license_plate}
                  onChange={(e) => setEditLocationData({ ...editLocationData, license_plate: e.target.value })}
                  placeholder="Bijv. XX-123-YY"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beschrijving (optioneel)</label>
                <textarea
                  value={editLocationData.description}
                  onChange={(e) => setEditLocationData({ ...editLocationData, description: e.target.value })}
                  rows={3}
                  placeholder="Extra informatie over deze locatie"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowEditLocationModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleSaveLocationEdit}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Opslaan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImportLocationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Importeer Producten</h2>
              <button onClick={() => setShowImportLocationModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">CSV Formaat</h3>
                <p className="text-sm text-blue-800 mb-2">Het CSV bestand moet de volgende kolommen bevatten:</p>
                <code className="text-xs bg-blue-100 px-2 py-1 rounded block">
                  SKU,Naam,Materiaal groep,Voorraad
                </code>
                <p className="text-sm text-blue-700 mt-2">Voorbeeld:</p>
                <code className="text-xs bg-blue-100 px-2 py-1 rounded block">
                  SKU001,Product Naam,Cement,10
                </code>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecteer CSV Bestand
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleImportCSV}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  Let op: Producten die al bestaan op deze locatie worden bijgewerkt met de nieuwe aantallen (opgeteld).
                </p>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowImportLocationModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Sluiten
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-900">Product Toevoegen</h2>
              <button onClick={closeAddProductModal} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Photo Upload Section */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                <input
                  type="file"
                  id="product-photo"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setNewProductPhoto(file);
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setNewProductPhotoPreview(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                />

                {showCamera ? (
                  /* Camera Preview */
                  <div className="space-y-3">
                    <div className="relative bg-black rounded-lg overflow-hidden">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full max-h-80 object-contain"
                      />
                    </div>
                    <div className="flex gap-2 justify-center">
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
                      >
                        <Camera size={18} />
                        Foto Maken
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                      >
                        Annuleren
                      </button>
                    </div>
                  </div>
                ) : newProductPhotoPreview ? (
                  /* Photo Preview */
                  <div className="space-y-3">
                    <div className="relative">
                      <img src={newProductPhotoPreview} alt="Preview" className="mx-auto max-h-60 rounded" />
                      <button
                        type="button"
                        onClick={() => {
                          setNewProductPhoto(null);
                          setNewProductPhotoPreview(null);
                        }}
                        className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 hover:bg-red-700 shadow-lg"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Upload Options */
                  <div className="text-center space-y-4">
                    <ImageIcon size={48} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600 mb-4">Product Foto Toevoegen</p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <label htmlFor="product-photo" className="cursor-pointer px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center justify-center gap-2">
                        <Upload size={18} />
                        Bestand Kiezen
                      </label>
                      <button
                        type="button"
                        onClick={startCamera}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center justify-center gap-2"
                      >
                        <Camera size={18} />
                        Camera Gebruiken
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Materiaalomschrijving *</label>
                  <input
                    type="text"
                    value={newProductData.name}
                    onChange={(e) => setNewProductData({ ...newProductData, name: e.target.value })}
                    placeholder="Bijv. Vuren C geschaafd 44x70 FSC"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GB-art.nr.</label>
                  <input
                    type="text"
                    value={newProductData.gb_article_number}
                    onChange={(e) => setNewProductData({ ...newProductData, gb_article_number: e.target.value })}
                    placeholder="Bijv. 45x70-300"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
                  <input
                    type="text"
                    value={newProductData.sku}
                    onChange={(e) => setNewProductData({ ...newProductData, sku: e.target.value })}
                    placeholder="Bijv. CEM-001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">EAN-code</label>
                  <input
                    type="text"
                    value={newProductData.ean}
                    onChange={(e) => setNewProductData({ ...newProductData, ean: e.target.value })}
                    placeholder="37215133001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Materiaal groep</label>
                  <select
                    value={newProductData.category}
                    onChange={(e) => setNewProductData({ ...newProductData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="">Selecteer materiaal groep</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Eenheid</label>
                  <input
                    type="text"
                    value={newProductData.unit}
                    onChange={(e) => setNewProductData({ ...newProductData, unit: e.target.value })}
                    placeholder="Bijv. stuk, doosje, kg, m"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min. voorraad</label>
                  <input
                    type="number"
                    min="0"
                    value={newProductData.minimum_stock}
                    onChange={(e) => setNewProductData({ ...newProductData, minimum_stock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Leverancier</label>
                  <input
                    type="text"
                    value={newProductData.supplier}
                    onChange={(e) => setNewProductData({ ...newProductData, supplier: e.target.value })}
                    placeholder="Bijv. Stiho, Berner"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lev.art.nr.</label>
                  <input
                    type="text"
                    value={newProductData.supplier_article_number}
                    onChange={(e) => setNewProductData({ ...newProductData, supplier_article_number: e.target.value })}
                    placeholder="Bijv. 160740"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">€/eenh (prijs per eenheid)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newProductData.price_per_unit}
                    onChange={(e) => setNewProductData({ ...newProductData, price_per_unit: parseFloat(e.target.value) || 0 })}
                    placeholder="5.13"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inkoopprijs (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newProductData.purchase_price}
                    onChange={(e) => setNewProductData({ ...newProductData, purchase_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Verkoopprijs (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newProductData.sale_price}
                    onChange={(e) => setNewProductData({ ...newProductData, sale_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beschrijving</label>
                <textarea
                  value={newProductData.description}
                  onChange={(e) => setNewProductData({ ...newProductData, description: e.target.value })}
                  rows={3}
                  placeholder="Extra informatie over dit product"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              {/* Initial Stock Section */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-md font-semibold text-gray-900 mb-3">Initiële Voorraad (optioneel)</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Voeg direct voorraad toe zodat het product in het overzicht verschijnt. Je kunt dit ook later doen.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Locatie</label>
                    <select
                      value={initialStockLocation}
                      onChange={(e) => setInitialStockLocation(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    >
                      <option value="">Geen (later toevoegen)</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name} ({location.type})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Aantal</label>
                    <input
                      type="number"
                      min="0"
                      value={initialStockQuantity}
                      onChange={(e) => setInitialStockQuantity(parseInt(e.target.value) || 0)}
                      placeholder="0"
                      disabled={!initialStockLocation}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
                {initialStockLocation && initialStockQuantity > 0 && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-800">
                      ✓ Product wordt toegevoegd met {initialStockQuantity} stuks op {locations.find(l => l.id === initialStockLocation)?.name}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={closeAddProductModal}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleAddProduct}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Product Toevoegen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && productToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Product Verwijderen</h2>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Weet je zeker dat je dit product wilt verwijderen? Dit verwijdert ook alle voorraad van dit product.
              </p>
              <p className="text-red-600 font-semibold">Deze actie kan niet ongedaan worden gemaakt.</p>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setProductToDelete(null);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Annuleren
              </button>
              <button
                onClick={() => handleDeleteProduct(productToDelete)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Ja, Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}

      {showMoveStockModal && moveStockData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Voorraad Verplaatsen</h2>
              <button onClick={() => {
                setShowMoveStockModal(false);
                setMoveStockData(null);
              }} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Product</p>
                <p className="font-semibold text-gray-900">{moveStockData.productName}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-2">Van Locatie</p>
                <p className="font-semibold text-gray-900">
                  {locations.find(l => l.id === moveStockData.fromLocationId)?.name || 'Onbekend'}
                </p>
                <p className="text-sm text-gray-500">
                  Beschikbaar: {moveStockData.maxQuantity} stuks
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Naar Locatie *
                </label>
                <select
                  value={moveStockData.toLocationId}
                  onChange={(e) => setMoveStockData({ ...moveStockData, toLocationId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">Selecteer locatie</option>
                  {locations
                    .filter(l => l.id !== moveStockData.fromLocationId)
                    .map(location => (
                      <option key={location.id} value={location.id}>
                        {location.type === 'bus' ? '🚚' : '🏢'} {location.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hoeveelheid *
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMoveStockData({
                      ...moveStockData,
                      quantity: Math.max(1, moveStockData.quantity - 1)
                    })}
                    className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={moveStockData.maxQuantity}
                    value={moveStockData.quantity}
                    onChange={(e) => setMoveStockData({
                      ...moveStockData,
                      quantity: Math.min(moveStockData.maxQuantity, Math.max(1, parseInt(e.target.value) || 1))
                    })}
                    className="flex-1 px-3 py-2 text-center border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                  <button
                    onClick={() => setMoveStockData({
                      ...moveStockData,
                      quantity: Math.min(moveStockData.maxQuantity, moveStockData.quantity + 1)
                    })}
                    className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    +
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Max: {moveStockData.maxQuantity} stuks
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowMoveStockModal(false);
                  setMoveStockData(null);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Annuleren
              </button>
              <button
                onClick={handleMoveStock}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
              >
                <ArrowRightLeft size={18} />
                Verplaatsen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Weet je het zeker?</h3>
            <p className="text-gray-600 mb-6">
              Je staat op het punt om {selectedStockIds.size} voorraad item(s) permanent te verwijderen.
              Deze actie kan niet ongedaan worden gemaakt.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
              <p className="text-sm text-yellow-800 font-medium">
                Dit is een tweede waarschuwing. Weet je zeker dat je wilt doorgaan?
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Nee, Annuleren
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Ja, Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Location Change Modal */}
      {showBulkLocationChange && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Locatie Wijzigen</h3>
              <button
                onClick={() => {
                  setShowBulkLocationChange(false);
                  setBulkNewLocationId('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            <p className="text-gray-600 mb-4">
              Selecteer de nieuwe locatie voor {selectedStockIds.size} geselecteerde item(s).
            </p>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nieuwe Locatie *
              </label>
              <select
                value={bulkNewLocationId}
                onChange={(e) => setBulkNewLocationId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">Selecteer locatie</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBulkLocationChange(false);
                  setBulkNewLocationId('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Annuleren
              </button>
              <button
                onClick={handleBulkLocationChangeSubmit}
                disabled={!bulkNewLocationId}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Doorgaan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Location Change Confirmation Modal */}
      {showBulkLocationConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Bevestig Locatie Wijziging</h3>
            <p className="text-gray-600 mb-6">
              Weet je zeker dat je {selectedStockIds.size} voorraad item(s) wilt verplaatsen naar de nieuwe locatie?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBulkLocationConfirm(false);
                  setBulkNewLocationId('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Nee, Annuleren
              </button>
              <button
                onClick={handleBulkLocationChangeConfirm}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Ja, Wijzigen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoorraadbeheerAdmin;
