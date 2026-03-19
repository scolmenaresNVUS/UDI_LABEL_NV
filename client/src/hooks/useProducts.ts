import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import type { Product } from '../types/product.types';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/products');
      setProducts(res.data);
      setError(null);
    } catch {
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  const seedProducts = async () => {
    try {
      await api.post('/products/seed');
      await fetchProducts();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to seed';
      setError(msg);
    }
  };

  const createProduct = async (data: Omit<Product, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => {
    await api.post('/products', data);
    await fetchProducts();
  };

  const updateProduct = async (id: string, data: Partial<Omit<Product, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>>) => {
    await api.put(`/products/${id}`, data);
    await fetchProducts();
  };

  const deleteProduct = async (id: string) => {
    await api.delete(`/products/${id}`);
    await fetchProducts();
  };

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  return { products, loading, error, refresh: fetchProducts, seedProducts, createProduct, updateProduct, deleteProduct };
}
