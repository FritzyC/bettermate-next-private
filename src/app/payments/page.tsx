'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import PaymentCheckout from '@/components/PaymentCheckout';

export default function PaymentsPage() {
  const { user, session, loading } = useAuth();

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!session) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Not authenticated</h1>
          <a href="/login" className="text-blue-600 hover:underline">
            Go to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold mb-2">Long-Distance Fee</h1>
        <p className="text-gray-600 mb-6">
          Pay for your long-distance match connection
        </p>

        <PaymentCheckout
          matchId="a2de324f-5049-43ab-8057-9f7bb8b64408"
          daysCount={7}
          token={session.access_token}
          onSuccess={() => {
            alert('Payment successful!');
            window.location.href = '/matches';
          }}
        />
      </div>
    </div>
  );
}
