import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ProductCategory } from '../types';

const CategoryManagement: React.FC = () => {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Category form states
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({ name: '', description: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      if (data) setCategories(data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Category functions
  const handleSaveCategory = async () => {
    if (!categoryFormData.name.trim()) {
      alert('Categorie naam is verplicht');
      return;
    }

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('product_categories')
          .update({
            name: categoryFormData.name.trim(),
            description: categoryFormData.description.trim() || null
          })
          .eq('id', editingCategory.id);

        if (error) throw error;
        alert('Categorie bijgewerkt!');
      } else {
        const { error } = await supabase
          .from('product_categories')
          .insert({
            name: categoryFormData.name.trim(),
            description: categoryFormData.description.trim() || null
          });

        if (error) throw error;
        alert('Categorie toegevoegd!');
      }

      setShowCategoryForm(false);
      setEditingCategory(null);
      setCategoryFormData({ name: '', description: '' });
      loadData();
    } catch (error: any) {
      console.error('Error saving category:', error);
      alert(error.message || 'Fout bij opslaan categorie');
    }
  };

  const handleEditCategory = (category: ProductCategory) => {
    setEditingCategory(category);
    setCategoryFormData({ name: category.name, description: category.description || '' });
    setShowCategoryForm(true);
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze categorie wilt verwijderen?')) return;

    try {
      const { error } = await supabase
        .from('product_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Categorie verwijderd!');
      loadData();
    } catch (error: any) {
      console.error('Error deleting category:', error);
      alert(error.message || 'Fout bij verwijderen. Mogelijk zijn er nog producten gekoppeld aan deze categorie.');
    }
  };

  const handleToggleCategoryActive = async (category: ProductCategory) => {
    try {
      const { error } = await supabase
        .from('product_categories')
        .update({ is_active: !category.is_active })
        .eq('id', category.id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error toggling category:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Product Categories Section */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Product Categorieën</h2>
              <p className="text-sm text-gray-600 mt-1">Beheer de beschikbare product categorieën</p>
            </div>
            <button
              onClick={() => {
                setEditingCategory(null);
                setCategoryFormData({ name: '', description: '' });
                setShowCategoryForm(true);
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
            >
              <Plus size={18} />
              Nieuwe Categorie
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => (
              <div
                key={category.id}
                className={`border rounded-lg p-4 ${category.is_active ? 'border-gray-300' : 'border-gray-200 bg-gray-50 opacity-60'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{category.name}</h3>
                    {category.description && (
                      <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditCategory(category)}
                      className="text-blue-600 hover:text-blue-700"
                      title="Bewerken"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="text-red-600 hover:text-red-700"
                      title="Verwijderen"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={category.is_active}
                      onChange={() => handleToggleCategoryActive(category)}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-sm text-gray-700">
                      {category.is_active ? 'Actief' : 'Inactief'}
                    </span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category Form Modal */}
      {showCategoryForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {editingCategory ? 'Categorie Bewerken' : 'Nieuwe Categorie'}
              </h2>
              <button
                onClick={() => {
                  setShowCategoryForm(false);
                  setEditingCategory(null);
                  setCategoryFormData({ name: '', description: '' });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Naam *</label>
                <input
                  type="text"
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  placeholder="Bijv. Bouwmaterialen"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beschrijving</label>
                <textarea
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                  rows={3}
                  placeholder="Optionele beschrijving"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCategoryForm(false);
                  setEditingCategory(null);
                  setCategoryFormData({ name: '', description: '' });
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Annuleren
              </button>
              <button
                onClick={handleSaveCategory}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
              >
                <Save size={18} />
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryManagement;
