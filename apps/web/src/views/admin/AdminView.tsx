'use client';

import { useState } from 'react';
import { PageHeader, SegmentedControl } from '@/components/ui';
import { OverviewTab } from './OverviewTab';
import { PlayersTab } from './PlayersTab';
import { ProductsTab } from './ProductsTab';
import { PurchasesTab } from './PurchasesTab';

const SECTIONS = {
  overview: { label: 'Overview', Component: OverviewTab },
  products: { label: 'Products', Component: ProductsTab },
  players: { label: 'Players', Component: PlayersTab },
  purchases: { label: 'Purchases', Component: PurchasesTab },
};

type Section = keyof typeof SECTIONS;

export function AdminView() {
  const [section, setSection] = useState<Section>('overview');
  const { Component } = SECTIONS[section];

  return (
    <div>
      <PageHeader title="Admin" subtitle="Manage the catalog, player balances and purchases." />
      <div className="mb-6">
        <SegmentedControl
          label="Admin section"
          options={(Object.keys(SECTIONS) as Section[]).map((value) => ({ value, label: SECTIONS[value].label }))}
          value={section}
          onChange={setSection}
        />
      </div>
      <Component />
    </div>
  );
}
