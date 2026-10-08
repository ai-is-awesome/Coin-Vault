'use client';

import { useState, type FormEvent } from 'react';
import { useToast } from '@/components/Toaster';
import { Alert, Button, Field, Input, Select, TextArea } from '@/components/ui';
import { errorMessage, validationErrors } from '@/lib/api';
import { CATEGORY_SINGULAR, RARITY_STYLES } from '@/lib/format';
import { useSaveProduct } from '@/lib/queries';
import { PRODUCT_CATEGORIES, RARITIES, type Product, type ProductCategory, type Rarity } from '@/lib/types';

/** Create (product = null) or edit a product. Edits send only the fields the form manages. */
export function ProductForm({ product, onDone }: { product: Product | null; onDone: () => void }) {
  const save = useSaveProduct();
  const toast = useToast();
  const [form, setForm] = useState({
    sku: product?.sku ?? '',
    name: product?.name ?? '',
    description: product?.description ?? '',
    category: product?.category ?? ('SKIN' as ProductCategory),
    rarity: product?.rarity ?? ('COMMON' as Rarity),
    priceCoins: String(product?.priceCoins ?? ''),
    imageUrl: product?.imageUrl ?? '',
  });
  const errors = validationErrors(save.error);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      {
        id: product?.id,
        data: { ...form, priceCoins: Number(form.priceCoins), imageUrl: form.imageUrl.trim() || null },
      },
      {
        onSuccess: () => {
          toast(product ? 'Product updated' : 'Product created');
          onDone();
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Field label="SKU" error={errors.sku}>
          <Input value={form.sku} onChange={set('sku')} placeholder="SKN-MY-ITEM" />
        </Field>
        <Field label="Price (coins)" error={errors.priceCoins}>
          <Input type="number" min={1} step={1} value={form.priceCoins} onChange={set('priceCoins')} />
        </Field>
      </div>
      <Field label="Name" error={errors.name}>
        <Input value={form.name} onChange={set('name')} />
      </Field>
      <Field label="Description" error={errors.description}>
        <TextArea rows={3} value={form.description} onChange={set('description')} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <Select value={form.category} onChange={set('category')}>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_SINGULAR[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Rarity">
          <Select value={form.rarity} onChange={set('rarity')}>
            {RARITIES.map((r) => (
              <option key={r} value={r}>
                {RARITY_STYLES[r].label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Image URL (optional, https)" error={errors.imageUrl}>
        <Input value={form.imageUrl} onChange={set('imageUrl')} placeholder="https://..." />
      </Field>
      {save.isError && Object.keys(errors).length === 0 && <Alert>{errorMessage(save.error)}</Alert>}
      <Button type="submit" className="w-full" loading={save.isPending}>
        {product ? 'Save changes' : 'Create product'}
      </Button>
    </form>
  );
}
