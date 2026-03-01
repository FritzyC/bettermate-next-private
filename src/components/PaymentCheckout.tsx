'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
);

interface PaymentCheckoutProps {
  matchId: string;
  daysCount: number;
  token: string;
  onSuccess?: () => void;
}

function CheckoutForm({
  matchId,
  daysCount,
  token,
  onSuccess,
}: PaymentCheckoutProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);

  const handleCreateIntent = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          match_id: matchId,
          days_count: daysCount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create payment intent');
      }

      setClientSecret(data.data.client_secret);
      setAmount(data.data.amount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || !clientSecret) {
      setError('Stripe not loaded');
      return;
    }

    setLoading(true);
    setError(null);

    const cardElement = elements.getElement(CardElement);

    if (!cardElement) {
      setError('Card element not found');
      setLoading(false);
      return;
    }

    try {
      const { error: stripeError, paymentIntent } =
        await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: 'Customer',
            },
          },
        });

      if (stripeError) {
        setError(stripeError.message || 'Payment failed');
        setLoading(false);
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        setSuccess(true);
        console.log('✅ Payment succeeded:', paymentIntent.id);
        onSuccess?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center p-6 bg-green-50 border border-green-200 rounded-lg">
        <h3 className="text-xl font-bold text-green-800 mb-2">
          Payment Successful!
        </h3>
        <p className="text-green-700">
          Your long-distance fee has been processed. Your subscription is now active.
        </p>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-bold text-blue-900 mb-2">Long-Distance Fee</h3>
          <p className="text-blue-800 mb-4">
            ${(0.99 * daysCount).toFixed(2)} for {daysCount} days @ $0.99/day
          </p>
          <button
            onClick={handleCreateIntent}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Continue to Payment'}
          </button>
        </div>
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-sm font-semibold text-gray-700 mb-1">Amount</p>
        <p className="text-2xl font-bold text-gray-900">${amount?.toFixed(2)}</p>
        <p className="text-xs text-gray-600 mt-1">
          {daysCount} days @ $0.99/day
        </p>
      </div>

      <div className="p-4 border border-gray-300 rounded-lg bg-white">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
              invalid: {
                color: '#9e2146',
              },
            },
          }}
        />
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded disabled:opacity-50"
      >
        {loading ? 'Processing...' : `Pay $${amount?.toFixed(2)}`}
      </button>

      <p className="text-xs text-gray-600 text-center">
        Test card: 4242 4242 4242 4242 | Any future date | Any 3-digit CVC
      </p>
    </form>
  );
}

export default function PaymentCheckout({
  matchId,
  daysCount,
  token,
  onSuccess,
}: PaymentCheckoutProps) {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm
        matchId={matchId}
        daysCount={daysCount}
        token={token}
        onSuccess={onSuccess}
      />
    </Elements>
  );
}
