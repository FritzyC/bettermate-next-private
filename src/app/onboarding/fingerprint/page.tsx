import React, { Suspense } from 'react';
import FingerprintClient from './FingerprintClient';

export const dynamic = 'force-dynamic'

export default function FingerprintPage() {
  return (
    <Suspense fallback={null}>
      <FingerprintClient />
    </Suspense>
  );
}
