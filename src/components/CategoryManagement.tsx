import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ProductCategory, MaterialGroup } from '../types';

const CategoryManagement: React.FC = () => {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [materialGroups, setMaterialGroups] = useState<MaterialGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Category form states
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({ name: '', description: '' });

  // Material group form states
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<MaterialGroup | null>(null);
  const [groupFormData, setGroupFormData] = useState({ code: '', name: '', description: '', sort_order: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [categoriesRes, groupsRes] = await Promise.all([
        supabase.from('product_categories').select('*').order('name'),
        supabase.from('material_groups').select('*').order('sort_order')
      ]);

      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (groupsRes.data) setMaterialGroups(groupsRes.data);
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

  // Material group functions
  const handleSaveGroup = async () => {
    if (!groupFormData.code.trim() || !groupFormData.name.trim()) {
      alert('Code en naam zijn verplicht');
      return;
    }

    try {
      if (editingGroup) {
        const { error } = await supabase
          .from('material_groups')
          .update({
            code: groupFormData.code.trim(),
            name: groupFormData.name.trim(),
            description: groupFormData.description.trim() || null,
            sort_order: groupFormData.sort_order
          })
          .eq('id', editingGroup.id);

        if (error) throw error;
        alert('Materiaalgroep bijgewerkt!');
      } else {
        const { error } = await supabase
          .from('material_groups')
          .insert({
            code: groupFormData.code.trim(),
            name: groupFormData.name.trim(),
            description: groupFormData.description.trim() || null,
            sort_order: groupFormData.sort_order
          });

        if (error) throw error;
        alert('Materiaalgroep toegevoegd!');
      }

      setShowGroupForm(false);
      setEditingGroup(null);
      setGroupFormData({ code: '', name: '', description: '', sort_order: 0 });
      loadData();
    } catch (error: any) {
      console.error('Error saving group:', error);
      alert(error.message || 'Fout bij opslaan materiaalgroep');
    }
  };

  const handleEditGroup = (group: MaterialGroup) => {
    setEditingGroup(group);
    setGroupFormData({
      code: group.code,
      name: group.name,
      description: group.description || '',
      sort_order: group.sort_order
    });
    setShowGroupForm(true);
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze materiaalgroep wilt verwijderen?')) return;

    try {
      const { error } = await supabase
        .from('material_groups')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Materiaalgroep verwijderd!');
      loadData();
    } catch (error: any) {
      console.error('Error deleting group:', error);
      alert(error.message || 'Fout bij verwijderen. Mogelijk zijn er nog producten gekoppeld aan deze groep.');
    }
  };

  const handleToggleGroupActive = async (group: MaterialGroup) => {
    try {
      const { error } = await supabase
        .from('material_groups')
        .update({ is_active: !group.is_active })
        .eq('id', group.id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error toggling group:', error);
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

      {/* Material Groups Section */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Materiaalgroepen</h2>
              <p className="text-sm text-gray-600 mt-1">Beheer de beschikbare materiaalgroepen (01-10)</p>
            </div>
            <button
              onClick={() => {
                setEditingGroup(null);
                const nextCode = String(materialGroups.length + 1).padStart(2, '0');
                setGroupFormData({ code: nextCode, name: '', description: '', sort_order: materialGroups.length + 1 });
                setShowGroupForm(true);
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
            >
              <Plus size={18} />
              Nieuwe Materiaalgroep
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {materialGroups.map((group) => (
              <div
                key={group.id}
                className={`border rounded-lg p-4 ${group.is_active ? 'border-gray-300' : 'border-gray-200 bg-gray-50 opacity-60'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">
                      {group.code} - {group.name}
                    </h3>
                    {group.description && (
                      <p className="text-sm text-gray-600 mt-1">{group.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditGroup(group)}
                      className="text-blue-600 hover:text-blue-700"
                      title="Bewerken"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
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
                      checked={group.is_active}
                      onChange={() => handleToggleGroupActive(group)}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-sm text-gray-700">
                      {group.is_active ? 'Actief' : 'Inactief'}
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

      {/* Material Group Form Modal */}
      {showGroupForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {editingGroup ? 'Materiaalgroep Bewerken' : 'Nieuwe Materiaalgroep'}
              </h2>
              <button
                onClick={() => {
                  setShowGroupForm(false);
                  setEditingGroup(null);
                  setGroupFormData({ code: '', name: '', description: '', sort_order: 0 });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                  <input
                    type="text"
                    value={groupFormData.code}
                    onChange={(e) => setGroupFormData({ ...groupFormData, code: e.target.value })}
                    placeholder="Bijv. 01"
                    maxLength={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sorteervolgorde</label>
                  <input
                    type="number"
                    value={groupFormData.sort_order}
                    onChange={(e) => setGroupFormData({ ...groupFormData, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Naam *</label>
                <input
                  type="text"
                  value={groupFormData.name}
                  onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                  placeholder="Bijv. Diversen"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beschrijving</label>
                <textarea
                  value={groupFormData.description}
                  onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                  rows={3}
                  placeholder="Optionele beschrijving"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowGroupForm(false);
                  setEditingGroup(null);
                  setGroupFormData({ code: '', name: '', description: '', sort_order: 0 });
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Annuleren
              </button>
              <button
                onClick={handleSaveGroup}
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
